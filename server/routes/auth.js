const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { User } = require('../models');
const crypto = require('crypto');
const tokenService = require('../services/tokenService');
const logger = require('../utils/logger/logger');
const { auditLog } = require('../utils/logger/auditLogger');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const Redis = require('ioredis');
const AppError = require('../utils/errors/AppError');

// Redis接続
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_AUTH_DB || 1,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  maxRetriesPerRequest: 3
});

// 認証関連のレート制限
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 最大5回
  message: {
    error: 'Too many authentication attempts',
    retryAfter: 15 * 60 * 1000
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `auth_rate_limit:${req.ip}:${req.path}`,
  handler: (req, res) => {
    auditLog('auth_rate_limit_exceeded', null, req.ip, {
      path: req.path,
      userAgent: req.get('user-agent')
    });
    res.status(429).json({
      error: 'Too many authentication attempts',
      retryAfter: 15 * 60 * 1000
    });
  }
});

// スロー制限
const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: 500,
  maxDelayMs: 5000
});

// Ensure JWT_SECRET is set
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined.');
  process.exit(1);
}

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
 '/register',
 [
   check('name', '名前は必須です').not().isEmpty(),
   check('email', '有効なメールアドレスを入力してください').isEmail(),
   check('password', 'パスワードは6文字以上必要です').isLength({ min: 6 })
 ],
 async (req, res) => {
   const errors = validationResult(req);
   if (!errors.isEmpty()) {
     return res.status(400).json({ errors: errors.array() });
   }

   const { name, email, password } = req.body;

   try {
     // ユーザー存在チェック
     let user = await User.findOne({ where: { email } });

     if (user) {
       return res.status(400).json({ message: 'このメールアドレスは既に登録されています' });
     }

     // ユーザー作成
     user = await User.create({
       name,
       email,
       password // bcryptはbeforeCreateフックで処理
     });

     const payload = {
       user: {
         id: user.id
       },
       role: user.role // ロール情報を追加
     };

     // アクセストークン（短期）とリフレッシュトークン（長期）の生成
     const accessToken = jwt.sign(
       payload,
       process.env.JWT_SECRET,
       { expiresIn: '15m' }
     );
     
     const refreshToken = jwt.sign(
       { ...payload, type: 'refresh', jti: crypto.randomUUID() },
       process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
       { expiresIn: '7d' }
     );

     // CSRFトークンの生成
     const csrfToken = crypto.randomBytes(32).toString('hex');

     // HTTPOnly Cookieの設定
     const cookieOptions = {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'strict',
       maxAge: 7 * 24 * 60 * 60 * 1000 // 7日間
     };

     // リフレッシュトークンをCookieに設定
     res.cookie('refreshToken', refreshToken, cookieOptions);
     
     // CSRFトークンを読み取り可能なCookieに設定
     res.cookie('csrfToken', csrfToken, {
       ...cookieOptions,
       httpOnly: false // JavaScriptから読み取り可能
     });

     res.json({ 
       accessToken, 
       csrfToken,
       user: { 
         id: user.id, 
         name: user.name, 
         email: user.email,
         role: user.role
       } 
     });
   } catch (err) {
     console.error("Login error:", err);
     res.status(500).send('サーバーエラーが発生しました');
   }
 }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
 '/login',
 authRateLimit,
 authSlowDown,
 [
   check('email', 'メールアドレスを入力してください').isEmail().normalizeEmail(),
   check('password', 'パスワードは必須です').exists().isLength({ min: 1 })
 ],
 async (req, res) => {
   const requestId = crypto.randomUUID();
   const startTime = Date.now();
   
   logger.info('Login attempt started', {
     requestId,
     ip: req.ip,
     userAgent: req.get('user-agent')
   });

   const errors = validationResult(req);
   if (!errors.isEmpty()) {
     await auditLog('login_validation_failed', null, req.ip, {
       requestId,
       errors: errors.array(),
       userAgent: req.get('user-agent')
     });
     
     return res.status(400).json({ 
       errors: errors.array(),
       requestId
     });
   }

   const { email, password } = req.body;

   try {
     // ユーザー存在確認
     const user = await User.findOne({ where: { email } });

     if (!user) {
       await auditLog('login_user_not_found', null, req.ip, {
         requestId,
         email,
         userAgent: req.get('user-agent')
       });
       
       return res.status(400).json({ 
         message: 'メールアドレスまたはパスワードが正しくありません',
         requestId
       });
     }

     // アカウントロック確認
     if (user.isLocked) {
       await auditLog('login_account_locked', user.id, req.ip, {
         requestId,
         email,
         userAgent: req.get('user-agent')
       });
       
       return res.status(423).json({ 
         message: 'アカウントがロックされています',
         requestId
       });
     }

     // パスワード確認
     const isMatch = await user.matchPassword(password);

     if (!isMatch) {
       // 失敗試行回数を増加
       await incrementFailedAttempts(user);
       
       await auditLog('login_invalid_password', user.id, req.ip, {
         requestId,
         email,
         userAgent: req.get('user-agent')
       });
       
       return res.status(400).json({ 
         message: 'メールアドレスまたはパスワードが正しくありません',
         requestId
       });
     }

     // 成功時は失敗回数をリセット
     await resetFailedAttempts(user);

     // トークン生成
     const accessToken = await tokenService.generateAccessToken(user, {
       ip: req.ip,
       userAgent: req.get('user-agent')
     });

     const refreshToken = await tokenService.generateRefreshToken(user, {
       ip: req.ip,
       userAgent: req.get('user-agent')
     });

     // CSRFトークンの生成
     const csrfToken = crypto.randomBytes(32).toString('hex');

     // HTTPOnly Cookieの設定
     const cookieOptions = {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'strict',
       maxAge: 7 * 24 * 60 * 60 * 1000 // 7日間
     };

     // リフレッシュトークンをCookieに設定
     res.cookie('refreshToken', refreshToken, cookieOptions);
     
     // CSRFトークンを読み取り可能なCookieに設定
     res.cookie('csrfToken', csrfToken, {
       ...cookieOptions,
       httpOnly: false // JavaScriptから読み取り可能
     });

     // 最終ログイン時刻を更新
     await user.update({ lastLoginAt: new Date() });

     // 成功ログ
     await auditLog('login_success', user.id, req.ip, {
       requestId,
       email,
       userAgent: req.get('user-agent'),
       processingTime: Date.now() - startTime
     });

     logger.info('Login successful', {
       requestId,
       userId: user.id,
       email,
       processingTime: Date.now() - startTime
     });

     res.json({ 
       accessToken, 
       csrfToken,
       user: { 
         id: user.id, 
         name: user.name, 
         email: user.email,
         role: user.role
       },
       expiresIn: 15 * 60, // 15分
       requestId
     });
   } catch (err) {
     const errorId = crypto.randomUUID();
     
     logger.error('Login error', {
       requestId,
       errorId,
       error: err.message,
       stack: err.stack,
       ip: req.ip,
       userAgent: req.get('user-agent'),
       processingTime: Date.now() - startTime
     });

     await auditLog('login_error', null, req.ip, {
       requestId,
       errorId,
       error: err.message,
       userAgent: req.get('user-agent')
     });

     res.status(500).json({
       error: 'サーバーエラーが発生しました',
       requestId,
       errorId
     });
   }
 }
);

// @route   GET api/auth/me
// @desc    Get authenticated user
// @access  Private
router.get('/me', auth, async (req, res) => {
 try {
   const user = await User.findByPk(req.user.id, {
     attributes: { exclude: ['password'] }
   });
   
   if (!user) {
     return res.status(404).json({ message: 'ユーザーが見つかりません' });
   }
   
   res.json(user);
 } catch (err) {
   console.error("Login error:", err);
   res.status(500).send('サーバーエラーが発生しました');
 }
});

// @route   POST api/auth/refresh
// @desc    Refresh access token
// @access  Public (with refresh token)
router.post('/refresh', authRateLimit, async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  logger.info('Token refresh attempt started', {
    requestId,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  const { refreshToken } = req.cookies;
  
  if (!refreshToken) {
    await auditLog('token_refresh_missing', null, req.ip, {
      requestId,
      userAgent: req.get('user-agent')
    });
    
    return res.status(401).json({ 
      message: 'リフレッシュトークンがありません',
      requestId
    });
  }

  try {
    // トークンサービスを使用してリフレッシュ
    const tokens = await tokenService.refreshTokens(refreshToken, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // 新しいリフレッシュトークンをCookieに設定
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7日間
    };

    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    logger.info('Token refresh successful', {
      requestId,
      processingTime: Date.now() - startTime
    });

    res.json({ 
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      requestId
    });
  } catch (err) {
    const errorId = crypto.randomUUID();
    
    logger.error('Token refresh error', {
      requestId,
      errorId,
      error: err.message,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      processingTime: Date.now() - startTime
    });

    await auditLog('token_refresh_error', null, req.ip, {
      requestId,
      errorId,
      error: err.message,
      userAgent: req.get('user-agent')
    });

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        requestId,
        errorId
      });
    }

    res.status(401).json({
      error: '認証エラーが発生しました',
      requestId,
      errorId
    });
  }
});

// @route   POST api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', auth, async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    logger.info('Logout attempt started', {
      requestId,
      userId: req.user.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // リフレッシュトークンを取得
    const { refreshToken } = req.cookies;
    
    if (refreshToken) {
      try {
        // リフレッシュトークンを検証してJTIを取得
        const decoded = jwt.verify(
          refreshToken, 
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );
        
        // トークンを取り消し
        await tokenService.revokeToken(decoded.jti);
      } catch (tokenError) {
        logger.warn('Failed to revoke refresh token during logout', {
          requestId,
          error: tokenError.message
        });
      }
    }

    // アクセストークンも取り消し
    if (req.token && req.token.jti) {
      await tokenService.revokeToken(req.token.jti);
    }

    // Cookieをクリア
    res.clearCookie('refreshToken');
    res.clearCookie('csrfToken');
    res.clearCookie('sessionId');

    // 監査ログ
    await auditLog('logout_success', req.user.id, req.ip, {
      requestId,
      userAgent: req.get('user-agent'),
      processingTime: Date.now() - startTime
    });

    logger.info('Logout successful', {
      requestId,
      userId: req.user.id,
      processingTime: Date.now() - startTime
    });
    
    res.json({ 
      message: 'ログアウトしました',
      requestId
    });
  } catch (err) {
    const errorId = crypto.randomUUID();
    
    logger.error('Logout error', {
      requestId,
      errorId,
      error: err.message,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      processingTime: Date.now() - startTime
    });

    await auditLog('logout_error', req.user?.id, req.ip, {
      requestId,
      errorId,
      error: err.message,
      userAgent: req.get('user-agent')
    });

    res.status(500).json({
      error: 'サーバーエラーが発生しました',
      requestId,
      errorId
    });
  }
});

// ヘルパー関数
/**
 * ログイン失敗回数を増加
 */
async function incrementFailedAttempts(user) {
  try {
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updates = { failedLoginAttempts: failedAttempts };
    
    // 5回失敗でアカウントロック
    if (failedAttempts >= 5) {
      updates.isLocked = true;
      updates.lockedAt = new Date();
    }
    
    await user.update(updates);
  } catch (error) {
    logger.error('Failed to increment failed attempts', {
      userId: user.id,
      error: error.message
    });
  }
}

/**
 * ログイン失敗回数をリセット
 */
async function resetFailedAttempts(user) {
  try {
    if (user.failedLoginAttempts > 0 || user.isLocked) {
      await user.update({
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: null
      });
    }
  } catch (error) {
    logger.error('Failed to reset failed attempts', {
      userId: user.id,
      error: error.message
    });
  }
}

module.exports = router;