# SafeVideo デプロイメント - Sequelize Association エラーの解決

**サーバー**: 167.172.92.88  
**エラー**: `AssociationError: You have used the alias performer in two separate associations`  
**作成日時**: 2025年7月1日

## 🚨 現在の問題

サーバーコンテナが以下のエラーで起動できない状態：
```
AssociationError [SequelizeAssociationError]: You have used the alias performer 
in two separate associations. Aliased associations must have unique aliases.
    at Function.KYCRequest.associate (/app/models/KYCRequest.js:146:14)
```

## 🔍 エラーの原因

`KYCRequest.js`モデルで、同じ`performer`エイリアスが複数の関連付けで使用されています。Sequelizeでは、各関連付けに一意のエイリアスが必要です。

## 🔧 解決手順

### Step 1: 現在のKYCRequest.jsファイルを確認

```bash
# サーバーコンテナに入る
docker exec -it safevideo-server sh

# KYCRequest.jsファイルを確認
cat /app/models/KYCRequest.js | grep -A 5 -B 5 "performer"

# コンテナから出る
exit
```

### Step 2: KYCRequest.jsファイルを修正

```bash
# ホストマシンでファイルを直接編集
cd /var/www/sharegramvideo/safevideo
nano server/models/KYCRequest.js
```

#### 修正内容

**問題のあるコード（例）:**
```javascript
// 重複したperformerエイリアス
KYCRequest.belongsTo(models.Performer, {
  foreignKey: 'performerId',
  as: 'performer'
});

// 別の場所で同じエイリアス
KYCRequest.hasOne(models.Performer, {
  foreignKey: 'kycRequestId',
  as: 'performer'  // ここが重複！
});
```

**修正後のコード:**
```javascript
// メインのperformer関連
KYCRequest.belongsTo(models.Performer, {
  foreignKey: 'performerId',
  as: 'performer'
});

// 他の関連には別のエイリアスを使用
KYCRequest.hasOne(models.PerformerDetails, {
  foreignKey: 'kycRequestId',
  as: 'performerDetails'  // 一意のエイリアスに変更
});
```

### Step 3: 完全な修正版KYCRequest.jsの作成

```bash
# バックアップを作成
cp server/models/KYCRequest.js server/models/KYCRequest.js.backup

# 修正版を作成
cat > server/models/KYCRequest.js << 'EOF'
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const KYCRequest = sequelize.define('KYCRequest', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    performerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Performers',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_review', 'approved', 'rejected', 'additional_info_required'),
      defaultValue: 'pending'
    },
    documentType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    documentUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    submittedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    tableName: 'KYCRequests',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['performerId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['submittedAt']
      }
    ]
  });

  KYCRequest.associate = function(models) {
    // Performerとの関連（一意のエイリアス）
    KYCRequest.belongsTo(models.Performer, {
      foreignKey: 'performerId',
      as: 'performer'
    });

    // レビュアーとの関連（一意のエイリアス）
    KYCRequest.belongsTo(models.User, {
      foreignKey: 'reviewedBy',
      as: 'reviewer'
    });

    // KYCドキュメントとの関連（一意のエイリアス）
    KYCRequest.hasMany(models.KYCDocument, {
      foreignKey: 'kycRequestId',
      as: 'documents'
    });

    // 監査ログとの関連（一意のエイリアス）
    KYCRequest.hasMany(models.AuditLog, {
      foreignKey: 'entityId',
      constraints: false,
      scope: {
        entityType: 'KYCRequest'
      },
      as: 'auditLogs'
    });
  };

  return KYCRequest;
};
EOF
```

### Step 4: サーバーコンテナを再ビルド

```bash
cd /var/www/sharegramvideo/safevideo

# コンテナを停止
docker-compose -f docker-compose.prod.yml stop server

# サーバーイメージを再ビルド
docker-compose -f docker-compose.prod.yml build server

# サーバーコンテナを起動
docker-compose -f docker-compose.prod.yml up -d server

# ログを確認
docker-compose -f docker-compose.prod.yml logs -f server
```

### Step 5: エラーが続く場合の追加確認

```bash
# 全てのモデルファイルでperformerエイリアスを検索
grep -r "as: 'performer'" server/models/

# 他のモデルでも重複がある場合は同様に修正
```

## 🚑 緊急対応（即座に修正する方法）

### 方法1: コンテナ内で直接修正

```bash
# サーバーコンテナに入る
docker exec -it safevideo-server sh

# viまたはnanoがない場合はインストール
apk add nano

# ファイルを編集
nano /app/models/KYCRequest.js

# 重複したperformerエイリアスを探して修正
# 例: 2つ目のperformerを performerInfo や performerData に変更

# コンテナから出る
exit

# サーバーを再起動
docker-compose -f docker-compose.prod.yml restart server
```

### 方法2: sedコマンドで自動修正

```bash
# バックアップ作成
cp server/models/KYCRequest.js server/models/KYCRequest.js.bak

# 2番目のperformerエイリアスを自動的に変更
sed -i '0,/as: '\''performer'\''/! s/as: '\''performer'\''/as: '\''performerDetails'\''/' server/models/KYCRequest.js

# 変更を確認
grep -n "as: 'performer" server/models/KYCRequest.js
```

## ✅ 成功の確認

正常に起動した場合のログ：
```
safevideo-server | Sequelize models loaded successfully
safevideo-server | Database connection established
safevideo-server | Server running on port 5000
safevideo-server | MySQL接続成功
```

## 🔍 トラブルシューティング

### 他のエイリアス重複エラーが出た場合

```bash
# エラーメッセージから重複しているエイリアス名を確認
# 例: "You have used the alias user in two separate associations"

# 該当するモデルファイルを検索
grep -r "as: 'user'" server/models/

# 見つかったファイルを編集して一意のエイリアスに変更
```

### よくあるエイリアスの重複パターン

1. **user** → `creator`, `assignedUser`, `reviewer` など
2. **document** → `primaryDocument`, `supportDocument`, `kycDocument` など
3. **status** → `currentStatus`, `previousStatus`, `statusHistory` など

## 📝 エイリアス命名のベストプラクティス

1. **関連の目的を明確に表現**
   - ❌ `user` (曖昧)
   - ✅ `createdByUser`, `assignedToUser` (明確)

2. **モデル名を含める**
   - ❌ `details` (曖昧)
   - ✅ `performerDetails` (明確)

3. **一貫性を保つ**
   - 作成者: `createdBy` + モデル名
   - レビュアー: `reviewedBy` + モデル名
   - 承認者: `approvedBy` + モデル名

## 🚀 次のアクション

1. **Step 2または3** でKYCRequest.jsを修正
2. **Step 4** でコンテナを再ビルド
3. ログを確認してサーバーが正常に起動することを確認

---

## 📋 チェックリスト

- [ ] KYCRequest.jsのバックアップ作成
- [ ] 重複したperformerエイリアスを特定
- [ ] 一意のエイリアスに変更
- [ ] サーバーコンテナを再ビルド
- [ ] ログでエラーがないことを確認
- [ ] APIエンドポイントが応答することを確認

---
*最終更新: 2025年7月1日*