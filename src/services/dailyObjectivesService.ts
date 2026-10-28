import { supabase } from '../shared/supabase/client';

export type ObjectiveKey =
  | 'visit_town' | 'comment_in_space' | 'create_companion' | 'play_velvet_sims' | 'read_feed'
  | 'open_mailbox' | 'visit_neighbor' | 'edit_profile' | 'check_leaderboard' | 'view_medals'
  | 'browse_spaces' | 'join_a_space' | 'react_in_space' | 'post_in_space' | 'discover_people' | 'cheer_a_win' | 'comment_on_wins'
  | 'add_friend' | 'message_friend'
  | 'chat_with_helper' | 'ask_atlas' | 'explore_navi' | 'use_co_author'
  | 'set_a_goal' | 'make_commitment' | 'complete_step' | 'view_progress' | 'coaching_library' | 'check_insights'
  | 'view_calendar' | 'add_to_calendar' | 'morning_journal' | 'watch_videos'
  | 'play_game' | 'play_shootout' | 'play_checkers' | 'play_momentum' | 'play_slime_soccer' | 'play_stellar'
  | 'play_social_combat' | 'play_pacman' | 'real_or_not' | 'memory_training'
  | 'change_background' | 'see_whats_new';

/** The ones the app reports because a visit leaves no other record. */
export type ReportedKey =
  | 'visit_town' | 'play_velvet_sims' | 'read_feed' | 'open_mailbox' | 'visit_neighbor' | 'edit_profile'
  | 'check_leaderboard' | 'view_medals' | 'browse_spaces' | 'discover_people' | 'use_co_author' | 'view_progress'
  | 'coaching_library' | 'check_insights' | 'view_calendar' | 'watch_videos' | 'play_game' | 'play_shootout'
  | 'play_checkers' | 'play_momentum' | 'play_slime_soccer' | 'play_stellar' | 'play_social_combat' | 'play_pacman'
  | 'real_or_not' | 'memory_training' | 'change_background' | 'see_whats_new';

export interface ObjectiveDef {
  /** What to do, short. */
  label: string;
  /** A little more, shown under it. */
  hint: string;
  /** Where the objective takes you. */
  to: string;
}

/** Every objective's words and where it leads. The server decides which are offered and how many it takes. */
export const OBJECTIVE_DEFS: Record<ObjectiveKey, ObjectiveDef> = {
  // The core five
  visit_town: { label: 'Visit the Town', hint: 'Take a stroll down your street', to: '/world' },
  comment_in_space: { label: 'Leave a comment in a Space', hint: 'Chat in a room, or comment on a post', to: '/spaces' },
  create_companion: { label: 'Create a companion', hint: 'Someone to talk to between goals', to: '/intent-select?people=1' },
  play_velvet_sims: { label: 'Play Velvet Sims', hint: 'Step into your cozy mystery', to: '/velvet-house' },
  read_feed: { label: 'Check out your Daily Feed', hint: 'News and videos picked for you', to: '/daily-feed' },
  // Town, mail, profile
  open_mailbox: { label: 'Check your mailbox', hint: 'Tap the mailbox on your house', to: '/world' },
  visit_neighbor: { label: 'Visit a neighbor', hint: 'Open someone\'s profile', to: '/discover' },
  edit_profile: { label: 'Polish your profile', hint: 'Tell people a little about you', to: '/my-profile/edit' },
  check_leaderboard: { label: 'See where you stand', hint: 'Check the leaderboard', to: '/leaderboard' },
  view_medals: { label: 'Admire your medals', hint: 'See what you have and what\'s next', to: '/medals' },
  // Spaces and Discover
  browse_spaces: { label: 'Browse the Spaces', hint: 'See what people are talking about', to: '/spaces' },
  join_a_space: { label: 'Join a new Space', hint: 'Find one that suits you', to: '/spaces/browse' },
  react_in_space: { label: 'React to posts in Spaces', hint: 'Show some love', to: '/spaces' },
  post_in_space: { label: 'Start a conversation', hint: 'Make a post in a Space', to: '/spaces' },
  discover_people: { label: 'Meet someone new', hint: 'Look around Discover', to: '/discover' },
  cheer_a_win: { label: 'Cheer on wins', hint: 'React to neighbors\' wins in Discover', to: '/discover' },
  comment_on_wins: { label: 'Encourage your neighbors', hint: 'Comment on their progress and statuses', to: '/discover' },
  // Friends
  add_friend: { label: 'Add a friend', hint: 'Send a friend request', to: '/discover' },
  message_friend: { label: 'Chat with your friends', hint: 'Send a few messages', to: '/lobby' },
  // Coaches, companions, Atlas, Navi
  chat_with_helper: { label: 'Talk it over', hint: 'Chat with your coach or a companion', to: '/lobby' },
  ask_atlas: { label: 'Ask Atlas something', hint: 'Anything at all', to: '/atlas' },
  explore_navi: { label: 'Find something to do', hint: 'Ask Navi about your area', to: '/navi' },
  use_co_author: { label: 'Write with Co-Author', hint: 'Start or continue a piece', to: '/co-author' },
  // Goals and plans
  set_a_goal: { label: 'Set a new goal', hint: 'Something you want to work toward', to: '/coaching-progress' },
  make_commitment: { label: 'Make a commitment', hint: 'Promise yourself one small step', to: '/coaching-commitments' },
  complete_step: { label: 'Finish a step of your plan', hint: 'Tick one off', to: '/coaching-commitments' },
  view_progress: { label: 'Check your progress', hint: 'See how far you\'ve come', to: '/coaching-progress' },
  coaching_library: { label: 'Browse the coaching library', hint: 'Lessons and guides', to: '/coaching-library' },
  check_insights: { label: 'Look at your Insights', hint: 'Streaks and patterns', to: '/insights' },
  // Calendar, journal, videos
  view_calendar: { label: 'Look at your Calendar', hint: 'See what\'s coming up', to: '/calendar' },
  add_to_calendar: { label: 'Put something on your Calendar', hint: 'An event or a reminder', to: '/calendar' },
  morning_journal: { label: 'Write in your Morning Journal', hint: 'Start the day with intention', to: '/morning-journal' },
  watch_videos: { label: 'Watch something', hint: 'Open your video history', to: '/videos' },
  // Games
  play_game: { label: 'Play a game', hint: 'Any game counts', to: '/lobby' },
  play_shootout: { label: 'Take some 3-pointers', hint: 'Play 3-Point Shootout', to: '/shootout' },
  play_checkers: { label: 'Play Checkers', hint: 'Take on an AI opponent', to: '/checkers' },
  play_momentum: { label: 'Run Momentum', hint: 'Try a new world', to: '/momentum' },
  play_slime_soccer: { label: 'Play Slime Soccer', hint: 'Score a goal', to: '/slime-soccer' },
  play_stellar: { label: 'Fly Stellar Pursuit', hint: 'Rescue your family', to: '/stellar-pursuit' },
  play_social_combat: { label: 'Play Social Combat', hint: 'Read the room', to: '/social-combat' },
  play_pacman: { label: 'Play Pac-Man', hint: 'Eat the dots', to: '/pacman' },
  real_or_not: { label: 'Play Real or Not', hint: 'Spot the fake', to: '/real-or-not' },
  memory_training: { label: 'Train your memory', hint: 'A quick workout for your mind', to: '/memory-training' },
  // Around the site
  change_background: { label: 'Change your background', hint: 'Make it feel like yours', to: '/background-settings' },
  see_whats_new: { label: 'See what\'s new', hint: 'Read the changelog', to: '/changelog' },
};

/** One row of today's list, as the server sends it. */
export interface ObjectiveRow {
  key: ObjectiveKey;
  progress: number;
  target: number;
  done: boolean;
  /** A challenge: one a day after the core five. It earns the same XP as any other. */
  hard: boolean;
  /** True while they are still on the five core objectives. */
  core: boolean;
}

/** Every objective is worth the same XP, easy or hard (mirrors objective_xp() in the database). */
export const XP_PER_OBJECTIVE = 10;

/** Fired after something that may have ticked an objective, so the toolbar re-checks at once. */
export const OBJECTIVES_CHANGED = 'velvet:objectives-changed';

export function notifyObjectivesChanged() {
  window.dispatchEvent(new Event(OBJECTIVES_CHANGED));
}

/** The start of the user's own day, so "today" follows their clock and not the server's. */
export function localDayStart(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** The objectives on offer right now: the core five until they are all done, then the day's set. */
export async function getDailyObjectives(): Promise<ObjectiveRow[]> {
  const { data, error } = await supabase.rpc('get_daily_objectives', { p_day_start: localDayStart() });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ObjectiveRow[]).filter(r => r.key in OBJECTIVE_DEFS);
}

/** A visit to a page or a game leaves no record of its own, so the app reports it. */
export async function reportActivity(key: ReportedKey): Promise<void> {
  const { error } = await supabase.rpc('report_activity', { p_key: key });
  if (error) console.warn('[objectives] report failed:', error.message);
  notifyObjectivesChanged();
}

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  nickname: string;
  xp: number;
  full_days: number;
  is_you: boolean;
}

export type LeaderboardPeriod = 'week' | 'all';

export async function getObjectiveLeaderboard(period: LeaderboardPeriod, limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_objective_leaderboard', { p_period: period, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}
