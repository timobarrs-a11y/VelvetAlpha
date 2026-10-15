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
} from '../types/community';

const PAGE_SIZE = 10;

export async function fetchBoards(): Promise<BoardWithCounts[]> {
  const { data: boards, error } = await supabase
    .from('community_boards')
    .select('*')
    .order('is_pinned', { ascending: false })
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

export async function fetchPosts(
  boardId: string,
  cursor?: string
): Promise<{ posts: PostWithAuthor[]; nextCursor: string | null }> {
  let query = supabase
    .from('community_posts')
    .select('*, author_name:user_profiles!community_posts_author_profile_fkey(name)')
    .eq('board_id', boardId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

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
    const { data: reactions } = await supabase
      .from('community_reactions')
      .select('target_id, reaction_type')
      .eq('user_id', userId)
      .eq('target_type', 'post')
      .in('target_id', postIds);

    const reactionMap = new Map<string, ReactionType>();
    (reactions ?? []).forEach((r) => reactionMap.set(r.target_id, r.reaction_type as ReactionType));

    return {
      posts: rows.map((r) => ({
        ...r,
        author_name: (r.author_name as unknown as { name: string })?.name ?? 'Unknown',
        user_reaction: reactionMap.get(r.id) ?? null,
      })),
      nextCursor,
    };
  }

  return {
    posts: rows.map((r) => ({
      ...r,
      author_name: (r.author_name as unknown as { name: string })?.name ?? 'Unknown',
      user_reaction: null,
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

  return {
    ...data,
    author_name: (data.author_name as unknown as { name: string })?.name ?? 'Unknown',
    user_reaction: userReaction,
  };
}

export async function createPost(input: {
  board_id: string;
  title: string;
  body: string;
}): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      board_id: input.board_id,
      title: input.title,
      body: input.body,
      is_ai_generated: false,
    })
    .select()
    .maybeSingle();

  if (error) return null;
  return data;
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

  return data.map((r) => ({
    ...r,
    author_name: (r.author_name as unknown as { name: string })?.name ?? 'Unknown',
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
    .select('id')
    .eq('target_id', targetId)
    .eq('target_type', targetType)
    .eq('reaction_type', reactionType)
    .maybeSingle();

  if (existing) {
    await supabase.from('community_reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('community_reactions').insert({
      target_id: targetId,
      target_type: targetType,
      reaction_type: reactionType,
    });
  }
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

export { PAGE_SIZE };
