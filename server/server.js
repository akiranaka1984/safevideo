const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// データベース設定をインポート
const { connectDB } = require('./config/db');

// データベース接続
connectDB();

const app = express();

// より詳細なCORS設定
app.use(cors({
  origin: '*',  // すべてのオリジンからのアクセスを許可（開発環境用）
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

// アップロードディレクトリを作成（起動時に1回）
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('アップロードディレクトリを作成しました:', uploadsDir);
  } catch (err) {
    console.error('アップロードディレクトリの作成に失敗しました:', err);
  }
}

// 出演者のアップロードディレクトリを作成
const performersUploadsDir = path.join(__dirname, 'uploads', 'performers');
if (!fs.existsSync(performersUploadsDir)) {
  try {
    fs.mkdirSync(performersUploadsDir, { recursive: true });
    console.log('出演者アップロードディレクトリを作成しました:', performersUploadsDir);
  } catch (err) {
    console.error('出演者アップロードディレクトリの作成に失敗しました:', err);
  }
}

// アップロードされたファイルの保存ディレクトリを静的ファイルとして公開
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// APIルートを設定する前にCORSのpreflight requestを処理
app.options('*', cors());

// ルート設定（重複を削除）
app.use('/api/auth', require('./routes/auth'));
app.use('/api/performers', require('./routes/performers'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 簡単なテストエンドポイント
app.get('/', (req, res) => {
  res.json({ message: 'SafeVideo API is running!' });
});

// 404エラーハンドラー
app.use((req, res, next) => {
  res.status(404).json({ message: `Not Found: ${req.originalUrl}` });
});

// multerによるファイルアップロードエラーを処理
app.use((err, req, res, next) => {
  // multerのエラーを特別に処理
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ 
      message: 'ファイルサイズが大きすぎます。5MB以下のファイルをアップロードしてください。' 
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ 
      message: '予期しないフィールド名でファイルがアップロードされました。' 
    });
  }
  
  next(err);
});

// 一般的なエラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  
  if (err.name === 'CorsError') {
    return res.status(403).json({ message: 'CORS error: ' + err.message });
  }
  
  res.status(500).json({ 
    message: 'サーバーエラーが発生しました',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS is enabled for all origins`);
});