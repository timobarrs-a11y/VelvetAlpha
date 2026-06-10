import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthSpinner } from './AuthSpinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSpinner />;

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return <>{children}</>;
}
