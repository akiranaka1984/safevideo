const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../middleware/auth');
const { checkRole } = require('../../middleware/checkRole');
const { SharegramIntegration, KYCRequest, Performer } = require('../../models');
const { createSharegramClient } = require('../../services/sharegram/sharegramClient');
const logger = require('../../utils/logger/logger');
const { auditLog } = require('../../utils/logger/auditLogger');
const AppError = require('../../utils/errors/AppError');

// GET /api/integration/status - 統合ステータスの取得
router.get('/status', authenticateUser, checkRole(['admin', 'moderator']), async (req, res, next) => {
  try {
    logger.info('統合ステータスの取得を開始', { userId: req.user.id });

    // Sharegram統合情報の取得
    const integration = await SharegramIntegration.findOne({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });

    // KYC処理統計の取得
    const kycStats = await KYCRequest.findAll({
      attributes: [
        'status',
        [SharegramIntegration.sequelize.fn('COUNT', SharegramIntegration.sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // KYC統計をオブジェクトに変換
    const kycStatistics = kycStats.reduce((acc, stat) => {
      acc[stat.status] = parseInt(stat.count);
      return acc;
    }, {
      pending: 0,
      in_progress: 0,
      verified: 0,
      rejected: 0,
      expired: 0
    });

    // 最近のエラー情報を取得
    const recentErrors = integration ? await SharegramIntegration.findAll({
      where: {
        lastError: { [SharegramIntegration.sequelize.Op.ne]: null },
        updatedAt: {
          [SharegramIntegration.sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // 過去24時間
        }
      },
      attributes: ['lastError', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: 5
    }) : [];

    const response = {
      sharegram: {
        enabled: !!integration && integration.isActive,
        lastSyncDate: integration ? integration.lastSyncDate : null,
        totalSyncedPerformers: integration ? integration.totalSyncedPerformers : 0,
        lastSyncStatus: integration ? integration.lastSyncStatus : 'never_synced'
      },
      kyc: {
        statistics: kycStatistics,
        totalRequests: Object.values(kycStatistics).reduce((sum, count) => sum + count, 0)
      },
      errors: {
        hasRecentErrors: recentErrors.length > 0,
        recentErrors: recentErrors.map(err => ({
          message: err.lastError,
          timestamp: err.updatedAt
        }))
      }
    };

    // 監査ログに記録
    await auditLog('integration_status_check', req.user.id, null, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('統合ステータス取得エラー:', error);
    next(new AppError('統合ステータスの取得に失敗しました', 500));
  }
});

// GET /api/integration/health - ヘルスチェック
router.get('/health', async (req, res, next) => {
  try {
    const healthChecks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    };

    // データベース接続チェック
    try {
      await SharegramIntegration.sequelize.authenticate();
      healthChecks.checks.database = {
        status: 'healthy',
        message: 'Database connection is active'
      };
    } catch (dbError) {
      healthChecks.status = 'unhealthy';
      healthChecks.checks.database = {
        status: 'unhealthy',
        message: 'Database connection failed',
        error: dbError.message
      };
    }

    // Sharegram API接続チェック
    try {
      // アクティブな統合を探す
      const activeIntegration = await SharegramIntegration.findOne({
        where: { isActive: true },
        order: [['createdAt', 'DESC']]
      });
      
      if (activeIntegration) {
        const client = await createSharegramClient(activeIntegration.id);
        const apiHealth = await client.checkHealth();
        healthChecks.checks.sharegramApi = {
          status: apiHealth.success ? 'healthy' : 'unhealthy',
          message: apiHealth.message || 'Sharegram API is reachable',
          responseTime: apiHealth.responseTime
        };
      } else {
        healthChecks.checks.sharegramApi = {
          status: 'warning',
          message: 'No active Sharegram integration configured'
        };
      }
    } catch (apiError) {
      healthChecks.checks.sharegramApi = {
        status: 'unhealthy',
        message: 'Sharegram API connection failed',
        error: apiError.message
      };
      healthChecks.status = 'degraded';
    }

    // 認証システムチェック（簡易版）
    try {
      // 認証ミドルウェアの存在確認
      const authMiddlewareExists = typeof authenticateUser === 'function';
      healthChecks.checks.authSystem = {
        status: authMiddlewareExists ? 'healthy' : 'unhealthy',
        message: authMiddlewareExists ? 'Authentication system is configured' : 'Authentication system not found'
      };
    } catch (authError) {
      healthChecks.checks.authSystem = {
        status: 'unhealthy',
        message: 'Authentication system check failed',
        error: authError.message
      };
      healthChecks.status = 'degraded';
    }

    // メモリ使用量チェック
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    healthChecks.checks.memory = {
      status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      usagePercent: `${memoryUsagePercent.toFixed(2)}%`
    };

    // 全体のステータス決定
    const allHealthy = Object.values(healthChecks.checks).every(check => check.status === 'healthy');
    const hasUnhealthy = Object.values(healthChecks.checks).some(check => check.status === 'unhealthy');
    
    if (allHealthy) {
      healthChecks.status = 'healthy';
    } else if (hasUnhealthy) {
      healthChecks.status = 'unhealthy';
    } else {
      healthChecks.status = 'degraded';
    }

    // HTTPステータスコードの決定
    const statusCode = healthChecks.status === 'healthy' ? 200 : 
                      healthChecks.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthChecks);

  } catch (error) {
    logger.error('ヘルスチェックエラー:', error);
    res.status(503).json({
      timestamp: new Date().toISOString(),
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

module.exports = router;