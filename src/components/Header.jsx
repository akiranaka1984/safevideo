import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, User, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isPathDashboard = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link 
            to="/"
            className="cursor-pointer flex items-center" 
          >
            <div className="text-green-500 p-1 rounded-md bg-green-50">
              <div className="bg-green-500 text-white p-1 rounded-md">
                <Shield size={18} />
              </div>
            </div>
            <span className="ml-2 font-bold text-gray-800">SafeVideo<span className="text-gray-400 text-xs">.org</span></span>
          </Link>
          
          {!isPathDashboard && (
            <Link
              to="/"
              className="flex items-center text-sm text-gray-500 hover:text-gray-700 ml-4"
            >
              <ArrowLeft size={16} className="mr-1" />
              ダッシュボード
            </Link>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <div className="text-sm text-gray-600 mr-4">
              <div className="flex items-center">
                <User size={16} className="mr-1" />
                <span className="font-medium">{user.name || user.email}</span>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-gray-500">
                  ロール: {isAdmin ? '管理者' : '一般ユーザー'}
                  {isAdmin && <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">管理者</span>}
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;