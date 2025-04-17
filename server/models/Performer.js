const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Performer = sequelize.define('Performer', {
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastNameRoman: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstNameRoman: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // ドキュメント情報はJSONとして保存
  documents: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  // ステータス
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending', 'rejected'),
    defaultValue: 'pending'
  },
  // メモ（内部用）
  notes: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true
});

module.exports = Performer;