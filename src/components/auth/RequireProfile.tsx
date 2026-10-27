import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../shared/supabase/client';
import { AuthSpinner } from './AuthSpinner';

/** Who the questionnaire is for: a profile with a name to call them, a birthday and a gender, or one marked done. */
export function isProfileComplete(p: { profile_completed?: boolean | null; nickname?: string | null; name?: string | null; birthday?: string | null; gender?: string | null } | null): boolean {
  if (!p) return false;
  if (p.profile_completed) return true;
  const named = !!(p.nickname?.trim() || (p.name && p.name !== 'babe' && p.name !== 'there'));
  return named && !!p.birthday && !!p.gender;
}

// Finishing is permanent, so once someone checks out they aren't looked up again this session.
const verified = new Set<string>();

type State = 'checking' | 'ok' | 'incomplete';

/**
 * Keeps people who haven't done the questionnaire out of the lobby and the rest of the app:
 * they go back to the questions, new sign-ups and existing members alike. A failed lookup lets
 * them through, so a hiccup can't lock anyone out.
 */
export function RequireProfile({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<State>(() => (userId && verified.has(userId) ? 'ok' : 'checking'));

  useEffect(() => {
    if (!userId) return;
    if (verified.has(userId)) { setState('ok'); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('profile_completed, nickname, name, birthday, gender')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setState('ok'); return; }
      if (isProfileComplete(data)) {
        verified.add(userId);
        setState('ok');
      } else {
        setState('incomplete');
      }
    })().catch(() => { if (!cancelled) setState('ok'); });
    return () => { cancelled = true; };
  }, [userId]);

  if (state === 'checking') return <AuthSpinner />;
  if (state === 'incomplete') return <Navigate to="/user-questionnaire" replace />;
  return <>{children}</>;
}
