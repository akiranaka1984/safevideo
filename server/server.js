const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// データベース設定をインポート
const { connectDB } = require('./config/db');

// データベース接続
connectDB();

const app = express();

// より詳細なCORS設定
app.use(cors({
  origin: '*',  // すべてのオリジンからのアクセスを許可
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// その他のミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// リクエストログ用ミドルウェア（デバッグ用）
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// アップロードされたファイルの保存ディレクトリを静的ファイルとして公開
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// APIルートを設定する前にCORSのpreflight requestを処理
app.options('*', cors());

// ルート設定
app.use('/api/auth', require('./routes/auth'));
app.use('/api/performers', require('./routes/performers'));

// 簡単なテストエンドポイント
app.get('/', (req, res) => {
  res.json({ message: 'SafeVideo API is running!' });
});

// CORSエラー専用のハンドラー
app.use((req, res, next) => {
  res.status(404).json({ message: `Not Found: ${req.originalUrl}` });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  
  if (err.name === 'CorsError') {
    return res.status(403).json({ message: 'CORS error: ' + err.message });
  }
  
  res.status(500).json({ message: 'サーバーエラーが発生しました' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS is enabled for all origins`);
});

// ルート設定
app.use('/api/auth', require('./routes/auth'));
app.use('/api/performers', require('./routes/performers'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/dashboard', require('./routes/dashboard'));