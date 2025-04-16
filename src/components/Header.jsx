import React from 'react';
import { Video, User, LogOut, ArrowLeft } from 'lucide-react';

const Header = ({ navigateTo, currentView }) => {
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div 
            className="cursor-pointer flex items-center" 
            onClick={() => navigateTo('dashboard')}
          >
            <div className="text-green-500 p-1 rounded-md bg-green-50">
              <div className="bg-green-500 text-white p-1 rounded-md">
                <Video size={18} />
              </div>
            </div>
            <span className="ml-2 font-bold text-gray-800">SafeVideo<span className="text-gray-400 text-xs">.org</span></span>
          </div>
          
          {currentView !== 'dashboard' && (
            <button
              onClick={() => navigateTo('dashboard')}
              className="flex items-center text-sm text-gray-500 hover:text-gray-700 ml-4"
            >
              <ArrowLeft size={16} className="mr-1" />
              トップ
            </button>
          )}
        </div>
        
        <div className="flex items-center">
          <div className="text-sm text-gray-600 mr-4">
            <div className="flex items-center">
              <User size={16} className="mr-1" />
              lc6343cb9ee8ccb
            </div>
          </div>
          <button 
            onClick={() => navigateTo('login')}
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