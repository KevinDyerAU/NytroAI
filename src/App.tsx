import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './pages/login';
import { RegisterPage } from './pages/register';
import { ForgotPasswordPage } from './pages/forgot-password';
import { ResetPasswordPage } from './pages/reset-password';
import { DashboardPage } from './pages/dashboard';
import { LandingPage } from './pages/LandingPage';
import { ValidationLandingPage } from './pages/ValidationLandingPage';
import { ValidationSuccessPage } from './pages/ValidationSuccessPage';
import './styles/index.css';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#dbeafe] border-t-[#3b82f6] rounded-full animate-spin"></div>
          <p className="text-[#64748b]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* $99 Validation Landing Page - default landing page */}
        <Route 
          path="/" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <ValidationLandingPage />
          } 
        />

        {/* Validation success page */}
        <Route path="/validation/success" element={<ValidationSuccessPage />} />

        {/* Direct validation route - accessible even when logged in */}
        <Route path="/validate" element={<ValidationLandingPage />} />

        {/* Legacy redirect: /validation now redirects to root */}
        <Route path="/validation" element={<Navigate to="/" replace />} />

        {/* Original landing page preserved at /original */}
        <Route 
          path="/original" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />
          } 
        />

        {/* Public Auth Routes - redirect to landing page */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to landing or dashboard */}
        <Route 
          path="*" 
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />
          } 
        />
      </Routes>
    </Router>
  );
}
