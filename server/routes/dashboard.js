// server/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { Performer, AuditLog, User } = require('../models');

// @route   GET api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    // ダミーデータを返す
    res.json({
      totalPerformers: 12,
      pendingVerification: 3,
      recentlyUpdated: 5,
      expiringDocuments: 2,
      recentActivity: [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          userName: 'サンプルユーザー',
          action: 'create',
          resourceType: 'performer',
          resourceId: 1,
          description: '出演者を新規作成しました。'
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          userName: 'サンプルユーザー',
          action: 'update',
          resourceType: 'performer',
          resourceId: 2,
          description: '出演者情報を更新しました。'
        }
      ]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// @route   GET api/dashboard/activity
// @desc    Get recent activity
// @access  Private
router.get('/activity', auth, async (req, res) => {
  try {
    // ダミーデータを返す
    res.json([
      {
        id: 1,
        timestamp: new Date().toISOString(),
        userName: 'サンプルユーザー',
        action: 'create',
        resourceType: 'performer',
        resourceId: 1,
        description: '出演者を新規作成しました。'
      },
      {
        id: 2,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        userName: 'サンプルユーザー',
        action: 'update',
        resourceType: 'performer',
        resourceId: 2,
        description: '出演者情報を更新しました。'
      }
    ]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

// @route   GET api/dashboard/chart
// @desc    Get chart data
// @access  Private
router.get('/chart', auth, async (req, res) => {
  try {
    // ダミーデータを返す
    const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    res.json({
      labels,
      datasets: [
        {
          label: '出演者登録数',
          data: [4, 6, 8, 10, 12, 8, 6, 4, 7, 9, 11, 12]
        },
        {
          label: '書類アップロード数',
          data: [10, 12, 15, 18, 20, 15, 12, 10, 14, 16, 18, 22]
        },
        {
          label: '検証完了数',
          data: [8, 10, 12, 14, 16, 12, 10, 8, 11, 13, 15, 18]
        }
      ]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('サーバーエラーが発生しました');
  }
});

module.exports = router;