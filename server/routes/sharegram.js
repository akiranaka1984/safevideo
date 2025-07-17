const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const firebaseAuth = require('../middleware/firebaseAuth');
const { User, SharegramIntegration, FirebaseUser } = require('../models');
const axios = require('axios');
const crypto = require('crypto');

// @route   POST api/sharegram/auth-result
// @desc    Send authentication result to Sharegram
// @access  Private (Firebase Auth)
router.post('/auth-result', firebaseAuth, [
  check('callback_url', 'コールバックURLは必須です').notEmpty().isURL(),
  check('api_key', 'APIキーは必須です').notEmpty(),
  check('result', '結果データは必須です').notEmpty(),
  check('result.user_id', 'ユーザーIDは必須です').notEmpty(),
  check('result.firebase_uid', 'Firebase UIDは必須です').notEmpty(),
  check('result.email', 'メールアドレスは必須です').isEmail(),
  check('result.status', 'ステータスは必須です').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { callback_url, api_key, result } = req.body;

  try {
    // Firebase UIDの検証
    if (req.user.uid !== result.firebase_uid) {
      return res.status(403).json({ message: 'Firebase UIDが一致しません' });
    }

    // APIキーの検証（本番環境では適切な検証を実装）
    if (!isValidApiKey(api_key)) {
      return res.status(401).json({ message: '無効なAPIキーです' });
    }

    // Sharegram統合情報の保存
    const integrationData = {
      sharegram_user_id: result.user_id,
      firebase_uid: result.firebase_uid,
      email: result.email,
      display_name: result.display_name,
      photo_url: result.photo_url,
      session_id: result.session_id,
      status: result.status,
      callback_url: callback_url,
      api_key_hash: hashApiKey(api_key), // APIキーをハッシュ化して保存
      created_at: new Date(),
      updated_at: new Date()
    };

    // データベースに保存
    const integration = await SharegramIntegration.create(integrationData);

    // Sharegramに結果を送信
    const sharegramResponse = await sendToSharegram(callback_url, api_key, result);

    res.json({
      message: 'Sharegramに認証結果を送信しました',
      integration_id: integration.id,
      sharegram_response: sharegramResponse
    });

  } catch (error) {
    console.error('Sharegram認証結果送信エラー:', error);
    res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST api/sharegram/user-register
// @desc    Register user for Sharegram integration
// @access  Private (Firebase Auth)
router.post('/user-register', firebaseAuth, [
  check('sharegram_user_id', 'Sharegram ユーザーIDは必須です').notEmpty(),
  check('session_id', 'セッションIDは必須です').notEmpty(),
  check('company_id', '企業IDは必須です').optional(),
  check('locale', 'ロケールは必須です').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    sharegram_user_id,
    session_id,
    company_id,
    locale,
    display_name,
    photo_url
  } = req.body;

  try {
    // Firebase ユーザー情報の保存/更新
    const [firebaseUser] = await FirebaseUser.findOrCreate({
      where: { firebase_uid: req.user.uid },
      defaults: {
        firebase_uid: req.user.uid,
        email: req.user.email,
        display_name: display_name || req.user.name,
        photo_url: photo_url || req.user.picture,
        provider: req.user.firebase?.sign_in_provider || 'unknown',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // 既存のレコードを更新
    if (!firebaseUser.isNewRecord) {
      await firebaseUser.update({
        email: req.user.email,
        display_name: display_name || req.user.name,
        photo_url: photo_url || req.user.picture,
        updated_at: new Date()
      });
    }

    // Sharegram統合情報の保存
    const [integration] = await SharegramIntegration.findOrCreate({
      where: { 
        sharegram_user_id: sharegram_user_id,
        firebase_uid: req.user.uid
      },
      defaults: {
        sharegram_user_id: sharegram_user_id,
        firebase_uid: req.user.uid,
        email: req.user.email,
        display_name: display_name || req.user.name,
        photo_url: photo_url || req.user.picture,
        session_id: session_id,
        company_id: company_id,
        locale: locale,
        status: 'registered',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // 既存のレコードを更新
    if (!integration.isNewRecord) {
      await integration.update({
        email: req.user.email,
        display_name: display_name || req.user.name,
        photo_url: photo_url || req.user.picture,
        session_id: session_id,
        company_id: company_id,
        locale: locale,
        status: 'registered',
        updated_at: new Date()
      });
    }

    res.json({
      message: 'ユーザー登録が完了しました',
      firebase_user_id: firebaseUser.id,
      integration_id: integration.id
    });

  } catch (error) {
    console.error('Sharegramユーザー登録エラー:', error);
    res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET api/sharegram/integration/:user_id
// @desc    Get Sharegram integration status
// @access  Private (Firebase Auth)
router.get('/integration/:user_id', firebaseAuth, async (req, res) => {
  const { user_id } = req.params;

  try {
    const integration = await SharegramIntegration.findOne({
      where: { 
        sharegram_user_id: user_id,
        firebase_uid: req.user.uid
      }
    });

    if (!integration) {
      return res.status(404).json({ message: '統合情報が見つかりません' });
    }

    res.json({
      integration: {
        id: integration.id,
        sharegram_user_id: integration.sharegram_user_id,
        firebase_uid: integration.firebase_uid,
        email: integration.email,
        display_name: integration.display_name,
        photo_url: integration.photo_url,
        status: integration.status,
        created_at: integration.created_at,
        updated_at: integration.updated_at
      }
    });

  } catch (error) {
    console.error('Sharegram統合情報取得エラー:', error);
    res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST api/sharegram/webhook
// @desc    Handle Sharegram webhook
// @access  Public (with signature validation)
router.post('/webhook', [
  check('event', 'イベントタイプは必須です').notEmpty(),
  check('user_id', 'ユーザーIDは必須です').notEmpty(),
  check('timestamp', 'タイムスタンプは必須です').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Webhook署名の検証
    const signature = req.headers['x-sharegram-signature'];
    if (!validateWebhookSignature(req.body, signature)) {
      return res.status(401).json({ message: '無効なWebhook署名です' });
    }

    const { event, user_id, timestamp, data } = req.body;

    // イベントタイプに応じた処理
    switch (event) {
      case 'user.kyc.completed':
        await handleKYCCompleted(user_id, data);
        break;
      case 'user.kyc.failed':
        await handleKYCFailed(user_id, data);
        break;
      case 'user.account.suspended':
        await handleAccountSuspended(user_id, data);
        break;
      default:
        console.warn('未対応のWebhookイベント:', event);
    }

    res.json({ message: 'Webhookを処理しました' });

  } catch (error) {
    console.error('Sharegram Webhookエラー:', error);
    res.status(500).json({ 
      message: 'サーバーエラーが発生しました',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ヘルパー関数

// APIキーの検証
function isValidApiKey(apiKey) {
  // 本番環境では適切なAPIキー検証を実装
  const validApiKeys = process.env.SHAREGRAM_API_KEYS?.split(',') || [];
  return validApiKeys.includes(apiKey) || process.env.NODE_ENV === 'development';
}

// APIキーのハッシュ化
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Sharegramへの結果送信
async function sendToSharegram(callbackUrl, apiKey, result) {
  try {
    const response = await axios.post(callbackUrl, {
      api_key: apiKey,
      result: result,
      timestamp: new Date().toISOString(),
      source: 'safevideo-kyc'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SafeVideo-KYC/1.0'
      },
      timeout: 30000 // 30秒タイムアウト
    });

    return {
      status: response.status,
      data: response.data
    };
  } catch (error) {
    console.error('Sharegram送信エラー:', error);
    throw new Error('Sharegramへの送信に失敗しました');
  }
}

// Webhook署名の検証
function validateWebhookSignature(payload, signature) {
  const webhookSecret = process.env.SHAREGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('SHAREGRAM_WEBHOOK_SECRET が設定されていません');
    return process.env.NODE_ENV === 'development';
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

// KYC完了処理
async function handleKYCCompleted(userId, data) {
  try {
    await SharegramIntegration.update(
      { 
        status: 'kyc_completed',
        kyc_completed_at: new Date(),
        updated_at: new Date()
      },
      { where: { sharegram_user_id: userId } }
    );
  } catch (error) {
    console.error('KYC完了処理エラー:', error);
  }
}

// KYC失敗処理
async function handleKYCFailed(userId, data) {
  try {
    await SharegramIntegration.update(
      { 
        status: 'kyc_failed',
        kyc_failed_reason: data.reason || '不明なエラー',
        updated_at: new Date()
      },
      { where: { sharegram_user_id: userId } }
    );
  } catch (error) {
    console.error('KYC失敗処理エラー:', error);
  }
}

// アカウント停止処理
async function handleAccountSuspended(userId, data) {
  try {
    await SharegramIntegration.update(
      { 
        status: 'suspended',
        suspended_reason: data.reason || '不明な理由',
        updated_at: new Date()
      },
      { where: { sharegram_user_id: userId } }
    );
  } catch (error) {
    console.error('アカウント停止処理エラー:', error);
  }
}

module.exports = router;