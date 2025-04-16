const express = require('express');
const router = express.Router({ mergeParams: true });
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { Video, Performer } = require('../models');

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads', req.params.videoId);
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // ファイル名をユニークにするために現在時刻を追加
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// ファイルフィルター
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('許可されているファイル形式はJPEG、PNG、PDFのみです'));
  }
};

// アップロード制限
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// アップロードフィールド
const uploadFields = upload.fields([
  { name: 'agreementFile', maxCount: 1 },
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 },
  { name: 'selfieWithId', maxCount: 1 }
]);

// @route   GET api/videos/:videoId/performers
// @desc    Get all performers for a video
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // 動画の存在確認と権限チェック
    const video = await Video.findByPk(req.params.videoId);
    
    if (!video) {
      return res.status(404).json({ message: '動画が見つかりません' });
    }
    
    if (video.userId !== req.user.id) {
      return res.status(403).json({ message: 'アクセス権限がありません' });
    }
    
    const performers = await Performer.findAll({
      where: { videoId: req.params.videoId }
    });
    
    res.json(performers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// @route   POST api/videos/:videoId/performers
// @desc    Add a performer to a video
// @access  Private
router.post('/', auth, uploadFields, async (req, res) => {
  try {
    // 動画の存在確認と権限チェック
    const video = await Video.findByPk(req.params.videoId);
    
    if (!video) {
      // アップロードされたファイルを削除
      if (req.files) {
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            fs.unlinkSync(file.path);
          });
        });
      }
      return res.status(404).json({ message: '動画が見つかりません' });
    }
    
    if (video.userId !== req.user.id) {
      // アップロードされたファイルを削除
      if (req.files) {
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            fs.unlinkSync(file.path);
          });
        });
      }
      return res.status(403).json({ message: 'アクセス権限がありません' });
    }
    
    const { lastName, firstName, lastNameRoman, firstNameRoman } = req.body;
    
    // 入力検証
    if (!lastName || !firstName || !lastNameRoman || !firstNameRoman) {
      // アップロードされたファイルを削除
      if (req.files) {
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            fs.unlinkSync(file.path);
          });
        });
      }
      return res.status(400).json({ message: '氏名は必須です' });
    }
    
    // 必須ファイルの確認
    if (!req.files || !req.files.agreementFile || !req.files.idFront || !req.files.selfie) {
      // アップロードされたファイルを削除
      if (req.files) {
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            fs.unlinkSync(file.path);
          });
        });
      }
      return res.status(400).json({ message: '必須ファイル（許諾書、身分証明書表面、本人写真）がアップロードされていません' });
    }
    
    // 出演者データの作成
    const performer = await Performer.create({
      videoId: req.params.videoId,
      lastName,
      firstName,
      lastNameRoman,
      firstNameRoman,
      documents: {
        agreementFile: req.files.agreementFile ? {
          path: req.files.agreementFile[0].path,
          originalName: req.files.agreementFile[0].originalname,
          mimeType: req.files.agreementFile[0].mimetype
        } : null,
        idFront: req.files.idFront ? {
          path: req.files.idFront[0].path,
          originalName: req.files.idFront[0].originalname,
          mimeType: req.files.idFront[0].mimetype
        } : null,
        idBack: req.files.idBack ? {
          path: req.files.idBack[0].path,
          originalName: req.files.idBack[0].originalname,
          mimeType: req.files.idBack[0].mimetype
        } : null,
        selfie: req.files.selfie ? {
          path: req.files.selfie[0].path,
          originalName: req.files.selfie[0].originalname,
          mimeType: req.files.selfie[0].mimetype
        } : null,
        selfieWithId: req.files.selfieWithId ? {
          path: req.files.selfieWithId[0].path,
          originalName: req.files.selfieWithId[0].originalname,
          mimeType: req.files.selfieWithId[0].mimetype
        } : null
      }
    });
    
    res.json(performer);
  } catch (err) {
    console.error(err.message);
    // アップロードされたファイルを削除
    if (req.files) {
      Object.values(req.files).forEach(files => {
        files.forEach(file => {
          fs.unlinkSync(file.path);
        });
      });
    }
    res.status(500).send('サーバーエラーが発生しました');
  }
});

module.exports = router;