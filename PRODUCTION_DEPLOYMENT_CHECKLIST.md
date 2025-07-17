# 本番環境デプロイメントチェックリスト

## 環境設定完了項目

### ✅ 1. 環境変数設定（.env.production）
- [x] API URLをHTTPSに変更: `https://api.sharegramvideo.org/api`
- [x] WebSocket URLをWSSに変更: `wss://api.sharegramvideo.org/ws`
- [x] Firebase設定を追加
- [x] FORCE_HTTPSをtrueに設定

### ✅ 2. package.json修正
- [x] プロキシ設定を削除（本番環境では不要）

### ✅ 3. Firebase設定確認
- [x] src/config/firebase.js でHTTPSチェック実装済み
- [x] 環境変数による設定切り替え実装済み

### ✅ 4. HTTPS要件ドキュメント
- [x] HTTPS_REQUIREMENTS.md を作成

## デプロイ前の確認事項

### 1. ビルドの実行
```bash
npm run build
```
- ビルドが正常に完了すること
- 警告は許容（ESLintの未使用変数警告のみ）

### 2. 環境変数の確認
- 本番サーバーで.env.productionが正しく配置されていること
- すべての必須環境変数が設定されていること

### 3. SSL証明書
- api.sharegramvideo.org のSSL証明書が有効であること
- HTTPからHTTPSへのリダイレクトが設定されていること

### 4. Firebaseプロジェクト設定
- Firebase Consoleで以下を確認:
  - 認証済みドメインに `singular-winter-370002.web.app` が追加されていること
  - 認証済みドメインに `api.sharegramvideo.org` が追加されていること（必要な場合）

### 5. CORS設定
- バックエンドサーバーのCORS設定で本番URLが許可されていること

## デプロイコマンド

### Firebaseホスティングへのデプロイ
```bash
# ビルド
npm run build

# Firebaseへデプロイ
firebase deploy --only hosting
```

### バックエンドサーバーへのデプロイ
```bash
# サーバーにSSH接続
ssh user@api.sharegramvideo.org

# 最新コードを取得
git pull origin master

# 依存関係をインストール
npm install --production

# サービスを再起動
pm2 restart safevideo-api
```

## デプロイ後の確認

### 1. アプリケーションアクセス
- https://singular-winter-370002.web.app にアクセス
- ログインページが表示されること
- コンソールにエラーがないこと

### 2. API接続確認
- ネットワークタブでAPIリクエストを確認
- HTTPSで通信されていること
- CORSエラーがないこと

### 3. Firebase認証確認
- Googleログインが機能すること
- メール/パスワードログインが機能すること

### 4. WebSocket接続確認
- WebSocket接続がWSSで確立されること
- リアルタイム機能が動作すること

## トラブルシューティング

### Mixed Contentエラー
- すべてのリソースがHTTPSで読み込まれているか確認
- .env.productionの設定を再確認

### CORSエラー
- バックエンドのCORS設定を確認
- 本番URLが許可リストに含まれているか確認

### Firebase認証エラー
- Firebase Consoleで認証済みドメインを確認
- APIキーが正しく設定されているか確認

## 関連ドキュメント
- [HTTPS要件](./HTTPS_REQUIREMENTS.md)
- [環境設定ファイル](./.env.production)
- [Firebaseドキュメント](https://firebase.google.com/docs)