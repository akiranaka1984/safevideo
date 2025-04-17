/**
 * 特定のロールを持つユーザーのみアクセスを許可するミドルウェア
 * @param {Array} roles 許可するロールの配列（例: ['admin']）
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    // 認証されていない場合
    if (!req.user) {
      return res.status(401).json({ message: '認証されていません' });
    }
    
    // 必要なロールを持っていない場合
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '権限がありません' });
    }
    
    // 権限チェック通過
    next();
  };
};

module.exports = checkRole;