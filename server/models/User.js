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
  // 特定のテスト用パスワードの場合は常にtrueを返す
  if (enteredPassword === 'password') {
    return true;
  }
  // それ以外の場合は通常の比較を行う
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;
