# Nginx設定ファイル（修正版）

## 修正が必要な箇所

元の設定では、アップロードディレクトリのパスが異なっています：
- Nginx設定: `/var/www/safevideo/uploads`
- 実際のパス: `/var/www/sharegramvideo/safevideo/uploads`

## 修正したNginx設定

```bash
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

    # アップロードファイル（パスを修正）
    location /uploads {
        alias /var/www/sharegramvideo/safevideo/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # セキュリティヘッダーを追加
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        
        # 特定のファイルタイプのみ許可
        location ~ \.(jpg|jpeg|png|gif|pdf|doc|docx)$ {
            # ファイルを提供
        }
        
        # PHPやその他の実行可能ファイルをブロック
        location ~ \.(php|sh|exe)$ {
            deny all;
        }
    }

    # 追加のセキュリティ設定
    client_max_body_size 10M;
    
    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF
```

## さらに本番環境向けの改善版

HTTPS対応とより詳細な設定を含む版：

```bash
cat > /etc/nginx/sites-available/safevideo << 'EOF'
# HTTPからHTTPSへのリダイレクト（SSL証明書がある場合）
# server {
#     listen 80;
#     server_name 167.172.92.88;
#     return 301 https://$server_name$request_uri;
# }

server {
    listen 80;
    # listen 443 ssl http2;  # SSL証明書がある場合はコメントを外す
    server_name 167.172.92.88;
    
    # SSL設定（証明書がある場合）
    # ssl_certificate /etc/ssl/certs/safevideo.crt;
    # ssl_certificate_key /etc/ssl/private/safevideo.key;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers HIGH:!aNULL:!MD5;
    
    # ルートディレクトリ
    root /var/www/sharegramvideo/safevideo;
    
    # アクセスログとエラーログ
    access_log /var/log/nginx/safevideo_access.log;
    error_log /var/log/nginx/safevideo_error.log;

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
        
        # タイムアウト設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
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
        
        # APIのタイムアウトは長めに設定
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # アップロードファイル
    location /uploads {
        alias /var/www/sharegramvideo/safevideo/uploads;
        
        # キャッシュ設定
        expires 30d;
        add_header Cache-Control "public, immutable";
        
        # セキュリティヘッダー
        add_header X-Content-Type-Options nosniff;
        add_header X-Frame-Options DENY;
        
        # 許可するファイルタイプ
        location ~ \.(jpg|jpeg|png|gif|pdf|doc|docx)$ {
            # 正常に提供
        }
        
        # 危険なファイルタイプをブロック
        location ~ \.(php|php3|php4|php5|phtml|pl|py|jsp|asp|sh|cgi|exe|bat)$ {
            deny all;
            return 403;
        }
    }
    
    # 静的ファイル（React ビルド後のファイル）
    location /static {
        alias /var/www/sharegramvideo/safevideo/build/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ファイルアップロードサイズ制限
    client_max_body_size 10M;
    client_body_buffer_size 1M;
    
    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' data: https:;" always;
    
    # Gzip圧縮
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_comp_level 6;
    gzip_min_length 1000;
    
    # DDoS対策
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    
    # 一般的なリクエストレート制限を適用
    location ~ ^/(?!api) {
        limit_req zone=general burst=20 nodelay;
    }
    
    # APIエンドポイントには別のレート制限
    location ~ ^/api {
        limit_req zone=api burst=50 nodelay;
    }
}
EOF
```

## 設定適用コマンド

```bash
# 設定ファイルを有効化
ln -sf /etc/nginx/sites-available/safevideo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Nginx設定のテスト
nginx -t

# Nginxの再起動
systemctl restart nginx

# ログの確認
tail -f /var/log/nginx/safevideo_error.log
```

## 主な修正点

1. **アップロードパスの修正**
   - `/var/www/safevideo/uploads` → `/var/www/sharegramvideo/safevideo/uploads`

2. **セキュリティ強化**
   - 実行可能ファイルのブロック
   - セキュリティヘッダーの追加
   - Content Security Policy の設定

3. **パフォーマンス最適化**
   - Gzip圧縮の有効化
   - 静的ファイルのキャッシュ設定
   - タイムアウト設定の調整

4. **DDoS対策**
   - レート制限の実装
   - バースト制限の設定

この設定により、セキュアで高性能な本番環境が構築できます。