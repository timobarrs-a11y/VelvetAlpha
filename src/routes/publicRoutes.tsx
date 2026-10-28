import React, { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { SplashPage } from '../pages/SplashPage';
import LoginPage from '../pages/LoginPage';
import SignUpPage from '../pages/SignUpPage';
import { RouteFallback } from '../shared/ui/RouteFallback';

const AboutPage = lazy(() => import('../pages/AboutPage'));
const TermsOfServicePage = lazy(() => import('../pages/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const AddFriendPage = lazy(() => import('../pages/AddFriendPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const PersonSurveyPage = lazy(() => import('../pages/PersonSurveyPage'));
const DonationPage = lazy(() => import('../pages/DonationPage').then(m => ({ default: m.DonationPage })));
const ChangelogPage = lazy(() => import('../pages/ChangelogPage'));

function S(el: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{el}</Suspense>;
}

export const publicRoutes = [
  <Route key="splash" path="/splash" element={<SplashPage />} />,
  // The old welcome page is gone: old links go home (the splash page if signed out).
  <Route key="welcome-public" path="/welcome" element={<Navigate to="/" replace />} />,
  <Route key="login" path="/login" element={<LoginPage />} />,
  <Route key="add-friend" path="/add/:code" element={S(<AddFriendPage />)} />,
  <Route key="signup" path="/signup" element={<SignUpPage />} />,
  <Route key="forgot-password" path="/forgot-password" element={S(<ForgotPasswordPage />)} />,
  <Route key="reset-password" path="/reset-password" element={S(<ResetPasswordPage />)} />,
  <Route key="terms" path="/terms" element={S(<TermsOfServicePage />)} />,
  <Route key="privacy" path="/privacy" element={S(<PrivacyPolicyPage />)} />,
  <Route key="about" path="/about" element={S(<AboutPage />)} />,
  <Route key="person-survey" path="/survey/:token" element={S(<PersonSurveyPage />)} />,
  <Route key="support" path="/support" element={S(<DonationPage />)} />,
  <Route key="updates" path="/updates" element={S(<ChangelogPage />)} />,
  // It was called the changelog; old links land on Updates.
  <Route key="changelog" path="/changelog" element={<Navigate to="/updates" replace />} />,
];
