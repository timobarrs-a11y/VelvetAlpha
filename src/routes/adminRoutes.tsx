import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RoleGuard } from '../components/RoleGuard';
import type { UserRole } from '../services/roleService';
import { RouteFallback } from '../shared/ui/RouteFallback';

const PromptDebuggerPage = lazy(() => import('../pages/PromptDebuggerPage').then(m => ({ default: m.PromptDebuggerPage })));
const DebugSubscriptionPage = lazy(() => import('../pages/DebugSubscriptionPage'));
const AdminAnalyticsPage = lazy(() => import('../pages/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const UserManagementPage = lazy(() => import('../pages/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const SemanticMemoryDebugPage = lazy(() => import('../pages/SemanticMemoryDebugPage'));
const MonitoringDashboardPage = lazy(() => import('../pages/MonitoringDashboardPage').then(m => ({ default: m.MonitoringDashboardPage })));
const ResponseQualityPage = lazy(() => import('../pages/ResponseQualityPage').then(m => ({ default: m.ResponseQualityPage })));

function admin(role: UserRole | 'manager_or_above', el: React.ReactNode) {
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
  <Route key="admin-response-quality" path="/admin/response-quality" element={admin('manager_or_above', <ResponseQualityPage />)} />,
  <Route key="admin-users" path="/admin/users" element={admin('admin', <UserManagementPage />)} />,
  <Route key="prompt-debugger" path="/prompt-debugger" element={admin('manager_or_above', <PromptDebuggerPage />)} />,
  <Route key="debug-subscription" path="/debug-subscription" element={admin('manager_or_above', <DebugSubscriptionPage />)} />,
  <Route key="debug-semantic" path="/debug-semantic" element={admin('manager_or_above', <SemanticMemoryDebugPage />)} />,
];
