import { supabase } from '../../shared/supabase/client';
import type { RPGSave, IslandProgress, DungeonRunResult } from './rpgTypes';

const DEFAULT_SAVE: RPGSave = {
  rupeeWallet: 0,
  maxHealth: 6,
  currentHealth: 6,
  hasSword: false,
  hasShield: false,
  hasHookshot: false,
  hasBow: false,
  discoveredIslands: [],
  totalEnemiesDefeated: 0,
  totalDungeonsCleared: 0,
};

export async function loadRPGSave(userId: string): Promise<RPGSave> {
  const { data } = await supabase
    .from('zelda_rpg_saves')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return { ...DEFAULT_SAVE };

  return {
    rupeeWallet: data.rupee_wallet,
    maxHealth: data.max_health,
    currentHealth: data.current_health,
    hasSword: data.has_sword,
    hasShield: data.has_shield,
    hasHookshot: data.has_hookshot,
    hasBow: data.has_bow,
    discoveredIslands: data.discovered_islands ?? [],
    totalEnemiesDefeated: data.total_enemies_defeated,
    totalDungeonsCleared: data.total_dungeons_cleared,
  };
}

export async function saveRPGSave(userId: string, save: RPGSave): Promise<void> {
  await supabase.from('zelda_rpg_saves').upsert({
    user_id: userId,
    rupee_wallet: save.rupeeWallet,
    max_health: save.maxHealth,
    current_health: save.currentHealth,
    has_sword: save.hasSword,
    has_shield: save.hasShield,
    has_hookshot: save.hasHookshot,
    has_bow: save.hasBow,
    discovered_islands: save.discoveredIslands,
    total_enemies_defeated: save.totalEnemiesDefeated,
    total_dungeons_cleared: save.totalDungeonsCleared,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function loadIslandProgress(userId: string): Promise<IslandProgress[]> {
  const { data } = await supabase
    .from('zelda_island_progress')
    .select('*')
    .eq('user_id', userId);

  return (data ?? []).map(r => ({
    islandId: r.island_id,
    dungeonCleared: r.dungeon_cleared,
    chestsOpened: r.chests_opened ?? [],
    npcsMet: r.npcs_met ?? [],
    dungeonAttempts: r.dungeon_attempts,
    firstVisitedAt: r.first_visited_at,
    clearedAt: r.cleared_at,
  }));
}

export async function upsertIslandProgress(userId: string, progress: IslandProgress): Promise<void> {
  await supabase.from('zelda_island_progress').upsert({
    user_id: userId,
    island_id: progress.islandId,
    dungeon_cleared: progress.dungeonCleared,
    chests_opened: progress.chestsOpened,
    npcs_met: progress.npcsMet,
    dungeon_attempts: progress.dungeonAttempts,
    first_visited_at: progress.firstVisitedAt ?? new Date().toISOString(),
    cleared_at: progress.clearedAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,island_id' });
}

export async function recordDungeonRun(userId: string, islandId: string, result: DungeonRunResult): Promise<void> {
  await supabase.from('zelda_dungeon_runs').insert({
    user_id: userId,
    island_id: islandId,
    completed: result.completed,
    enemies_defeated: result.enemiesDefeated,
    chests_opened: result.chestsOpened,
    damage_taken: result.damageTaken,
    time_seconds: result.timeSeconds,
    rupees_found: result.rupeesFound,
    item_found: result.itemFound ?? null,
  });
}

export async function upsertQuestProgress(userId: string, questId: string, progress: number, completed: boolean): Promise<void> {
  await supabase.from('zelda_quest_log').upsert({
    user_id: userId,
    quest_id: questId,
    status: completed ? 'completed' : 'active',
    progress,
    completed_at: completed ? new Date().toISOString() : null,
  }, { onConflict: 'user_id,quest_id' });
}

export async function loadQuestLog(userId: string): Promise<Record<string, { progress: number; status: string }>> {
  const { data } = await supabase
    .from('zelda_quest_log')
    .select('quest_id, progress, status')
    .eq('user_id', userId);

  const result: Record<string, { progress: number; status: string }> = {};
  for (const row of data ?? []) {
    result[row.quest_id] = { progress: row.progress, status: row.status };
  }
  return result;
}
