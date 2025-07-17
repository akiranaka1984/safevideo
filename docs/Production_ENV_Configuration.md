# 本番環境 .env ファイル設定ガイド

## セキュアなパスワードを設定した .env ファイル

プログラムが `/var/www/sharegramvideo/safevideo` に配置されている場合の設定：

```bash
# アプリケーション設定
NODE_ENV=production
PORT=5000

# データベース設定
DB_HOST=mysql
DB_PORT=3306
DB_NAME=safevideo
DB_USER=safevideo_user
DB_PASSWORD=Sgv#2025$Prod&Secure!

# JWT設定
JWT_SECRET=kYc$JWT#Secret@2025!SharegramVideo&SafeAuth

# Redis設定
REDIS_HOST=redis
REDIS_PORT=6379

# アップロードディレクトリ
# プログラムが /var/www/sharegramvideo/safevideo にある場合
UPLOAD_DIR=/var/www/sharegramvideo/safevideo/uploads

# API設定
API_BASE_URL=http://167.172.92.88
FRONTEND_URL=http://167.172.92.88

# 追加のセキュリティ設定
SESSION_SECRET=Sess!on#2025@SharegramKYC$Secure
COOKIE_SECRET=C00k!e#Secret@2025$SafeVideo

# Firebase設定（必要に応じて）
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com

# Sharegram API設定
SHAREGRAM_API_KEY=sgAPI#2025$KYC&Integration!Key
SHAREGRAM_API_SECRET=sgSecret@2025#Secure$Integration
SHAREGRAM_WEBHOOK_SECRET=Wh#Hook$2025@SharegramSafe!
```

## 📁 ディレクトリ構造の説明

プログラムが `/var/www/sharegramvideo/safevideo` にある場合：

```
/var/www/sharegramvideo/
└── safevideo/              # アプリケーションルート
    ├── server/             # バックエンドコード
    ├── src/                # フロントエンドコード
    ├── uploads/            # アップロードファイル保存先
    │   ├── performers/     # パフォーマー関連ファイル
    │   └── documents/      # ドキュメントファイル
    ├── .env                # 環境変数ファイル
    └── docker-compose.yml  # Docker設定
```

## 🔧 アップロードディレクトリの設定

### 1. ディレクトリ作成

```bash
# アップロードディレクトリの作成
mkdir -p /var/www/sharegramvideo/safevideo/uploads/performers
mkdir -p /var/www/sharegramvideo/safevideo/uploads/documents

# 権限設定
chown -R www-data:www-data /var/www/sharegramvideo/safevideo/uploads
chmod -R 755 /var/www/sharegramvideo/safevideo/uploads
```

### 2. Docker Composeでのボリュームマウント

`docker-compose.prod.yml` に以下を設定：

```yaml
services:
  server:
    volumes:
      - ./server:/app
      - ./uploads:/app/uploads  # コンテナ内では /app/uploads
      - /var/www/sharegramvideo/safevideo/uploads:/var/www/sharegramvideo/safevideo/uploads
```

### 3. Nginxでの静的ファイル配信

```nginx
location /uploads {
    alias /var/www/sharegramvideo/safevideo/uploads;
    expires 30d;
    add_header Cache-Control "public, immutable";
    
    # セキュリティヘッダー
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
}
```

## 🔐 パスワード生成のヒント

より強力なパスワードを生成したい場合：

```bash
# ランダムパスワード生成（32文字）
openssl rand -base64 32

# 特殊文字を含むパスワード生成
python3 -c "import secrets; import string; print(''.join(secrets.choice(string.ascii_letters + string.digits + '!@#$%^&*') for _ in range(32)))"
```

## ⚠️ 重要な注意事項

1. **パスワードの管理**
   - 本番環境では、提供したサンプルパスワードをそのまま使用しないでください
   - 各環境で異なるパスワードを使用してください
   - パスワードは安全な場所に保管してください

2. **Firebase設定**
   - `your-firebase-project-id` などは実際の値に置き換えてください
   - Firebase Admin SDKの秘密鍵ファイルも別途必要です

3. **ファイルパーミッション**
   - `.env` ファイルは適切な権限を設定してください
   ```bash
   chmod 600 /var/www/sharegramvideo/safevideo/.env
   ```

4. **バックアップ**
   - 環境変数ファイルのバックアップを取ってください
   - アップロードディレクトリも定期的にバックアップしてください

## 🚀 設定の適用

```bash
# .envファイルをサーバーに作成
cd /var/www/sharegramvideo/safevideo
nano .env  # 上記の内容をコピー＆ペースト

# Dockerコンテナの再起動
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# ログで起動確認
docker-compose -f docker-compose.prod.yml logs -f
```

---

*この設定は本番環境用です。開発環境では異なる設定を使用してください。*