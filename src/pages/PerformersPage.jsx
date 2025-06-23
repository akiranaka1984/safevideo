import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Plus, Eye, Download, Trash } from 'lucide-react';
import { getPerformers } from '../services/performerService';
import { useAuth } from '../contexts/AuthContext';

const PerformersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPerformers = async () => {
      try {
        // 管理者は別のエンドポイントを使用可能（実装時に調整）
        const data = await getPerformers();
        setPerformers(data);
      } catch (err) {
        setError('出演者情報の取得に失敗しました');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformers();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-md p-4">
        <p>{error}</p>
        <button 
          onClick={() => navigate('/')}
          className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
        >
          ダッシュボードに戻る
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="md:flex md:items-center md:justify-between mb-6">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            {isAdmin ? '全出演者一覧' : 'マイ出演者一覧'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin 
              ? 'システムに登録されているすべての出演者の一覧です' 
              : 'あなたが登録した出演者の一覧です'}
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <Link
            to="/performers/add"
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <Plus className="mr-2 -ml-1 h-5 w-5" />
            出演者を追加
          </Link>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">登録済み出演者</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
            {performers.length}名
          </span>
        </div>
        
        {performers.length === 0 ? (
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">出演者なし</h3>
            <p className="mt-1 text-sm text-gray-500">出演者情報は登録されていません</p>
            <div className="mt-6">
              <Link
                to="/performers/add"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                出演者を追加
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {performers.map((performer) => (
              <li key={performer.id} className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <User className="h-8 w-8 rounded-full bg-gray-100 p-1 text-gray-500" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {performer.lastName} {performer.firstName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {performer.lastNameRoman} {performer.firstNameRoman}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/performers/${performer.id}`}
                      className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>

                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PerformersPage;
