# SafeVideo デプロイメント - 現在の状況と次のステップ

**サーバー**: 167.172.92.88  
**作業ディレクトリ**: `/var/www/sharegramvideo/safevideo`  
**作成日時**: 2025年7月1日

## 📊 現在の状況

### ✅ 完了済みタスク
1. サーバーへのSSH接続
2. Docker/Docker Composeのインストール
3. プロジェクトファイルの配置
4. 環境変数ファイル（.env）の作成
5. Dockerfileの作成（server/Dockerfile、Dockerfile）
6. docker-compose.prod.ymlの作成

### ❌ 現在の問題
- **nginx.confファイルが不足している**
- エラーメッセージ: `COPY nginx.conf /etc/nginx/conf.d/default.conf: "/nginx.conf": not found`

## 🔧 今すぐ実行すべきコマンド

### Step 1: nginx.confファイルの作成

```bash
# 作業ディレクトリに移動
cd /var/www/sharegramvideo/safevideo

# nginx.confファイルを作成
cat > nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    # Reactアプリのルートディレクトリ
    root /usr/share/nginx/html;
    index index.html index.htm;
    
    # React Router対応 - 全てのルートをindex.htmlに
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # APIリクエストをバックエンドにプロキシ
    location /api {
        proxy_pass http://server:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静的ファイルのキャッシュ設定
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip圧縮の有効化
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/x-javascript;
    
    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# ファイルが作成されたか確認
ls -la nginx.conf
```

### Step 2: Dockerコンテナの再ビルドと起動

```bash
# 既存のコンテナを停止（エラーを避けるため）
docker-compose -f docker-compose.prod.yml down

# コンテナを再ビルドして起動
docker-compose -f docker-compose.prod.yml up -d --build --remove-orphans

# ビルドの進行状況を確認
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 3: コンテナの状態確認

```bash
# 全てのコンテナが起動しているか確認
docker-compose -f docker-compose.prod.yml ps

# 期待される出力:
# NAME                  COMMAND                  SERVICE    STATUS    PORTS
# safevideo-client      "nginx -g 'daemon of…"   client     running   0.0.0.0:3000->80/tcp
# safevideo-mysql       "docker-entrypoint.s…"   mysql      running   0.0.0.0:3306->3306/tcp
# safevideo-redis       "docker-entrypoint.s…"   redis      running   6379/tcp
# safevideo-server      "node server.js"         server     running   0.0.0.0:5000->5000/tcp
```

## 📝 ビルド成功後の残りのタスク

### Step 4: データベースの初期化

```bash
# MySQLが完全に起動するまで待機
echo "MySQLの起動を待機中..."
sleep 30

# データベーステーブルの作成（必要な場合）
docker-compose -f docker-compose.prod.yml exec server npm run migrate

# 初期管理者ユーザーの作成
docker-compose -f docker-compose.prod.yml exec mysql mysql -uroot -proot_password_change_this -e "
USE safevideo;
CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO Users (email, password, name, role) 
VALUES ('admin@example.com', '\$2a\$10\$khfTWK9oc3mTdk.HuWtSeetEYDwIsZ9yTV1POCJqbSka5krVk4HgK', 'Admin User', 'admin');
"
```

### Step 5: ホストNginxの設定（リバースプロキシ）

```bash
# Nginxがインストールされているか確認
which nginx || apt install -y nginx

# 設定ファイルの作成
cat > /etc/nginx/sites-available/safevideo << 'EOF'
server {
    listen 80;
    server_name 167.172.92.88;

    # ログファイル
    access_log /var/log/nginx/safevideo_access.log;
    error_log /var/log/nginx/safevideo_error.log;

    # フロントエンド（Reactアプリ）
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
        alias /var/www/sharegramvideo/safevideo/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
EOF

# 設定を有効化
ln -sf /etc/nginx/sites-available/safevideo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Nginx設定のテスト
nginx -t

# Nginxを再起動
systemctl restart nginx
```

### Step 6: 最終動作確認

```bash
# ローカルでの確認
curl -I http://localhost
curl http://localhost/api/integration/health

# 外部からの確認
curl -I http://167.172.92.88
```

## 🌐 ブラウザでのアクセス

1. ブラウザで `http://167.172.92.88` にアクセス
2. ログイン画面が表示されることを確認
3. 以下の認証情報でログイン：
   - Email: `admin@example.com`
   - Password: `AdminPassword123`

## ⚠️ トラブルシューティング

### ビルドエラーが続く場合

```bash
# Dockerのキャッシュをクリア
docker system prune -a

# 再度ビルド
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### ポート競合の場合

```bash
# 使用中のポートを確認
netstat -tlnp | grep -E ':(80|3000|5000)'

# 競合するサービスを停止
systemctl stop apache2  # 例
```

### ログの確認

```bash
# Docker コンテナのログ
docker-compose -f docker-compose.prod.yml logs server
docker-compose -f docker-compose.prod.yml logs client

# Nginxのログ
tail -f /var/log/nginx/safevideo_error.log
```

## 📌 重要な注意点

1. **nginx.confファイルは必須です** - Step 1を必ず実行してください
2. **ビルドには時間がかかります** - 5-10分程度お待ちください
3. **エラーが出た場合** - ログを確認して、エラーメッセージを共有してください

---

## 🚀 次のアクション

**今すぐStep 1のnginx.conf作成コマンドを実行してください！**

```bash
cd /var/www/sharegramvideo/safevideo
cat > nginx.conf << 'EOF'
[上記のnginx.conf内容をコピー]
EOF
```

---
*このドキュメントは現在の状況に基づいて作成されています*
*最終更新: 2025年7月1日*