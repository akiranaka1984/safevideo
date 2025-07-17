# SafeVideo KYCシステム デプロイプロセス整理

**対象サーバー**: 167.172.92.88  
**プロジェクトパス**: `/var/www/sharegramvideo/safevideo`

## 📋 デプロイプロセスの全体像

### Step 1: サーバー準備
```bash
# 1. SSHでサーバーに接続
ssh root@167.172.92.88

# 2. システムアップデート
apt update && apt upgrade -y

# 3. 必要なソフトウェアをインストール
apt install -y curl wget git vim unzip build-essential
```

### Step 2: Docker環境の構築
```bash
# 1. Dockerをインストール
curl -fsSL https://get.docker.com | sh

# 2. Docker Composeをインストール
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 3. 確認
docker --version
docker-compose --version
```

### Step 3: プロジェクトファイルの配置
```bash
# 1. ディレクトリ作成
mkdir -p /var/www/sharegramvideo/safevideo
cd /var/www/sharegramvideo/safevideo

# 2. ファイルをアップロード（ローカルから実行）
# ローカルマシンで:
rsync -avz --exclude 'node_modules' --exclude '.env' --exclude 'uploads' \
  /path/to/local/safevideo/ \
  root@167.172.92.88:/var/www/sharegramvideo/safevideo/
```

### Step 4: ディレクトリ構造の確認と準備
```bash
# 1. 現在の構造を確認
cd /var/www/sharegramvideo/safevideo
ls -la

# 2. 必要なディレクトリ構造を作成
mkdir -p uploads/performers
mkdir -p uploads/documents
mkdir -p server
mkdir -p src
mkdir -p public

# 3. 権限設定
chown -R www-data:www-data uploads
chmod -R 755 uploads
```

### Step 5: 環境設定ファイルの作成

#### .envファイル（プロジェクトルート）
```bash
cat > /var/www/sharegramvideo/safevideo/.env << 'EOF'
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
UPLOAD_DIR=/var/www/sharegramvideo/safevideo/uploads

# API設定
API_BASE_URL=http://167.172.92.88
FRONTEND_URL=http://167.172.92.88
EOF

# server用.envも作成
cp .env server/.env
```

### Step 6: Dockerファイルの作成

#### サーバー用Dockerfile
```bash
cat > /var/www/sharegramvideo/safevideo/server/Dockerfile << 'EOF'
FROM node:16-alpine

WORKDIR /app

# package.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# アプリケーションコードをコピー
COPY . .

# ポート公開
EXPOSE 5000

# サーバー起動
CMD ["node", "server.js"]
EOF
```

#### クライアント用Dockerfile
```bash
cat > /var/www/sharegramvideo/safevideo/Dockerfile << 'EOF'
FROM node:16-alpine as build

WORKDIR /app

# package.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルド
RUN npm run build

# 本番ステージ
FROM nginx:alpine

# Nginxの設定
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF
```

### Step 7: Docker Compose設定
```bash
cat > /var/www/sharegramvideo/safevideo/docker-compose.prod.yml << 'EOF'
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
      MYSQL_PASSWORD: Sgv#2025$Prod&Secure!
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - safevideo-network

  redis:
    image: redis:7-alpine
    container_name: safevideo-redis
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - safevideo-network

  server:
    build: ./server
    container_name: safevideo-server
    restart: always
    depends_on:
      - mysql
      - redis
    env_file:
      - ./server/.env
    volumes:
      - ./uploads:/app/uploads
    ports:
      - "5000:5000"
    networks:
      - safevideo-network

  client:
    build: .
    container_name: safevideo-client
    restart: always
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://167.172.92.88:5000
    networks:
      - safevideo-network

networks:
  safevideo-network:
    driver: bridge

volumes:
  mysql_data:
  redis_data:
EOF
```

### Step 8: Nginxリバースプロキシ設定
```bash
# 1. Nginxをインストール
apt install -y nginx

# 2. 設定ファイルを作成
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
    }

    # バックエンドAPI
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # アップロードファイル
    location /uploads {
        alias /var/www/sharegramvideo/safevideo/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
EOF

# 3. 設定を有効化
ln -sf /etc/nginx/sites-available/safevideo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 4. Nginxを再起動
nginx -t && systemctl restart nginx
```

### Step 9: アプリケーション起動
```bash
# 1. Dockerコンテナを起動
cd /var/www/sharegramvideo/safevideo
docker-compose -f docker-compose.prod.yml up -d --build

# 2. ログを確認
docker-compose -f docker-compose.prod.yml logs -f

# 3. コンテナの状態を確認
docker-compose -f docker-compose.prod.yml ps
```

### Step 10: データベース初期化
```bash
# 1. データベースが起動するまで待機
sleep 30

# 2. マイグレーション実行（必要な場合）
docker-compose -f docker-compose.prod.yml exec server npm run migrate

# 3. 初期ユーザー作成
docker-compose -f docker-compose.prod.yml exec mysql mysql -uroot -proot_password_change_this -e "
USE safevideo;
INSERT INTO Users (email, password, name, role, createdAt, updatedAt) 
VALUES ('admin@example.com', '\$2a\$10\$khfTWK9oc3mTdk.HuWtSeetEYDwIsZ9yTV1POCJqbSka5krVk4HgK', 'Admin User', 'admin', NOW(), NOW());
"
```

## 🔍 トラブルシューティング

### 問題1: Dockerfileが見つからない
```bash
# ファイルの存在を確認
ls -la server/Dockerfile
ls -la Dockerfile

# 存在しない場合は上記Step 6で作成
```

### 問題2: ポート競合
```bash
# 使用中のポートを確認
netstat -tlnp | grep -E ':(80|3000|5000)'

# 競合するサービスを停止
systemctl stop apache2  # 例：Apache
```

### 問題3: データベース接続エラー
```bash
# MySQLコンテナのログを確認
docker-compose -f docker-compose.prod.yml logs mysql

# データベースに接続してテスト
docker-compose -f docker-compose.prod.yml exec mysql mysql -uroot -p
```

## ✅ 最終確認

1. **ブラウザでアクセス**
   - http://167.172.92.88 でアプリケーションが表示される
   - ログイン画面が正常に表示される

2. **APIの動作確認**
   ```bash
   curl http://167.172.92.88/api/integration/health
   ```

3. **ログイン確認**
   - Email: admin@example.com
   - Password: AdminPassword123

## 📝 まとめ

このプロセスに従えば、SafeVideo KYCシステムを確実にデプロイできます。各ステップで問題が発生した場合は、トラブルシューティングセクションを参照してください。

---
*最終更新: 2025年7月1日*