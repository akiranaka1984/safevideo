# Firebase認証デプロイメント修正ガイド

## 問題
- Firebase認証エンドポイントが502 Bad Gatewayエラーを返す
- 原因：Firebase環境変数が本番環境に設定されていない

## 解決手順

### 1. 環境変数の設定

サーバー上で以下の環境変数を設定する必要があります：

```bash
# /opt/safevideo/.env.production に追加
FIREBASE_PROJECT_ID=singular-winter-370002
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-vs2w6@singular-winter-370002.iam.gserviceaccount.com
```

### 2. Docker Composeの更新

```bash
cd /opt/safevideo
git pull origin main
```

### 3. サービスの再起動

```bash
# 環境変数を読み込んでサービスを再起動
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### 4. 動作確認

```bash
# ヘルスチェック
curl http://localhost:5000/health

# Firebase認証エンドポイントの確認
curl -X POST http://localhost:5000/api/auth/firebase-verify \
  -H "Content-Type: application/json" \
  -d '{"id_token": "test", "client_id": "sharegram"}'
```

## 注意事項
- Firebase Private Keyは改行文字を`\n`でエスケープする必要があります
- 本番環境の.envファイルは絶対にGitにコミットしないでください