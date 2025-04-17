const User = require('./User');
const Performer = require('./Performer');

// リレーションシップ設定
User.hasMany(Performer, { foreignKey: 'userId' });
Performer.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  User,
  Performer
};