import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';
import { getCompanions } from '../services/companionService';
import { AuthSpinner } from '../components/auth/AuthSpinner';

export function OnboardingTourPage() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login', { replace: true }); return; }

      const sessionCid = sessionStorage.getItem('currentCompanionId');
      if (sessionCid) {
        navigate(`/chat?companion=${sessionCid}&tour=1`, { replace: true });
        return;
      }

      // A brand-new companion can briefly be unreadable right after creation
      // (replication lag). Retry a few times before falling back to the lobby.
      let primary;
      for (let attempt = 0; attempt < 4 && !primary; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 600));
        const companions = await getCompanions(user.id);
        primary = companions[0];
      }
      if (primary) {
        navigate(`/chat?companion=${primary.id}&tour=1`, { replace: true });
      } else {
        navigate('/lobby', { replace: true });
      }
    })().catch(() => navigate('/lobby', { replace: true }));
  }, [navigate]);

  return <AuthSpinner />;
}
