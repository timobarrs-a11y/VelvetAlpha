import { supabase } from '../shared/supabase/client';
import { townSlot, type Plot, type PlotConfig, type HouseStyle } from '../features/velvet-world/art/streetArt.js';

export interface WorldCard {
  user_id: string; slot_index: number; house: PlotConfig['house']; sign: PlotConfig['sign']; yard: Omit<PlotConfig, 'house' | 'sign'>;
  is_member: boolean; earned: string[]; is_public: boolean; display_name: string; headline: string | null;
  goal_label: string | null; goal_pct: number | null; medals: string[]; medal_count: number; spaces: string[]; new_neighbor: boolean;
}
export interface MyPlot {
  slot_index: number; house: PlotConfig['house']; sign: PlotConfig['sign']; yard: Omit<PlotConfig, 'house' | 'sign'>;
  main_companion_id: string | null; moved_in_at: string; is_member: boolean; earned: string[];
}

export interface TownPlot { user_id: string; slot_index: number; style: string | null; body: string | null; roof: string | null; door: string | null; sign_color: string | null; is_member: boolean; earned: string[] }

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

/** What this person can live in right now. Works before they have a plot. */
export async function getUnlocks(): Promise<{ is_member: boolean; earned: string[] }> {
  const { data, error } = await supabase.rpc('get_world_unlocks');
  if (error) throw new Error(error.message);
  return (data as { is_member: boolean; earned: string[] }[] | null)?.[0] ?? { is_member: false, earned: [] };
}

export interface WorldWelcome { has_plot: boolean; needs_welcome: boolean; slot_index: number | null; house: PlotConfig['house'] | null }

/** Should this person see the welcome popup? Falls back to "no plot yet" before migration 6c is applied. */
export async function getWelcome(): Promise<WorldWelcome | null> {
  const { data, error } = await supabase.rpc('get_world_welcome');
  if (error) {
    const plot = await getMyPlot();
    return plot ? { has_plot: true, needs_welcome: false, slot_index: plot.slot_index, house: plot.house } : { has_plot: false, needs_welcome: true, slot_index: null, house: null };
  }
  return (data as WorldWelcome[] | null)?.[0] ?? null;
}

export async function markWelcomed(): Promise<void> {
  await supabase.rpc('mark_world_welcomed');
}

/** Change just the house (style and colors), keeping the billboard and yard as they are. */
export async function saveHouse(house: PlotConfig['house']): Promise<void> {
  const { error } = await supabase.rpc('save_world_plot', { p_house: house, p_sign: null, p_yard: null });
  if (error) throw new Error(error.message);
}

/** Move in with a random starter house, for people who skip the picker. Safe to call twice. */
export async function claimDefaultPlot(): Promise<number> {
  const starters = ['standard', 'cottage', 'bungalow', 'ranch', 'cabin'];
  return claimPlot({ style: starters[Math.floor(Math.random() * starters.length)] as HouseStyle });
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

/** The rest of the billboard card. Everything past the visitor counts is only there for a public profile (or your own). */
export interface CardDetails {
  visitors: number;
  visitors_week: number;
  avatar_config?: Record<string, unknown> | null;
  bio?: string | null;
  moved_in_at?: string;
  friends?: number;
  mutual_friends?: number;
  streak?: number;
  goals_done?: number;
  commitments_kept?: number;
  goals?: { label: string; pct: number | null; done: boolean }[];
  shared_spaces?: string[];
}

export async function getCardDetails(userId: string): Promise<CardDetails | null> {
  const { data, error } = await supabase.rpc('world_card_details', { p_user_id: userId });
  if (error) throw new Error(`Failed to load billboard: ${error.message}`);
  return (data as CardDetails | null) ?? null;
}

/** Opening someone's billboard counts as a visit (once per person). Returns their visitor count. */
export async function recordVisit(hostId: string): Promise<number> {
  const { data, error } = await supabase.rpc('record_world_visit', { p_host: hostId });
  if (error) throw new Error(`Failed to record visit: ${error.message}`);
  return (data as number) ?? 0;
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

export async function getTownSize(): Promise<number> {
  const { data, error } = await supabase.rpc('get_town_size');
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Plot summaries for slot_index in [from, to). The server caps one call at 5,000. */
export async function getTownPlots(from: number, to: number): Promise<TownPlot[]> {
  const { data, error } = await supabase.rpc('get_town_plots', { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as TownPlot[];
}

export async function findPlot(query: string): Promise<{ user_id: string; slot_index: number; display_name: string }[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('find_world_plot', { p_query: query });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLandmarkProgress(): Promise<number> {
  const { data } = await supabase.rpc('get_landmark_progress');
  return (data as number) ?? 0;
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

/** A town summary → a kit plot placed at its permanent lot. Enough for drawPlotLowDetail. */
export function townToPlot(t: TownPlot): Plot {
  const slot = townSlot(t.slot_index);
  return {
    id: t.user_id, number: (slot.col + 1) * 2, member: t.is_member, origin: { x: slot.x, y: slot.y },
    config: { house: { style: (t.style ?? 'standard') as HouseStyle, ...(t.body && { body: t.body }), ...(t.roof && { roof: t.roof }), ...(t.door && { door: t.door }) }, sign: t.sign_color ? { color: t.sign_color } : {} },
    profile: { name: '', earned: t.earned, address: slot.address },
  };
}
