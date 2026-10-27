import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { getDiscoverAccomplishments } from '../../services/progressFeedService';
import { PostCard } from './PostCard';
import { useFeedPosts } from './useFeedPosts';
import { LoadingState } from '../../shared/ui/LoadingState';
import { EmptyState } from '../../shared/ui/EmptyState';

/**
 * Discover: people getting things done. Every goal, task and commitment a member finishes
 * (unless they turned sharing off) lands here so anyone can find them and cheer them on.
 */
export function DiscoverWins() {
  const load = useCallback(() => getDiscoverAccomplishments(30), []);
  const { posts, likedIds, loading, currentUserId, onLikeChange, onDeleted } = useFeedPosts(load);

  return (
    <div className="p-4 space-y-3">
      {loading && posts.length === 0 ? (
        <LoadingState label="Finding people getting things done..." />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-7 h-7" />}
          title="No wins yet"
          description="When people finish goals, tasks and commitments, they show up here so you can cheer them on. Go finish something."
        />
      ) : (
        <>
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              liked={likedIds.has(post.id)}
              currentUserId={currentUserId}
              onLikeChange={onLikeChange}
              onDeleted={onDeleted}
            />
          ))}
          <p className="pt-2 text-center text-xs text-white/35">
            Your wins show up here too. You can turn that off in{' '}
            <Link to="/my-profile/edit" className="text-pink-300 hover:text-pink-200 underline underline-offset-2">your profile settings</Link>.
          </p>
        </>
      )}
    </div>
  );
}
