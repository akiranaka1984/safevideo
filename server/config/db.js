const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL接続成功');
    
    // 開発環境ではテーブルを自動同期（本番環境ではマイグレーションを使用したほうが良い）
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('データベーステーブルが同期されました');
    }
  } catch (err) {
    console.error('MySQL接続エラー:', err);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };