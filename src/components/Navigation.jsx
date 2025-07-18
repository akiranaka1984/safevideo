import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Clock, Shield, Settings, Home, Users, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Navigation = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="bg-gray-800 text-white w-64 min-h-screen hidden md:block">
      <div className="p-6">
        <div className="flex items-center">
          <Shield className="h-8 w-8 mr-2 text-green-400" />
          <span className="text-xl font-bold">SharegramVideo</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">出演者情報管理システム</p>
      </div>
      
      <nav className="mt-6">
        <Link
          to="/"
          className={`flex items-center px-6 py-3 hover:bg-gray-700 ${
            location.pathname === '/' ? 'bg-gray-700' : ''
          }`}
        >
          <Home className="h-5 w-5 mr-3" />
          <span>ダッシュボード</span>
        </Link>
        
        <Link
          to="/performers"
          className={`flex items-center px-6 py-3 hover:bg-gray-700 ${
            isActive('/performers') ? 'bg-gray-700' : ''
          }`}
        >
          <User className="h-5 w-5 mr-3" />
          <span>{isAdmin ? '全出演者一覧' : 'マイ出演者一覧'}</span>
        </Link>
        
        {/* 管理者専用メニュー */}
        {/* 監査ログとシステム設定を非表示 */}
      </nav>
    </aside>
  );
};

export default Navigation;