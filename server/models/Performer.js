const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Performer = sequelize.define('Performer', {
  videoId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Videos',
      key: 'id'
    }
  },
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
  }
}, {
  timestamps: true
});

module.exports = Performer;