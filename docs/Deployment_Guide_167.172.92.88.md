# SafeVideo KYCシステム デプロイメント手順書

**対象サーバー**: 167.172.92.88  
**作成日**: 2025年7月1日

## 📋 目次

1. [事前準備](#事前準備)
2. [サーバー初期設定](#サーバー初期設定)
3. [必要なソフトウェアのインストール](#必要なソフトウェアのインストール)
4. [アプリケーションのデプロイ](#アプリケーションのデプロイ)
5. [環境設定](#環境設定)
6. [サービスの起動](#サービスの起動)
7. [動作確認](#動作確認)
8. [トラブルシューティング](#トラブルシューティング)

---

## 1. 事前準備

### 必要な情報を準備

以下の情報を事前に準備してください：

- [ ] SSHアクセス情報（ユーザー名、パスワードまたは秘密鍵）
- [ ] MySQLのrootパスワード（設定する値）
- [ ] Firebase設定ファイル（`firebase-admin-key.json`）
- [ ] SSL証明書（本番環境の場合）

### ローカルでの準備

```bash
# プロジェクトをzip化
cd /Users/maemuraeisuke/Documents/ai-kycsite
zip -r safevideo-deploy.zip safevideo/ -x "*/node_modules/*" "*/uploads/*" "*/.env"
```

---

## 2. サーバー初期設定

### SSHでサーバーに接続

```bash
ssh root@167.172.92.88
# またはSSHキーを使用する場合
ssh -i ~/.ssh/your-key.pem root@167.172.92.88
```

### システムの更新

```bash
# パッケージリストの更新
apt update

# システムのアップグレード
apt upgrade -y

# 必要な基本ツールのインストール
apt install -y curl wget git vim unzip build-essential
```

### ファイアウォールの設定

```bash
# UFWのインストールと設定
apt install -y ufw

# 必要なポートを開放
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3306/tcp  # MySQL（必要に応じて）

# ファイアウォールを有効化
ufw --force enable
```

---

## 3. 必要なソフトウェアのインストール

### Docker と Docker Composeのインストール

```bash
# Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Composeのインストール
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 動作確認
docker --version
docker-compose --version
```

### Node.js のインストール（Docker外で実行する場合）

```bash
# NodeSourceリポジトリの追加
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Node.jsのインストール
apt install -y nodejs

# 動作確認
node --version
npm --version
```

### Nginx のインストール

```bash
# Nginxのインストール
apt install -y nginx

# 自動起動設定
systemctl enable nginx
```

---

## 4. アプリケーションのデプロイ

### アプリケーションディレクトリの作成

```bash
# アプリケーション用ディレクトリ作成
mkdir -p /var/www/safevideo
cd /var/www/safevideo
```

### ファイルのアップロード

ローカルマシンから実行：

```bash
# SCPでファイルをアップロード
scp safevideo-deploy.zip root@167.172.92.88:/var/www/safevideo/

# またはrsyncを使用（推奨）
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'uploads' \
  /Users/maemuraeisuke/Documents/ai-kycsite/safevideo/ \
  root@167.172.92.88:/var/www/safevideo/
```

サーバー上で実行：

```bash
cd /var/www/safevideo

# zipファイルの場合は解凍
unzip safevideo-deploy.zip

# ディレクトリ構造の確認
ls -la
```

---

## 5. 環境設定

### 環境変数ファイルの作成

```bash
# サーバー用の環境変数ファイルを作成
cd /var/www/safevideo/safevideo
```

#### `.env` ファイルの作成

```bash
cat > .env << 'EOF'
# アプリケーション設定
NODE_ENV=production
PORT=5000

# データベース設定
DB_HOST=mysql
DB_PORT=3306
DB_NAME=safevideo
DB_USER=safevideo_user
DB_PASSWORD=your_secure_password_here

# JWT設定
JWT_SECRET=your_very_secure_jwt_secret_key_here

# Redis設定
REDIS_HOST=redis
REDIS_PORT=6379

# アップロードディレクトリ
UPLOAD_DIR=/var/www/safevideo/uploads

# API設定
API_BASE_URL=http://167.172.92.88
FRONTEND_URL=http://167.172.92.88
EOF
```

#### `server/.env` ファイルの作成

```bash
cp .env server/.env
```

### Docker Compose設定の修正

```bash
# 本番用のdocker-compose.ymlを作成
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: safevideo-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_password_change_this
      MYSQL_DATABASE: safevideo
      MYSQL_USER: safevideo_user
      MYSQL_PASSWORD: your_secure_password_here
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    container_name: safevideo-redis
    restart: always
    volumes:
      - redis_data:/data

  server:
    build: ./server
    container_name: safevideo-server
    restart: always
    depends_on:
      - mysql
      - redis
    environment:
      NODE_ENV: production
    volumes:
      - ./server:/app
      - ./uploads:/app/uploads
    ports:
      - "5000:5000"

  client:
    build: .
    container_name: safevideo-client
    restart: always
    environment:
      REACT_APP_API_URL: http://167.172.92.88:5000
    ports:
      - "3000:3000"

volumes:
  mysql_data:
  redis_data:
EOF
```

### Nginx設定

```bash
# Nginx設定ファイルの作成
cat > /etc/nginx/sites-available/safevideo << 'EOF'
server {
    listen 80;
    server_name 167.172.92.88;

    # フロントエンド
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # バックエンドAPI
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # アップロードファイル
    location /uploads {
        alias /var/www/safevideo/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
EOF

# 設定を有効化
ln -s /etc/nginx/sites-available/safevideo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Nginx設定のテスト
nginx -t

# Nginxの再起動
systemctl restart nginx
```

---

## 6. サービスの起動

### Dockerコンテナの起動

```bash
cd /var/www/safevideo/safevideo

# ビルドと起動
docker-compose -f docker-compose.prod.yml up -d --build

# 起動状態の確認
docker-compose -f docker-compose.prod.yml ps

# ログの確認
docker-compose -f docker-compose.prod.yml logs -f
```

### データベースの初期化

```bash
# データベースが起動するまで待機（30秒程度）
sleep 30

# マイグレーションの実行
docker-compose -f docker-compose.prod.yml exec server npm run migrate

# 初期データの投入（必要な場合）
docker-compose -f docker-compose.prod.yml exec server npm run seed
```

---

## 7. 動作確認

### サービスの確認

```bash
# 各サービスの状態確認
curl http://localhost:3000  # フロントエンド
curl http://localhost:5000/api/integration/health  # バックエンドAPI

# Nginxプロキシ経由での確認
curl http://167.172.92.88
curl http://167.172.92.88/api/integration/health
```

### ブラウザでの確認

1. ブラウザで `http://167.172.92.88` にアクセス
2. ログインページが表示されることを確認
3. テストアカウントでログイン

```
メールアドレス: admin@example.com
パスワード: AdminPassword123
```

### ログの確認

```bash
# 全サービスのログ
docker-compose -f docker-compose.prod.yml logs

# 特定サービスのログ
docker-compose -f docker-compose.prod.yml logs server
docker-compose -f docker-compose.prod.yml logs mysql

# Nginxのログ
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 8. トラブルシューティング

### よくある問題と解決方法

#### 1. ポート競合エラー

```bash
# 使用中のポートを確認
netstat -tlnp | grep -E ':(80|3000|5000|3306)'

# 競合するプロセスを停止
systemctl stop apache2  # Apacheが動いている場合
```

#### 2. データベース接続エラー

```bash
# MySQLコンテナに接続して確認
docker-compose -f docker-compose.prod.yml exec mysql mysql -uroot -p

# データベースとユーザーの確認
SHOW DATABASES;
SELECT User, Host FROM mysql.user;
```

#### 3. 権限エラー

```bash
# アップロードディレクトリの権限設定
mkdir -p /var/www/safevideo/uploads
chown -R www-data:www-data /var/www/safevideo/uploads
chmod -R 755 /var/www/safevideo/uploads
```

#### 4. メモリ不足

```bash
# スワップファイルの作成（メモリが少ない場合）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 再起動手順

```bash
# サービスの停止
cd /var/www/safevideo/safevideo
docker-compose -f docker-compose.prod.yml down

# サービスの起動
docker-compose -f docker-compose.prod.yml up -d

# Nginxの再起動
systemctl restart nginx
```

### バックアップ

```bash
# データベースのバックアップ
docker-compose -f docker-compose.prod.yml exec mysql mysqldump -uroot -p safevideo > backup_$(date +%Y%m%d).sql

# アップロードファイルのバックアップ
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/www/safevideo/uploads
```

---

## 📌 重要な注意事項

1. **セキュリティ**
   - 本番環境では必ずSSL証明書を設定してください
   - 環境変数の値は必ず変更してください
   - ファイアウォールルールを適切に設定してください

2. **監視**
   - ログを定期的に確認してください
   - リソース使用状況を監視してください
   - バックアップを定期的に取得してください

3. **メンテナンス**
   - システムアップデートを定期的に実行してください
   - Dockerイメージを定期的に更新してください

---

## 🆘 サポート

問題が発生した場合は、以下の情報と共に報告してください：

1. エラーログ（`docker-compose logs`の出力）
2. システム情報（`uname -a`、`docker --version`）
3. 実行したコマンドと結果

---

*このガイドは SafeVideo KYCシステムのデプロイメント用です。*
*最終更新: 2025年7月1日*