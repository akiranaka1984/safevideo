const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { User } = require('../models');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post(
  '/register',
  [
    check('name', '名前は必須です').not().isEmpty(),
    check('email', '有効なメールアドレスを入力してください').isEmail(),
    check('password', 'パスワードは6文字以上必要です').isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      // ユーザー存在チェック
      let user = await User.findOne({ where: { email } });

      if (user) {
        return res.status(400).json({ message: 'このメールアドレスは既に登録されています' });
      }

      // ユーザー作成
      user = await User.create({
        name,
        email,
        password // bcryptはbeforeCreateフックで処理
      });

      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET || "your_super_secret_jwt_key_change_in_production",
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err;
          res.json({ 
            token, 
            user: { 
              id: user.id, 
              name: user.name, 
              email: user.email 
            } 
          });
        }
      );
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).send('サーバーエラーが発生しました');
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'メールアドレスを入力してください').isEmail(),
    check('password', 'パスワードは必須です').exists()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(400).json({ message: 'メールアドレスまたはパスワードが正しくありません' });
      }

      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(400).json({ message: 'メールアドレスまたはパスワードが正しくありません' });
      }

      const payload = {
        user: {
          id: user.id
        }
      };

      jwt.sign(
        payload,
        process.env.JWT_SECRET || "your_super_secret_jwt_key_change_in_production",
        { expiresIn: '24h' },
        (err, token) => {
          if (err) throw err;
          res.json({ 
            token, 
            user: { 
              id: user.id, 
              name: user.name, 
              email: user.email 
            } 
          });
        }
      );
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).send('サーバーエラーが発生しました');
    }
  }
);

// @route   GET api/auth/me
// @desc    Get authenticated user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'ユーザーが見つかりません' });
    }
    
    res.json(user);
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

module.exports = router;