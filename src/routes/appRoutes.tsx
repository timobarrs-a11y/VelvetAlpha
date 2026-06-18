import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteFallback } from '../shared/ui/RouteFallback';

const App = lazy(() => import('../App'));
const CompanionLobbyPage = lazy(() => import('../pages/CompanionLobbyPage').then(m => ({ default: m.CompanionLobbyPage })));
const ProfilePage = lazy(() => import('../pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const InsightsPage = lazy(() => import('../pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const GroupChatPage = lazy(() => import('../pages/GroupChatPage').then(m => ({ default: m.GroupChatPage })));
const CalendarPage = lazy(() => import('../pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const DailyFeedPage = lazy(() => import('../pages/DailyFeedPage').then(m => ({ default: m.DailyFeedPage })));
const ArticleDetailPage = lazy(() => import('../pages/ArticleDetailPage').then(m => ({ default: m.ArticleDetailPage })));
const VideoHistoryPage = lazy(() => import('../pages/VideoHistoryPage').then(m => ({ default: m.VideoHistoryPage })));
const PricingPageRoute = lazy(() => import('../pages/PricingPageRoute').then(m => ({ default: m.PricingPageRoute })));
const SuccessPage = lazy(() => import('../pages/SuccessPage').then(m => ({ default: m.SuccessPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('../pages/BillingPage').then(m => ({ default: m.BillingPage })));
const CoAuthorPage = lazy(() => import('../pages/CoAuthorPage').then(m => ({ default: m.CoAuthorPage })));
const RealOrNotPage = lazy(() => import('../pages/RealOrNotPage').then(m => ({ default: m.RealOrNotPage })));
const AtlasPage = lazy(() => import('../pages/AtlasPage').then(m => ({ default: m.AtlasPage })));
const LocalExplorerPage = lazy(() => import('../pages/LocalExplorerPage').then(m => ({ default: m.LocalExplorerPage })));

function P(el: React.ReactNode) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<RouteFallback />}>{el}</Suspense>
    </ProtectedRoute>
  );
}

export const appRoutes = [
  <Route key="lobby" path="/lobby" element={P(<CompanionLobbyPage />)} />,
  <Route key="profile" path="/profile" element={P(<ProfilePage />)} />,
  <Route key="insights" path="/insights" element={P(<InsightsPage />)} />,
  <Route key="chat" path="/chat" element={P(<App />)} />,
  <Route key="group-chat" path="/group-chat" element={P(<GroupChatPage />)} />,
  <Route key="calendar" path="/calendar" element={P(<CalendarPage />)} />,
  <Route key="daily-feed" path="/daily-feed" element={P(<DailyFeedPage />)} />,
  <Route key="article" path="/article" element={P(<ArticleDetailPage />)} />,
  <Route key="videos" path="/videos" element={P(<VideoHistoryPage />)} />,
  <Route key="pricing" path="/pricing" element={P(<PricingPageRoute />)} />,
  <Route key="co-author" path="/co-author" element={P(<CoAuthorPage />)} />,
  <Route key="atlas" path="/atlas" element={P(<AtlasPage />)} />,
  <Route key="local-explorer" path="/local-explorer" element={P(<LocalExplorerPage />)} />,
  <Route key="success" path="/success" element={P(<SuccessPage />)} />,
  <Route key="settings" path="/settings" element={P(<SettingsPage />)} />,
  <Route key="billing" path="/billing" element={P(<BillingPage />)} />,
  <Route key="real-or-not" path="/real-or-not" element={P(<RealOrNotPage />)} />,
];
