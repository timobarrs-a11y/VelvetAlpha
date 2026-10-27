import { supabase } from '../shared/supabase/client';
import { getCompanions, type CompanionWithLastMessage } from './companionService';
import { generateDailyExperience } from './dailyExperienceService';
import { isHelper } from '../utils/relationshipType';

export const COMPANION_STATUS_COMMENT_MAX = 500;

export interface CompanionStatusPost {
  id: string;
  companion_id: string;
  body: string;
  activity: string | null;
  visible_at: string;
}

export interface CompanionStatusComment {
  id: string;
  post_id: string;
  author_type: 'user' | 'companion';
  companion_id: string | null;
  body: string;
  mentioned_companion_id: string | null;
  created_at: string;
}

export interface CompanionStatusFeed {
  posts: CompanionStatusPost[];
  comments: CompanionStatusComment[];
  /** The member's companions (not coaches), by id, for names and faces. */
  companions: Map<string, CompanionWithLastMessage>;
}

const EMPTY: CompanionStatusFeed = { posts: [], comments: [], companions: new Map() };

// Making a day's lines can mean a model call per companion, so it happens at most this often per visit.
const REFRESH_EVERY_MS = 30 * 60 * 1000;
let lastRefresh = 0;
let refreshing: Promise<void> | null = null;

/** Writes today's lines for each companion if they don't exist yet, then posts the ones that are due. */
export function refreshCompanionStatuses(force = false): Promise<void> {
  if (refreshing) return refreshing;
  if (!force && Date.now() - lastRefresh < REFRESH_EVERY_MS) return Promise.resolve();
  refreshing = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const companions = (await getCompanions(user.id)).filter(c => !isHelper(c.relationship_type));
      // One at a time: each is a model call, and the function returns an existing day straight away.
      for (const c of companions) {
        await generateDailyExperience(user.id, c.id).catch(() => {});
      }
      await supabase.functions.invoke('companion-status', { body: { action: 'sync' } });
      lastRefresh = Date.now();
    } catch (err) {
      console.error('[companionStatus] refresh failed', err);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Your companions' recent statuses with the comments under them. */
export async function loadCompanionStatuses(limit = 15): Promise<CompanionStatusFeed> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const { data: posts, error } = await supabase
    .from('companion_status_posts')
    .select('id, companion_id, body, activity, visible_at')
    .lte('visible_at', new Date().toISOString())
    .order('visible_at', { ascending: false })
    .limit(limit);
  if (error || !posts || posts.length === 0) return EMPTY;

  const [{ data: comments }, companionList] = await Promise.all([
    supabase
      .from('companion_status_comments')
      .select('id, post_id, author_type, companion_id, body, mentioned_companion_id, created_at')
      .in('post_id', posts.map(p => p.id))
      .order('created_at', { ascending: true }),
    getCompanions(user.id),
  ]);

  return {
    posts: posts as CompanionStatusPost[],
    comments: (comments ?? []) as CompanionStatusComment[],
    companions: new Map(companionList.map(c => [c.id, c])),
  };
}

export type ReplySkipReason = 'not_mentioned' | 'post_limit' | 'daily_limit' | 'cooldown' | 'already_replied' | 'unavailable';

export interface CommentResult {
  comment: CompanionStatusComment;
  reply: CompanionStatusComment | null;
  replySkipped?: ReplySkipReason;
}

const COMMENT_ERRORS: Record<string, string> = {
  empty: 'Write something first.',
  too_long: `Keep it under ${COMPANION_STATUS_COMMENT_MAX} characters.`,
  rate_limited: "You've commented a lot in the last hour. Try again a bit later.",
  blocked: "That comment can't be posted.",
  not_found: 'That post is no longer here.',
};

/** Comment on a status. Mentioning a companion with @ asks it to answer. Throws with a message to show. */
export async function commentOnStatus(postId: string, body: string): Promise<CommentResult> {
  const { data, error } = await supabase.functions.invoke('companion-status', { body: { action: 'comment', postId, body } });
  if (error || !data || data.error) {
    let code = (data as { error?: string } | null)?.error ?? '';
    // A refusal (rate limit, blocked) comes back as an error whose body holds the reason.
    const response = (error as { context?: Response } | null)?.context;
    if (!code && response && typeof response.json === 'function') {
      code = (await response.json().catch(() => null))?.error ?? '';
    }
    throw new Error(COMMENT_ERRORS[code] ?? "Couldn't post that. Try again.");
  }
  return data as CommentResult;
}
