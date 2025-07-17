const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const authenticateUser = require('../middleware/auth');
const logger = require('../utils/logger/logger');
const { auditLog } = require('../utils/logger/auditLogger');
const AppError = require('../utils/errors/AppError');
const { Op } = require('sequelize');
const rateLimit = require('express-rate-limit');

// Sharegramからの認証リクエストを処理
router.post('/sso', rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 10, // 最大10リクエスト
  message: 'Too many SSO requests from this IP, please try again later.'
}), async (req, res) => {
  try {
    const { sharegram_user_id, email, name, timestamp, signature, return_url } = req.body;

    // 必須フィールドの検証
    if (!sharegram_user_id || !email || !timestamp || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // 署名検証
    const secretKey = process.env.SHAREGRAM_SECRET || 'default-secret';
    const data = `${sharegram_user_id}:${email}:${timestamp}`;
    const expectedSignature = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    // タイムスタンプ検証（5分以内）
    const now = Date.now();
    if (Math.abs(now - parseInt(timestamp)) > 300000) {
      return res.status(401).json({
        success: false,
        message: 'Request expired'
      });
    }

    // ユーザー検索または作成
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { sharegramUserId: sharegram_user_id }
        ]
      }
    });

    if (!user) {
      // 新規ユーザー作成
      user = await User.create({
        email,
        name: name || 'Sharegram User',
        sharegramUserId: sharegram_user_id,
        isActive: true,
        role: 'user'
      });
    } else {
      // 既存ユーザー更新
      await user.update({
        sharegramUserId: sharegram_user_id,
        name: name || user.name,
        lastLoginAt: new Date()
      });
    }

    // JWTトークン生成
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // 監査ログ記録
    await auditLog('sso_login', user.id, req.ip, {
      sharegramUserId: sharegram_user_id,
      email
    });

    // 成功レスポンス
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      redirectUrl: return_url || '/dashboard'
    });

  } catch (error) {
    logger.error('SSO authentication error:', error);
    
    // 監査ログ記録
    await auditLog('sso_error', null, req.ip, {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// SSO状態確認エンドポイント
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    res.json({
      success: true,
      isConnected: !!user.sharegramUserId,
      sharegramUserId: user.sharegramUserId,
      email: user.email,
      name: user.name
    });
  } catch (error) {
    logger.error('SSO status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// テスト用エンドポイント
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'SSO endpoints are working',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/sso/sso - Sharegram SSO authentication',
      'GET /api/auth/sso/status - Check SSO connection status',
      'GET /api/auth/sso/test - This test endpoint'
    ]
  });
});

module.exports = router;