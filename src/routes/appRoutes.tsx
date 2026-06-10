import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteFallback } from '../shared/ui/RouteFallback';

import App from '../App';
import { CompanionLobbyPage } from '../pages/CompanionLobbyPage';
import { ProfilePage } from '../pages/ProfilePage';
import { InsightsPage } from '../pages/InsightsPage';
import { GroupChatPage } from '../pages/GroupChatPage';
import { CalendarPage } from '../pages/CalendarPage';
import { DailyFeedPage } from '../pages/DailyFeedPage';
import { ArticleDetailPage } from '../pages/ArticleDetailPage';
import { VideoHistoryPage } from '../pages/VideoHistoryPage';
import { PricingPageRoute } from '../pages/PricingPageRoute';
import { SuccessPage } from '../pages/SuccessPage';
import { SettingsPage } from '../pages/SettingsPage';
import { BillingPage } from '../pages/BillingPage';

const CoAuthorPage = lazy(() => import('../pages/CoAuthorPage').then(m => ({ default: m.CoAuthorPage })));
const RealOrNotPage = lazy(() => import('../pages/RealOrNotPage').then(m => ({ default: m.RealOrNotPage })));
const AtlasPage = lazy(() => import('../pages/AtlasPage').then(m => ({ default: m.AtlasPage })));
const LocalExplorerPage = lazy(() => import('../pages/LocalExplorerPage').then(m => ({ default: m.LocalExplorerPage })));

function P(el: React.ReactNode) {
  return <ProtectedRoute>{el}</ProtectedRoute>;
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
  <Route
    key="co-author"
    path="/co-author"
    element={
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <CoAuthorPage />
        </Suspense>
      </ProtectedRoute>
    }
  />,
  <Route
    key="atlas"
    path="/atlas"
    element={
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <AtlasPage />
        </Suspense>
      </ProtectedRoute>
    }
  />,
  <Route
    key="local-explorer"
    path="/local-explorer"
    element={
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <LocalExplorerPage />
        </Suspense>
      </ProtectedRoute>
    }
  />,
  <Route key="success" path="/success" element={P(<SuccessPage />)} />,
  <Route key="settings" path="/settings" element={P(<SettingsPage />)} />,
  <Route key="billing" path="/billing" element={P(<BillingPage />)} />,
  <Route
    key="real-or-not"
    path="/real-or-not"
    element={
      <ProtectedRoute>
        <Suspense fallback={<RouteFallback />}>
          <RealOrNotPage />
        </Suspense>
      </ProtectedRoute>
    }
  />,
];
