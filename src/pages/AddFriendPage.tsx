import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AuthSpinner } from '../components/auth/AuthSpinner';
import { PENDING_FRIEND_CODE_KEY } from '../components/dock/DockContext';

/**
 * /add/<code>: a shareable link that adds the code's owner. The code waits in
 * session storage through sign-in (or sign-up), then the dock opens Messages
 * with it.
 */
export default function AddFriendPage() {
  const { code } = useParams();
  const { user, loading } = useAuth();
  const digits = (code ?? '').replace(/\D/g, '');

  useEffect(() => {
    if (digits.length === 8) {
      try { sessionStorage.setItem(PENDING_FRIEND_CODE_KEY, digits); } catch { /* storage blocked */ }
    }
  }, [digits]);

  if (loading) return <AuthSpinner />;
  return <Navigate to={user ? '/lobby' : '/login'} replace />;
}
