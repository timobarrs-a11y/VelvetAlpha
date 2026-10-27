import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ARRIVAL_STEPS, prepareResume, type SetupStep } from '../../services/setupProgressService';
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

type State = { kind: 'checking' } | { kind: 'ok' } | { kind: 'go'; to: string };

const BASE_PATH = (to: string) => to.split('?')[0];

/**
 * Keeps people who haven't finished arriving out of the lobby and the rest of the app: no
 * questionnaire sends them back to the questions, and a first session left half-way sends them
 * to the step they were on (the goal with Atlas, their avatar, their house, the plan, the look
 * around town). Members from before the arrival existed have no step and are left alone. A failed
 * lookup lets them through, so a hiccup can't lock anyone out.
 */
export function RequireProfile({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { pathname } = useLocation();
  const [state, setState] = useState<State>(() => (userId && verified.has(userId) ? { kind: 'ok' } : { kind: 'checking' }));

  useEffect(() => {
    if (!userId) return;
    if (verified.has(userId)) { setState({ kind: 'ok' }); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('profile_completed, nickname, name, birthday, gender, setup_step, age_verified_at')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) { setState({ kind: 'ok' }); return; }
      if (!isProfileComplete(data)) { setState({ kind: 'go', to: '/user-questionnaire' }); return; }
      // Members from before age checks confirm their birthday (it comes with the questions) before going on.
      if (!data?.age_verified_at) { setState({ kind: 'go', to: '/user-questionnaire' }); return; }
      const step = (data?.setup_step ?? null) as SetupStep | null;
      if (step && ARRIVAL_STEPS.includes(step)) {
        const to = prepareResume({ step, path: null }, []);
        // Where they already are is fine (the look around town is part of the app's own routes).
        if (to && BASE_PATH(to) !== pathname) { setState({ kind: 'go', to }); return; }
        setState({ kind: 'ok' });
        return;
      }
      verified.add(userId);
      setState({ kind: 'ok' });
    })().catch(() => { if (!cancelled) setState({ kind: 'ok' }); });
    return () => { cancelled = true; };
  }, [userId, pathname]);

  if (state.kind === 'checking') return <AuthSpinner />;
  if (state.kind === 'go') return <Navigate to={state.to} replace />;
  return <>{children}</>;
}
