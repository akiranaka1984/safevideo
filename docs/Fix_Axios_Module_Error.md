# SafeVideo デプロイメント - Axiosモジュールエラーの解決

**サーバー**: 167.172.92.88  
**エラー**: `Error: Cannot find module 'axios'`  
**作成日時**: 2025年7月1日

## 🚨 現在の問題

サーバーコンテナが以下のエラーで起動できない状態：
```
Error: Cannot find module 'axios'
Require stack:
- /app/models/Webhook.js
- /app/models/index.js
- /app/routes/auth.js
- /app/server.js
```

## 🔧 解決手順

### Step 1: コンテナを一旦停止

```bash
# 現在のログ表示を停止
# Ctrl+C を押す

# または別のターミナルで実行
docker-compose -f docker-compose.prod.yml stop
```

### Step 2: サーバーのpackage.jsonを修正

```bash
# サーバーディレクトリに移動
cd /var/www/sharegramvideo/safevideo/server

# 現在のdependenciesを確認
cat package.json | grep -A 30 "dependencies"
```

#### axiosを追加する方法

**方法1: エディタで直接編集**
```bash
nano package.json
# dependenciesセクションに以下を追加
# "axios": "^1.6.0",
```

**方法2: sedコマンドで自動追加**
```bash
# winstonの後にaxiosを追加
sed -i '/"winston":/a\    "axios": "^1.6.0",' package.json

# 確認
cat package.json | grep -A 2 "axios"
```

**方法3: 完全なdependenciesセクションを置き換え**
```bash
# バックアップを作成
cp package.json package.json.backup

# dependenciesセクションを更新（必要な場合）
cat > temp_dependencies.json << 'EOF'
  "dependencies": {
    "express": "^4.18.2",
    "sequelize": "^6.30.0",
    "mysql2": "^3.2.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "cors": "^2.8.5",
    "helmet": "^6.1.5",
    "dotenv": "^16.0.3",
    "express-rate-limit": "^6.7.0",
    "express-validator": "^6.15.0",
    "multer": "^1.4.5-lts.1",
    "csv-parser": "^3.0.0",
    "csv-writer": "^1.6.0",
    "xlsx": "^0.18.5",
    "winston": "^3.8.2",
    "axios": "^1.6.0",
    "winston-daily-rotate-file": "^4.7.1",
    "ioredis": "^5.3.2",
    "rate-limit-redis": "^3.0.1",
    "firebase-admin": "^11.8.0",
    "nodemailer": "^6.9.1",
    "joi": "^17.9.1",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "express-slow-down": "^1.6.0"
  },
EOF
```

### Step 3: Dockerfileを修正

```bash
# サーバーのDockerfileを更新
cat > /var/www/sharegramvideo/safevideo/server/Dockerfile << 'EOF'
FROM node:16-alpine

WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール（本番用）
RUN npm install --production

# もしくは、全ての依存関係を確実にインストール
# RUN npm install

# アプリケーションコードをコピー
COPY . .

# アップロードディレクトリを作成
RUN mkdir -p /app/uploads

# ポート公開
EXPOSE 5000

# サーバー起動
CMD ["node", "server.js"]
EOF
```

### Step 4: docker-compose.prod.ymlを最適化

```bash
cd /var/www/sharegramvideo/safevideo

# docker-compose.prod.ymlを更新
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
      MYSQL_PASSWORD: Sgv#2025$Prod&Secure!
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
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
    build: 
      context: ./server
      dockerfile: Dockerfile
    container_name: safevideo-server
    restart: always
    depends_on:
      - mysql
      - redis
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_PORT: 3306
      DB_NAME: safevideo
      DB_USER: safevideo_user
      DB_PASSWORD: Sgv#2025$Prod&Secure!
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: kYc$JWT#Secret@2025!SharegramVideo&SafeAuth
      UPLOAD_DIR: /app/uploads
    volumes:
      # 重要: node_modulesはマウントしない
      - ./uploads:/app/uploads
      # ソースコードの変更を反映したい場合のみ
      # - ./server:/app
      # - /app/node_modules
    ports:
      - "5000:5000"
    networks:
      - safevideo-network

  client:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: safevideo-client
    restart: always
    environment:
      REACT_APP_API_URL: http://167.172.92.88:5000
      NODE_ENV: production
    ports:
      - "3000:80"
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

### Step 5: クリーンビルドを実行

```bash
# 作業ディレクトリで実行
cd /var/www/sharegramvideo/safevideo

# 既存のコンテナを停止・削除
docker-compose -f docker-compose.prod.yml down

# Dockerのキャッシュをクリア（オプション）
docker system prune -f

# イメージを削除して完全に再ビルド
docker-compose -f docker-compose.prod.yml rm -f
docker rmi safevideo-server safevideo-client

# 再ビルドと起動
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Step 6: ログを確認

```bash
# サーバーのログを確認
docker-compose -f docker-compose.prod.yml logs -f server

# 全サービスのログを確認
docker-compose -f docker-compose.prod.yml logs -f
```

## 🚑 緊急対応（上記がうまくいかない場合）

### 方法1: コンテナ内で直接修正

```bash
# サーバーコンテナに入る
docker-compose -f docker-compose.prod.yml exec server sh

# コンテナ内でaxiosをインストール
npm install axios
npm install  # 全ての依存関係を再インストール

# コンテナから出る
exit

# サーバーを再起動
docker-compose -f docker-compose.prod.yml restart server
```

### 方法2: 一時的な開発モードで起動

```bash
# 開発用の簡易設定を作成
cat > docker-compose.dev.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root_password_change_this
      MYSQL_DATABASE: safevideo
      MYSQL_USER: safevideo_user
      MYSQL_PASSWORD: Sgv#2025$Prod&Secure!
    ports:
      - "3306:3306"

  server:
    image: node:16-alpine
    working_dir: /app
    volumes:
      - ./server:/app
    ports:
      - "5000:5000"
    environment:
      DB_HOST: mysql
    command: sh -c "npm install && npm start"
    depends_on:
      - mysql
EOF

# 開発モードで起動
docker-compose -f docker-compose.dev.yml up
```

## ✅ 成功の確認

正常に起動した場合のログ：
```
safevideo-server | データベース接続試行: safevideo_user@mysql:3306/safevideo
safevideo-server | Server running on port 5000
safevideo-server | MySQL接続成功
```

## 🔍 トラブルシューティング

### 他の不足モジュールエラーが出た場合

```bash
# 全ての依存関係を確認
docker-compose -f docker-compose.prod.yml exec server npm list

# 不足しているモジュールを個別にインストール
docker-compose -f docker-compose.prod.yml exec server npm install [モジュール名]
```

### ビルドキャッシュの問題

```bash
# 完全なクリーンアップ
docker-compose -f docker-compose.prod.yml down -v
docker system prune -a --volumes
```

## 📝 まとめ

1. **根本原因**: package.jsonにaxiosが含まれていない
2. **解決策**: package.jsonを修正してaxiosを追加
3. **重要**: node_modulesフォルダをボリュームマウントしない
4. **確認**: ログでサーバーが正常に起動したことを確認

---

## 🚀 次のアクション

**Step 2でpackage.jsonにaxiosを追加してから、Step 5のクリーンビルドを実行してください。**

---
*最終更新: 2025年7月1日*