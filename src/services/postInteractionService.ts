import { supabase } from '../shared/supabase/client';

export interface PostComment {
  id: string;
  user_id: string;
  post_id: string;
  body: string;
  is_bot: boolean;
  created_at: string;
  author_name?: string;
  author_avatar_config?: Record<string, unknown> | null;
}

export async function toggleLike(postId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if already liked
  const { data: existing } = await supabase
    .from('progress_post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('progress_post_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);
    return false; // unliked
  }

  const { error } = await supabase
    .from('progress_post_likes')
    .insert({ user_id: user.id, post_id: postId });

  if (error && !error.message.includes('duplicate')) {
    console.error('[postInteraction] toggleLike error:', error.message);
    return false;
  }
  return true; // liked
}

export async function isLiked(postId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('progress_post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle();

  return !!data;
}

export async function getLikedPostIds(postIds: string[]): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || postIds.length === 0) return new Set();

  const { data } = await supabase
    .from('progress_post_likes')
    .select('post_id')
    .eq('user_id', user.id)
    .in('post_id', postIds);

  return new Set((data ?? []).map(r => r.post_id));
}

export async function getComments(postId: string, limit = 50): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('progress_post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[postInteraction] getComments error:', error.message);
    return [];
  }

  const comments = (data ?? []) as PostComment[];
  if (comments.length === 0) return comments;

  // Enrich with author info
  const userIds = [...new Set(comments.map(c => c.user_id))];
  const { data: profiles } = await supabase
    .from('member_profiles')
    .select('user_id, display_name, avatar_config')
    .in('user_id', userIds);

  const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
  return comments.map(c => {
    const prof = profileMap.get(c.user_id);
    return {
      ...c,
      author_name: prof?.display_name ?? 'Member',
      author_avatar_config: prof?.avatar_config ?? null,
    };
  });
}

export async function addComment(postId: string, body: string): Promise<PostComment | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('progress_post_comments')
    .insert({
      user_id: user.id,
      post_id: postId,
      body: body.trim(),
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[postInteraction] addComment error:', error.message);
    return null;
  }

  return (data as PostComment) ?? null;
}

export async function deleteComment(commentId: string): Promise<void> {
  await supabase
    .from('progress_post_comments')
    .delete()
    .eq('id', commentId);
}
