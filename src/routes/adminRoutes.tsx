import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RoleGuard } from '../components/RoleGuard';
import { RouteFallback } from '../shared/ui/RouteFallback';

const PromptDebuggerPage = lazy(() => import('../pages/PromptDebuggerPage').then(m => ({ default: m.PromptDebuggerPage })));
const DebugSubscriptionPage = lazy(() => import('../pages/DebugSubscriptionPage'));
const AdminAnalyticsPage = lazy(() => import('../pages/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const UserManagementPage = lazy(() => import('../pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const SemanticMemoryDebugPage = lazy(() => import('../pages/SemanticMemoryDebugPage'));
const MonitoringDashboardPage = lazy(() => import('../pages/MonitoringDashboardPage').then(m => ({ default: m.MonitoringDashboardPage })));

function admin(role: string, el: React.ReactNode) {
  return (
    <ProtectedRoute>
      <RoleGuard requiredRole={role}>
        <Suspense fallback={<RouteFallback />}>{el}</Suspense>
      </RoleGuard>
    </ProtectedRoute>
  );
}

export const adminRoutes = [
  <Route key="admin-analytics" path="/admin/analytics" element={admin('manager_or_above', <AdminAnalyticsPage />)} />,
  <Route key="admin-monitoring" path="/admin/monitoring" element={admin('manager_or_above', <MonitoringDashboardPage />)} />,
  <Route key="admin-users" path="/admin/users" element={admin('admin', <UserManagementPage />)} />,
  <Route key="prompt-debugger" path="/prompt-debugger" element={admin('manager_or_above', <PromptDebuggerPage />)} />,
  <Route key="debug-subscription" path="/debug-subscription" element={admin('manager_or_above', <DebugSubscriptionPage />)} />,
  <Route key="debug-semantic" path="/debug-semantic" element={admin('manager_or_above', <SemanticMemoryDebugPage />)} />,
];
