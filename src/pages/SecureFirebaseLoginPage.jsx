import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Shield, Lock, AlertTriangle } from 'lucide-react';
import FirebaseAuthUI from '../components/auth/FirebaseAuthUI';
import { useSecureFirebaseAuth } from '../contexts/SecureFirebaseAuthContext';

const SecureFirebaseLoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, getSecurityStatus } = useSecureFirebaseAuth();
  const [securityStatus, setSecurityStatus] = useState(null);

  // セキュリティステータスの監視
  useEffect(() => {
    const status = getSecurityStatus();
    setSecurityStatus(status);

    // HTTPSでない場合の警告
    if (!status.isHttps && process.env.NODE_ENV === 'production') {
      console.error('🚨 セキュリティ警告: HTTPSを使用してください');
    }
  }, [getSecurityStatus]);

  // 既に認証済みの場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // 認証成功時の処理
  const handleAuthSuccess = async (user, idToken) => {
    try {
      console.log('🎉 認証成功:', user.email);
      
      // SafeVideo APIへのトークン送信（セキュアな方法）
      const response = await fetch('/api/auth/firebase-sso', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest' // CSRF対策
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          idToken: idToken,
          returnUrl: '/dashboard'
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // 安全なリダイレクト
        if (data.redirectUrl && data.redirectUrl.startsWith('/')) {
          navigate(data.redirectUrl);
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error('認証APIエラー');
      }
    } catch (error) {
      console.error('❌ 認証処理エラー:', error);
      // エラーはFirebaseAuthUIコンポーネントで表示される
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* セキュリティステータスバー */}
      {securityStatus && (
        <div className={`${
          securityStatus.isHttps 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-yellow-50 border-yellow-200 text-yellow-800'
        } border-b px-4 py-2`}>
          <div className="max-w-7xl mx-auto flex items-center justify-center text-sm">
            {securityStatus.isHttps ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                <span>安全な接続（HTTPS）</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                <span>警告: 安全でない接続です</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full space-y-8">
          {/* ロゴとタイトル */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="bg-blue-100 p-4 rounded-full">
                  <Video className="w-12 h-12 text-blue-600" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                  <Shield className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              SafeVideo KYC
            </h1>
            <p className="mt-2 text-gray-600">
              セキュアなFirebase認証システム
            </p>
          </div>

          {/* ログインフォーム */}
          <div className="mt-8">
            <FirebaseAuthUI 
              onAuthSuccess={handleAuthSuccess}
              mode="login"
            />
          </div>

          {/* セキュリティ情報 */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              セキュリティ機能
            </h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                エンドツーエンド暗号化
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                セッションベースの認証（localStorage不使用）
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                自動セッションタイムアウト
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                ブルートフォース攻撃対策
              </li>
            </ul>
          </div>

          {/* フッター */}
          <div className="text-center text-xs text-gray-500">
            <p>© 2025 SafeVideo KYC. All rights reserved.</p>
            <p className="mt-1">
              Powered by Firebase • Protected by Google Cloud Security
            </p>
          </div>
        </div>
      </div>

      {/* レスポンシブ対応のためのメディアクエリ用スタイル */}
      <style jsx>{`
        @media (max-width: 640px) {
          .min-h-screen {
            min-height: 100vh;
            min-height: -webkit-fill-available;
          }
        }
      `}</style>
    </div>
  );
};

export default SecureFirebaseLoginPage;