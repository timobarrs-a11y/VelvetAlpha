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

export interface ProgressPostWithAuthor extends ProgressPost {
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
  commitment_completed: { label: 'Commitment Kept', icon: 'check', color: '#34d399' },
  plan_step_completed: { label: 'Plan Step Done', icon: 'layers', color: '#a78bfa' },
  goal_completed: { label: 'Goal Completed', icon: 'target', color: '#fbbf24' },
  milestone_achieved: { label: 'Milestone', icon: 'trophy', color: '#f472b6' },
  streak_milestone: { label: 'Streak', icon: 'flame', color: '#fb923c' },
  medal_earned: { label: 'Medal Earned', icon: 'trophy', color: '#fbbf24' },
};
