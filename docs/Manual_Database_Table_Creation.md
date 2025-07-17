# SafeVideo デプロイメント - 手動データベーステーブル作成ガイド

**サーバー**: 167.172.92.88  
**問題**: Sequelize自動同期が失敗、手動でテーブル作成が必要  
**作成日時**: 2025年7月1日

## 🚨 問題の背景

### 発生したエラー
1. `TypeError: Cannot read properties of undefined (reading 'sync')` - Sequelizeオブジェクトが未定義
2. `Table 'safevideo.Users' doesn't exist` - テーブルが存在しない
3. `ERROR 1046 (3D000): No database selected` - データベース未選択

### 原因
- models/index.jsでsequelizeオブジェクトが正しくエクスポートされていない
- Sequelize自動同期機能が動作しない
- 手動でのテーブル作成が必要

## 🔧 手動テーブル作成手順

### Step 1: MySQLに接続

```bash
# rootユーザーでMySQLに接続
docker exec -it safevideo-mysql mysql -u root -p'root_password_change_this'
```

### Step 2: データベースを選択

```sql
-- 利用可能なデータベースを確認
SHOW DATABASES;

-- safevideoデータベースを選択
USE safevideo;

-- 現在のテーブル一覧を確認（空のはず）
SHOW TABLES;
```

### Step 3: 全テーブルを作成

```sql
-- 1. Usersテーブル（ユーザー管理）
CREATE TABLE IF NOT EXISTS Users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role ENUM('admin', 'user', 'manager') DEFAULT 'user',
  firebaseUid VARCHAR(255) UNIQUE,
  isActive BOOLEAN DEFAULT true,
  lastLoginAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_firebase_uid (firebaseUid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Performersテーブル（出演者情報）
CREATE TABLE IF NOT EXISTS Performers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firstName VARCHAR(255) NOT NULL,
  lastName VARCHAR(255) NOT NULL,
  firstNameRoman VARCHAR(255),
  lastNameRoman VARCHAR(255),
  status ENUM('pending', 'active', 'inactive', 'rejected') DEFAULT 'pending',
  birthDate DATE,
  nationality VARCHAR(100),
  phoneNumber VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  metadata JSON,
  createdBy INT,
  updatedBy INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_name (lastName, firstName),
  FOREIGN KEY (createdBy) REFERENCES Users(id) ON DELETE SET NULL,
  FOREIGN KEY (updatedBy) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. KYCRequestsテーブル（KYC申請）
CREATE TABLE IF NOT EXISTS KYCRequests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  performerId INT NOT NULL,
  status ENUM('pending', 'in_review', 'approved', 'rejected', 'additional_info_required') DEFAULT 'pending',
  documentType VARCHAR(100) NOT NULL,
  documentUrl VARCHAR(500),
  submittedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewedAt TIMESTAMP NULL,
  reviewedBy INT,
  rejectionReason TEXT,
  notes TEXT,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_performer_id (performerId),
  INDEX idx_status (status),
  INDEX idx_submitted_at (submittedAt),
  FOREIGN KEY (performerId) REFERENCES Performers(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewedBy) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. KYCDocumentsテーブル（KYC書類）
CREATE TABLE IF NOT EXISTS KYCDocuments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kycRequestId INT,
  performerId INT NOT NULL,
  documentType ENUM('agreementFile', 'idFront', 'idBack', 'selfie', 'selfieWithId', 'other') NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  fileSize INT,
  mimeType VARCHAR(100),
  verified BOOLEAN DEFAULT false,
  verifiedAt TIMESTAMP NULL,
  verifiedBy INT,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_performer_id (performerId),
  INDEX idx_kyc_request_id (kycRequestId),
  INDEX idx_document_type (documentType),
  INDEX idx_verified (verified),
  FOREIGN KEY (performerId) REFERENCES Performers(id) ON DELETE CASCADE,
  FOREIGN KEY (kycRequestId) REFERENCES KYCRequests(id) ON DELETE SET NULL,
  FOREIGN KEY (verifiedBy) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. AuditLogsテーブル（監査ログ）
CREATE TABLE IF NOT EXISTS AuditLogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT,
  entityType VARCHAR(100) NOT NULL,
  entityId INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  oldValues JSON,
  newValues JSON,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (userId),
  INDEX idx_entity (entityType, entityId),
  INDEX idx_action (action),
  INDEX idx_created_at (createdAt),
  FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Webhooksテーブル（Webhook設定）
CREATE TABLE IF NOT EXISTS Webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255),
  events JSON,
  isActive BOOLEAN DEFAULT true,
  lastTriggeredAt TIMESTAMP NULL,
  failureCount INT DEFAULT 0,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (isActive),
  INDEX idx_url (url)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 作成したテーブルを確認
SHOW TABLES;
```

### Step 4: テーブル構造を確認

```sql
-- 各テーブルの構造を確認
DESCRIBE Users;
DESCRIBE Performers;
DESCRIBE KYCRequests;
DESCRIBE KYCDocuments;
DESCRIBE AuditLogs;
DESCRIBE Webhooks;

-- 外部キー制約を確認
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM
  INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE
  REFERENCED_TABLE_SCHEMA = 'safevideo'
  AND TABLE_SCHEMA = 'safevideo';

-- MySQLを終了
exit;
```

### Step 5: 初期ユーザーを作成

```bash
# 管理者ユーザーを作成
docker exec safevideo-server node -e "
const { User } = require('./models');
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const hashedPassword = await bcrypt.hash('AdminPassword123', 10);
    await User.create({
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin'
    });
    console.log('管理者ユーザーが作成されました');
  } catch (err) {
    console.error('エラー:', err.message);
  }
  process.exit();
})();
"

# 一般ユーザーを作成
docker exec safevideo-server node -e "
const { User } = require('./models');
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const hashedPassword = await bcrypt.hash('AdminPassword123', 10);
    
    // 複数のユーザーを一度に作成
    const users = [
      { email: 'user@example.com', name: 'General User', role: 'user' },
      { email: 'test1@example.com', name: 'Test User 1', role: 'user' },
      { email: 'test2@example.com', name: 'Test User 2', role: 'user' }
    ];
    
    for (const userData of users) {
      await User.create({
        ...userData,
        password: hashedPassword
      });
      console.log(userData.email + ' が作成されました');
    }
  } catch (err) {
    console.error('エラー:', err.message);
  }
  process.exit();
})();
"
```

### Step 6: 作成されたユーザーを確認

```bash
# MySQLで直接確認
docker exec -it safevideo-mysql mysql -u root -p'root_password_change_this' safevideo -e "
SELECT id, email, name, role, createdAt FROM Users;
"
```

## 🔍 トラブルシューティング

### テーブル作成エラーが発生した場合

1. **外部キー制約エラー**
```sql
-- 外部キー制約を一時的に無効化
SET FOREIGN_KEY_CHECKS = 0;

-- テーブルを作成

-- 外部キー制約を再有効化
SET FOREIGN_KEY_CHECKS = 1;
```

2. **既存テーブルとの競合**
```sql
-- 既存のテーブルを削除（注意：データが失われます）
DROP TABLE IF EXISTS AuditLogs;
DROP TABLE IF EXISTS KYCDocuments;
DROP TABLE IF EXISTS KYCRequests;
DROP TABLE IF EXISTS Webhooks;
DROP TABLE IF EXISTS Performers;
DROP TABLE IF EXISTS Users;
```

3. **文字コードエラー**
```sql
-- データベースの文字コードを確認
SHOW VARIABLES LIKE 'character_set_%';

-- 必要に応じて変更
ALTER DATABASE safevideo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### ユーザー作成エラーが発生した場合

1. **bcryptモジュールエラー**
```bash
# サーバーコンテナでbcryptjsを再インストール
docker exec safevideo-server npm install bcryptjs
```

2. **重複エラー**
```bash
# 既存のユーザーを削除
docker exec -it safevideo-mysql mysql -u root -p'root_password_change_this' safevideo -e "
DELETE FROM Users WHERE email IN ('admin@example.com', 'user@example.com', 'test1@example.com', 'test2@example.com');
"
```

## ✅ 動作確認

### 1. API経由でログインテスト

```bash
# 管理者でログイン
curl -X POST http://167.172.92.88:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPassword123"}'

# 一般ユーザーでログイン
curl -X POST http://167.172.92.88:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"AdminPassword123"}'
```

### 2. ブラウザでログイン

1. `http://167.172.92.88:3000` にアクセス
2. 以下のアカウントでログイン：
   - **管理者**: admin@example.com / AdminPassword123
   - **一般ユーザー**: user@example.com / AdminPassword123
   - **テストユーザー1**: test1@example.com / AdminPassword123
   - **テストユーザー2**: test2@example.com / AdminPassword123

## 📝 永続的な解決策

### 1. models/index.jsの修正

Sequelizeオブジェクトが正しくエクスポートされるように修正：

```javascript
// models/index.jsの最後に追加
module.exports = db;
module.exports.sequelize = sequelize;
module.exports.Sequelize = Sequelize;
```

### 2. 初期化スクリプトの作成

```bash
# init-tables.sqlファイルを作成
cat > /var/www/sharegramvideo/safevideo/init-tables.sql << 'EOF'
-- 上記のCREATE TABLE文をすべて含める
EOF

# Dockerfileに追加
COPY init-tables.sql /docker-entrypoint-initdb.d/
```

### 3. docker-compose.ymlの改善

```yaml
mysql:
  image: mysql:8.0
  environment:
    MYSQL_DATABASE: safevideo
    # ... 他の環境変数
  volumes:
    - ./init-tables.sql:/docker-entrypoint-initdb.d/init-tables.sql
```

## 🎯 まとめ

### 完了したタスク
1. ✅ MySQLデータベースへの接続
2. ✅ 必要な全テーブルの手動作成
3. ✅ 適切なインデックスと外部キー制約の設定
4. ✅ 初期ユーザーアカウントの作成

### 作成されたテーブル
- Users（ユーザー管理）
- Performers（出演者情報）
- KYCRequests（KYC申請）
- KYCDocuments（KYC書類）
- AuditLogs（監査ログ）
- Webhooks（Webhook設定）

### 作成されたユーザー
- admin@example.com（管理者）
- user@example.com（一般ユーザー）
- test1@example.com（テストユーザー1）
- test2@example.com（テストユーザー2）

---

## 🚀 次のステップ

1. ブラウザで `http://167.172.92.88:3000` にアクセス
2. 作成したアカウントでログインテスト
3. KYC機能の動作確認

---
*最終更新: 2025年7月1日*