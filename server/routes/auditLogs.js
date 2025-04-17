const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const auth = require('../middleware/auth');
const { AuditLog, User } = require('../models');

// @route   GET api/audit-logs
// @desc    Get all audit logs with filtering
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      action,
      resourceType,
      resourceId,
      userId
    } = req.query;
    
    const whereClause = {};
    
    // 日付範囲フィルター
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(endDate)
      };
    }
    
    // アクションフィルター
    if (action) {
      whereClause.action = action;
    }
    
    // リソースタイプフィルター
    if (resourceType) {
      whereClause.resourceType = resourceType;
    }
    
    // リソースIDフィルター
    if (resourceId) {
      whereClause.resourceId = resourceId;
    }
    
    // ユーザーIDフィルター（管理者のみ他のユーザーのログを見ることができる）
    if (userId && req.user.role === 'admin') {
      whereClause.userId = userId;
    } else {
      // 管理者でない場合は自分のログのみ表示
      whereClause.userId = req.user.id;
    }
    
    const logs = await AuditLog.findAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']],
      limit: 1000 // 最大1000件まで
    });
    
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// @route   GET api/audit-logs/:resourceType/:resourceId
// @desc    Get audit logs for a specific resource
// @access  Private
router.get('/:resourceType/:resourceId', auth, async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      where: {
        resourceType: req.params.resourceType,
        resourceId: req.params.resourceId
      },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// @route   GET api/audit-logs/export
// @desc    Export audit logs as Excel file
// @access  Private (Admin only)
router.get('/export', auth, async (req, res) => {
  // 管理者権限チェック
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '権限がありません' });
  }
  
  try {
    const {
      startDate,
      endDate,
      action,
      resourceType
    } = req.query;
    
    const whereClause = {};
    
    // 日付範囲フィルター
    if (startDate && endDate) {
      whereClause.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereClause.createdAt = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereClause.createdAt = {
        [Op.lte]: new Date(endDate)
      };
    }
    
    // アクションフィルター
    if (action) {
      whereClause.action = action;
    }
    
    // リソースタイプフィルター
    if (resourceType) {
      whereClause.resourceType = resourceType;
    }
    
    const logs = await AuditLog.findAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['id', 'name', 'email']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    // ExcelのワークブックとワークシートをRUB
    const wb = xlsx.utils.book_new();
    
    // ログデータをExcelに適した形式に変換
    const excelData = logs.map(log => ({
      'タイムスタンプ': new Date(log.createdAt).toLocaleString(),
      'ユーザーID': log.userId,
      'ユーザー名': log.User ? log.User.name : '',
      'アクション': log.action,
      'リソースタイプ': log.resourceType,
      'リソースID': log.resourceId,
      'IPアドレス': log.ipAddress,
      '詳細': JSON.stringify(log.details)
    }));
    
    // ワークシートを作成
    const ws = xlsx.utils.json_to_sheet(excelData);
    
    // ワークブックに追加
    xlsx.utils.book_append_sheet(wb, ws, '監査ログ');
    
    // バッファに変換
    const excelBuffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });
    
    // レスポンスヘッダーを設定
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=audit_log_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    
    // レスポンスを送信
    res.send(excelBuffer);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

module.exports = router;