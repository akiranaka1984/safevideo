# SafeVideo デプロイメント - Router.use() ミドルウェアエラーの解決

**サーバー**: 167.172.92.88  
**エラー**: `TypeError: Router.use() requires a middleware function but got a Object`  
**作成日時**: 2025年7月1日

## 🚨 問題の詳細

### 発生したエラー
```
TypeError: Router.use() requires a middleware function but got a Object
    at Function.use (/app/node_modules/express/lib/router/index.js:469:13)
    at Object.<anonymous> (/app/server.js:63:5)
```

### エラーの原因
1. `auth-firebase.js`が正しくルーターをエクスポートしていない
2. `server.js`がオブジェクトではなく、ルーター関数を期待している
3. Firebase初期化エラーが適切に処理されていない

## 🔧 完全な解決手順

### Step 1: 現在のserver.jsの確認

```bash
# server.jsの問題箇所（63行目付近）を確認
sed -n '60,70p' server/server.js

# auth-firebaseのインポート方法を確認
grep -n "auth-firebase" server/server.js
```

### Step 2: auth-firebase.jsを完全に書き換え

```bash
# バックアップを作成
cp server/routes/auth-firebase.js server/routes/auth-firebase.js.backup2

# 新しいauth-firebase.jsを作成
cat > server/routes/auth-firebase.js << 'EOF'
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Firebase Admin SDKは条件付きで初期化
let admin = null;
let firebaseInitialized = false;

try {
  admin = require('firebase-admin');
  
  const initializeFirebase = () => {
    if (!admin.apps.length && !firebaseInitialized) {
      try {
        // 有効なFirebase設定がある場合のみ初期化
        if (process.env.FIREBASE_PROJECT_ID && 
            process.env.FIREBASE_CLIENT_EMAIL && 
            process.env.FIREBASE_PRIVATE_KEY) {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            })
          });
          firebaseInitialized = true;
          console.log('Firebase initialized successfully');
        } else {
          console.log('Firebase configuration not found, skipping initialization');
        }
      } catch (error) {
        console.error('Firebase initialization error:', error.message);
      }
    }
  };
  
  initializeFirebase();
} catch (error) {
  console.log('Firebase Admin SDK not available, continuing without Firebase auth');
}

// Firebaseトークン検証ミドルウェア
const verifyFirebaseToken = async (req, res, next) => {
  if (!firebaseInitialized || !admin) {
    return res.status(503).json({ error: 'Firebase authentication not available' });
  }
  
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Firebase認証エンドポイント
router.post('/login', async (req, res) => {
  try {
    if (!firebaseInitialized || !admin) {
      return res.status(503).json({ error: 'Firebase authentication not available' });
    }
    
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const { User } = require('../models');
    let user = await User.findOne({ where: { firebaseUid: decodedToken.uid } });
    
    if (!user) {
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email.split('@')[0],
        role: 'user'
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        firebaseUid: user.firebaseUid
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Firebase login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// 正しくエクスポート
module.exports = router;
module.exports.verifyFirebaseToken = verifyFirebaseToken;
EOF
```

### Step 3: server.jsのインポート方法を確認・修正（必要な場合）

```bash
# server.jsでauth-firebaseをどのように使っているか確認
grep -B2 -A2 "auth-firebase" server/server.js

# もし以下のような形式の場合：
# const { router, verifyFirebaseToken } = require('./routes/auth-firebase');
# 次のように修正：
# const authFirebaseRouter = require('./routes/auth-firebase');
# const { verifyFirebaseToken } = authFirebaseRouter;
```

### Step 4: Dockerコンテナを再ビルド

```bash
# サーバーコンテナを停止
docker-compose -f docker-compose.prod.yml stop server

# キャッシュをクリアして再ビルド
docker-compose -f docker-compose.prod.yml build --no-cache server

# サーバーを起動
docker-compose -f docker-compose.prod.yml up -d server

# ログを確認
docker-compose -f docker-compose.prod.yml logs -f server
```

## 🔍 修正内容の詳細

### 1. エクスポート方法の修正

**修正前（問題のあるコード）:**
```javascript
module.exports = { router, verifyFirebaseToken };
```

**修正後（正しいコード）:**
```javascript
module.exports = router;
module.exports.verifyFirebaseToken = verifyFirebaseToken;
```

### 2. Firebase初期化の改善
- 環境変数が存在する場合のみ初期化
- エラーが発生してもアプリケーションは継続
- 適切なログメッセージの出力

### 3. エラーハンドリングの強化
- try-catchブロックで全体を包む
- Firebaseが利用できない場合の代替処理
- 明確なエラーメッセージ

## 🎯 期待される結果

### 成功時のログ
```
データベース接続試行: safevideo_user@mysql:3306/safevideo
Firebase configuration not found, skipping initialization
Server running on port 5000
MySQL接続成功
データベーステーブルが同期されました
```

### アプリケーションの状態
- ✅ サーバーが正常に起動
- ✅ 通常のAPI認証は利用可能
- ⚠️ Firebase認証は無効（503エラーを返す）
- ✅ その他のAPI機能は正常動作

## 📝 代替解決策

### server.jsを修正する場合

```javascript
// server.jsの該当箇所を以下のように修正
// 修正前
const { router: authFirebaseRouter, verifyFirebaseToken } = require('./routes/auth-firebase');
app.use('/api/auth-firebase', authFirebaseRouter);

// 修正後
const authFirebaseRouter = require('./routes/auth-firebase');
app.use('/api/auth-firebase', authFirebaseRouter);
// verifyFirebaseTokenが必要な場合
const { verifyFirebaseToken } = authFirebaseRouter;
```

## ✅ トラブルシューティング

### 1. まだエラーが出る場合

```bash
# コンテナ内のファイルを直接確認
docker exec -it safevideo-server cat /app/routes/auth-firebase.js | tail -5

# server.jsの該当箇所を確認
docker exec -it safevideo-server cat /app/server.js | grep -n "auth-firebase" -A 2 -B 2
```

### 2. 完全リセット

```bash
# 全コンテナを停止・削除
docker-compose -f docker-compose.prod.yml down -v

# イメージも削除
docker rmi safevideo-server

# キャッシュをクリア
docker builder prune -f

# 再ビルド
docker-compose -f docker-compose.prod.yml up -d --build
```

### 3. 一時的な回避策

server.jsでFirebase認証を一時的に無効化：

```javascript
// server.jsで以下の行をコメントアウト
// app.use('/api/auth-firebase', authFirebaseRouter);
```

## 🎉 まとめ

この修正により：
1. **正しいルーターエクスポート形式**に変更
2. **Firebase設定なしでも起動可能**
3. **エラーが発生しても継続動作**
4. **明確なログメッセージ**で状態を把握

## 📌 重要なポイント

- **根本原因**: モジュールエクスポートの形式不一致
- **解決策**: Express.jsが期待する形式でルーターをエクスポート
- **副次効果**: Firebaseエラーの適切な処理

## 🚀 次のステップ

サーバーが正常に起動したら：
1. `http://167.172.92.88/api/integration/health` でヘルスチェック
2. 通常のログイン機能の確認
3. 必要に応じてFirebase設定を追加

---
*最終更新: 2025年7月1日*