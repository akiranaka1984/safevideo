import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Video, Lock, Mail, LogIn, Globe } from 'lucide-react';
import { trackEvent, trackUserLogin, trackPageView, trackError, ANALYTICS_EVENTS } from '../services/firebaseAnalytics';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  
  // Track page view on component mount
  useEffect(() => {
    trackPageView('Login Page');
  }, []);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Track login attempt
    trackEvent(ANALYTICS_EVENTS.LOGIN_ATTEMPT, {
      method: 'email_password',
      email_domain: email.split('@')[1] || 'unknown'
    });
    
    try {
      const user = await login(email, password);
      // Track successful login
      trackUserLogin(user?.uid || email, 'email_password', true);
      navigate('/');
    } catch (err) {
      const errorMessage = err.message || 'ログインに失敗しました';
      setError(errorMessage);
      
      // Track failed login
      trackUserLogin(null, 'email_password', false);
      trackError('login_error', errorMessage, err.stack, {
        email_domain: email.split('@')[1] || 'unknown'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <div className="bg-blue-50 p-3 rounded-full">
                <div className="text-white bg-blue-600 rounded-full p-3">
                  <Video size={24} />
                </div>
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">SharegramVideo<span className="text-blue-600">.org</span></h2>
            <p className="mt-2 text-sm text-gray-600">
              A simple and easy solution for your record keeping service.
            </p>
          </div>
          
          <div className="mt-8 bg-white py-8 px-6 shadow-lg rounded-lg border border-gray-100">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  パスワード
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={16} className="text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="appearance-none block w-full pl-10 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isLoading ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <LogIn size={16} className="mr-2" />
                  )}
                  {isLoading ? 'ログイン中...' : 'ログイン'}
                </button>
              </div>
            </form>

            {/* Firebase認証ボタン */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">または</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    // Track Sharegram login attempt
                    trackEvent(ANALYTICS_EVENTS.LOGIN_ATTEMPT, {
                      method: 'sharegram_sso'
                    });
                    
                    // ローディング状態をユーザーに示すため、ボタンを無効化
                    const button = document.querySelector('[data-sharegram-login]');
                    if (button) {
                      button.disabled = true;
                      button.innerHTML = `
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sharegramに移動中...
                      `;
                    }
                    
                    // 認証ページへリダイレクト
                    window.location.href = '/firebase-login';
                  }}
                  data-sharegram-login
                  className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#FFA000" d="M3.89 15.67L6.41 4.11c.06-.27.27-.47.55-.47h10.08c.28 0 .49.2.55.47l2.52 11.56c.02.11 0 .23-.06.32l-.06.08L12 22.11 4.01 16.07l-.06-.08c-.06-.09-.08-.21-.06-.32z"/>
                    <path fill="#F57F17" d="M12 2L4.5 15.07l.5.93L12 21l7-5-3-7.5L12 2z"/>
                    <path fill="#FFCA28" d="M12 2L4.5 15.07l.5.93L12 12.5V2z"/>
                    <path fill="#FFA000" d="M12 2l7.5 13.07-.5.93L12 12.5V2z"/>
                  </svg>
                  Sharegramアカウントでログイン
                </button>
              </div>
            </div>
            
            <div className="mt-6 text-center">
              <button className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200">
                <Globe size={14} className="mr-1" />
                <span>日本語</span>
              </button>
            </div>
          </div>
          
          <div className="text-center text-xs text-gray-500 mt-4">
            © 2025 SharegramVideo All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;