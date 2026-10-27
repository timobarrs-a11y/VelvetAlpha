import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { AuthSpinner } from '../components/auth/AuthSpinner';

export function RootRedirect() {
  const { user, loading } = useAuth();
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    async function determineRoute() {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const isRecovery = hashParams.get('type') === 'recovery' || hashParams.has('access_token');

      if (isRecovery) {
        setDestination(`/reset-password${hash}`);
        return;
      }

      if (!user) {
        setDestination('/splash');
        return;
      }

      // Signed-in members always land in the lobby. With no companion yet, the
      // lobby offers to create one; setup is never forced, and a slow or failed
      // lookup can't send an existing member back through it.
      setDestination('/lobby');
    }

    determineRoute();
  }, [user, loading]);

  if (loading || !destination) return <AuthSpinner />;

  return <Navigate to={destination} replace />;
}
