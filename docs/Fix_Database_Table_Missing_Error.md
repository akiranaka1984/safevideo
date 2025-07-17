# SafeVideo デプロイメント - データベーステーブル不存在エラーの解決

**サーバー**: 167.172.92.88  
**エラー**: `Table 'safevideo.Users' doesn't exist`  
**作成日時**: 2025年7月1日

## 🚨 問題の詳細

### エラーメッセージ
```
SequelizeDatabaseError: Table 'safevideo.Users' doesn't exist
Error: ER_NO_SUCH_TABLE
errno: 1146
sqlState: '42S02'
```

### 原因
- データベースは作成されているが、テーブルが作成されていない
- Sequelizeの自動同期が実行されていない
- 初回デプロイ時のテーブル初期化が未完了

## 🔧 解決手順

### Step 1: 現在のデータベース状態を確認

```bash
# MySQLコンテナでテーブル一覧を確認
docker exec -it safevideo-mysql mysql -u safevideo_user -p'Sgv#2025$Prod&Secure!' safevideo -e "SHOW TABLES;"

# データベースが存在するか確認
docker exec -it safevideo-mysql mysql -u safevideo_user -p'Sgv#2025$Prod&Secure!' -e "SHOW DATABASES;"
```

### Step 2: Sequelizeでテーブルを作成

#### 方法1: サーバーコンテナ内で直接実行

```bash
# サーバーコンテナに入る
docker exec -it safevideo-server sh

# コンテナ内でテーブル作成スクリプトを実行
cd /app
node -e "
const { sequelize } = require('./models');
sequelize.sync({ alter: true })
  .then(() => {
    console.log('データベーステーブルが作成されました');
    process.exit(0);
  })
  .catch(err => {
    console.error('エラー:', err);
    process.exit(1);
  });
"

# コンテナから出る
exit
```

#### 方法2: 外部から直接実行

```bash
# 一行コマンドでテーブル作成
docker exec safevideo-server node -e "const{sequelize}=require('./models');sequelize.sync({alter:true}).then(()=>console.log('テーブル作成完了')).catch(e=>console.error(e));"
```

### Step 3: テーブルが作成されたか確認

```bash
# 作成されたテーブルを確認
docker exec -it safevideo-mysql mysql -u safevideo_user -p'Sgv#2025$Prod&Secure!' safevideo -e "SHOW TABLES;"

# 期待される出力:
# +------------------------+
# | Tables_in_safevideo    |
# +------------------------+
# | AuditLogs              |
# | KYCDocuments           |
# | KYCRequests            |
# | Performers             |
# | Users                  |
# | Webhooks               |
# +------------------------+
```

### Step 4: 初期ユーザーを作成

#### 管理者ユーザーの作成

```bash
# 管理者ユーザーを作成
docker exec safevideo-server node -e "
const { User } = require('./models');
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const hashedPassword = await bcrypt.hash('AdminPassword123', 10);
    const admin = await User.create({
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin'
    });
    console.log('管理者ユーザーが作成されました:', admin.email);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      console.log('ユーザーは既に存在します');
    } else {
      console.error('エラー:', err.message);
    }
  }
  process.exit();
})();
"
```

#### 一般ユーザーの作成

```bash
# 一般ユーザーを作成
docker exec safevideo-server node -e "
const { User } = require('./models');
const bcrypt = require('bcryptjs');
(async () => {
  try {
    const hashedPassword = await bcrypt.hash('AdminPassword123', 10);
    
    // 一般ユーザー
    await User.create({
      email: 'user@example.com',
      password: hashedPassword,
      name: 'General User',
      role: 'user'
    });
    
    // テストユーザー1
    await User.create({
      email: 'test1@example.com',
      password: hashedPassword,
      name: 'Test User 1',
      role: 'user'
    });
    
    // テストユーザー2
    await User.create({
      email: 'test2@example.com',
      password: hashedPassword,
      name: 'Test User 2',
      role: 'user'
    });
    
    console.log('ユーザーが作成されました');
  } catch (err) {
    console.error('エラー:', err.message);
  }
  process.exit();
})();
"
```

### Step 5: 作成されたユーザーを確認

```bash
# ユーザー一覧を確認
docker exec -it safevideo-mysql mysql -u safevideo_user -p'Sgv#2025$Prod&Secure!' safevideo -e "SELECT id, email, name, role FROM Users;"

# 期待される出力:
# +----+-------------------+--------------+-------+
# | id | email             | name         | role  |
# +----+-------------------+--------------+-------+
# |  1 | admin@example.com | Admin User   | admin |
# |  2 | user@example.com  | General User | user  |
# |  3 | test1@example.com | Test User 1  | user  |
# |  4 | test2@example.com | Test User 2  | user  |
# +----+-------------------+--------------+-------+
```

## 🔍 トラブルシューティング

### テーブル作成が失敗する場合

1. **権限の問題**
```bash
# rootユーザーで権限を付与
docker exec -it safevideo-mysql mysql -u root -p'root_password_change_this' -e "
GRANT ALL PRIVILEGES ON safevideo.* TO 'safevideo_user'@'%';
FLUSH PRIVILEGES;
"
```

2. **既存のテーブルとの競合**
```bash
# 全テーブルを削除して再作成（注意：データが失われます）
docker exec safevideo-server node -e "
const{sequelize}=require('./models');
sequelize.sync({force:true})
  .then(()=>console.log('テーブルを強制再作成しました'))
  .catch(e=>console.error(e));
"
```

3. **モデル定義の問題**
```bash
# モデルファイルの確認
docker exec safevideo-server ls -la /app/models/

# エラーログの詳細確認
docker-compose -f docker-compose.prod.yml logs server | grep -i error
```

### ユーザー作成が失敗する場合

1. **bcryptの問題**
```bash
# bcryptがインストールされているか確認
docker exec safevideo-server npm list bcryptjs
```

2. **重複エラー**
```bash
# 既存のユーザーを削除
docker exec -it safevideo-mysql mysql -u safevideo_user -p'Sgv#2025$Prod&Secure!' safevideo -e "DELETE FROM Users WHERE email IN ('admin@example.com', 'user@example.com');"
```

## ✅ 動作確認

### 1. ログイン機能のテスト

```bash
# curlでAPIをテスト
curl -X POST http://167.172.92.88:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPassword123"}'
```

### 2. ブラウザでのテスト

1. `http://167.172.92.88:3000` にアクセス
2. 以下のアカウントでログイン：
   - **管理者**: admin@example.com / AdminPassword123
   - **一般ユーザー**: user@example.com / AdminPassword123

## 📝 永続的な解決策

### server.jsに自動同期を追加

```javascript
// server.jsのデータベース接続後に追加
const { sequelize } = require('./models');

// データベース同期
sequelize.sync({ alter: true })
  .then(() => {
    console.log('データベーステーブルが同期されました');
  })
  .catch(err => {
    console.error('データベース同期エラー:', err);
  });
```

### 初期化スクリプトの作成

```bash
# init-db.jsファイルを作成
cat > /var/www/sharegramvideo/safevideo/server/init-db.js << 'EOF'
const { sequelize, User } = require('./models');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  try {
    // テーブル作成
    await sequelize.sync({ alter: true });
    console.log('テーブルが作成されました');
    
    // 管理者ユーザー作成
    const hashedPassword = await bcrypt.hash('AdminPassword123', 10);
    const [admin, created] = await User.findOrCreate({
      where: { email: 'admin@example.com' },
      defaults: {
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin'
      }
    });
    
    if (created) {
      console.log('管理者ユーザーが作成されました');
    } else {
      console.log('管理者ユーザーは既に存在します');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('初期化エラー:', error);
    process.exit(1);
  }
}

initDatabase();
EOF

# 実行権限を付与して実行
docker exec safevideo-server node /app/init-db.js
```

## 🎯 まとめ

### 問題の原因
- Sequelizeの自動同期が実行されていなかった
- 初回デプロイ時のデータベース初期化が不完全

### 解決策
1. Sequelizeの`sync()`メソッドでテーブルを作成
2. 初期ユーザーをプログラムで作成
3. server.jsに自動同期機能を追加

### 今後の推奨事項
1. 本番環境ではマイグレーションを使用
2. 初期化スクリプトをDockerfileに組み込む
3. ヘルスチェックにDB接続確認を追加

---

## 🚀 次のステップ

1. **Step 2** でテーブルを作成
2. **Step 4** で初期ユーザーを作成
3. **動作確認** でログインテスト

---
*最終更新: 2025年7月1日*