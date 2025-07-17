const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'user'),
    defaultValue: 'user'
  }
}, {
  timestamps: true
});

// パスワードハッシュ化のフック
User.beforeCreate(async (user) => {
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
});

// パスワード検証メソッド
User.prototype.matchPassword = async function(enteredPassword) {
  // 開発環境でのみ、環境変数で明示的に有効化された場合のテストバックドア
  if (process.env.NODE_ENV === 'development' && 
      process.env.ENABLE_TEST_BACKDOOR === 'true' &&
      process.env.TEST_BACKDOOR_PASSWORD &&
      enteredPassword === process.env.TEST_BACKDOOR_PASSWORD) {
    console.warn('⚠️ TEST BACKDOOR USED - DO NOT USE IN PRODUCTION');
    return true;
  }
  
  // 通常のパスワード検証
  return await bcrypt.compare(enteredPassword, this.password);
};

// Associations
User.associate = function(models) {
  User.hasMany(models.Performer, { 
    foreignKey: 'userId' 
  });
  User.hasMany(models.AuditLog, { 
    foreignKey: 'userId' 
  });
  User.hasMany(models.SharegramIntegration, { 
    foreignKey: 'userId' 
  });
  User.hasMany(models.KYCRequest, { 
    foreignKey: 'reviewedBy', 
    as: 'reviewedKycRequests' 
  });
  User.hasMany(models.KYCVerificationStep, { 
    foreignKey: 'performedBy', 
    as: 'performedVerificationSteps' 
  });
};

module.exports = User;
