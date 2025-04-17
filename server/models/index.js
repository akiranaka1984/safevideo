const User = require('./User');
const Performer = require('./Performer');
const AuditLog = require('./AuditLog');

// リレーションシップ設定
User.hasMany(Performer, { foreignKey: 'userId' });
Performer.belongsTo(User, { foreignKey: 'userId' });

// AuditLogとUserのリレーションシップを追加
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  User,
  Performer,
  AuditLog
};