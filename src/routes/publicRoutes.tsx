import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { SplashPage } from '../pages/SplashPage';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import { RouteFallback } from '../shared/ui/RouteFallback';

const WelcomePage = lazy(() => import('../pages/WelcomePage').then(m => ({ default: m.WelcomePage })));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const TermsOfServicePage = lazy(() => import('../pages/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));

function S(el: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{el}</Suspense>;
}

export const publicRoutes = [
  <Route key="splash" path="/splash" element={<SplashPage />} />,
  <Route key="welcome-public" path="/welcome" element={S(<WelcomePage />)} />,
  <Route key="login" path="/login" element={<LoginPage />} />,
  <Route key="signup" path="/signup" element={<SignUpPage />} />,
  <Route key="forgot-password" path="/forgot-password" element={S(<ForgotPasswordPage />)} />,
  <Route key="reset-password" path="/reset-password" element={S(<ResetPasswordPage />)} />,
  <Route key="terms" path="/terms" element={S(<TermsOfServicePage />)} />,
  <Route key="privacy" path="/privacy" element={S(<PrivacyPolicyPage />)} />,
  <Route key="about" path="/about" element={S(<AboutPage />)} />,
];
