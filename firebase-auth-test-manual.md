# Firebase認証手動テスト手順書

## テスト前準備

### 必要なテストアカウント
1. **Googleアカウント**: テスト用Googleアカウント
2. **メール/パスワード**: test@example.com / TestPassword123!

### ブラウザ設定
- キャッシュをクリア
- シークレット/プライベートモードを使用推奨
- 開発者ツールを開いておく（F12）

## テストケース1: Googleログイン成功フロー

### 手順
1. **アクセス**
   - URL: https://singular-winter-370002.web.app/firebase-login
   - ページが完全に読み込まれるまで待機

2. **開発者ツール確認**
   - Consoleタブ: エラーがないことを確認
   - Networkタブ: すべてのリソースがHTTPSで読み込まれていることを確認

3. **Googleログイン実行**
   - "Googleでログイン"ボタンをクリック
   - Googleアカウント選択画面が表示される
   - テストアカウントを選択

4. **認証後の確認**
   - ダッシュボードまたはホームページにリダイレクト
   - ユーザー情報が表示される
   - ログアウトボタンが表示される

### 期待結果
- ✅ エラーなくログイン完了
- ✅ 適切なページにリダイレクト
- ✅ ユーザーセッションが確立

### エラーチェックポイント
- ❌ "SyntaxError: \\!tokenResponse.ok" が表示されない
- ❌ "auth/invalid-api-key" エラーが表示されない
- ❌ "auth/unauthorized-domain" エラーが表示されない

## テストケース2: メール/パスワードログイン

### 手順
1. **フォーム入力**
   - メール: test@example.com
   - パスワード: TestPassword123!

2. **ログイン実行**
   - "ログイン"ボタンをクリック
   - ローディング表示を確認

3. **結果確認**
   - 成功: ダッシュボードへ遷移
   - 失敗: エラーメッセージ表示

### バリデーションテスト
- 空のメールアドレス → エラー表示
- 無効なメール形式 → エラー表示
- 短いパスワード → エラー表示

## テストケース3: エラーハンドリング

### ネットワークエラー
1. **開発者ツール** → **Network** → **Offline**モードに設定
2. ログインボタンをクリック
3. 適切なエラーメッセージが表示されることを確認

### 無効な認証情報
1. 存在しないメールアドレスでログイン試行
2. エラーメッセージ: "ユーザーが見つかりません"等

### Firebase設定エラー
1. Consoleでエラーを監視
2. 以下のエラーが発生しないことを確認:
   - Firebase App not initialized
   - Invalid API key
   - Permission denied

## テストケース4: セキュリティ確認

### HTTPS通信確認
1. **URLバー**の鍵アイコンを確認
2. **開発者ツール** → **Security**タブ
3. すべての通信がセキュアであることを確認

### トークン管理
1. **開発者ツール** → **Application** → **Local Storage**
2. 認証トークンが適切に管理されていることを確認
3. セッション終了時にクリアされることを確認

## トラブルシューティングガイド

### よくあるエラーと対処法

#### 1. SyntaxErrorが発生する場合
```
エラー: Uncaught SyntaxError: \\!tokenResponse.ok
対処: 
- ブラウザキャッシュをクリア
- 最新のビルドがデプロイされているか確認
- ビルドプロセスでのエラーを確認
```

#### 2. CORSエラーが発生する場合
```
エラー: Access to fetch at 'https://api.sharegramvideo.org' from origin 'https://singular-winter-370002.web.app' has been blocked by CORS policy
対処:
- バックエンドのCORS設定を確認
- 本番URLが許可リストに含まれているか確認
```

#### 3. Firebase認証エラー
```
エラー: auth/unauthorized-domain
対処:
- Firebase Console → Authentication → Settings → Authorized domains
- singular-winter-370002.web.app が追加されているか確認
```

## レポート作成

### 成功時のレポート例
```
テスト実施日: 2025-01-17
テスト環境: Chrome 120, macOS
テスト結果: すべて成功

詳細:
- Googleログイン: ✅ 成功（2秒で完了）
- メール/パスワード: ✅ 成功
- エラーハンドリング: ✅ 適切に動作
- セキュリティ: ✅ HTTPS通信確認
```

### 失敗時のレポート例
```
テスト実施日: 2025-01-17
テスト環境: Chrome 120, macOS
テスト結果: 一部失敗

失敗項目:
1. Googleログイン時にSyntaxError発生
   - エラー: \\!tokenResponse.ok
   - 発生箇所: 不明（minified code）
   - 再現率: 100%
   - スクリーンショット: attached

対応必要事項:
- ビルドプロセスの確認
- エラーの原因調査
```