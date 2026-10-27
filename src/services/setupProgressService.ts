import { supabase } from '../shared/supabase/client';
import { isHelper } from '../utils/relationshipType';

export type SetupStep =
  | 'atlas'
  | 'coach_avatar'
  | 'coach_environment'
  | 'coach_ready'
  | 'companion_in_progress'
  | 'choose_conversation'
  | 'complete'
  // The arrival (docs/onboarding/questionnaire-plan.md): the goal with Atlas, your look, your home,
  // Atlas back with the plan, then the town.
  | 'arrival_goal'
  | 'arrival_look'
  | 'arrival_home'
  | 'arrival_town'
  | 'arrival_atlas';

export type SetupPath = 'coach_only' | 'coach_and_companion';

export interface SetupProgress {
  step: SetupStep | null;
  path: SetupPath | null;
}

/** The first session's steps, in order. Someone at one of these has not finished arriving. */
export const ARRIVAL_STEPS: SetupStep[] = ['arrival_goal', 'arrival_look', 'arrival_home', 'arrival_atlas', 'arrival_town'];

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

export function isCompanionSetupPending(progress: SetupProgress | null, companions: CompanionLite[] = []): boolean {
  if (!progress || progress.path !== 'coach_and_companion' || progress.step === 'complete') return false;
  const nonMentorCompanions = companions.filter(c => !isHelper(c.relationship_type) && c.is_active !== false);
  if (nonMentorCompanions.length > 0) return false;
  return true;
}

export function isSetupUnfinished(progress: SetupProgress | null, companions: CompanionLite[] = []): boolean {
  if (!progress || progress.step === null || progress.step === 'complete' || progress.step === 'atlas') return false;
  const nonMentorCompanions = companions.filter(c => !isHelper(c.relationship_type) && c.is_active !== false);
  if (nonMentorCompanions.length > 0 && (progress.step === 'companion_in_progress' || progress.step === 'choose_conversation')) return false;
  return true;
}

// Restores the session hints each setup screen reads; returns null when nothing to resume.
export function prepareResume(progress: SetupProgress | null, companions: CompanionLite[]): string | null {
  if (!progress || !isSetupUnfinished(progress, companions)) return null;

  const coach = companions.find(c => c.relationship_type === 'mentor' && c.is_active !== false);
  const others = companions.filter(c => !isHelper(c.relationship_type));

  if (coach) sessionStorage.setItem('atlasCoachId', coach.id);

  switch (progress.step) {
    case 'arrival_goal':
      return '/atlas-onboarding';
    case 'arrival_look':
      return '/arrival/look';
    case 'arrival_home':
      return '/arrival/home';
    case 'arrival_town':
      return '/world?arrival=1';
    case 'arrival_atlas':
      return '/atlas-onboarding';
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
