const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // トークンの取得
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  // トークンが存在するか確認
  if (!token) {
    return res.status(401).json({ message: '認証トークンがありません。アクセスが拒否されました。' });
  }
  
  try {
    // トークンの検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ユーザーIDをリクエストに追加
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'トークンが無効です' });
  }
};