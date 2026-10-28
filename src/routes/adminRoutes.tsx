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
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminHomePage = lazy(() => import('../pages/admin/AdminHomePage').then(m => ({ default: m.AdminHomePage })));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminModerationPage = lazy(() => import('../pages/admin/AdminModerationPage').then(m => ({ default: m.AdminModerationPage })));
const AdminFeedbackPage = lazy(() => import('../pages/admin/AdminFeedbackPage').then(m => ({ default: m.AdminFeedbackPage })));
const AdminBotsPage = lazy(() => import('../pages/admin/AdminBotsPage').then(m => ({ default: m.AdminBotsPage })));
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminPromoCodesPage = lazy(() => import('../pages/admin/AdminPromoCodesPage').then(m => ({ default: m.AdminPromoCodesPage })));
const AdminAuditPage = lazy(() => import('../pages/admin/AdminAuditPage').then(m => ({ default: m.AdminAuditPage })));
const MemoryProposalsPage = lazy(() => import('../pages/MemoryProposalsPage').then(m => ({ default: m.MemoryProposalsPage })));

function admin(role: UserRole | 'manager_or_above', el: React.ReactNode) {
  return (
    <ProtectedRoute>
      <RoleGuard requiredRole={role}>
        <Suspense fallback={<RouteFallback />}>{el}</Suspense>
      </RoleGuard>
    </ProtectedRoute>
  );
}

/** Wrap a child page: role check + lazy-load boundary (the layout supplies the sidebar). */
function page(role: UserRole | 'manager_or_above', el: React.ReactNode) {
  return (
    <RoleGuard requiredRole={role}>
      <Suspense fallback={<RouteFallback />}>{el}</Suspense>
    </RoleGuard>
  );
}

// Owner console: every /admin/* page shares the sidebar layout. The new console pages are
// owner-only in the UI and enforced again inside each admin_* database function.
export const adminRoutes = [
  <Route
    key="admin"
    path="/admin"
    element={
      <ProtectedRoute>
        <RoleGuard requiredRole="manager_or_above">
          <Suspense fallback={<RouteFallback />}><AdminLayout /></Suspense>
        </RoleGuard>
      </ProtectedRoute>
    }
  >
    <Route index element={page('admin', <AdminHomePage />)} />
    <Route path="users" element={page('admin', <AdminUsersPage />)} />
    <Route path="moderation" element={page('admin', <AdminModerationPage />)} />
    <Route path="feedback" element={page('admin', <AdminFeedbackPage />)} />
    <Route path="bots" element={page('admin', <AdminBotsPage />)} />
    <Route path="promo-codes" element={page('admin', <AdminPromoCodesPage />)} />
    <Route path="settings" element={page('admin', <AdminSettingsPage />)} />
    <Route path="audit" element={page('admin', <AdminAuditPage />)} />
    <Route path="roles" element={page('admin', <UserManagementPage />)} />
    <Route path="analytics" element={page('manager_or_above', <AdminAnalyticsPage />)} />
    <Route path="monitoring" element={page('manager_or_above', <MonitoringDashboardPage />)} />
    <Route path="response-quality" element={page('manager_or_above', <ResponseQualityPage />)} />
    <Route path="memory-proposals" element={page('manager_or_above', <MemoryProposalsPage />)} />
  </Route>,
  <Route key="prompt-debugger" path="/prompt-debugger" element={admin('manager_or_above', <PromptDebuggerPage />)} />,
  <Route key="debug-subscription" path="/debug-subscription" element={admin('manager_or_above', <DebugSubscriptionPage />)} />,
  <Route key="debug-semantic" path="/debug-semantic" element={admin('manager_or_above', <SemanticMemoryDebugPage />)} />,
];
