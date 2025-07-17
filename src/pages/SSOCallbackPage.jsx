import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Video, CheckCircle, XCircle } from 'lucide-react';

const SSOCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleSSOCallback = async () => {
      const token = searchParams.get('token');
      const redirect = searchParams.get('redirect') || '/';

      if (!token) {
        console.error('SSOトークンが見つかりません');
        setStatus('error');
        setError('認証トークンが見つかりませんでした。');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        // プログレス更新
        setProgress(25);
        
        // トークンを保存してログイン状態にする
        localStorage.setItem('token', token);
        setProgress(50);
        
        // AuthContextを更新
        await login(null, null, token);
        setProgress(75);
        
        // 成功状態に移行
        setStatus('success');
        setProgress(100);
        
        // 少し待ってからリダイレクト
        setTimeout(() => {
          navigate(redirect);
        }, 1500);
      } catch (error) {
        console.error('SSO認証エラー:', error);
        setStatus('error');
        setError('認証処理中にエラーが発生しました。再度お試しください。');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleSSOCallback();
  }, [searchParams, navigate, login]);

  const getStatusContent = () => {
    switch (status) {
      case 'processing':
        return {
          title: 'Sharegramから認証中...',
          icon: (
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Video className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          ),
          message: 'しばらくお待ちください...'
        };
      case 'success':
        return {
          title: '認証完了',
          icon: (
            <div className="text-green-500 mb-4">
              <CheckCircle className="w-16 h-16 mx-auto" />
            </div>
          ),
          message: 'ダッシュボードへリダイレクトしています...'
        };
      case 'error':
        return {
          title: '認証エラー',
          icon: (
            <div className="text-red-500 mb-4">
              <XCircle className="w-16 h-16 mx-auto" />
            </div>
          ),
          message: error || '認証に失敗しました。'
        };
      default:
        return null;
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          {statusContent.icon}
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            {statusContent.title}
          </h2>
          
          <p className="text-gray-600 mb-6">
            {statusContent.message}
          </p>
          
          {/* プログレスバー */}
          {status === 'processing' && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
          
          {/* エラー時のリダイレクト情報 */}
          {status === 'error' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                3秒後にログインページに戻ります。
              </p>
            </div>
          )}
          
          {/* 成功時のリダイレクト情報 */}
          {status === 'success' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">
                認証が完了しました。まもなくダッシュボードに移動します。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SSOCallbackPage;