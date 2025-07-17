import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { login, logout, checkAuth } from '../services/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const authCheckPerformed = useRef(false); // 認証チェックが実行されたかを追跡

  useEffect(() => {
    // 認証チェックが既に実行されたかチェック
    if (authCheckPerformed.current) return;

    const checkAuthentication = async () => {
      try {
        // ローカルストレージにトークンがない場合は早期リターン
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('No token found.');
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        console.log('Token found, checking authentication...');
        const userData = await checkAuth();
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.log('Authentication check failed:', error);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
        authCheckPerformed.current = true; // 認証チェックが実行されたことをマーク
      }
    };

    checkAuthentication();
  }, []);

  const loginUser = async (email, password, token = null) => {
    try {
      let userData;
      if (token) {
        // SSO経由のログイン（トークンが直接提供される）
        localStorage.setItem('token', token);
        userData = await checkAuth();
      } else {
        // 通常のメール/パスワードログイン
        userData = await login(email, password);
      }
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const logoutUser = async () => {
    try {
      await logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login: loginUser,
    logout: logoutUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};