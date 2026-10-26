import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import type { ProgressPostWithAuthor } from '../../services/progressFeedService';
import { getLikedPostIds } from '../../services/postInteractionService';

/**
 * Posts for one feed plus which of them you've liked. `load` should be
 * memoized; a new `load` reloads the list, and a slower earlier load can't
 * overwrite a newer one.
 */
export function useFeedPosts(load: () => Promise<ProgressPostWithAuthor[]>) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ProgressPostWithAuthor[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    const data = await load();
    const liked = data.length > 0 ? await getLikedPostIds(data.map(p => p.id)) : new Set<string>();
    if (id !== requestId.current) return;
    setPosts(data);
    setLikedIds(liked);
    setLoading(false);
  }, [load]);

  useEffect(() => { reload(); }, [reload]);

  // Read synchronously so a double-tap can't apply the same change twice.
  const likedRef = useRef(likedIds);
  likedRef.current = likedIds;

  const onLikeChange = useCallback((postId: string, liked: boolean) => {
    if (likedRef.current.has(postId) === liked) return;
    const next = new Set(likedRef.current);
    if (liked) next.add(postId); else next.delete(postId);
    likedRef.current = next;
    setLikedIds(next);
    setPosts(ps => ps.map(p => p.id === postId
      ? { ...p, like_count: Math.max(0, p.like_count + (liked ? 1 : -1)) }
      : p));
  }, []);

  const onDeleted = useCallback((postId: string) => {
    setPosts(ps => ps.filter(p => p.id !== postId));
  }, []);

  return { posts, likedIds, loading, currentUserId: user?.id ?? null, reload, onLikeChange, onDeleted };
}
