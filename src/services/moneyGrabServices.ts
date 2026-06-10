import { supabase } from '../shared/supabase/client';

export type PowerUpType = 'invincibility' | 'speed' | 'magnet' | 'shield' | 'double' | 'freeze' | 'ghost';

export interface PowerUp {
  type: PowerUpType;
  duration: number;
  color: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic';
  points: number;
}

export const POWER_UPS: Record<PowerUpType, PowerUp> = {
  invincibility: {
    type: 'invincibility',
    duration: 10000,
    color: '#fbbf24',
    icon: '🔨',
    rarity: 'common',
    points: 500
  },
  speed: {
    type: 'speed',
    duration: 8000,
    color: '#3b82f6',
    icon: '⚡',
    rarity: 'common',
    points: 300
  },
  magnet: {
    type: 'magnet',
    duration: 10000,
    color: '#ec4899',
    icon: '🧲',
    rarity: 'rare',
    points: 400
  },
  shield: {
    type: 'shield',
    duration: 15000,
    color: '#8b5cf6',
    icon: '🛡️',
    rarity: 'rare',
    points: 600
  },
  double: {
    type: 'double',
    duration: 12000,
    color: '#10b981',
    icon: '💎',
    rarity: 'epic',
    points: 700
  },
  freeze: {
    type: 'freeze',
    duration: 5000,
    color: '#06b6d4',
    icon: '❄️',
    rarity: 'epic',
    points: 800
  },
  ghost: {
    type: 'ghost',
    duration: 6000,
    color: '#a855f7',
    icon: '👻',
    rarity: 'epic',
    points: 900
  }
};

export function getRandomPowerUpType(): PowerUpType {
  const roll = Math.random();

  if (roll < 0.5) {
    const common: PowerUpType[] = ['invincibility', 'speed'];
    return common[Math.floor(Math.random() * common.length)];
  } else if (roll < 0.85) {
    const rare: PowerUpType[] = ['magnet', 'shield'];
    return rare[Math.floor(Math.random() * rare.length)];
  } else {
    const epic: PowerUpType[] = ['double', 'freeze', 'ghost'];
    return epic[Math.floor(Math.random() * epic.length)];
  }
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: number;
  category: 'score' | 'level' | 'combo' | 'enemy' | 'speed' | 'collection';
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', title: 'First Blood', description: 'Defeat your first enemy', icon: '🔨', requirement: 1, category: 'enemy' },
  { id: 'hammer_master', title: 'Hammer Master', description: 'Defeat 10 enemies in one game', icon: '⚔️', requirement: 10, category: 'enemy' },
  { id: 'speed_demon', title: 'Speed Demon', description: 'Complete a level in under 30 seconds', icon: '⚡', requirement: 30, category: 'speed' },
  { id: 'collector', title: 'Perfect Collector', description: 'Collect all money in a level', icon: '💰', requirement: 1, category: 'collection' },
  { id: 'combo_king', title: 'Combo King', description: 'Achieve a 10x combo', icon: '🔥', requirement: 10, category: 'combo' },
  { id: 'millionaire', title: 'Millionaire', description: 'Earn $10,000 in one game', icon: '💎', requirement: 10000, category: 'score' },
  { id: 'survivor', title: 'Survivor', description: 'Reach level 10', icon: '🏆', requirement: 10, category: 'level' },
  { id: 'unstoppable', title: 'Unstoppable', description: 'Reach level 20', icon: '👑', requirement: 20, category: 'level' },
  { id: 'money_magnet', title: 'Money Magnet', description: 'Collect 1,000 bills total', icon: '🧲', requirement: 1000, category: 'collection' },
  { id: 'power_hungry', title: 'Power Hungry', description: 'Use 50 power-ups', icon: '✨', requirement: 50, category: 'collection' }
];

export async function saveGameScore(data: {
  companionId?: string;
  totalScore: number;
  playerScore: number;
  aiScore: number;
  highestLevel: number;
  durationSeconds: number;
  moneyCollected: number;
  powerUpsUsed: number;
  enemiesDefeated: number;
  maxCombo: number;
  fastestLevelTime?: number;
  playerWins: number;
  aiWins: number;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: score, error } = await supabase
      .from('money_grab_scores')
      .insert({
        user_id: user.id,
        companion_id: data.companionId || null,
        total_score: data.totalScore,
        player_score: data.playerScore,
        ai_score: data.aiScore,
        highest_level: data.highestLevel,
        duration_seconds: data.durationSeconds,
        money_collected: data.moneyCollected,
        power_ups_used: data.powerUpsUsed,
        enemies_defeated: data.enemiesDefeated,
        max_combo: data.maxCombo,
        fastest_level_time: data.fastestLevelTime || null,
        player_wins: data.playerWins,
        ai_wins: data.aiWins
      })
      .select()
      .single();

    if (error) throw error;
    return score;
  } catch (error) {
    console.error('Failed to save game score:', error);
    return null;
  }
}

export async function getLeaderboard(limit: number = 10, timeframe: 'all' | 'week' | 'today' = 'all') {
  try {
    let query = supabase
      .from('money_grab_scores')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(limit);

    if (timeframe === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query = query.gte('created_at', weekAgo.toISOString());
    } else if (timeframe === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query = query.gte('created_at', today.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
}

export async function getPlayerStats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('money_grab_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch player stats:', error);
    return null;
  }
}

export async function updateAchievementProgress(achievementId: string, progress: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return null;

    const completed = progress >= achievement.requirement;

    const { data, error } = await supabase
      .from('money_grab_achievements')
      .upsert({
        user_id: user.id,
        achievement_id: achievementId,
        progress,
        completed,
        unlocked_at: completed ? new Date().toISOString() : null
      }, {
        onConflict: 'user_id,achievement_id'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to update achievement:', error);
    return null;
  }
}

export async function getPlayerAchievements() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('money_grab_achievements')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch achievements:', error);
    return [];
  }
}

export async function checkAndUnlockAchievements(gameData: {
  score: number;
  level: number;
  combo: number;
  enemiesDefeated: number;
  levelTime?: number;
  collectedAll: boolean;
}) {
  const newUnlocks: Achievement[] = [];

  if (gameData.enemiesDefeated >= 1) {
    const result = await updateAchievementProgress('first_blood', gameData.enemiesDefeated);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'first_blood')!);
  }

  if (gameData.enemiesDefeated >= 10) {
    const result = await updateAchievementProgress('hammer_master', gameData.enemiesDefeated);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'hammer_master')!);
  }

  if (gameData.levelTime && gameData.levelTime < 30) {
    const result = await updateAchievementProgress('speed_demon', 1);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'speed_demon')!);
  }

  if (gameData.collectedAll) {
    const result = await updateAchievementProgress('collector', 1);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'collector')!);
  }

  if (gameData.combo >= 10) {
    const result = await updateAchievementProgress('combo_king', gameData.combo);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'combo_king')!);
  }

  if (gameData.score >= 10000) {
    const result = await updateAchievementProgress('millionaire', gameData.score);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'millionaire')!);
  }

  if (gameData.level >= 10) {
    const result = await updateAchievementProgress('survivor', gameData.level);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'survivor')!);
  }

  if (gameData.level >= 20) {
    const result = await updateAchievementProgress('unstoppable', gameData.level);
    if (result?.completed) newUnlocks.push(ACHIEVEMENTS.find(a => a.id === 'unstoppable')!);
  }

  return newUnlocks;
}
