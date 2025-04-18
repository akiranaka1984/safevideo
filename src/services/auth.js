import api from './api';

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    
    // トークンをローカルストレージに保存
    localStorage.setItem('token', token);
    
    return user;
  } catch (error) {
    throw error.response?.data || { message: 'ログインに失敗しました' };
  }
};

export const logout = async () => {
  localStorage.removeItem('token');
  return true;
};

export const checkAuth = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('認証トークンがありません');
  }
  
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    localStorage.removeItem('token');
    throw error;
  }
};

// ユーザーのロールを取得する関数
export const getUserRole = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return 'user';
    
    // JWT処理ロジック
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    const { role } = JSON.parse(jsonPayload);
    return role || 'user';
  } catch (error) {
    console.error('トークン解析エラー:', error);
    return 'user';
  }
};