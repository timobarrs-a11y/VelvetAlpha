import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getCompanions } from '../services/companionService';
import { getHomeLayout } from '../hooks/useHomeLayout';
import { AuthSpinner } from '../components/auth/AuthSpinner';
import { supabase } from '../shared/supabase/client';
import { getSetupProgress, prepareResume } from '../services/setupProgressService';

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
        setDestination('/welcome');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('welcome_seen, profile_completed, name, birthday, gender')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile === null) {
        await supabase.auth.signOut();
        setDestination('/welcome');
        return;
      }

      const companions = await getCompanions(user.id);

      const homeLayout = getHomeLayout();

      if (companions.length > 0) {
        const resumeRoute = prepareResume(await getSetupProgress(user.id), companions);
        if (resumeRoute) {
          setDestination(resumeRoute);
          return;
        }
      }

      if (companions.length === 0) {
        const currentCompanionId = sessionStorage.getItem('currentCompanionId');
        const matchAnswers = sessionStorage.getItem('matchAnswers');
        const expertMatchAnswers = sessionStorage.getItem('expertMatchAnswers');
        const onboardingIntent = sessionStorage.getItem('onboardingIntent');

        if (currentCompanionId && matchAnswers) {
          setDestination('/voice-selection');
          return;
        }

        if (onboardingIntent === 'coaches' && expertMatchAnswers) {
          setDestination('/voice-selection');
          return;
        }

        const profileComplete = !!(
          profile.profile_completed ||
          (profile.name && profile.name !== 'babe' && profile.name !== 'there' &&
           profile.birthday && profile.gender)
        );

        if (!profile?.welcome_seen) {
          setDestination('/welcome');
        } else if (!profileComplete) {
          setDestination('/user-questionnaire');
        } else {
          setDestination('/atlas-onboarding');
        }
      } else if (homeLayout === 'classic') {
        sessionStorage.removeItem('currentCompanionId');
        sessionStorage.removeItem('matchAnswers');
        setDestination('/lobby');
      } else if (companions.length === 1) {
        const pendingId = sessionStorage.getItem('currentCompanionId');
        const targetId = pendingId && companions[0].id === pendingId
          ? pendingId
          : companions[0].id;
        sessionStorage.removeItem('currentCompanionId');
        sessionStorage.removeItem('matchAnswers');
        setDestination(`/chat?companion=${targetId}`);
      } else {
        sessionStorage.removeItem('currentCompanionId');
        sessionStorage.removeItem('matchAnswers');
        const lastId = localStorage.getItem('velvet_last_companion');
        const lastCompanion = lastId ? companions.find(c => c.id === lastId) : null;
        // No remembered companion (new device, cleared site data): land on
        // home, where the sidebar lists everyone, rather than forcing a pick.
        setDestination(lastCompanion ? `/chat?companion=${lastCompanion.id}` : '/lobby');
      }
    }

    determineRoute();
  }, [user, loading]);

  if (loading || !destination) return <AuthSpinner />;

  return <Navigate to={destination!} replace />;
}
