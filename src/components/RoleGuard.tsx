import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { UserRole } from '../services/roleService';
import { ShieldOff } from 'lucide-react';

interface RoleGuardProps {
  children: ReactNode;
  requiredRole: UserRole | 'manager_or_above';
  fallbackPath?: string;
}

export function RoleGuard({ children, requiredRole, fallbackPath }: RoleGuardProps) {
  const { role, loading, isAdmin, isManagerOrAbove } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4" />
          <p className="text-white/60 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  let hasAccess = false;

  if (requiredRole === 'admin') {
    hasAccess = isAdmin;
  } else if (requiredRole === 'manager_or_above' || requiredRole === 'manager') {
    hasAccess = isManagerOrAbove;
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <ShieldOff className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
          <p className="text-white/60 mb-6">
            You don't have permission to view this page.
            Contact an administrator if you believe this is an error.
          </p>
          <a
            href="/lobby"
            className="inline-block px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium transition-colors"
          >
            Return to Lobby
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
