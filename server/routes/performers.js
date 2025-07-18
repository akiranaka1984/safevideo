const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { Performer, AuditLog } = require('../models');
const { Op } = require('sequelize');

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // アップロードディレクトリのパスを修正
    const uploadDir = path.join(__dirname, '..', 'uploads', 'performers');
    
    console.log('アップロードディレクトリ:', uploadDir);
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('アップロードディレクトリを作成しました:', uploadDir);
      } catch (err) {
        console.error('ディレクトリ作成エラー:', err);
        return cb(err, null);
      }
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

// @route   GET api/performers
// @desc    Get all performers
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // クエリパラメータの取得
    const { status, sort, expiring, search } = req.query;
    
    // 検索条件の構築
    const whereClause = {};
    
    // ステータスによるフィルタリング
    if (status) {
      whereClause.status = status;
    }
    
    // 期限切れ間近の書類フィルタリング
    if (expiring === 'true') {
      // 例として3ヶ月以上前に作成され、検証済みの書類を「期限切れ間近」とする
      whereClause.createdAt = {
        [Op.lte]: new Date(new Date().setMonth(new Date().getMonth() - 3))
      };
      whereClause[Op.and] = [
        { 
          documents: {
            [Op.ne]: null
          } 
        },
        { 
          [Op.or]: [
            { 'documents.agreementFile.verified': true },
            { 'documents.idFront.verified': true },
            { 'documents.selfie.verified': true }
          ]
        }
      ];
    }
    
    // 検索キーワードによるフィルタリング
    if (search) {
      whereClause[Op.or] = [
        { lastName: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastNameRoman: { [Op.like]: `%${search}%` } },
        { firstNameRoman: { [Op.like]: `%${search}%` } }
      ];
    }
    
    // ソート順の設定
    let order = [['createdAt', 'DESC']]; // デフォルトは作成日の降順
    
    if (sort === 'updatedAt') {
      order = [['updatedAt', 'DESC']]; // 更新日の降順
    } else if (sort === 'name') {
      order = [['lastName', 'ASC'], ['firstName', 'ASC']]; // 名前の昇順
    }
    
    // ユーザーロールの場合は自分が登録したデータのみ取得
    if (req.user.role === 'user') {
      whereClause.userId = req.user.id;
    }

    const performers = await Performer.findAll({
      where: whereClause,
      order,
      attributes: { 
        exclude: ['documents'] // documents JSONは除外（一覧表示では不要）
      }
    });
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'read',
      resourceType: 'performer',
      resourceId: 0, // 全体リスト
      details: { query: req.query },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    res.json(performers);
  } catch (err) {
    console.error('出演者一覧取得エラー:', err.message, err.stack);
    res.status(500).json({ 
      message: '出演者情報の取得に失敗しました。', 
      error: err.message 
    });
  }
});

// @route   GET api/performers/:id
// @desc    Get performer by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません。正しいIDで再度お試しください。' });
    }
    
    // ユーザーロールの場合、自分が登録したデータのみアクセス可能
    if (req.user.role === 'user' && performer.userId !== req.user.id) {
      return res.status(403).json({ message: 'このデータへのアクセス権限がありません。' });
    }
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'read',
      resourceType: 'performer',
      resourceId: performer.id,
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    res.json(performer);
  } catch (err) {
    console.error('出演者詳細取得エラー:', err.message, err.stack);
    res.status(500).json({ 
      message: '出演者情報の取得に失敗しました。', 
      error: err.message 
    });
  }
});

// @route   POST api/performers
// @desc    Create a performer
// @access  Private
router.post('/', auth, uploadFields, async (req, res) => {
  try {
    // 処理前にリクエストの内容をログに出力（デバッグ用）
    console.log('リクエスト受信:', {
      body: req.body,
      files: req.files ? Object.keys(req.files) : 'なし'
    });
    
    const { lastName, firstName, lastNameRoman, firstNameRoman } = req.body;
    
    // 入力検証
    if (!lastName || !firstName || !lastNameRoman || !firstNameRoman) {
      // アップロードされたファイルを削除
      if (req.files) {
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error('ファイル削除エラー:', e);
            }
          });
        });
      }
      return res.status(400).json({ message: '氏名は必須です。すべての氏名フィールドを入力してください。' });
    }
    
    // 必須ファイルの確認
    if (!req.files || !req.files.agreementFile || !req.files.idFront || !req.files.selfie) {
      // アップロードされたファイルを削除
      if (req.files) {
        Object.values(req.files).forEach(files => {
          files.forEach(file => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error('ファイル削除エラー:', e);
            }
          });
        });
      }
      return res.status(400).json({ message: '必須ファイル（許諾書、身分証明書表面、本人写真）がアップロードされていません。すべての必須書類をアップロードしてください。' });
    }
    
    // 出演者データの作成
    const performer = await Performer.create({
      userId: req.user.id, // 作成者のユーザーID
      lastName,
      firstName,
      lastNameRoman,
      firstNameRoman,
      status: 'pending', // 初期ステータスは「保留中」
      documents: {
        agreementFile: req.files.agreementFile ? {
          path: req.files.agreementFile[0].path,
          originalName: req.files.agreementFile[0].originalname,
          mimeType: req.files.agreementFile[0].mimetype,
          verified: false
        } : null,
        idFront: req.files.idFront ? {
          path: req.files.idFront[0].path,
          originalName: req.files.idFront[0].originalname,
          mimeType: req.files.idFront[0].mimetype,
          verified: false
        } : null,
        idBack: req.files.idBack ? {
          path: req.files.idBack[0].path,
          originalName: req.files.idBack[0].originalname,
          mimeType: req.files.idBack[0].mimetype,
          verified: false
        } : null,
        selfie: req.files.selfie ? {
          path: req.files.selfie[0].path,
          originalName: req.files.selfie[0].originalname,
          mimeType: req.files.selfie[0].mimetype,
          verified: false
        } : null,
        selfieWithId: req.files.selfieWithId ? {
          path: req.files.selfieWithId[0].path,
          originalName: req.files.selfieWithId[0].originalname,
          mimeType: req.files.selfieWithId[0].mimetype,
          verified: false
        } : null
      }
    });
    
    console.log('出演者情報登録成功:', performer.id);
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'create',
      resourceType: 'performer',
      resourceId: performer.id,
      details: {
        lastName,
        firstName,
        lastNameRoman,
        firstNameRoman,
        documents: Object.keys(req.files).map(key => key)
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    res.json(performer);
  } catch (err) {
    // より詳細なエラーログ
    console.error('出演者登録エラー詳細:', err.message, err.stack);
    
    // アップロードされたファイルを削除
    if (req.files) {
      Object.values(req.files).forEach(files => {
        files.forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error('ファイル削除エラー:', e);
          }
        });
      });
    }
    
    // クライアントへのエラー応答を改善
    res.status(500).json({
      message: '出演者情報の登録に失敗しました。',
      error: err.message
    });
  }
});

// @route   GET api/performers/:id/documents
// @desc    Get documents for a performer
// @access  Private
router.get('/:id/documents', auth, async (req, res) => {
  try {
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません。正しいIDで再度お試しください。' });
    }
    
    // ユーザーロールの場合、自分が登録したデータのみアクセス可能
    if (req.user.role === 'user' && performer.userId !== req.user.id) {
      return res.status(403).json({ message: 'このデータへのアクセス権限がありません。' });
    }
    
    // documents JSONから書類情報の配列を作成
    const documents = [];
    const docData = performer.documents || {};
    
    if (docData.agreementFile) {
      documents.push({
        id: 'agreementFile',
        type: 'agreementFile',
        name: '出演同意書',
        originalName: docData.agreementFile.originalName,
        mimeType: docData.agreementFile.mimeType,
        verified: docData.agreementFile.verified,
        updatedAt: performer.updatedAt
      });
    }
    
    if (docData.idFront) {
      documents.push({
        id: 'idFront',
        type: 'idFront',
        name: '身分証明書（表面）',
        originalName: docData.idFront.originalName,
        mimeType: docData.idFront.mimeType,
        verified: docData.idFront.verified,
        updatedAt: performer.updatedAt
      });
    }
    
    if (docData.idBack) {
      documents.push({
        id: 'idBack',
        type: 'idBack',
        name: '身分証明書（裏面）',
        originalName: docData.idBack.originalName,
        mimeType: docData.idBack.mimeType,
        verified: docData.idBack.verified,
        updatedAt: performer.updatedAt
      });
    }
    
    if (docData.selfie) {
      documents.push({
        id: 'selfie',
        type: 'selfie',
        name: '本人写真',
        originalName: docData.selfie.originalName,
        mimeType: docData.selfie.mimeType,
        verified: docData.selfie.verified,
        updatedAt: performer.updatedAt
      });
    }
    
    if (docData.selfieWithId) {
      documents.push({
        id: 'selfieWithId',
        type: 'selfieWithId',
        name: '本人と身分証明書の写真',
        originalName: docData.selfieWithId.originalName,
        mimeType: docData.selfieWithId.mimeType,
        verified: docData.selfieWithId.verified,
        updatedAt: performer.updatedAt
      });
    }
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'read',
      resourceType: 'document',
      resourceId: performer.id,
      details: { documentCount: documents.length },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    res.json(documents);
  } catch (err) {
    console.error('書類取得エラー:', err.message, err.stack);
    res.status(500).json({ 
      message: '書類情報の取得に失敗しました。', 
      error: err.message 
    });
  }
});

// /:id/documents/:type エンドポイントを探して修正
router.get('/:id/documents/:type', auth, async (req, res) => {
  try {
    console.log('=== 直接ファイル送信方式: ファイル表示対応 ===');
    console.log('リクエスト:', req.params.id, req.params.type);
    
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません' });
    }
    
    // ユーザーロールの場合、自分が登録したデータのみアクセス可能
    if (req.user.role === 'user' && performer.userId !== req.user.id) {
      return res.status(403).json({ message: 'このデータへのアクセス権限がありません。' });
    }
    
    const docType = req.params.type;
    const docData = performer.documents ? performer.documents[docType] : null;
    
    if (!docData || !docData.path) {
      return res.status(404).json({ message: '指定された書類が見つかりません' });
    }
    
    // ファイル存在チェック
    if (!fs.existsSync(docData.path)) {
      return res.status(404).json({ message: 'ファイルが存在しません' });
    }
    
    // 監査ログを記録
    await AuditLog.create({
      userId: req.user.id,
      action: req.query.download === 'true' ? 'download' : 'view',
      resourceType: 'document',
      resourceId: performer.id,
      details: { documentType: docType },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    // ダウンロードモードかどうか確認
    if (req.query.download === 'true') {
      // ダウンロード用のファイル名を設定
      const extension = path.extname(docData.path).substring(1) || 'pdf';
      const filename = `${docType}_${performer.lastName}_${performer.firstName}.${extension}`;
      return res.download(docData.path, filename);
    }
    
    // 重要な変更: リダイレクトではなく、直接ファイルを送信
    console.log('ファイルを直接送信:', docData.path);
    res.setHeader('Content-Type', docData.mimeType || 'application/octet-stream');
    res.sendFile(path.resolve(docData.path));
    
  } catch (err) {
    console.error('書類取得エラー:', err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'サーバーエラー', error: err.message });
    }
  }
});

// @route   PUT api/performers/:id/documents/:type/verify
// @desc    Verify a document
// @access  Private
router.put('/:id/documents/:type/verify', auth, async (req, res) => {
  try {
    // 管理者のみ検証可能
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '書類の検証は管理者のみが実行できます。' });
    }
    
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません。正しいIDで再度お試しください。' });
    }
    
    const docType = req.params.type;
    const documents = { ...(performer.documents || {}) };
    
    if (!documents[docType]) {
      return res.status(404).json({ message: '指定された書類が見つかりません。正しい書類タイプを指定してください。' });
    }
    
    // 書類の検証ステータスを更新
    documents[docType].verified = true;
    documents[docType].verifiedAt = new Date();
    documents[docType].verifiedBy = req.user.id;
    
    // 出演者データを更新
    await Performer.update({ documents }, {
      where: { id: req.params.id }
    });
    
    // すべての必須書類が検証されたかチェック
    const allVerified = 
      documents.agreementFile?.verified && 
      documents.idFront?.verified && 
      documents.selfie?.verified;
    
    // すべて検証済みの場合はステータスを更新
    if (allVerified) {
      await Performer.update({ status: 'active' }, {
        where: { id: req.params.id }
      });
    }
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'verify',
      resourceType: 'document',
      resourceId: performer.id,
      details: { documentType: docType },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    res.json({ 
      message: '書類が検証されました', 
      verified: true,
      allVerified
    });
  } catch (err) {
    console.error('書類検証エラー:', err.message, err.stack);
    res.status(500).json({ 
      message: '書類の検証に失敗しました。', 
      error: err.message 
    });
  }
});

// @route   POST api/performers/sync
// @desc    Sync performers from external system
// @access  Private (Admin only)
router.post('/sync', auth, async (req, res) => {
  try {
    // 管理者のみ同期実行可能
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: '同期処理は管理者のみが実行できます。' });
    }

    const { performers } = req.body;
    
    if (!performers || !Array.isArray(performers)) {
      return res.status(400).json({ message: '同期データが不正です。performers配列を送信してください。' });
    }

    // 同期結果の初期化
    const results = {
      total: performers.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // 100件ずつバッチ処理
    const batchSize = 100;
    for (let i = 0; i < performers.length; i += batchSize) {
      const batch = performers.slice(i, i + batchSize);
      
      // バッチ処理
      await Promise.all(batch.map(async (performerData) => {
        try {
          // external_idの検証
          if (!performerData.external_id) {
            results.errors.push({
              external_id: null,
              error: 'external_idが必須です'
            });
            results.skipped++;
            return;
          }

          // external_idで既存レコードを検索
          let performer = await Performer.findOne({
            where: { external_id: performerData.external_id }
          });

          if (performer) {
            // 既存レコードの更新
            await performer.update({
              lastName: performerData.lastName || performer.lastName,
              firstName: performerData.firstName || performer.firstName,
              lastNameRoman: performerData.lastNameRoman || performer.lastNameRoman,
              firstNameRoman: performerData.firstNameRoman || performer.firstNameRoman,
              status: performerData.status || performer.status,
              // documentsは既存のものとマージ
              documents: {
                ...performer.documents,
                ...(performerData.documents || {})
              }
            });
            results.updated++;
          } else {
            // 新規作成
            performer = await Performer.create({
              external_id: performerData.external_id,
              userId: req.user.id, // 同期実行者をuserIdとして設定
              lastName: performerData.lastName,
              firstName: performerData.firstName,
              lastNameRoman: performerData.lastNameRoman,
              firstNameRoman: performerData.firstNameRoman,
              status: performerData.status || 'pending',
              documents: performerData.documents || {}
            });
            results.created++;
          }
        } catch (error) {
          results.errors.push({
            external_id: performerData.external_id,
            error: error.message
          });
          results.skipped++;
        }
      }));
    }

    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'sync',
      resourceType: 'performer',
      resourceId: 0,
      details: {
        results,
        source: 'external_system'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });

    res.json({
      message: '同期処理が完了しました',
      results
    });
  } catch (err) {
    console.error('同期処理エラー:', err.message, err.stack);
    res.status(500).json({ 
      message: '同期処理に失敗しました。', 
      error: err.message 
    });
  }
});

// @route   POST api/performers/:id/approve
// @desc    Approve a performer registration
// @access  Private (Admin only)
router.post('/:id/approve', [auth, checkRole(['admin'])], async (req, res) => {
  try {
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません' });
    }
    
    // ステータスを承認済みに更新
    performer.status = 'active';
    await performer.save();
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'approve',
      resourceType: 'performer',
      resourceId: performer.id,
      details: {
        previousStatus: performer.status,
        newStatus: 'active',
        performerName: `${performer.lastName} ${performer.firstName}`
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    // Webhook通知をトリガー（別途実装）
    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook('performer.approved', {
      performerId: performer.id,
      externalId: performer.external_id,
      name: `${performer.lastName} ${performer.firstName}`,
      approvedAt: new Date(),
      approvedBy: req.user.id
    });
    
    res.json({
      message: '出演者が承認されました',
      performer: performer
    });
  } catch (err) {
    console.error('出演者承認エラー:', err);
    res.status(500).json({ 
      message: '出演者の承認に失敗しました', 
      error: err.message 
    });
  }
});

// @route   POST api/performers/:id/registration-complete
// @desc    Mark performer registration as complete
// @access  Private
router.post('/:id/registration-complete', auth, async (req, res) => {
  try {
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません' });
    }
    
    // ユーザーロールの場合、自分が登録したデータのみアクセス可能
    if (req.user.role === 'user' && performer.userId !== req.user.id) {
      return res.status(403).json({ message: 'このデータへのアクセス権限がありません' });
    }
    
    // 必須ドキュメントの確認
    const documents = performer.documents || {};
    const requiredDocs = ['agreementFile', 'idFront', 'selfie'];
    const missingDocs = requiredDocs.filter(doc => !documents[doc]);
    
    if (missingDocs.length > 0) {
      return res.status(400).json({ 
        message: '必須書類が不足しています',
        missingDocuments: missingDocs 
      });
    }
    
    // KYCステータスを更新
    if (performer.kycStatus === 'not_started') {
      performer.kycStatus = 'in_progress';
    }
    
    // メタデータに登録完了時刻を記録
    performer.kycMetadata = {
      ...performer.kycMetadata,
      registrationCompletedAt: new Date(),
      registrationCompletedBy: req.user.id
    };
    
    await performer.save();
    
    // 監査ログ記録
    await AuditLog.create({
      userId: req.user.id,
      action: 'complete_registration',
      resourceType: 'performer',
      resourceId: performer.id,
      details: {
        performerName: `${performer.lastName} ${performer.firstName}`,
        kycStatus: performer.kycStatus
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    // Webhook通知をトリガー
    const { triggerWebhook } = require('../services/webhookService');
    await triggerWebhook('performer.registration_completed', {
      performerId: performer.id,
      externalId: performer.external_id,
      name: `${performer.lastName} ${performer.firstName}`,
      completedAt: new Date(),
      userId: req.user.id
    });
    
    res.json({
      message: '登録が完了しました',
      performer: performer
    });
  } catch (err) {
    console.error('登録完了エラー:', err);
    res.status(500).json({ 
      message: '登録完了処理に失敗しました', 
      error: err.message 
    });
  }
});

// @route   DELETE api/performers/:id
// @desc    Delete a performer
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const performer = await Performer.findByPk(req.params.id);
    
    if (!performer) {
      return res.status(404).json({ message: '出演者情報が見つかりません。正しいIDで再度お試しください。' });
    }
    
    // ユーザーロールの場合、自分が登録したデータのみ削除可能
    if (req.user.role === 'user' && performer.userId !== req.user.id) {
      return res.status(403).json({ message: 'このデータを削除する権限がありません。' });
    }
    
    // 関連するファイルを削除
    const docData = performer.documents || {};
    Object.values(docData).forEach(doc => {
      if (doc && doc.path) {
        try {
          fs.unlinkSync(doc.path);
        } catch (e) {
          console.error(`ファイル削除エラー: ${e.message}`);
        }
      }
    });
    
    // 監査ログ記録（出演者削除前に記録）
    await AuditLog.create({
      userId: req.user.id,
      action: 'delete',
      resourceType: 'performer',
      resourceId: performer.id,
      details: {
        lastName: performer.lastName,
        firstName: performer.firstName
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    });
    
    // 出演者データを削除
    await Performer.destroy({
      where: { id: req.params.id }
    });
    
    res.json({ message: '出演者情報が削除されました' });
  } catch (err) {
    console.error('出演者削除エラー:', err.message, err.stack);
    res.status(500).json({ 
      message: '出演者情報の削除に失敗しました。', 
      error: err.message 
    });
  }
});

module.exports = router;