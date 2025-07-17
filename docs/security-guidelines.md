# SafeVideo セキュリティガイドライン

## 1. 概要

本ドキュメントは、SafeVideoシステムのセキュリティを確保するためのガイドラインです。開発者、運用担当者、セキュリティ監査者向けに、セキュリティベストプラクティスと実装手順を提供します。

## 2. セキュリティ原則

### 2.1 最小権限の原則
- すべてのプロセスは必要最小限の権限で実行
- Dockerコンテナは非rootユーザーで実行
- データベースユーザーは必要な権限のみ付与

### 2.2 多層防御
- ネットワークレベル：ファイアウォール、内部ネットワーク分離
- アプリケーションレベル：認証、認可、入力検証
- データレベル：暗号化、アクセス制御

### 2.3 ゼロトラスト
- すべての通信を検証
- 内部ネットワークも信頼しない
- 継続的な認証と認可

## 3. 環境変数とシークレット管理

### 3.1 シークレット生成

```bash
# シークレット生成スクリプトの実行
cd /path/to/safevideo
./scripts/generate-secrets.sh
```

### 3.2 環境変数設定

1. `.env.example`を`.env`にコピー
2. 環境固有の値を設定
3. シークレットは自動生成された値を使用

### 3.3 Docker Secrets

```yaml
# docker-compose.secure.ymlを使用
docker-compose -f docker-compose.secure.yml up -d
```

#### 重要な注意事項
- ❌ **絶対にしてはいけないこと**
  - シークレットをGitにコミット
  - 本番環境でデフォルト値を使用
  - シークレットをログに出力
  - 平文でシークレットを保存

- ✅ **必ず実施すること**
  - 環境ごとに異なるシークレットを使用
  - 定期的なシークレットローテーション
  - シークレットの安全なバックアップ
  - アクセスログの監視

## 4. ネットワークセキュリティ

### 4.1 ネットワーク分離

```yaml
networks:
  frontend:     # 外部アクセス可能
  backend:      # 内部のみ
    internal: true
  database:     # 内部のみ
    internal: true
```

### 4.2 ポート管理

| サービス | 内部ポート | 外部ポート | 備考 |
|---------|-----------|-----------|------|
| Nginx | 80, 443 | 80, 443 | リバースプロキシ |
| Client | 80 | - | Nginx経由のみ |
| Server | 5000 | - | Nginx経由のみ |
| MySQL | 3306 | - | 内部のみ |
| Redis | 6379 | - | 内部のみ |

### 4.3 HTTPS設定

```nginx
# SSL設定（nginx/ssl.conf）
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

## 5. アプリケーションセキュリティ

### 5.1 認証・認可

#### JWT設定
```javascript
// 安全なJWT設定
const jwtOptions = {
  expiresIn: '30d',
  algorithm: 'HS256',
  issuer: 'safevideo',
  audience: 'safevideo-users'
};
```

#### セッション管理
- セッションタイムアウト：30分（無操作時）
- 同時ログイン制限：設定可能
- ログイン試行制限：5回/15分

### 5.2 入力検証

#### サーバーサイド検証
```javascript
// Express Validatorの使用例
const { body, validationResult } = require('express-validator');

// Email検証
body('email').isEmail().normalizeEmail()

// ファイルアップロード検証
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
const maxSize = 5 * 1024 * 1024; // 5MB
```

### 5.3 SQLインジェクション対策

```javascript
// Sequelize ORMの使用（自動的にエスケープ）
const user = await User.findOne({
  where: { email: req.body.email }
});

// 生のクエリを使用する場合
const results = await sequelize.query(
  'SELECT * FROM users WHERE email = :email',
  {
    replacements: { email: userEmail },
    type: QueryTypes.SELECT
  }
);
```

### 5.4 XSS対策

```javascript
// React: 自動的にエスケープ
<div>{userInput}</div>

// dangerouslySetInnerHTMLは避ける
// 必要な場合はDOMPurifyでサニタイズ
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(dirty);
```

## 6. ファイルセキュリティ

### 6.1 アップロード制限

```javascript
// Multer設定
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // 最大5ファイル
  },
  fileFilter: (req, file, cb) => {
    // MIMEタイプ検証
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

### 6.2 ファイル保存

```javascript
// セキュアなファイル名生成
const filename = `${type}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

// ディレクトリトラバーサル対策
const safePath = path.join(uploadDir, path.basename(filename));
```

## 7. ロギングと監査

### 7.1 監査ログ

必須記録項目：
- ユーザー認証（成功/失敗）
- データアクセス（CRUD操作）
- 権限変更
- システム設定変更
- エラーとセキュリティイベント

### 7.2 ログ保護

```javascript
// センシティブ情報のマスキング
const sanitizeLog = (data) => {
  const sensitive = ['password', 'token', 'secret'];
  const sanitized = { ...data };
  
  sensitive.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });
  
  return sanitized;
};
```

## 8. インシデント対応

### 8.1 セキュリティインシデント検知

監視項目：
- 異常なログイン試行
- 大量のAPIリクエスト
- 不正なファイルアクセス
- SQLインジェクション試行
- XSS試行

### 8.2 対応手順

1. **検知**: 自動アラート、ログ監視
2. **評価**: 影響範囲の特定
3. **封じ込め**: 影響の拡大防止
4. **根絶**: 脆弱性の修正
5. **復旧**: システムの正常化
6. **事後分析**: 再発防止策の実施

## 9. セキュリティチェックリスト

### 9.1 デプロイ前チェック

- [ ] すべてのシークレットが環境変数化されている
- [ ] Docker Secretsが適切に設定されている
- [ ] HTTPSが有効化されている
- [ ] セキュリティヘッダーが設定されている
- [ ] ログが適切に設定されている
- [ ] バックアップが設定されている
- [ ] 監視が有効化されている

### 9.2 定期チェック（月次）

- [ ] シークレットのローテーション
- [ ] セキュリティパッチの適用
- [ ] ログの確認と分析
- [ ] アクセス権限の棚卸し
- [ ] バックアップの動作確認
- [ ] セキュリティスキャンの実施

## 10. セキュリティツール

### 10.1 脆弱性スキャン

```bash
# Dockerイメージスキャン
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image safevideo/server:latest

# 依存関係の脆弱性チェック
npm audit
```

### 10.2 セキュリティテスト

```bash
# OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://your-safevideo-url.com

# SQLMap（SQLインジェクションテスト）
sqlmap -u "https://your-safevideo-url.com/api/endpoint" \
  --batch --random-agent
```

## 11. コンプライアンス

### 11.1 データ保護

- 個人情報の暗号化
- アクセス制御の実施
- データ保持期間の管理
- 削除権の保証

### 11.2 監査証跡

- すべての操作の記録
- 改ざん防止
- 長期保存（最低1年）
- 定期的な監査

## 12. 緊急連絡先

| 役割 | 連絡先 | 備考 |
|-----|--------|------|
| セキュリティ責任者 | security@safevideo.com | 24時間対応 |
| システム管理者 | admin@safevideo.com | 営業時間内 |
| 外部セキュリティベンダー | vendor@security.com | SLA準拠 |

## 13. 更新履歴

| 日付 | バージョン | 変更内容 | 承認者 |
|-----|-----------|---------|--------|
| 2024-01-21 | 1.0.0 | 初版作成 | DevOps Team |

---

**注意**: このドキュメントは機密情報を含みます。適切に管理し、権限のない者と共有しないでください。