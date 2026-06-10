import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { SplashPage } from '../pages/SplashPage';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import TermsOfServicePage from '../pages/TermsOfServicePage';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import { RouteFallback } from '../shared/ui/RouteFallback';

const WelcomePage = lazy(() => import('../pages/WelcomePage').then(m => ({ default: m.WelcomePage })));

export const publicRoutes = [
  <Route key="splash" path="/splash" element={<SplashPage />} />,
  <Route key="welcome-public" path="/welcome" element={<Suspense fallback={<RouteFallback />}><WelcomePage /></Suspense>} />,
  <Route key="login" path="/login" element={<LoginPage />} />,
  <Route key="signup" path="/signup" element={<SignUpPage />} />,
  <Route key="forgot-password" path="/forgot-password" element={<ForgotPasswordPage />} />,
  <Route key="reset-password" path="/reset-password" element={<ResetPasswordPage />} />,
  <Route key="terms" path="/terms" element={<TermsOfServicePage />} />,
  <Route key="privacy" path="/privacy" element={<PrivacyPolicyPage />} />,
];
