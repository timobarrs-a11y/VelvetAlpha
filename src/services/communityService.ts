import { supabase } from '../shared/supabase/client';
import type {
  CommunityBoard,
  CommunityPost,
  CommunityComment,
  CommunityReaction,
  PostWithAuthor,
  CommentWithAuthor,
  BoardWithCounts,
  ReactionType,
  SmilieReactionAggregate,
  NotificationWithActor,
  CommunityPoll,
  PollVoteResult,
  CommunityBadge,
} from '../types/community';

const PAGE_SIZE = 10;

export async function isSuperUser(): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_super_user')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle();
  return profile?.is_super_user ?? false;
}

export async function fetchBoards(): Promise<BoardWithCounts[]> {
  const { data: boards, error } = await supabase
    .from('community_boards')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error || !boards) return [];

  const { data: profile } = await supabase.auth.getUser();
  const userId = profile.user?.id;

  return boards.map((b: CommunityBoard) => ({
    ...b,
    is_owner: b.owner_id === userId,
  }));
}

export async function fetchBoard(boardId: string): Promise<BoardWithCounts | null> {
  const { data, error } = await supabase
    .from('community_boards')
    .select('*')
    .eq('id', boardId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: profile } = await supabase.auth.getUser();
  return { ...data, is_owner: data.owner_id === profile.user?.id };
}

export async function approveBoard(boardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_boards')
    .update({ is_approved: true })
    .eq('id', boardId);
  return !error;
}

export async function rejectBoard(boardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_boards')
    .delete()
    .eq('id', boardId);
  return !error;
}

export async function createBoard(input: {
  name: string;
  description: string;
  color: string;
  icon: string;
}): Promise<CommunityBoard | null> {
  const { data, error } = await supabase
    .from('community_boards')
    .insert({
      name: input.name,
      description: input.description,
      color: input.color,
      icon: input.icon,
    })
    .select()
    .maybeSingle();

  if (error) return null;
  return data;
}

export type SortMode = 'latest' | 'replies' | 'reactions';

export async function fetchPosts(
  boardId: string,
  cursor?: string,
  sortMode: SortMode = 'latest'
): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }> {
  let query = supabase
    .from('community_posts')
    .select('*, author_name:user_profiles!community_posts_author_profile_fkey(name)')
    .eq('board_id', boardId)
    .limit(PAGE_SIZE + 1);

  if (sortMode === 'replies') {
    query = query.order('is_pinned', { ascending: false }).order('comment_count', { ascending: false }).order('created_at', { ascending: false });
  } else if (sortMode === 'reactions') {
    query = query.order('is_pinned', { ascending: false }).order('reaction_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
  }

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error || !data) return { posts: [], nextCursor: null };

  const hasMore = data.length > PAGE_SIZE;
  const rows = hasMore ? data.slice(0, PAGE_SIZE) : data;
  const nextCursor = hasMore ? rows[rows.length - 1].created_at : null;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (userId && rows.length > 0) {
    const postIds = rows.map((r) => r.id);
    const [reactionsRes, aggMap] = await Promise.all([
      supabase
        .from('community_reactions')
        .select('target_id, reaction_type')
        .eq('user_id', userId)
        .eq('target_type', 'post')
        .in('target_id', postIds),
      fetchReactionAggregates('post', postIds),
    ]);

    const reactionMap = new Map<string, ReactionType>();
    (reactionsRes.data ?? []).forEach((r) => reactionMap.set(r.target_id, r.reaction_type as ReactionType));

    return {
      posts: rows.map((r) => ({
        ...r,
        author_name: (r.author_name as unknown as { name: string })?.name ?? 'Unknown',
        user_reaction: reactionMap.get(r.id) ?? null,
        reaction_aggregates: aggMap.get(r.id) ?? [],
      })),
      nextCursor,
    };
  }

  const aggMap2 = await fetchReactionAggregates('post', rows.map((r) => r.id));
  return {
    posts: rows.map((r) => ({
      ...r,
      author_name: (r.author_name as unknown as { name: string })?.name ?? 'Unknown',
      user_reaction: null,
      reaction_aggregates: aggMap2.get(r.id) ?? [],
    })),
    nextCursor,
  };
}

export async function fetchPost(postId: string): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('*, author_name:user_profiles!community_posts_author_profile_fkey(name)')
    .eq('id', postId)
    .maybeSingle();

  if (error || !data) return null;

  const { data: userData } = await supabase.auth.getUser();
  let userReaction: ReactionType | null = null;

  if (userData.user) {
    const { data: reaction } = await supabase
      .from('community_reactions')
      .select('reaction_type')
      .eq('user_id', userData.user.id)
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .maybeSingle();
    userReaction = (reaction?.reaction_type as ReactionType) ?? null;
  }

  const aggMap = await fetchReactionAggregates('post', [postId]);
  const aggregates = aggMap.get(postId) ?? [];

  return {
    ...data,
    author_name: (data.author_name as unknown as { name: string })?.name ?? 'Unknown',
    user_reaction: userReaction,
    reaction_aggregates: aggregates,
  };
}

export async function createPost(input: {
  board_id: string;
  title: string;
  body: string;
  post_smilie?: string | null;
}): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      board_id: input.board_id,
      title: input.title,
      body: input.body,
      post_smilie: input.post_smilie ?? null,
      is_ai_generated: false,
    })
    .select()
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function editPost(postId: string, body: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_posts')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', postId);
  return !error;
}

export async function deletePost(postId: string): Promise<boolean> {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  return !error;
}

export async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*, author_name:user_profiles!community_comments_author_profile_fkey(name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const commentIds = data.map((r) => r.id);

  const [aggMap, userReactions] = await Promise.all([
    fetchReactionAggregates('comment', commentIds),
    userId
      ? supabase
          .from('community_reactions')
          .select('target_id, reaction_type')
          .eq('user_id', userId)
          .eq('target_type', 'comment')
          .in('target_id', commentIds)
      : Promise.resolve({ data: null }),
  ]);

  const userReactionMap = new Map<string, string>();
  (userReactions.data ?? []).forEach((r) => userReactionMap.set(r.target_id, r.reaction_type));

  return data.map((r) => ({
    ...r,
    author_name: (r.author_name as unknown as { name: string })?.name ?? 'Unknown',
    user_reaction: userReactionMap.get(r.id) ?? null,
    reaction_aggregates: aggMap.get(r.id) ?? [],
  }));
}

export async function createComment(input: {
  post_id: string;
  body: string;
}): Promise<CommunityComment | null> {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: input.post_id,
      body: input.body,
      is_ai_generated: false,
    })
    .select()
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const { error } = await supabase.from('community_comments').delete().eq('id', commentId);
  return !error;
}

export async function toggleReaction(
  targetId: string,
  targetType: 'post' | 'comment',
  reactionType: ReactionType
): Promise<void> {
  const { data: existing } = await supabase
    .from('community_reactions')
    .select('id, reaction_type')
    .eq('target_id', targetId)
    .eq('target_type', targetType)
    .maybeSingle();

  if (existing) {
    if (existing.reaction_type === reactionType) {
      await supabase.from('community_reactions').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('community_reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id);
    }
  } else {
    await supabase.from('community_reactions').insert({
      target_id: targetId,
      target_type: targetType,
      reaction_type: reactionType,
    });
  }
}

export async function fetchReactionAggregates(
  targetType: 'post' | 'comment',
  targetIds: string[],
): Promise<Map<string, SmilieReactionAggregate[]>> {
  if (targetIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('community_reactions')
    .select('target_id, reaction_type')
    .eq('target_type', targetType)
    .in('target_id', targetIds);

  if (error || !data) return new Map();

  const map = new Map<string, SmilieReactionAggregate[]>();
  for (const row of data) {
    const list = map.get(row.target_id) ?? [];
    const existing = list.find((a) => a.reaction_type === row.reaction_type);
    if (existing) {
      existing.count++;
    } else {
      list.push({ reaction_type: row.reaction_type, count: 1 });
    }
    map.set(row.target_id, list);
  }
  return map;
}

export async function reportContent(input: {
  target_type: 'post' | 'comment' | 'board';
  target_id: string;
  reason: string;
}): Promise<boolean> {
  const { error } = await supabase.from('community_reports').insert({
    target_type: input.target_type,
    target_id: input.target_id,
    reason: input.reason,
  });
  return !error;
}

/* ===== Read tracking ===== */

export async function markPostRead(postId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from('community_post_reads')
    .upsert({ user_id: userData.user.id, post_id: postId, read_at: new Date().toISOString() }, { onConflict: 'user_id,post_id' });
}

export async function fetchReadPostIds(postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Set();
  const { data, error } = await supabase
    .from('community_post_reads')
    .select('post_id')
    .eq('user_id', userData.user.id)
    .in('post_id', postIds);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.post_id));
}

/* ===== Board latest activity ===== */

export async function fetchBoardLatestActivity(boardId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .select('created_at')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.created_at;
}

export interface SearchResult {
  result_type: 'post' | 'board';
  id: string;
  title: string;
  body: string | null;
  board_id: string | null;
  board_name: string | null;
  author_name: string | null;
  comment_count: number;
  created_at: string;
  rank: number;
}

export async function searchCommunity(query: string, limit = 20): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('community_search', {
    p_query: query,
    p_limit: limit,
  });

  if (error || !data) return [];
  return data as SearchResult[];
}

/* ===== Notifications ===== */

export async function fetchNotifications(
  limit = 20,
  cursor?: string,
): Promise<{ notifications: NotificationWithActor[]; nextCursor: string | null }> {
  let query = supabase
    .from('community_notifications')
    .select('*, actor_name:user_profiles!community_notifications_actor_id_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error || !data) return { notifications: [], nextCursor: null };

  const hasMore = data.length > limit;
  const rows = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? rows[rows.length - 1].created_at : null;

  return {
    notifications: rows.map((r) => ({
      ...r,
      actor_name: (r.actor_name as unknown as { name: string } | null)?.name ?? null,
    })),
    nextCursor,
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_notification_count');
  if (error || data === null) return 0;
  return data as number;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase
    .from('community_notifications')
    .update({ read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsRead(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase
    .from('community_notifications')
    .update({ read: true })
    .eq('user_id', userData.user.id)
    .eq('read', false);
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await supabase.from('community_notifications').delete().eq('id', notificationId);
}

/* ===== Polls ===== */

export async function fetchPoll(postId: string): Promise<CommunityPoll | null> {
  const { data, error } = await supabase
    .from('community_polls')
    .select('*')
    .eq('post_id', postId)
    .maybeSingle();
  if (error || !data) return null;
  return data as CommunityPoll;
}

export async function createPoll(input: {
  post_id: string;
  question: string;
  options: string[];
  expires_at?: string | null;
}): Promise<CommunityPoll | null> {
  const { data, error } = await supabase
    .from('community_polls')
    .insert({
      post_id: input.post_id,
      question: input.question,
      options: input.options,
      expires_at: input.expires_at ?? null,
    })
    .select()
    .maybeSingle();
  if (error) return null;
  return data as CommunityPoll;
}

export async function fetchPollResults(pollId: string): Promise<PollVoteResult[]> {
  const { data, error } = await supabase.rpc('get_poll_results', { p_poll_id: pollId });
  if (error || !data) return [];
  return data as PollVoteResult[];
}

export async function fetchUserPollVote(pollId: string): Promise<number | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from('community_poll_votes')
    .select('option_index')
    .eq('poll_id', pollId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.option_index as number;
}

export async function votePoll(pollId: string, optionIndex: number): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { error } = await supabase
    .from('community_poll_votes')
    .upsert(
      { poll_id: pollId, user_id: userData.user.id, option_index: optionIndex },
      { onConflict: 'poll_id,user_id' },
    );
  return !error;
}

/* ===== Badges ===== */

export async function fetchBadges(userId: string): Promise<CommunityBadge[]> {
  const { data, error } = await supabase.rpc('get_community_badges', { p_user_id: userId });
  if (error || !data) return [];
  return data as CommunityBadge[];
}

/* ===== Weekly Threads ===== */

export interface WeeklyThreadTemplate {
  id: string;
  board_id: string;
  title_pattern: string;
  body_pattern: string;
  day_of_week: number;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

export async function fetchWeeklyTemplates(): Promise<WeeklyThreadTemplate[]> {
  const { data, error } = await supabase
    .from('community_weekly_threads')
    .select('*')
    .order('day_of_week', { ascending: true });
  if (error || !data) return [];
  return data as WeeklyThreadTemplate[];
}

export { PAGE_SIZE };
