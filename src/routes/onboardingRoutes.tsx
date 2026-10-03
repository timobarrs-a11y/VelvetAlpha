import React, { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteFallback } from '../shared/ui/RouteFallback';

const QuestionnairePage = lazy(() => import('../pages/QuestionnairePageV2').then(m => ({ default: m.QuestionnairePageV2 })));
const UserProfileQuestionnairePage = lazy(() => import('../pages/UserProfileQuestionnairePageV2').then(m => ({ default: m.UserProfileQuestionnairePageV2 })));
const CompanionPathSelectPage = lazy(() => import('../pages/CompanionPathSelectPage').then(m => ({ default: m.CompanionPathSelectPage })));
const CreateAdditionalCompanionPage = lazy(() => import('../pages/CreateAdditionalCompanionPage').then(m => ({ default: m.CreateAdditionalCompanionPage })));
const AnalyzingPage = lazy(() => import('../pages/AnalyzingPage').then(m => ({ default: m.AnalyzingPage })));
const SignatureVoiceSelectionPage = lazy(() => import('../pages/SignatureVoiceSelectionPage'));
const PricingOfferPage = lazy(() => import('../pages/PricingOfferPage').then(m => ({ default: m.PricingOfferPage })));
const CreateUserAvatarPage = lazy(() => import('../pages/CreateUserAvatarPage').then(m => ({ default: m.CreateUserAvatarPage })));
const CreateCompanionAvatarPage = lazy(() => import('../pages/CreateCompanionAvatarPage').then(m => ({ default: m.CreateCompanionAvatarPage })));
const OnboardingTourPage = lazy(() => import('../pages/OnboardingTourPage').then(m => ({ default: m.OnboardingTourPage })));
const GoalDiscoveryPage = lazy(() => import('../pages/GoalDiscoveryPage').then(m => ({ default: m.GoalDiscoveryPage })));
const AtlasConciergePage = lazy(() => import('../pages/AtlasConciergePage').then(m => ({ default: m.AtlasConciergePage })));
const CoachAvatarPage = lazy(() => import('../pages/CoachAvatarPage').then(m => ({ default: m.CoachAvatarPage })));
const IntentSelectPage = lazy(() => import('../pages/IntentSelectPage').then(m => ({ default: m.IntentSelectPage })));
const ExpertSelectionPage = lazy(() => import('../pages/ExpertSelectionPage'));
const ExpertQuestionnairePage = lazy(() => import('../pages/ExpertQuestionnairePage').then(m => ({ default: m.ExpertQuestionnairePage })));
const ExpertBuilderPage = lazy(() => import('../pages/ExpertBuilderPage').then(m => ({ default: m.ExpertBuilderPage })));
const CoachReadyPage = lazy(() => import('../pages/CoachReadyPage').then(m => ({ default: m.CoachReadyPage })));
const WhoToTalkPage = lazy(() => import('../pages/WhoToTalkPage').then(m => ({ default: m.WhoToTalkPage })));
const EnvironmentSetupPage = lazy(() => import('../pages/EnvironmentSetupPage').then(m => ({ default: m.EnvironmentSetupPage })));

function wrap(el: React.ReactNode) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteFallback />}>{el}</Suspense>
    </ProtectedRoute>
  );
}

export const onboardingRoutes = [
  <Route key="atlas-onboarding" path="/atlas-onboarding" element={wrap(<AtlasConciergePage />)} />,
  <Route key="coach-avatar" path="/coach-avatar" element={wrap(<CoachAvatarPage />)} />,
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
  <Route key="atlas-routing" path="/atlas-routing" element={<Navigate to="/" replace />} />,
  <Route key="coach-ready" path="/coach-ready" element={wrap(<CoachReadyPage />)} />,
  <Route key="who-to-talk" path="/who-to-talk" element={wrap(<WhoToTalkPage />)} />,
  <Route key="environment-setup" path="/environment-setup" element={wrap(<EnvironmentSetupPage />)} />,
];
