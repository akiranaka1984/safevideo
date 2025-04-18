import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Clock, FileCheck, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { getDashboardStats } from '../services/dashboardService';

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

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError('統計情報の取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
            onClick={fetchStats}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
              <Link to="/performers" className="font-medium text-green-600 hover:text-green-500">
                すべて表示
              </Link>
            </div>
          </div>
        </div>

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
              <Link to="/performers?status=pending" className="font-medium text-green-600 hover:text-green-500">
                確認する
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">最近の更新</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{stats.recentlyUpdated}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-4 sm:px-6">
            <div className="text-sm">
              <Link to="/performers?sort=updatedAt" className="font-medium text-green-600 hover:text-green-500">
                詳細を見る
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* 最近のアクティビティ */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">最近のアクティビティ</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">システムでの最近の操作履歴</p>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {stats.recentActivity.length === 0 ? (
              <li className="px-4 py-4 text-center text-gray-500">
                最近のアクティビティはありません
              </li>
            ) : (
              stats.recentActivity.map((activity) => (
                <li key={activity.id} className="px-4 py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {activity.action === 'create' && (
                        <div className="p-2 rounded-full bg-green-100">
                          <Plus className="h-5 w-5 text-green-600" />
                        </div>
                      )}
                      {activity.action === 'update' && (
                        <div className="p-2 rounded-full bg-yellow-100">
                          <RefreshCw className="h-5 w-5 text-yellow-600" />
                        </div>
                      )}
                      {activity.action === 'verify' && (
                        <div className="p-2 rounded-full bg-blue-100">
                          <FileCheck className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.userName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.description}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="bg-gray-50 px-4 py-4 sm:px-6">
          <div className="text-sm">
            <Link to="/audit-logs" className="font-medium text-green-600 hover:text-green-500">
              すべてのログを表示
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;