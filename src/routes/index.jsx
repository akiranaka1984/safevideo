import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import MainLayout from '../layouts/MainLayout';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import VideoDetailPage from '../pages/VideoDetailPage';
import AddVideoPage from '../pages/AddVideoPage';
import AddPerformerPage from '../pages/AddPerformerPage';
import CancellationPage from '../pages/CancellationPage';
import FAQsPage from '../pages/FAQsPage';
import ContactPage from '../pages/ContactPage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';

// 認証済みユーザーのみがアクセスできるルート
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<MainLayout />}>
            {/* 認証が必要なルート */}
            <Route path="/" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/videos/:id" element={
              <ProtectedRoute>
                <VideoDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/videos/add" element={
              <ProtectedRoute>
                <AddVideoPage />
              </ProtectedRoute>
            } />
            <Route path="/videos/:id/performers/add" element={
              <ProtectedRoute>
                <AddPerformerPage />
              </ProtectedRoute>
            } />
            
            {/* 認証不要のフッターページ */}
            <Route path="/cancellation" element={<CancellationPage />} />
            <Route path="/faqs" element={<FAQsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default AppRoutes;