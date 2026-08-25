import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteFallback } from '../shared/ui/RouteFallback';

const QuestionnairePage = lazy(() => import('../pages/QuestionnairePage').then(m => ({ default: m.QuestionnairePage })));
const UserProfileQuestionnairePage = lazy(() => import('../pages/UserProfileQuestionnairePage').then(m => ({ default: m.UserProfileQuestionnairePage })));
const CompanionPathSelectPage = lazy(() => import('../pages/CompanionPathSelectPage').then(m => ({ default: m.CompanionPathSelectPage })));
const CreateAdditionalCompanionPage = lazy(() => import('../pages/CreateAdditionalCompanionPage').then(m => ({ default: m.CreateAdditionalCompanionPage })));
const AnalyzingPage = lazy(() => import('../pages/AnalyzingPage').then(m => ({ default: m.AnalyzingPage })));
const SignatureVoiceSelectionPage = lazy(() => import('../pages/SignatureVoiceSelectionPage'));
const PricingOfferPage = lazy(() => import('../pages/PricingOfferPage').then(m => ({ default: m.PricingOfferPage })));
const CreateUserAvatarPage = lazy(() => import('../pages/CreateUserAvatarPage').then(m => ({ default: m.CreateUserAvatarPage })));
const CreateCompanionAvatarPage = lazy(() => import('../pages/CreateCompanionAvatarPage').then(m => ({ default: m.CreateCompanionAvatarPage })));
const OnboardingTourPage = lazy(() => import('../pages/OnboardingTourPage').then(m => ({ default: m.OnboardingTourPage })));
const GoalDiscoveryPage = lazy(() => import('../pages/GoalDiscoveryPage').then(m => ({ default: m.GoalDiscoveryPage })));
const IntentSelectPage = lazy(() => import('../pages/IntentSelectPage').then(m => ({ default: m.IntentSelectPage })));
const ExpertSelectionPage = lazy(() => import('../pages/ExpertSelectionPage'));
const ExpertQuestionnairePage = lazy(() => import('../pages/ExpertQuestionnairePage').then(m => ({ default: m.ExpertQuestionnairePage })));
const ExpertBuilderPage = lazy(() => import('../pages/ExpertBuilderPage').then(m => ({ default: m.ExpertBuilderPage })));

function wrap(el: React.ReactNode) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteFallback />}>{el}</Suspense>
    </ProtectedRoute>
  );
}

export const onboardingRoutes = [
  <Route key="goal-discovery" path="/goal-discovery" element={wrap(<GoalDiscoveryPage />)} />,
  <Route key="user-questionnaire" path="/user-questionnaire" element={wrap(<UserProfileQuestionnairePage />)} />,
  <Route key="create-user-avatar" path="/create-user-avatar" element={wrap(<CreateUserAvatarPage />)} />,
  <Route key="intent-select" path="/intent-select" element={wrap(<IntentSelectPage />)} />,
  <Route key="companion-path" path="/companion-path" element={wrap(<CompanionPathSelectPage />)} />,
  <Route key="expert-selection" path="/expert-selection" element={wrap(<ExpertSelectionPage />)} />,
  <Route key="expert-questionnaire" path="/expert-questionnaire" element={wrap(<ExpertQuestionnairePage />)} />,
  <Route key="expert-builder" path="/expert-builder" element={wrap(<ExpertBuilderPage />)} />,
  <Route key="questionnaire" path="/questionnaire" element={wrap(<QuestionnairePage />)} />,
  <Route key="create-additional-companion" path="/create-additional-companion" element={wrap(<CreateAdditionalCompanionPage />)} />,
  <Route key="analyzing" path="/analyzing" element={wrap(<AnalyzingPage />)} />,
  <Route key="voice-selection" path="/voice-selection" element={wrap(<SignatureVoiceSelectionPage />)} />,
  <Route key="create-companion-avatar" path="/create-companion-avatar" element={wrap(<CreateCompanionAvatarPage />)} />,
  <Route key="pricing-offer" path="/pricing-offer" element={wrap(<PricingOfferPage />)} />,
  <Route key="onboarding" path="/onboarding" element={wrap(<OnboardingTourPage />)} />,
];
