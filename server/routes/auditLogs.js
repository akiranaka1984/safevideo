const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { AuditLog, User } = require('../models');

// @route   GET api/audit-logs
// @desc    Get all audit logs with filtering
// @access  Private (Admin Only)
router.get('/', auth, async (req, res) => {
  // 🚨 MANAGER EMERGENCY FIX: 即座に権限チェック
  if (!req.user || req.user.role !== 'admin') {
    console.log('🚨 SECURITY BLOCK: Non-admin access attempt', {
      userId: req.user?.id,
      userRole: req.user?.role,
      path: req.path
    });
    return res.status(403).json({ 
      message: '権限がありません。管理者のみアクセス可能です。',
      code: 'ADMIN_ONLY'
    });
  }
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
    
    // ユーザーIDフィルター（管理者のみアクセス可能）
    if (userId) {
      whereClause.userId = userId;
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
    
    // 日本語化と整形
    const formattedLogs = logs.map(log => {
      const logData = log.toJSON();
      
      // アクションの日本語化
      let actionLabel = '';
      switch(log.action) {
        case 'create': actionLabel = '作成'; break;
        case 'read': actionLabel = '閲覧'; break;
        case 'update': actionLabel = '更新'; break;
        case 'delete': actionLabel = '削除'; break;
        case 'verify': actionLabel = '検証'; break;
        case 'download': actionLabel = 'ダウンロード'; break;
        default: actionLabel = log.action;
      }
      
      // リソースタイプの日本語化
      let resourceTypeLabel = '';
      switch(log.resourceType) {
        case 'performer': resourceTypeLabel = '出演者'; break;
        case 'document': resourceTypeLabel = '書類'; break;
        default: resourceTypeLabel = log.resourceType;
      }
      
      return {
        ...logData,
        actionLabel,
        resourceTypeLabel,
        formattedDate: new Date(log.createdAt).toLocaleString('ja-JP')
      };
    });
    
    res.json(formattedLogs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// @route   GET api/audit-logs/export
// @desc    Export audit logs as Excel file
// @access  Private (Admin only)
router.get('/export', auth, checkRole(['admin']), async (req, res) => {
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
    
    // アクションとリソースタイプのラベルマッピング
    const actionLabels = {
      'create': '作成',
      'read': '閲覧',
      'update': '更新',
      'delete': '削除',
      'verify': '検証',
      'download': 'ダウンロード'
    };
    
    const resourceTypeLabels = {
      'performer': '出演者',
      'document': '書類'
    };
    
    // ExcelのワークブックとワークシートをRUB
    const wb = xlsx.utils.book_new();
    
    // ログデータをExcelに適した形式に変換
    const excelData = logs.map(log => ({
      'タイムスタンプ': new Date(log.createdAt).toLocaleString('ja-JP'),
      'ユーザーID': log.userId,
      'ユーザー名': log.User ? log.User.name : '',
      'メールアドレス': log.User ? log.User.email : '',
      'アクション': actionLabels[log.action] || log.action,
      'リソースタイプ': resourceTypeLabels[log.resourceType] || log.resourceType,
      'リソースID': log.resourceId,
      'IPアドレス': log.ipAddress,
      '詳細': JSON.stringify(log.details, null, 2)
    }));
    
    // ワークシートを作成
    const ws = xlsx.utils.json_to_sheet(excelData);
    
    // 列幅の設定
    const wscols = [
      { wch: 20 }, // タイムスタンプ
      { wch: 10 }, // ユーザーID
      { wch: 15 }, // ユーザー名
      { wch: 25 }, // メールアドレス
      { wch: 10 }, // アクション
      { wch: 12 }, // リソースタイプ
      { wch: 10 }, // リソースID
      { wch: 15 }, // IPアドレス
      { wch: 50 }  // 詳細
    ];
    ws['!cols'] = wscols;
    
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

// @route   GET api/audit-logs/:resourceType/:resourceId
// @desc    Get audit logs for a specific resource
// @access  Private (Admin Only)
router.get('/:resourceType/:resourceId', auth, async (req, res) => {
  // 🚨 MANAGER EMERGENCY FIX: 即座に権限チェック
  if (!req.user || req.user.role !== 'admin') {
    console.log('🚨 SECURITY BLOCK: Non-admin access attempt', {
      userId: req.user?.id,
      userRole: req.user?.role,
      path: req.path
    });
    return res.status(403).json({ 
      message: '権限がありません。管理者のみアクセス可能です。',
      code: 'ADMIN_ONLY'
    });
  }
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
    
    // 日本語化と整形
    const formattedLogs = logs.map(log => {
      const logData = log.toJSON();
      
      // アクションの日本語化
      let actionLabel = '';
      switch(log.action) {
        case 'create': actionLabel = '作成'; break;
        case 'read': actionLabel = '閲覧'; break;
        case 'update': actionLabel = '更新'; break;
        case 'delete': actionLabel = '削除'; break;
        case 'verify': actionLabel = '検証'; break;
        case 'download': actionLabel = 'ダウンロード'; break;
        default: actionLabel = log.action;
      }
      
      // リソースタイプの日本語化
      let resourceTypeLabel = '';
      switch(log.resourceType) {
        case 'performer': resourceTypeLabel = '出演者'; break;
        case 'document': resourceTypeLabel = '書類'; break;
        default: resourceTypeLabel = log.resourceType;
      }
      
      return {
        ...logData,
        actionLabel,
        resourceTypeLabel,
        formattedDate: new Date(log.createdAt).toLocaleString('ja-JP')
      };
    });
    
    res.json(formattedLogs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

module.exports = router;