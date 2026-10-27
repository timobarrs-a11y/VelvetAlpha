import { supabase } from '../shared/supabase/client';

export interface ProgressPost {
  id: string;
  user_id: string;
  post_type: string;
  title: string;
  body: string | null;
  ref_target_type: string;
  ref_target_id: string;
  goal_id: string | null;
  like_count: number;
  comment_count: number;
  is_auto_generated: boolean;
  created_at: string;
  author_name?: string;
  author_avatar_config?: Record<string, unknown> | null;
  author_profile_image_type?: string;
  author_profile_smilie_code?: string | null;
  author_is_bot?: boolean;
}

export type PostAudience = 'everyone' | 'friends';

export interface ProgressPostWithAuthor extends ProgressPost {
  /** Who can see it. Absent on older rows and before the audience column exists. */
  audience?: PostAudience;
  author_name: string;
  author_avatar_config: Record<string, unknown> | null;
  author_profile_image_type: string;
  author_profile_smilie_code: string | null;
  author_is_bot: boolean;
}

interface FeedRpcResult {
  success: boolean;
  posts: ProgressPost[];
}

async function callFeedRpc(fn: string, params: Record<string, unknown>): Promise<ProgressPostWithAuthor[]> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) {
    console.error(`[progressFeedService] ${fn} error:`, error.message);
    return [];
  }
  const result = data as FeedRpcResult;
  if (!result?.success || !result.posts) return [];
  return result.posts as ProgressPostWithAuthor[];
}

export async function getFeedPosts(limit = 30, offset = 0): Promise<ProgressPostWithAuthor[]> {
  return callFeedRpc('get_progress_feed', { p_limit: limit, p_offset: offset });
}

export async function getTrendingPosts(limit = 20): Promise<ProgressPostWithAuthor[]> {
  return callFeedRpc('get_trending_posts', { p_limit: limit });
}

/** Posts from every public member, plus your own. */
export async function getPublicFeed(limit = 30, offset = 0): Promise<ProgressPostWithAuthor[]> {
  return callFeedRpc('get_public_feed', { p_limit: limit, p_offset: offset });
}

/** Recent wins from members who share them (not yours): the Discover feed. */
export async function getDiscoverAccomplishments(limit = 30, offset = 0): Promise<ProgressPostWithAuthor[]> {
  return callFeedRpc('get_discover_accomplishments', { p_limit: limit, p_offset: offset });
}

export const STATUS_MAX_LENGTH = 500;

const STATUS_ERRORS: Record<string, string> = {
  not_signed_in: 'Sign in to post.',
  no_access: 'Verify your age to post.',
  banned: "Your account can't post right now.",
  empty: 'Write something first.',
  too_long: `Keep it under ${STATUS_MAX_LENGTH} characters.`,
  rate_limited: "You've posted a lot in the last hour. Try again a bit later.",
  bad_audience: 'Choose who can see this post.',
};

/** Post a status. Resolves to the new post's id, or throws with a message to show. */
export async function createStatus(body: string, audience: PostAudience = 'everyone'): Promise<string> {
  // Public is the default, so the plain call keeps working; a friends-only post names its audience.
  const params = audience === 'everyone' ? { p_body: body } : { p_body: body, p_audience: audience };
  const { data, error } = await supabase.rpc('create_status_post', params);
  if (error) {
    console.error('[progressFeedService] create_status_post error:', error.message);
    throw new Error("Couldn't post that. Try again.");
  }
  const result = data as { success: boolean; id?: string; error?: string };
  if (!result?.success || !result.id) {
    throw new Error(STATUS_ERRORS[result?.error ?? ''] ?? "Couldn't post that. Try again.");
  }
  return result.id;
}

/** Delete one of your own posts. RLS only lets the owner delete. */
export async function deletePost(postId: string): Promise<boolean> {
  const { error } = await supabase.from('progress_posts').delete().eq('id', postId);
  if (error) {
    console.error('[progressFeedService] deletePost error:', error.message);
    return false;
  }
  return true;
}

export async function getPostsByGoal(goalId: string, limit = 20): Promise<ProgressPostWithAuthor[]> {
  const { data, error } = await supabase
    .from('progress_posts')
    .select('id, user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id, like_count, comment_count, is_auto_generated, created_at')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  const posts = (data ?? []) as ProgressPost[];
  if (posts.length === 0) return [];

  const uniqueUserIds = [...new Set(posts.map(p => p.user_id))];
  const { data: profiles } = await supabase
    .from('member_profiles')
    .select('user_id, display_name, avatar_config, profile_image_type, profile_smilie_code, is_bot')
    .in('user_id', uniqueUserIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
  return posts.map(p => {
    const prof = profileMap.get(p.user_id);
    return {
      ...p,
      author_name: prof?.display_name ?? 'Member',
      author_avatar_config: prof?.avatar_config ?? null,
      author_profile_image_type: prof?.profile_image_type ?? 'avatar',
      author_profile_smilie_code: prof?.profile_smilie_code ?? null,
      author_is_bot: prof?.is_bot ?? false,
    } as ProgressPostWithAuthor;
  });
}

export async function getPostsByUser(userId: string, limit = 20): Promise<ProgressPostWithAuthor[]> {
  return callFeedRpc('get_member_posts', { p_user_id: userId, p_limit: limit });
}

export const POST_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  status: { label: 'Status', icon: 'message', color: '#38bdf8' },
  commitment_completed: { label: 'Commitment Kept', icon: 'check', color: '#34d399' },
  plan_step_completed: { label: 'Plan Step Done', icon: 'layers', color: '#a78bfa' },
  goal_completed: { label: 'Goal Completed', icon: 'target', color: '#fbbf24' },
  milestone_achieved: { label: 'Milestone', icon: 'trophy', color: '#f472b6' },
  streak_milestone: { label: 'Streak', icon: 'flame', color: '#fb923c' },
  medal_earned: { label: 'Medal Earned', icon: 'trophy', color: '#fbbf24' },
};
