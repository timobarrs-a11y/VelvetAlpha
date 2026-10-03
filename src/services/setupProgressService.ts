import { supabase } from '../shared/supabase/client';

export type SetupStep =
  | 'atlas'
  | 'coach_avatar'
  | 'coach_environment'
  | 'coach_ready'
  | 'companion_in_progress'
  | 'choose_conversation'
  | 'complete';

export type SetupPath = 'coach_only' | 'coach_and_companion';

export interface SetupProgress {
  step: SetupStep | null;
  path: SetupPath | null;
}

export const SOMEONE_NEW_ROUTE = '/intent-select?people=1';

interface CompanionLite {
  id: string;
  relationship_type?: string | null;
  is_active?: boolean | null;
}

export async function getSetupProgress(userId: string): Promise<SetupProgress | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('setup_step, setup_path')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[setupProgress] load failed:', error);
    return null;
  }
  return {
    step: (data.setup_step as SetupStep | null) ?? null,
    path: (data.setup_path as SetupPath | null) ?? null,
  };
}

export async function updateSetupProgress(
  userId: string,
  patch: { step?: SetupStep; path?: SetupPath | null },
): Promise<void> {
  const update: Record<string, string | null> = {};
  if (patch.step !== undefined) update.setup_step = patch.step;
  if (patch.path !== undefined) update.setup_path = patch.path;

  const { error } = await supabase.from('user_profiles').update(update).eq('id', userId);
  if (error) console.error('[setupProgress] save failed:', error);
}

export async function advanceSetupStepIf(
  userId: string,
  fromSteps: SetupStep[],
  to: SetupStep,
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({ setup_step: to })
    .eq('id', userId)
    .in('setup_step', fromSteps);
  if (error) console.error('[setupProgress] advance failed:', error);
}

export function isCompanionSetupPending(progress: SetupProgress | null): boolean {
  return !!progress && progress.path === 'coach_and_companion' && progress.step !== 'complete';
}

export function isSetupUnfinished(progress: SetupProgress | null): boolean {
  return !!progress && progress.step !== null && progress.step !== 'complete' && progress.step !== 'atlas';
}

// Restores the session hints each setup screen reads; returns null when nothing to resume.
export function prepareResume(progress: SetupProgress | null, companions: CompanionLite[]): string | null {
  if (!progress || !isSetupUnfinished(progress)) return null;

  const coach = companions.find(c => c.relationship_type === 'mentor' && c.is_active !== false);
  const others = companions.filter(c => c.relationship_type !== 'mentor');

  if (coach) sessionStorage.setItem('atlasCoachId', coach.id);

  switch (progress.step) {
    case 'coach_avatar':
      if (!coach) return null;
      sessionStorage.setItem('atlasNextDestination', '/coach-ready');
      return '/coach-avatar';
    case 'coach_environment':
      if (!coach) return null;
      sessionStorage.removeItem('currentCompanionId');
      sessionStorage.setItem('envSetupNextRoute', '/coach-ready');
      sessionStorage.setItem('envSetupBackRoute', '/coach-avatar');
      return '/environment-setup';
    case 'coach_ready':
      return coach ? '/coach-ready' : null;
    case 'companion_in_progress': {
      const pending = sessionStorage.getItem('currentCompanionId');
      const created = others.find(c => c.id === pending) ?? others[0];
      if (created) {
        sessionStorage.setItem('currentCompanionId', created.id);
        return '/create-companion-avatar';
      }
      return SOMEONE_NEW_ROUTE;
    }
    case 'choose_conversation':
      return '/who-to-talk';
    default:
      return null;
  }
}
