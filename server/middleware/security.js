// セキュリティミドルウェア
const cors = require('cors');

// HTTPS強制ミドルウェア
const forceHTTPS = (req, res, next) => {
  // 本番環境でのみHTTPS強制を有効化
  if (process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true') {
    // プロトコルチェック（X-Forwarded-Protoヘッダーを確認）
    if (req.header('x-forwarded-proto') !== 'https') {
      // HTTPSへリダイレクト
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
  }
  next();
};

// セキュリティヘッダーの設定
const securityHeaders = (req, res, next) => {
  // Strict-Transport-Security (HSTS)
  if (process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // その他のセキュリティヘッダー
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.googleapis.com https://*.google.com",
    "frame-src https://*.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  
  next();
};

// セキュアなCORS設定
const secureCORS = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  return cors({
    origin: (origin, callback) => {
      // 開発環境では全てのオリジンを許可
      if (process.env.NODE_ENV === 'development' && !process.env.STRICT_CORS) {
        callback(null, true);
      } 
      // 本番環境では許可されたオリジンのみ
      else if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token'],
    maxAge: 86400 // 24時間
  });
};

// Cookie設定
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true',
  sameSite: 'strict',
  path: '/',
  domain: process.env.COOKIE_DOMAIN
};

module.exports = {
  forceHTTPS,
  securityHeaders,
  secureCORS,
  cookieConfig
};