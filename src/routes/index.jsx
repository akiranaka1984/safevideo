import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import MainLayout from '../layouts/MainLayout';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import PerformersPage from '../pages/PerformersPage';
import PerformerDetailPage from '../pages/PerformerDetailPage';
import AddPerformerPage from '../pages/AddPerformerPage';
import AuditLogsPage from '../pages/AuditLogsPage';
import CancellationPage from '../pages/CancellationPage';
import FAQsPage from '../pages/FAQsPage';
import ContactPage from '../pages/ContactPage';
import TermsPage from '../pages/TermsPage';
import PrivacyPage from '../pages/PrivacyPage';
import CustomVideoDetailPage from '../pages/CustomVideoDetailPage';

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
            <Route path="/performers" element={
              <ProtectedRoute>
                <PerformersPage />
              </ProtectedRoute>
            } />
            <Route path="/performers/:id" element={
              <ProtectedRoute>
                <PerformerDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/performers/add" element={
              <ProtectedRoute>
                <AddPerformerPage />
              </ProtectedRoute>
            } />
            <Route path="/audit-logs" element={
              <ProtectedRoute>
                <AuditLogsPage />
              </ProtectedRoute>
            } />

            <Route path="/videos/:id" element={
              <ProtectedRoute>
                <CustomVideoDetailPage />
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