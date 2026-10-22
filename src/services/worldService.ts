import { supabase } from '../shared/supabase/client';
import { townSlot, type Plot, type PlotConfig } from '../features/velvet-world/art/streetArt.js';

export interface WorldCard {
  user_id: string; slot_index: number; house: PlotConfig['house']; sign: PlotConfig['sign']; yard: Omit<PlotConfig, 'house' | 'sign'>;
  is_member: boolean; earned: string[]; is_public: boolean; display_name: string; headline: string | null;
  goal_label: string | null; goal_pct: number | null; medals: string[]; medal_count: number; spaces: string[]; new_neighbor: boolean;
}
export interface MyPlot {
  slot_index: number; house: PlotConfig['house']; sign: PlotConfig['sign']; yard: Omit<PlotConfig, 'house' | 'sign'>;
  main_companion_id: string | null; moved_in_at: string; is_member: boolean; earned: string[];
}

/** The user's local calendar date as YYYY-MM-DD. The daily block changes at their midnight. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getMyPlot(): Promise<MyPlot | null> {
  const { data, error } = await supabase.rpc('get_my_world_plot');
  if (error) throw new Error(`Failed to load your plot: ${error.message}`);
  return (data as MyPlot[] | null)?.[0] ?? null;
}

export async function claimPlot(house: PlotConfig['house']): Promise<number> {
  const { data, error } = await supabase.rpc('claim_world_plot', { p_house: house });
  if (error) throw new Error(`Failed to move in: ${error.message}`);
  return data as number;
}

/** Saves the whole look. `config` is a kit PlotConfig; house goes in its own column, the rest is sign + yard. */
export async function savePlot(config: PlotConfig): Promise<void> {
  const { house, sign, ...yard } = config;
  const { error } = await supabase.rpc('save_world_plot', { p_house: house, p_sign: sign ?? {}, p_yard: yard });
  if (error) throw new Error(error.message);
}

export async function setMainCompanion(companionId: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('world_plots').update({ main_companion_id: companionId }).eq('user_id', user.id);
  if (error) throw new Error(error.message);
}

/** Rows come back in any order; match them by user_id. */
export async function getCards(userIds: string[]): Promise<WorldCard[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc('world_cards', { p_user_ids: userIds });
  if (error) throw new Error(`Failed to load neighbors: ${error.message}`);
  return (data ?? []) as WorldCard[];
}

/** Today's candidates in order (16 by default). The page picks 8 of them; see pickBlock. */
export async function getDailyBlock(day = localDay(), count = 16): Promise<{ user_id: string; shares_space: boolean; ord: number }[]> {
  const { data, error } = await supabase.rpc('get_daily_block', { p_day: day, p_count: count });
  if (error) throw new Error(`Failed to load today's block: ${error.message}`);
  return data ?? [];
}

export async function markSeen(day: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase.rpc('mark_block_seen', { p_day: day, p_ids: userIds });
  if (error) console.warn('mark_block_seen failed', error.message);
}

/** A database card → the plot object the art kit draws. */
export function cardToPlot(c: WorldCard): Plot {
  const slot = townSlot(c.slot_index);
  return {
    id: c.user_id,
    number: (slot.col + 1) * 2,
    member: c.is_member,
    origin: null,
    config: { house: c.house ?? {}, sign: c.sign ?? {}, ...(c.yard ?? {}) },
    profile: {
      name: c.display_name,
      headline: c.headline,
      goal: c.goal_label ? { label: c.goal_label, pct: c.goal_pct ?? 0 } : null,
      medals: c.medals,
      earned: c.earned,
      medalCount: c.medal_count,
      spaces: c.spaces,
      newNeighbor: c.new_neighbor,
      address: slot.address,
    },
  };
}
