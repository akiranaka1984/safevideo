# SafeVideo デプロイメント - JSONパースエラーとポート競合の解決

**サーバー**: 167.172.92.88  
**エラー1**: `JSON.parse Unexpected token "　" (0x3000)` - 全角スペースエラー  
**エラー2**: `address already in use` - ポート3306競合  
**作成日時**: 2025年7月1日

## 🚨 発生した問題

### 1. package.jsonの全角スペースエラー
```
npm ERR! JSON.parse Unexpected token "　" (0x3000) in JSON at position 2071
npm ERR! JSON.parse Failed to parse JSON data.
```

### 2. MySQLポート競合エラー
```
ERROR: failed to bind host port for 0.0.0.0:3306:172.18.0.4:3306/tcp: 
address already in use
```

## 🔧 解決手順

### Step 1: package.jsonの全角スペース問題を修正

```bash
# サーバーディレクトリに移動
cd /var/www/sharegramvideo/safevideo/server

# バックアップを作成
cp package.json package.json.backup

# 全角スペースを半角スペースに自動置換
sed -i 's/　/ /g' package.json

# 確認（全角スペースが残っていないか）
grep -n "　" package.json
# 何も表示されなければOK
```

#### 手動で編集する場合
```bash
# エディタで開く
nano package.json

# axiosの行を探して、インデントの全角スペースを削除
# 悪い例: 　　"axios": "^1.6.0",
# 良い例:     "axios": "^1.6.0",
```

### Step 2: 既存のMySQLコンテナ/サービスを停止

#### 2.1 Dockerコンテナの確認と停止
```bash
# MySQLコンテナを確認
docker ps -a | grep mysql

# 実行中のMySQLコンテナを停止
docker stop $(docker ps -q --filter name=mysql)

# 古いコンテナを削除
docker rm $(docker ps -aq --filter name=mysql)
```

#### 2.2 システムのMySQLサービスを確認
```bash
# ポート3306の使用状況を確認
netstat -tlnp | grep 3306
# または
lsof -i :3306

# システムのMySQLが動いている場合は停止
systemctl stop mysql
# または
service mysql stop

# 自動起動を無効化（必要な場合）
systemctl disable mysql
```

### Step 3: 既存のDockerコンテナをクリーンアップ

```bash
# プロジェクトディレクトリに移動
cd /var/www/sharegramvideo/safevideo

# 全てのsafevideoコンテナを停止・削除（ボリュームも削除）
docker-compose -f docker-compose.prod.yml down -v

# 未使用のコンテナを削除
docker container prune -f

# 未使用のイメージを削除（オプション）
docker image prune -f
```

### Step 4: 正しいpackage.jsonを作成

```bash
cd /var/www/sharegramvideo/safevideo/server

# 完全に新しいpackage.jsonを作成
cat > package.json << 'EOF'
{
  "name": "safevideo-kyc-server",
  "version": "1.0.0",
  "description": "SafeVideo KYC System API Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["kyc", "safevideo", "api"],
  "author": "SafeVideo Team",
  "license": "MIT",
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
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOF

# JSONの検証
node -e "console.log('JSONは有効です:', JSON.parse(require('fs').readFileSync('package.json')))"
```

### Step 5: docker-compose.prod.ymlのポート設定を調整

#### オプション1: MySQLのポートを変更
```bash
cd /var/www/sharegramvideo/safevideo

# ポート3307を使用するように変更
sed -i 's/- "3306:3306"/- "3307:3306"/' docker-compose.prod.yml

# 変更を確認
grep -A2 "ports:" docker-compose.prod.yml
```

#### オプション2: 外部ポートマッピングを削除（推奨）
```bash
# docker-compose.prod.ymlを編集
nano docker-compose.prod.yml

# MySQLサービスのportsセクションをコメントアウトまたは削除
# 変更前:
#   ports:
#     - "3306:3306"
# 変更後:
#   # ports:
#   #   - "3306:3306"
```

#### オプション3: 完全なdocker-compose.prod.ymlの再作成
```bash
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
    # 外部からのアクセスが必要ない場合はコメントアウト
    # ports:
    #   - "3307:3306"
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
      - ./uploads:/app/uploads
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

### Step 6: 再ビルドと起動

```bash
cd /var/www/sharegramvideo/safevideo

# サーバーイメージを再ビルド
docker-compose -f docker-compose.prod.yml build --no-cache server

# 全サービスを起動
docker-compose -f docker-compose.prod.yml up -d

# ログを監視
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 7: 動作確認

```bash
# コンテナの状態を確認
docker-compose -f docker-compose.prod.yml ps

# 期待される出力:
# NAME                COMMAND                  SERVICE    STATUS    PORTS
# safevideo-client    "nginx -g 'daemon..."    client     running   0.0.0.0:3000->80/tcp
# safevideo-mysql     "docker-entrypoint..."   mysql      running   33060/tcp
# safevideo-redis     "docker-entrypoint..."   redis      running   6379/tcp
# safevideo-server    "node server.js"         server     running   0.0.0.0:5000->5000/tcp

# サーバーが正常に起動しているか確認
curl http://localhost:5000/api/integration/health
```

## 🔍 トラブルシューティング

### それでもJSONエラーが出る場合

```bash
# package.jsonの文字コードを確認
file -i server/package.json

# UTF-8に変換
iconv -f UTF-8 -t UTF-8 -c server/package.json > server/package.json.new
mv server/package.json.new server/package.json

# 隠れた文字を可視化
cat -A server/package.json | grep "M-"
```

### ポートがまだ使用中の場合

```bash
# プロセスを強制終了
sudo kill -9 $(sudo lsof -t -i:3306)

# または、別のポートを使用
# docker-compose.prod.ymlで 3308:3306 など
```

### ビルドキャッシュの問題

```bash
# 完全なクリーンアップ
docker system prune -a --volumes -f
```

## ✅ 成功の確認ポイント

1. **package.jsonが正しく読み込まれる**
   ```bash
   docker-compose -f docker-compose.prod.yml exec server node -e "console.log(require('./package.json').name)"
   # 出力: safevideo-kyc-server
   ```

2. **全コンテナが起動している**
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   # 全て "running" 状態
   ```

3. **サーバーログにエラーがない**
   ```
   safevideo-server | Server running on port 5000
   safevideo-server | MySQL接続成功
   ```

## 📝 まとめ

### 問題の原因
1. **全角スペース**: エディタの自動変換やコピペミスによる
2. **ポート競合**: システムのMySQLまたは他のDockerコンテナが3306を使用

### 解決のポイント
1. package.jsonから全角文字を完全に除去
2. ポート競合を回避（変更または削除）
3. クリーンな状態から再ビルド

---

## 🚀 次のアクション

1. **Step 1-4** を実行して問題を修正
2. **Step 6** で再ビルドと起動
3. **Step 7** で動作確認

問題が解決しない場合は、エラーログを確認してください。

---
*最終更新: 2025年7月1日*