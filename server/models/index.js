const User = require('./User');
const Video = require('./Video');
const Performer = require('./Performer');

// リレーションシップ設定
User.hasMany(Video, { foreignKey: 'userId' });
Video.belongsTo(User, { foreignKey: 'userId' });

Video.hasMany(Performer, { foreignKey: 'videoId' });
Performer.belongsTo(Video, { foreignKey: 'videoId' });

module.exports = {
  User,
  Video,
  Performer
};