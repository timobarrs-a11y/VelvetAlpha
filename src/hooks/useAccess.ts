import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../shared/supabase/client';
import { checkAccess, AccessState } from '../services/accessService';

export function useAccess() {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const state = await checkAccess();
    setAccess(state);
    setLoading(false);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      await refresh();

      channel = supabase
        .channel('access-changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
          () => { refresh(); }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [refresh]);

  return {
    access,
    loading,
    refresh,
    // Convenience flags
    welcomeWindowActive: access?.welcome_window_active ?? false,
    trialActive: access?.trial_active ?? false,
    isPaid: access?.is_paid ?? false,
    ageVerified: access?.age_verified ?? false,
    canAccessSocial: access?.can_access_social ?? false,
    isBot: access?.is_bot ?? false,
    tier: access?.tier ?? 'free',
    // The lock screen should show when: age verified, no welcome window, no trial, not paid
    showLockScreen: !loading && !!access && access.age_verified && !access.welcome_window_active && !access.trial_active && !access.is_paid,
  };
}
