# Sharegram KYC連携仕様書

## 概要
SharegramユーザーがKYC（本人確認）を行うための連携システムの仕様書です。

## 連携フロー

### 1. 基本的な流れ
```
1. SharegramでユーザーがKYC登録ボタンをクリック
2. SharegramがFirebase ID TokenをKYCシステムに送信
3. KYCシステムでFirebase認証を検証・自動ログイン
4. ユーザーが本人確認書類をアップロード
5. 管理者が書類を検証
6. 検証完了をSharegramに通知
```

### 2. 技術的な実装（Firebase Authentication）

#### Firebase SSO認証エンドポイント
```
POST /api/auth/firebase-verify
```

**リクエスト例：**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "client_id": "sharegram_platform"
}
```

**レスポンス例：**
```json
{
  "success": true,
  "data": {
    "user": {
      "firebase_uid": "firebase_user_123",
      "name": "山田太郎",
      "email": "yamada@example.com",
      "external_id": "sharegram_user_789"
    },
    "session_token": "local_session_token_abc123"
  }
}
```

#### Firebase SSO開始（リダイレクト方式）
```
GET /api/auth/firebase-sso?id_token={FIREBASE_ID_TOKEN}&redirect_url=/add-performer
```

## セキュリティ

### 1. Firebase ID Token検証
- Firebase Admin SDKを使用してID Tokenを検証
- Tokenの有効期限、署名、発行元を確認
- SharegramとKYCシステムで同じFirebaseプロジェクトを使用

### 2. システム間API認証
- API Key認証（Bearer Token）
- X-API-Clientヘッダーでクライアント識別

### 3. HTTPS必須
- 本番環境では必ずHTTPS通信を使用

## データベース構造

### Usersテーブル拡張
| カラム名 | 型 | 説明 |
|---------|---|------|
| sharegramUserId | VARCHAR(255) | SharegramのユーザーID |

### Performersテーブル拡張
| カラム名 | 型 | 説明 |
|---------|---|------|
| sharegramPerformerId | VARCHAR(255) | Sharegramの出演者ID |

## 環境変数設定

```env
# Firebase設定
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com

# Sharegram連携用
SHAREGRAM_API_KEY=your-api-key-here
SHAREGRAM_API_URL=https://api.sharegram.com
FRONTEND_URL=http://localhost
```

## ユーザー体験

### Sharegramユーザーから見た流れ
1. Sharegramにログイン
2. 「本人確認を行う」ボタンをクリック
3. 自動的にKYCシステムへ移動（ログイン不要）
4. 本人確認書類をアップロード
5. 完了後、Sharegramに戻る

### KYCシステムでの表示
- ユーザーロールでは「検証待ち」ステータスは非表示
- 自分がアップロードした書類のみ表示
- 「検証済み」になったらSharegramで出演可能

## 今後の実装予定

### Phase 1（現在実装済み）
- [x] ユーザーロール権限制御
- [ ] Firebase認証エンドポイント
- [ ] Firebase連携による自動アカウント作成

### Phase 2（今後実装）
- [ ] Webhook通知（KYC完了時）
- [ ] 定期的なステータス同期
- [ ] Sharegram APIとの双方向連携

### Phase 3（将来構想）
- [ ] リアルタイムステータス更新
- [ ] 書類の有効期限管理
- [ ] 自動再検証フロー

## API仕様書との整合性

本実装は `docs/Sharegram_SharegramKYCSysytem統合API仕様書.md` に準拠しています：

- **認証方式**: Firebase Authentication（仕様書3.1項）
- **エンドポイント**: `/api/auth/firebase-verify`（仕様書3.2項）
- **SSO開始**: `/api/auth/firebase-sso`（仕様書3.3項）
- **連携フロー**: Firebase ID Tokenベースの認証（仕様書9.1項）

## 注意事項

1. **Firebase設定**
   - SharegramとKYCシステムで同じFirebaseプロジェクトを使用
   - Firebase Admin SDKの認証情報が必要

2. **実装ファイル**
   - Firebase認証: `server/routes/auth-firebase.js`
   - SSO Callback: `src/pages/SSOCallbackPage.jsx`

## 連絡先
技術的な質問がある場合は、開発チームまでお問い合わせください。