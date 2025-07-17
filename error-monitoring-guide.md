# エラー監視ガイド

## 監視対象エラーと対処法

### 1. Firebase認証関連エラー

#### auth/invalid-api-key
```javascript
// エラー例
Error: Firebase: Error (auth/invalid-api-key).

// 原因
- Firebase APIキーが無効または誤っている
- 環境変数が正しく読み込まれていない

// 対処法
1. .env.productionのREACT_APP_FIREBASE_API_KEYを確認
2. Firebase Consoleでプロジェクト設定を確認
3. ビルド時に環境変数が正しく適用されているか確認
```

#### auth/unauthorized-domain
```javascript
// エラー例
Error: Firebase: Error (auth/unauthorized-domain).

// 原因
- 現在のドメインがFirebaseで承認されていない

// 対処法
1. Firebase Console → Authentication → Settings
2. Authorized domainsに以下を追加:
   - singular-winter-370002.web.app
   - singular-winter-370002.firebaseapp.com
   - localhost (開発用)
```

#### auth/network-request-failed
```javascript
// エラー例
Error: Firebase: Error (auth/network-request-failed).

// 原因
- ネットワーク接続の問題
- Firebase サービスへの接続がブロックされている

// 対処法
1. インターネット接続を確認
2. ファイアウォール設定を確認
3. プロキシ設定を確認
```

### 2. SyntaxError: \\!tokenResponse.ok

#### 監視方法
```javascript
// ブラウザコンソールで監視
window.addEventListener('error', (e) => {
  if (e.message.includes('tokenResponse') || e.message.includes('\\\\!')) {
    console.error('TokenResponse SyntaxError detected:', e);
    // エラーレポート送信
  }
});
```

#### 原因と対処法
```
原因:
- ビルドプロセスでのコード変換エラー
- 文字エスケープの問題
- minificationの問題

対処法:
1. ソースマップを有効にして正確なエラー位置を特定
2. ビルドコマンド実行: GENERATE_SOURCEMAP=true npm run build
3. エラー発生箇所のコードを確認
```

### 3. CORS関連エラー

#### 典型的なCORSエラー
```
Access to fetch at 'https://api.sharegramvideo.org/api/auth/login' 
from origin 'https://singular-winter-370002.web.app' 
has been blocked by CORS policy
```

#### 確認項目
```bash
# CORSヘッダー確認
curl -I -X OPTIONS https://api.sharegramvideo.org/api/auth/login \
  -H "Origin: https://singular-winter-370002.web.app" \
  -H "Access-Control-Request-Method: POST"

# 期待されるレスポンスヘッダー
Access-Control-Allow-Origin: https://singular-winter-370002.web.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

### 4. Mixed Content エラー

#### エラー例
```
Mixed Content: The page at 'https://singular-winter-370002.web.app' 
was loaded over HTTPS, but requested an insecure resource 'http://...'. 
This request has been blocked.
```

#### チェックリスト
- [ ] すべてのAPI URLがHTTPSを使用
- [ ] 画像、スクリプト、スタイルシートがHTTPSで読み込まれる
- [ ] WebSocket接続がWSSを使用
- [ ] 外部リソースがすべてHTTPSを使用

### 5. ネットワークエラー

#### ERR_CONNECTION_REFUSED
```
原因:
- APIサーバーが起動していない
- ポートがブロックされている
- URLが間違っている

確認コマンド:
curl -I https://api.sharegramvideo.org/health
```

#### ERR_SSL_PROTOCOL_ERROR
```
原因:
- SSL証明書の問題
- HTTPSが正しく設定されていない

確認コマンド:
openssl s_client -connect api.sharegramvideo.org:443 -servername api.sharegramvideo.org
```

## エラー監視ツール

### ブラウザ開発者ツール設定

#### Console設定
```javascript
// すべてのエラーをキャッチ
console.error = (function(oldError) {
  return function(...args) {
    // カスタムエラー処理
    if (args[0].includes('Firebase') || args[0].includes('tokenResponse')) {
      alert('Critical error detected! Check console.');
    }
    oldError.apply(console, args);
  };
})(console.error);
```

#### Network監視
1. Preserve logを有効化
2. Disable cacheを有効化
3. Failed requestsをフィルター

### 自動エラー収集スクリプト

```javascript
// error-collector.js
class ErrorCollector {
  constructor() {
    this.errors = [];
    this.setupListeners();
  }

  setupListeners() {
    // グローバルエラー
    window.addEventListener('error', (e) => {
      this.collectError({
        type: 'javascript',
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno,
        stack: e.error?.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Promise rejection
    window.addEventListener('unhandledrejection', (e) => {
      this.collectError({
        type: 'promise',
        message: e.reason?.message || e.reason,
        stack: e.reason?.stack,
        timestamp: new Date().toISOString()
      });
    });

    // ネットワークエラー監視
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.collectError({
            type: 'network',
            url: args[0],
            status: response.status,
            statusText: response.statusText,
            timestamp: new Date().toISOString()
          });
        }
        return response;
      } catch (error) {
        this.collectError({
          type: 'network',
          url: args[0],
          message: error.message,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };
  }

  collectError(error) {
    this.errors.push(error);
    console.warn('Error collected:', error);
    
    // 重要なエラーは即座に通知
    if (error.message?.includes('tokenResponse') || 
        error.message?.includes('Firebase')) {
      this.notifyCriticalError(error);
    }
  }

  notifyCriticalError(error) {
    console.error('🚨 CRITICAL ERROR:', error);
    // ここでエラーレポートサービスに送信
  }

  getReport() {
    return {
      totalErrors: this.errors.length,
      errors: this.errors,
      summary: this.errors.reduce((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

// 使用方法
const errorCollector = new ErrorCollector();

// レポート取得
setTimeout(() => {
  console.log('Error Report:', errorCollector.getReport());
}, 60000); // 1分後にレポート
```

## エラーレポートテンプレート

```markdown
## エラーレポート

### 基本情報
- 発生日時: 2025-01-17 15:30:00
- 環境: Production (https://singular-winter-370002.web.app)
- ブラウザ: Chrome 120.0.0
- ユーザーエージェント: [UA文字列]

### エラー詳細
1. **エラータイプ**: SyntaxError
   - メッセージ: Uncaught SyntaxError: \\!tokenResponse.ok
   - ファイル: main.chunk.js:1:23456
   - スタックトレース: [詳細]
   
2. **再現手順**:
   1. Firebase loginページにアクセス
   2. Googleログインボタンをクリック
   3. エラー発生

3. **影響範囲**: 
   - ログイン機能が完全に使用不可
   - 全ユーザーに影響

4. **優先度**: Critical

### スクリーンショット
- [console_error.png]
- [network_tab.png]

### 対応状況
- [ ] 原因調査中
- [ ] 修正実装中
- [ ] テスト中
- [ ] デプロイ済み
```