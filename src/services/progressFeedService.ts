import { supabase } from '../shared/supabase/client';
import { getFollowingIds } from './memberProfileService';

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
  // Joined fields
  author_name?: string;
  author_avatar_config?: Record<string, unknown> | null;
  author_is_bot?: boolean;
}

export interface ProgressPostWithAuthor extends ProgressPost {
  author_name: string;
  author_avatar_config: Record<string, unknown> | null;
  author_is_bot: boolean;
}

async function enrichPosts(posts: ProgressPost[]): Promise<ProgressPostWithAuthor[]> {
  if (posts.length === 0) return [];
  const userIds = [...new Set(posts.map(p => p.user_id))];
  const { data: profiles } = await supabase
    .from('member_profiles')
    .select('user_id, display_name, avatar_config, is_bot')
    .in('user_id', userIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

  return posts.map(p => {
    const prof = profileMap.get(p.user_id);
    return {
      ...p,
      author_name: prof?.display_name ?? 'Member',
      author_avatar_config: prof?.avatar_config ?? null,
      author_is_bot: prof?.is_bot ?? false,
    };
  });
}

export async function getFeedPosts(limit = 30, offset = 0): Promise<ProgressPostWithAuthor[]> {
  // Feed = posts from people you follow + your own posts
  const followingIds = await getFollowingIds();
  const { data: { user } } = await supabase.auth.getUser();
  const userIds = user ? [...new Set([user.id, ...followingIds])] : followingIds;

  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from('progress_posts')
    .select('*')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[progressFeedService] getFeedPosts error:', error.message);
    return [];
  }

  return enrichPosts((data as ProgressPost[]) ?? []);
}

export async function getTrendingPosts(limit = 20): Promise<ProgressPostWithAuthor[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('progress_posts')
    .select('*')
    .gte('created_at', since)
    .order('like_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[progressFeedService] getTrendingPosts error:', error.message);
    return [];
  }

  return enrichPosts((data as ProgressPost[]) ?? []);
}

export async function getPostsByGoal(goalId: string, limit = 20): Promise<ProgressPostWithAuthor[]> {
  const { data, error } = await supabase
    .from('progress_posts')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return enrichPosts((data as ProgressPost[]) ?? []);
}

export async function getPostsByUser(userId: string, limit = 20): Promise<ProgressPostWithAuthor[]> {
  const { data, error } = await supabase
    .from('progress_posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return enrichPosts((data as ProgressPost[]) ?? []);
}

export const POST_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  commitment_completed: { label: 'Commitment Kept', icon: 'check', color: '#34d399' },
  plan_step_completed: { label: 'Plan Step Done', icon: 'layers', color: '#a78bfa' },
  goal_completed: { label: 'Goal Completed', icon: 'target', color: '#fbbf24' },
  milestone_achieved: { label: 'Milestone', icon: 'trophy', color: '#f472b6' },
  streak_milestone: { label: 'Streak', icon: 'flame', color: '#fb923c' },
};
