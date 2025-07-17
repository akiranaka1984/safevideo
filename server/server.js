const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

// セキュリティミドルウェアをインポート
const { forceHTTPS, securityHeaders, secureCORS } = require('./middleware/security');

// データベース設定をインポート
const { connectDB } = require('./config/db');

// データベース接続
connectDB();

const app = express();

// HTTPS強制（最初に適用）
app.use(forceHTTPS);

// セキュリティヘッダーの設定
app.use(securityHeaders);

// セキュアなCORS設定
app.use(secureCORS());

// その他のミドルウェア
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Cookieパーサー（セッション管理用）
const cookieParser = require('cookie-parser');
app.use(cookieParser(process.env.SESSION_SECRET || 'dev-secret-key'));

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
app.use('/api/auth/sso', require('./routes/auth-sso'));
// app.use('/api/auth', require('./routes/auth-firebase'));
app.use('/api/auth/firebase', require('./routes/auth-firebase-v2'));
app.use('/api/performers', require('./routes/performers'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/documents', require('./routes/api/documents'));
// app.use('/api/sharegram', require('./routes/sharegram'));
// app.use('/api/users', require('./routes/users'));
app.use('/test', require('./routes/test-file'));

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

// Firebase統合エラーハンドラー
// const { firebaseErrorHandler } = require('./middleware/firebase-error-handler');
// app.use(firebaseErrorHandler);

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

// HTTP サーバーを作成
const server = http.createServer(app);

// WebSocket サーバーを作成
const wss = new WebSocket.Server({ 
  server, 
  path: process.env.WS_PATH || '/ws' 
});

// ヘルスチェックエンドポイント（WebSocket情報を含む）
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websocket: {
      enabled: process.env.WS_ENABLED === 'true',
      path: process.env.WS_PATH || '/ws',
      connections: wss ? wss.clients.size : 0
    }
  });
});

// WebSocket 接続管理
wss.on('connection', (ws, req) => {
  console.log('WebSocket connection established from:', req.socket.remoteAddress);
  
  // 接続確認メッセージ
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'WebSocket connection established',
    timestamp: new Date().toISOString()
  }));
  
  // メッセージハンドラー
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received WebSocket message:', data);
      
      // エコーレスポンス
      ws.send(JSON.stringify({
        type: 'echo',
        data: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('WebSocket message parsing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // 切断ハンドラー
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
  
  // エラーハンドラー
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// ヘルスチェック用のハートビート
if (process.env.WS_HEARTBEAT_INTERVAL) {
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000);
  
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });
}

// サーバー起動
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server running on ${process.env.WS_PATH || '/ws'}`);
  console.log(`CORS is enabled for all origins`);
});