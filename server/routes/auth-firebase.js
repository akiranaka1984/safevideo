const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { User } = require('../models');

// Firebase Admin SDK初期化
const initializeFirebase = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });
  }
};

// 初期化
initializeFirebase();

// Firebase ID Token検証エンドポイント
router.post('/firebase-verify', async (req, res) => {
  try {
    const { id_token, client_id } = req.body;

    if (!id_token) {
      return res.status(400).json({ 
        success: false,
        error: {
          code: 'FIREBASE_AUTH_ERROR',
          message: 'ID Tokenが提供されていません'
        }
      });
    }

    // Firebase ID Tokenを検証
    const decodedToken = await admin.auth().verifyIdToken(id_token);
    
    // ユーザー情報取得
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);

    // ローカルユーザーを作成または更新
    let user = await User.findOne({ 
      where: { email: firebaseUser.email } 
    });

    if (!user) {
      // 新規ユーザー作成
      user = await User.create({
        email: firebaseUser.email,
        name: firebaseUser.displayName || 'Sharegram User',
        password: require('crypto').randomBytes(32).toString('hex'),
        role: 'user',
        firebaseUid: decodedToken.uid,
        sharegramUserId: decodedToken.sharegram_user_id || null
      });
    } else {
      // 既存ユーザー更新
      await user.update({
        name: firebaseUser.displayName || user.name,
        firebaseUid: decodedToken.uid,
        sharegramUserId: decodedToken.sharegram_user_id || user.sharegramUserId
      });
    }

    // ローカルセッショントークン生成
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        firebaseUid: user.firebaseUid,
        sharegramUserId: user.sharegramUserId
      }
    };

    const sessionToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    res.json({
      success: true,
      data: {
        user: {
          firebase_uid: decodedToken.uid,
          name: user.name,
          email: user.email,
          external_id: user.sharegramUserId
        },
        session_token: sessionToken
      }
    });

  } catch (error) {
    console.error('Firebase認証エラー:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_EXPIRED_TOKEN',
          message: 'ID Tokenの有効期限が切れています'
        }
      });
    }

    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_INVALID_TOKEN',
          message: 'ID Tokenが無効です'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'FIREBASE_AUTH_ERROR',
        message: 'Firebase認証に失敗しました'
      }
    });
  }
});

// Firebase SSO認証開始（リダイレクト方式）
router.get('/firebase-sso', async (req, res) => {
  try {
    const { id_token, redirect_url = '/dashboard' } = req.query;

    if (!id_token) {
      return res.redirect('/login?error=missing_token');
    }

    // ID Tokenを検証
    const decodedToken = await admin.auth().verifyIdToken(id_token);
    
    // ユーザー情報取得
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);

    // ローカルユーザーを作成または更新
    let user = await User.findOne({ 
      where: { email: firebaseUser.email } 
    });

    if (!user) {
      user = await User.create({
        email: firebaseUser.email,
        name: firebaseUser.displayName || 'Sharegram User',
        password: require('crypto').randomBytes(32).toString('hex'),
        role: 'user',
        firebaseUid: decodedToken.uid,
        sharegramUserId: decodedToken.sharegram_user_id || null
      });
    } else {
      await user.update({
        firebaseUid: decodedToken.uid,
        sharegramUserId: decodedToken.sharegram_user_id || user.sharegramUserId
      });
    }

    // JWTトークン生成
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        firebaseUid: user.firebaseUid,
        sharegramUserId: user.sharegramUserId
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    // フロントエンドのSSO callbackページへリダイレクト
    const callbackUrl = `${process.env.FRONTEND_URL}/sso-callback?token=${token}&redirect=${encodeURIComponent(redirect_url)}`;
    res.redirect(callbackUrl);

  } catch (error) {
    console.error('Firebase SSO認証エラー:', error);
    res.redirect('/login?error=auth_failed');
  }
});

// Firebase連携状態確認
router.get('/firebase-status', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.json({ 
        success: true,
        data: { connected: false }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findByPk(decoded.user.id);
    
    res.json({
      success: true,
      data: {
        connected: !!user.firebaseUid,
        firebaseUid: user.firebaseUid,
        sharegramUserId: user.sharegramUserId
      }
    });

  } catch (err) {
    res.json({ 
      success: true,
      data: { connected: false }
    });
  }
});

module.exports = router;