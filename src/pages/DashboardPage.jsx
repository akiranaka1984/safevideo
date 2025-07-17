import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Clock, FileCheck, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { getDashboardStats } from '../services/dashboardService';
import { getUserRole } from '../services/auth';
import { trackEvent, trackPageView, trackError, ANALYTICS_EVENTS } from '../services/firebaseAnalytics';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalPerformers: 0,
    pendingVerification: 0,
    recentlyUpdated: 0,
    expiringDocuments: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('user');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
      
      // Track dashboard stats view
      trackEvent('dashboard_stats_viewed', {
        totalPerformers: data.totalPerformers,
        pendingVerification: data.pendingVerification,
        userRole: userRole
      });
    } catch (err) {
      const errorMsg = '統計情報の取得に失敗しました';
      setError(errorMsg);
      console.error(err);
      
      // Track error
      trackError('dashboard_stats_error', errorMsg, err.stack);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Track page view
    trackPageView('Dashboard Page');
    
    const role = getUserRole();
    setUserRole(role);
    
    // Track user engagement
    trackEvent(ANALYTICS_EVENTS.FEATURE_INTERACTION, {
      feature: 'dashboard_load',
      userRole: role
    });
    
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              // Track refresh action
              trackEvent(ANALYTICS_EVENTS.FEATURE_INTERACTION, {
                feature: 'dashboard_refresh',
                userRole: userRole
              });
              fetchStats();
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            更新
          </button>
          <Link
            to="/performers/add"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <Plus className="mr-2 -ml-1 h-5 w-5" />
            新規出演者登録
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      
      {/* 統計カード */}
      <div className={`grid grid-cols-1 ${userRole === 'admin' ? 'md:grid-cols-2' : ''} gap-6 mb-8`}>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                <User className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">登録出演者数</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{stats.totalPerformers}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <Link 
                to="/performers" 
                className="font-medium text-green-600 hover:text-green-500"
                onClick={() => {
                  trackEvent(ANALYTICS_EVENTS.FEATURE_INTERACTION, {
                    feature: 'view_all_performers',
                    from: 'dashboard',
                    totalPerformers: stats.totalPerformers
                  });
                }}
              >
                すべて表示
              </Link>
            </div>
          </div>
        </div>

        {userRole === 'admin' && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">検証待ち</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{stats.pendingVerification}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm">
                <Link 
                  to="/performers?status=pending" 
                  className="font-medium text-green-600 hover:text-green-500"
                  onClick={() => {
                    trackEvent(ANALYTICS_EVENTS.FEATURE_INTERACTION, {
                      feature: 'view_pending_verification',
                      from: 'dashboard',
                      pendingCount: stats.pendingVerification
                    });
                  }}
                >
                  確認する
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DashboardPage;