import { supabase } from '../shared/supabase/client';

export type CombatMode = 'tutorial' | 'single' | 'ascent';
export type CombatOutcome =
  | 'win'
  | 'loss'
  | 'abandoned'
  | 'ending_standoff'
  | 'ending_reconcile'
  | 'ending_dominate'
  | 'ending_expose'
  | 'ending_walk_away';

export interface CombatMemory {
  opponent_id: string;
  rapport: number;
  times_faced: number;
  times_defeated: number;
  endings_seen: string[];
}

export interface CombatRunInput {
  mode: CombatMode;
  scenarioId?: string | null;
  outcome: CombatOutcome;
  turns: number;
  maxCombo: number;
  score: number;
  notes?: Record<string, unknown>;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function recordRun(input: CombatRunInput): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('social_combat_runs')
    .insert({
      user_id: userId,
      mode: input.mode,
      scenario_id: input.scenarioId ?? null,
      outcome: input.outcome,
      turns: input.turns,
      max_combo: input.maxCombo,
      score: input.score,
      notes: input.notes ?? {},
    })
    .select('id')
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

export async function getMemory(opponentId: string): Promise<CombatMemory | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('social_combat_memory')
    .select('opponent_id, rapport, times_faced, times_defeated, endings_seen')
    .eq('user_id', userId)
    .eq('opponent_id', opponentId)
    .maybeSingle();
  return data;
}

export async function getAllMemory(): Promise<CombatMemory[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('social_combat_memory')
    .select('opponent_id, rapport, times_faced, times_defeated, endings_seen')
    .eq('user_id', userId);
  return data ?? [];
}

export interface MemoryUpdate {
  rapportDelta?: number;
  facedDelta?: number;
  defeatedDelta?: number;
  endingSeen?: string;
}

export async function updateMemory(opponentId: string, change: MemoryUpdate): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  const existing = await getMemory(opponentId);
  const next = {
    user_id: userId,
    opponent_id: opponentId,
    rapport: (existing?.rapport ?? 0) + (change.rapportDelta ?? 0),
    times_faced: (existing?.times_faced ?? 0) + (change.facedDelta ?? 0),
    times_defeated: (existing?.times_defeated ?? 0) + (change.defeatedDelta ?? 0),
    endings_seen: change.endingSeen && !(existing?.endings_seen ?? []).includes(change.endingSeen)
      ? [...(existing?.endings_seen ?? []), change.endingSeen]
      : existing?.endings_seen ?? [],
    last_seen_at: new Date().toISOString(),
  };
  await supabase
    .from('social_combat_memory')
    .upsert(next, { onConflict: 'user_id,opponent_id' });
}

export async function getUnlocks(): Promise<Set<string>> {
  const userId = await currentUserId();
  if (!userId) return new Set();
  const { data } = await supabase
    .from('social_combat_unlocks')
    .select('unlock_key')
    .eq('user_id', userId);
  return new Set((data ?? []).map(r => r.unlock_key));
}

export async function addUnlock(key: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await supabase
    .from('social_combat_unlocks')
    .insert({ user_id: userId, unlock_key: key })
    .select()
    .maybeSingle();
}
