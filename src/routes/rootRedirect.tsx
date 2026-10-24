import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getCompanions } from '../services/companionService';
import { AuthSpinner } from '../components/auth/AuthSpinner';
import { supabase } from '../shared/supabase/client';

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

      // Anyone with a companion lands in the lobby; the sidebar takes it from there.
      if (companions.length > 0) {
        sessionStorage.removeItem('currentCompanionId');
        sessionStorage.removeItem('matchAnswers');
        setDestination('/lobby');
        return;
      }

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
    }

    determineRoute();
  }, [user, loading]);

  if (loading || !destination) return <AuthSpinner />;

  return <Navigate to={destination} replace />;
}
