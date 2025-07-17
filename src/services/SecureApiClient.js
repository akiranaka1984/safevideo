import axios from 'axios';
import { auth } from '../config/firebase';

/**
 * セキュアなAPIクライアント
 * - httpOnly cookieを活用したトークン管理
 * - CSRF保護
 * - 自動リトライ機能
 */
class SecureApiClient {
  constructor() {
    this.client = null;
    this.csrfToken = null;
    this.isInitialized = false;
    this.retryCount = 3;
    this.retryDelay = 1000;
    
    this.setupClient();
  }

  setupClient() {
    // Axiosインスタンスの作成
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || '/api',
      timeout: 30000,
      withCredentials: true, // Cookie送信を有効化
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest' // CSRF対策
      }
    });

    // リクエストインターセプター
    this.client.interceptors.request.use(
      async (config) => {
        // CSRFトークンの付与
        if (this.csrfToken) {
          config.headers['X-CSRF-Token'] = this.csrfToken;
        }

        // Firebase IDトークンの取得（必要な場合）
        const currentUser = auth.currentUser;
        if (currentUser && config.useFirebaseAuth !== false) {
          try {
            const idToken = await currentUser.getIdToken();
            config.headers['X-Firebase-Token'] = idToken;
          } catch (error) {
            console.warn('Firebase token取得エラー:', error);
          }
        }

        // セキュリティヘッダーの追加
        config.headers['X-Client-Version'] = process.env.REACT_APP_VERSION || '1.0.0';
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        // CSRFトークンの更新
        const newCsrfToken = response.headers['x-csrf-token'];
        if (newCsrfToken) {
          this.csrfToken = newCsrfToken;
        }

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // 401エラー（認証エラー）の処理
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // セッションの更新を試みる
            await this.refreshSession();
            return this.client(originalRequest);
          } catch (refreshError) {
            // セッション更新失敗時はログイン画面へ
            this.handleAuthError();
            return Promise.reject(refreshError);
          }
        }

        // 429エラー（レート制限）の処理
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
          
          console.warn(`レート制限に達しました。${delay / 1000}秒後に再試行してください。`);
          
          // 自動リトライは行わない（ユーザーに通知）
          return Promise.reject({
            ...error,
            isRateLimited: true,
            retryAfter: delay
          });
        }

        // ネットワークエラーの自動リトライ
        if (!error.response && originalRequest._retryCount < this.retryCount) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          await this.delay(this.retryDelay * originalRequest._retryCount);
          return this.client(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * セッションの初期化
   */
  async initializeSession() {
    try {
      const response = await this.client.post('/auth/session/init', {
        clientInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      this.csrfToken = response.data.csrfToken;
      this.isInitialized = true;

      console.log('✅ セキュアセッションが初期化されました');
      return response.data;
    } catch (error) {
      console.error('❌ セッション初期化エラー:', error);
      throw error;
    }
  }

  /**
   * Firebase認証セッションの作成
   */
  async createFirebaseSession(idToken) {
    try {
      const response = await this.client.post('/auth/firebase/session', {
        idToken
      }, {
        useFirebaseAuth: false // このリクエストではFirebaseトークンを使用しない
      });

      this.csrfToken = response.data.csrfToken;
      
      console.log('✅ Firebase認証セッションが作成されました');
      return response.data;
    } catch (error) {
      console.error('❌ Firebaseセッション作成エラー:', error);
      throw error;
    }
  }

  /**
   * セッションの更新
   */
  async refreshSession() {
    try {
      const response = await this.client.post('/auth/session/refresh');
      
      this.csrfToken = response.data.csrfToken;
      
      console.log('✅ セッションが更新されました');
      return response.data;
    } catch (error) {
      console.error('❌ セッション更新エラー:', error);
      throw error;
    }
  }

  /**
   * ログアウト
   */
  async logout() {
    try {
      await this.client.post('/auth/logout');
      
      // クライアント側のクリーンアップ
      this.csrfToken = null;
      this.isInitialized = false;
      
      console.log('✅ ログアウトしました');
    } catch (error) {
      console.error('❌ ログアウトエラー:', error);
      // エラーが発生してもクリーンアップは実行
      this.csrfToken = null;
      this.isInitialized = false;
    }
  }

  /**
   * 認証エラーのハンドリング
   */
  handleAuthError() {
    // クリーンアップ
    this.csrfToken = null;
    this.isInitialized = false;

    // カスタムイベントを発火
    window.dispatchEvent(new CustomEvent('auth:error', {
      detail: { message: '認証が必要です' }
    }));

    // ログイン画面へリダイレクト（React Router使用時）
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    }
  }

  /**
   * 遅延関数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * セキュアなGETリクエスト
   */
  async get(url, config = {}) {
    if (!this.isInitialized) {
      await this.initializeSession();
    }
    return this.client.get(url, config);
  }

  /**
   * セキュアなPOSTリクエスト
   */
  async post(url, data, config = {}) {
    if (!this.isInitialized) {
      await this.initializeSession();
    }
    return this.client.post(url, data, config);
  }

  /**
   * セキュアなPUTリクエスト
   */
  async put(url, data, config = {}) {
    if (!this.isInitialized) {
      await this.initializeSession();
    }
    return this.client.put(url, data, config);
  }

  /**
   * セキュアなDELETEリクエスト
   */
  async delete(url, config = {}) {
    if (!this.isInitialized) {
      await this.initializeSession();
    }
    return this.client.delete(url, config);
  }

  /**
   * ファイルアップロード
   */
  async uploadFile(url, file, onProgress) {
    if (!this.isInitialized) {
      await this.initializeSession();
    }

    const formData = new FormData();
    formData.append('file', file);

    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      }
    });
  }

  /**
   * セキュリティ状態の取得
   */
  getSecurityStatus() {
    return {
      isInitialized: this.isInitialized,
      hasCSRFToken: !!this.csrfToken,
      isSecure: window.location.protocol === 'https:',
      isAuthenticated: !!auth.currentUser
    };
  }
}

// シングルトンインスタンスをエクスポート
const secureApiClient = new SecureApiClient();

// 認証エラーのグローバルリスナー
window.addEventListener('auth:error', (event) => {
  console.error('認証エラー:', event.detail.message);
  // 必要に応じてトースト通知などを表示
});

export default secureApiClient;