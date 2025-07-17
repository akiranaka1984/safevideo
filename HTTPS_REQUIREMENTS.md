# HTTPS要件ドキュメント

## 概要
SafeVideoアプリケーションは本番環境でHTTPSが必須です。Firebase認証およびセキュアなAPI通信のため、すべての通信は暗号化される必要があります。

## 必須要件

### 1. Firebaseアプリケーション（フロントエンド）
- **URL**: https://singular-winter-370002.web.app
- **プロトコル**: HTTPS必須
- **理由**: 
  - Firebase認証がHTTPSを要求
  - ブラウザのセキュリティポリシー
  - クッキーとセッション管理のセキュリティ

### 2. APIサーバー（バックエンド）
- **URL**: https://api.sharegramvideo.org
- **プロトコル**: HTTPS必須
- **WebSocket**: wss://api.sharegramvideo.org/ws
- **理由**:
  - 認証トークンの安全な送信
  - ユーザーデータの保護
  - クロスオリジン通信のセキュリティ

## 設定確認項目

### 環境変数（.env.production）
```env
# HTTPSを強制
FORCE_HTTPS=true

# API URLはHTTPSを使用
REACT_APP_API_URL=https://api.sharegramvideo.org/api

# WebSocketはWSSを使用
REACT_APP_WS_URL=wss://api.sharegramvideo.org/ws
```

### Firebase設定（src/config/firebase.js）
- 本番環境でHTTPSチェックが実装済み
- HTTPでアクセスした場合はエラーを表示

### CORS設定（config/cors.js）
- 許可されたオリジンにHTTPSのURLのみを含む
- 本番環境: https://singular-winter-370002.web.app

## デプロイメントチェックリスト

1. **SSL証明書の確認**
   - api.sharegramvideo.org に有効なSSL証明書が設定されていること
   - 証明書の有効期限を確認

2. **リダイレクト設定**
   - HTTPからHTTPSへの自動リダイレクトを設定
   - nginxまたはロードバランサーでの設定推奨

3. **セキュリティヘッダー**
   - Strict-Transport-Security (HSTS)
   - X-Content-Type-Options
   - X-Frame-Options

4. **環境変数の確認**
   - すべての環境でHTTPS URLが設定されていること
   - 開発環境と本番環境の切り替えが正しく機能すること

## トラブルシューティング

### Mixed Content エラー
- すべてのリソース（API、画像、スクリプト）がHTTPSで読み込まれていることを確認
- ブラウザのコンソールでエラーを確認

### CORS エラー
- APIサーバーのCORS設定でHTTPSオリジンが許可されていることを確認
- プリフライトリクエストが正しく処理されていることを確認

### WebSocket接続エラー
- WSではなくWSSプロトコルを使用していることを確認
- ファイアウォールがWebSocket通信を許可していることを確認

## 関連ファイル
- `/safevideo/.env.production` - 本番環境設定
- `/safevideo/src/config/firebase.js` - Firebase設定とHTTPSチェック
- `/config/cors.js` - CORS設定
- `/safevideo/services/api.js` - API通信設定