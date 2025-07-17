# デプロイ後検証シナリオ

## 検証環境
- **本番URL**: https://singular-winter-370002.web.app
- **API URL**: https://api.sharegramvideo.org
- **検証日時**: [デプロイ完了後に記載]
- **検証担当**: dev2（品質検証担当）

## 1. Firebase認証フロー検証

### 1.1 Googleログイン検証
```
手順:
1. https://singular-winter-370002.web.app/firebase-login にアクセス
2. ブラウザの開発者ツールを開く（F12）
3. Networkタブ、Consoleタブを確認可能な状態にする
4. "Googleでログイン"ボタンをクリック
5. Google認証画面が表示されることを確認
6. テストアカウントでログイン実行

確認項目:
□ Googleログインボタンが表示される
□ クリック時にポップアップが開く
□ 認証後、正しくリダイレクトされる
□ Consoleにエラーが表示されない
□ tokenResponse関連のSyntaxErrorが発生しない
□ ログイン成功後、適切なページに遷移する
```

### 1.2 メール/パスワードログイン検証
```
手順:
1. メールアドレスとパスワードを入力
2. "ログイン"ボタンをクリック
3. 認証処理を確認

確認項目:
□ 入力フォームが正しく表示される
□ バリデーションエラーが適切に表示される
□ ログイン成功時に適切なページに遷移する
□ エラー時に適切なメッセージが表示される
```

## 2. APIエンドポイント疎通確認

### 2.1 ヘルスチェック
```bash
# コマンドライン実行
curl -X GET https://api.sharegramvideo.org/health

期待結果:
{
  "status": "ok",
  "timestamp": "2025-01-17T..."
}
```

### 2.2 認証エンドポイント確認
```
ブラウザ開発者ツール - Networkタブで確認:

1. ログイン時のAPIリクエスト
   - URL: https://api.sharegramvideo.org/api/auth/login
   - Method: POST
   - Status: 200 OK
   - Response: トークンを含むレスポンス

2. HTTPS通信の確認
   - すべてのリクエストがHTTPSで送信されている
   - Mixed Contentエラーが発生していない
```

### 2.3 CORS動作確認
```
確認項目:
□ Preflight（OPTIONS）リクエストが成功
□ Access-Control-Allow-Origin ヘッダーが含まれる
□ Credentialsが正しく送信される
```

## 3. エラーログ監視

### 3.1 ブラウザコンソール監視
```
監視項目:
□ SyntaxError（特に \\!tokenResponse.ok）
□ Mixed Content警告
□ CORS関連エラー
□ Firebase認証エラー
□ ネットワークエラー（ERR_CONNECTION_REFUSED等）

エラー記録フォーマット:
- エラータイプ: [error/warning/info]
- メッセージ: [詳細なエラーメッセージ]
- ファイル: [エラー発生ファイルと行番号]
- 再現手順: [エラーを再現する手順]
```

### 3.2 ネットワークエラー監視
```
確認項目:
□ 404 Not Found エラー
□ 500 Internal Server Error
□ タイムアウトエラー
□ SSL/TLS関連エラー
```

## 4. セキュリティ検証

### 4.1 HTTPS強制確認
```
手順:
1. HTTPでアクセス試行: http://singular-winter-370002.web.app
2. HTTPSにリダイレクトされることを確認
3. すべてのリソースがHTTPSで読み込まれることを確認
```

### 4.2 認証トークン確認
```
確認項目:
□ トークンがlocalStorageに保存されない（セッションのみ）
□ APIリクエストにAuthorizationヘッダーが含まれる
□ トークンの有効期限が適切
```

## 5. WebSocket接続検証

### 5.1 接続確立確認
```
ブラウザ開発者ツール - Networkタブ - WSフィルター:
□ wss://api.sharegramvideo.org/ws への接続確立
□ ハートビートメッセージの送受信
□ 接続維持の確認
```

## 検証結果記録テンプレート

```markdown
## 検証実施記録

### 基本情報
- 検証日時: YYYY-MM-DD HH:MM
- 検証者: dev2
- ブラウザ: [Chrome/Firefox/Safari] バージョン: XX
- OS: [Windows/Mac/Linux]

### 検証結果サマリー
- [ ] Firebase認証: OK/NG
- [ ] API疎通: OK/NG
- [ ] HTTPS通信: OK/NG
- [ ] エラーなし: OK/NG

### 発見された問題
1. 問題の概要:
   - 詳細:
   - 再現手順:
   - 影響範囲:

### スクリーンショット
- ログイン画面: [screenshot1.png]
- エラー画面: [screenshot2.png]
- ネットワークタブ: [screenshot3.png]

### 次のアクション
- [ ] 問題の修正が必要
- [ ] 追加検証が必要
- [ ] デプロイ完了承認
```

## 自動検証スクリプト

### 基本疎通確認スクリプト
```bash
#!/bin/bash
echo "=== デプロイ後自動検証開始 ==="

# 1. ヘルスチェック
echo "1. APIヘルスチェック..."
curl -s https://api.sharegramvideo.org/health | jq '.'

# 2. Firebase Hosting確認
echo "2. Firebase Hosting確認..."
curl -s -o /dev/null -w "%{http_code}" https://singular-winter-370002.web.app

# 3. HTTPS証明書確認
echo "3. SSL証明書確認..."
echo | openssl s_client -connect api.sharegramvideo.org:443 2>/dev/null | openssl x509 -noout -dates

echo "=== 自動検証完了 ==="
```

## 待機中のタスク
現在、dev1とdev3のデプロイ作業完了を待機中です。
完了通知を受け次第、上記の検証シナリオに従って本番環境での動作検証を実施します。