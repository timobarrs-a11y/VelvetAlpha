import { useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { getPostsByUser } from '../../services/progressFeedService';
import { PostCard } from './PostCard';
import { StatusComposer } from './StatusComposer';
import { useFeedPosts } from './useFeedPosts';

/** The Posts section on a profile. On your own profile it has the post box. */
export function ProfilePosts({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const load = useCallback(() => getPostsByUser(userId, 30), [userId]);
  const { posts, likedIds, loading, currentUserId, reload, onLikeChange, onDeleted } = useFeedPosts(load);

  return (
    <div>
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" />
        Posts
      </h2>
      <div className="space-y-3">
        {isOwn && <StatusComposer onPosted={reload} placeholder="Post a status to your profile..." />}
        {loading && posts.length === 0 ? null : posts.length === 0 ? (
          <p className="text-sm text-white/30 py-2">{isOwn ? 'Nothing posted yet.' : 'No posts yet.'}</p>
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              liked={likedIds.has(post.id)}
              currentUserId={currentUserId}
              onLikeChange={onLikeChange}
              onDeleted={onDeleted}
            />
          ))
        )}
      </div>
    </div>
  );
}
