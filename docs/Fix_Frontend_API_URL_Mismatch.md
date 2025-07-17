# SafeVideo デプロイメント - フロントエンドAPIのURL不一致エラーの解決

**サーバー**: 167.172.92.88  
**エラー**: 一般ユーザーログイン時に `localhost:5002` へのリクエストで400エラー  
**作成日時**: 2025年7月1日

## 🚨 問題の詳細

### 現在の状況
- ✅ 管理者アカウント（admin@example.com）はログイン成功
- ❌ 一般ユーザーアカウントは400エラーでログイン失敗
- ❌ フロントエンドが `localhost:5002/api/auth/login` にリクエストを送信
- ✅ 正しいAPIは `http://167.172.92.88:5000/api/auth/login`

### エラーの原因
1. フロントエンドのビルド時に環境変数が反映されていない
2. ハードコードされたAPI URLが存在する
3. ビルドキャッシュが古い設定を保持している

## 🔧 完全な解決手順

### Step 1: フロントエンドのソースコードを確認

```bash
# フロントエンドディレクトリに移動
cd /var/www/sharegramvideo/safevideo

# API URLの設定箇所を検索
grep -r "localhost:5002" src/ public/
grep -r "5002" src/ public/
grep -r "API_URL" src/

# 環境変数の使用箇所を確認
grep -r "process.env.REACT_APP_API_URL" src/
```

### Step 2: src/config/api.jsを修正（または作成）

```bash
# API設定ファイルを作成
cat > src/config/api.js << 'EOF'
// API設定ファイル
const API_URL = process.env.REACT_APP_API_URL || 'http://167.172.92.88:5000';

// デバッグ用ログ
console.log('API URL configured:', API_URL);

export default API_URL;
EOF
```

### Step 3: src/services/api.jsまたは該当ファイルを修正

```bash
# 既存のAPI設定を確認
find src -name "*.js" -o -name "*.jsx" | xargs grep -l "axios.create\|baseURL"

# 見つかったファイルを修正（例: src/services/api.js）
cat > src/services/api.js << 'EOF'
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://167.172.92.88:5000';

console.log('Configuring API with URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Request to:', config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
EOF
```

### Step 4: .envファイルを作成（本番用）

```bash
# 本番環境用の.envファイルを作成
cat > .env.production << 'EOF'
REACT_APP_API_URL=http://167.172.92.88:5000
NODE_ENV=production
EOF

# 開発環境用も作成（念のため）
cat > .env << 'EOF'
REACT_APP_API_URL=http://167.172.92.88:5000
EOF
```

### Step 5: Dockerfileを修正して環境変数を確実に設定

```bash
# フロントエンドのDockerfileを修正
cat > Dockerfile << 'EOF'
# ビルドステージ
FROM node:16-alpine as build

WORKDIR /app

# package.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# ソースコードをコピー
COPY . .

# 環境変数を設定してビルド
ARG REACT_APP_API_URL=http://167.172.92.88:5000
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# ビルド前に環境変数を確認
RUN echo "Building with API URL: $REACT_APP_API_URL"

# アプリケーションをビルド
RUN npm run build

# 本番ステージ
FROM nginx:alpine

# Nginxの設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ビルドされたファイルをコピー
COPY --from=build /app/build /usr/share/nginx/html

# 環境変数を置換するスクリプトを追加
COPY env-config.sh /docker-entrypoint.d/env-config.sh
RUN chmod +x /docker-entrypoint.d/env-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF
```

### Step 6: 環境変数置換スクリプトを作成

```bash
# env-config.shを作成（動的な環境変数対応）
cat > env-config.sh << 'EOF'
#!/bin/sh

# 環境変数をJavaScriptファイルに注入
echo "window._env_ = {" > /usr/share/nginx/html/env-config.js
echo "  REACT_APP_API_URL: '${REACT_APP_API_URL:-http://167.172.92.88:5000}'" >> /usr/share/nginx/html/env-config.js
echo "};" >> /usr/share/nginx/html/env-config.js

echo "Environment config created with API URL: ${REACT_APP_API_URL:-http://167.172.92.88:5000}"
EOF

chmod +x env-config.sh
```

### Step 7: public/index.htmlに環境変数スクリプトを追加

```bash
# index.htmlに環境変数読み込みを追加
sed -i '/<\/head>/i \  <script src="/env-config.js"></script>' public/index.html

# または手動で編集
nano public/index.html
# </head>タグの前に以下を追加:
# <script src="/env-config.js"></script>
```

### Step 8: docker-compose.prod.ymlを更新

```bash
# docker-compose.prod.ymlのclientサービスを更新
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
      args:
        REACT_APP_API_URL: http://167.172.92.88:5000
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

### Step 9: フロントエンドを完全に再ビルド

```bash
cd /var/www/sharegramvideo/safevideo

# 既存のクライアントコンテナを停止・削除
docker-compose -f docker-compose.prod.yml stop client
docker-compose -f docker-compose.prod.yml rm -f client

# イメージも削除（キャッシュをクリア）
docker rmi safevideo-client

# node_modulesとビルドフォルダを削除（ローカル）
rm -rf node_modules
rm -rf build

# 再ビルド
docker-compose -f docker-compose.prod.yml build --no-cache client

# 起動
docker-compose -f docker-compose.prod.yml up -d client

# ログを確認
docker-compose -f docker-compose.prod.yml logs -f client
```

### Step 10: ブラウザのキャッシュをクリア

```bash
# ブラウザで以下を実行：
# 1. Ctrl+Shift+R (強制リロード)
# 2. または開発者ツールを開いて Network タブで "Disable cache" をチェック
# 3. またはシークレット/プライベートウィンドウで開く
```

## 🔍 デバッグ方法

### 1. コンテナ内のビルドファイルを確認

```bash
# env-config.jsが生成されているか確認
docker exec safevideo-client cat /usr/share/nginx/html/env-config.js

# ビルドされたJSファイルを確認
docker exec safevideo-client grep -r "localhost:5002" /usr/share/nginx/html/static/js/
```

### 2. ブラウザのコンソールで確認

```javascript
// ブラウザの開発者ツールコンソールで実行
console.log(window._env_);
console.log(process.env.REACT_APP_API_URL);
```

### 3. ネットワークタブで確認

ブラウザの開発者ツール > Network タブで、実際のAPIリクエストURLを確認

## 🚑 緊急対応

### 方法1: Nginxでプロキシ設定

```bash
# nginx.confを作成
cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # APIリクエストをプロキシ
    location /api {
        proxy_pass http://167.172.92.88:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

### 方法2: ビルド後にJSファイルを直接修正

```bash
# コンテナ内でJSファイルを修正
docker exec -it safevideo-client sh

# localhost:5002を検索
find /usr/share/nginx/html -name "*.js" -exec grep -l "localhost:5002" {} \;

# sedで置換
find /usr/share/nginx/html -name "*.js" -exec sed -i 's|localhost:5002|167.172.92.88:5000|g' {} \;

exit
```

## ✅ 成功の確認

1. **環境変数の確認**
   ```bash
   docker exec safevideo-client printenv | grep REACT_APP_API_URL
   # 出力: REACT_APP_API_URL=http://167.172.92.88:5000
   ```

2. **一般ユーザーでログイン**
   - user@example.com / AdminPassword123
   - test1@example.com / AdminPassword123

3. **ネットワークリクエストの確認**
   - 開発者ツールでAPIリクエストが `167.172.92.88:5000` に送信されることを確認

## 📝 まとめ

### 問題の根本原因
1. React環境変数がビルド時に固定される
2. localhost:5002がハードコードされている可能性
3. ビルドキャッシュが古い設定を保持

### 解決のポイント
1. 環境変数を正しく設定してビルド
2. 動的な環境変数対応（env-config.js）
3. キャッシュを完全にクリアして再ビルド

## 🎯 推奨される永続的な解決策

1. **API URLを環境変数で管理**
2. **ビルド時に環境変数を注入**
3. **実行時にも環境変数を読める仕組み**
4. **Nginxプロキシでフォールバック**

---

## 🚀 次のステップ

1. **Step 1-2** でハードコードされたURLを特定
2. **Step 9** で完全な再ビルド
3. **Step 10** でブラウザキャッシュをクリア
4. 一般ユーザーでログインテスト

---
*最終更新: 2025年7月1日*