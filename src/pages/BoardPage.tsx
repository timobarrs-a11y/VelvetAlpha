import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Info, Lock } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { PageHeader } from '../shared/ui/PageHeader';
import { Button } from '../shared/ui/Button';
import { LoadingState } from '../shared/ui/LoadingState';
import { EmptyState } from '../shared/ui/EmptyState';
import { PostCard, CreatePostModal } from '../components/community/CommunityComponents';
import { fetchBoard, fetchPosts, deletePost } from '../services/communityService';
import type { BoardWithCounts, PostWithAuthor } from '../types/community';

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  rose: '#f43f5e',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  slate: '#64748b',
  teal: '#14b8a6',
  pink: '#ec4899',
};

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardWithCounts | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadBoard = useCallback(async () => {
    if (!boardId) return;
    const b = await fetchBoard(boardId);
    setBoard(b);
  }, [boardId]);

  const loadPosts = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    const { posts: initialPosts, nextCursor: nc } = await fetchPosts(boardId);
    setPosts(initialPosts);
    setNextCursor(nc);
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    loadBoard();
    loadPosts();
  }, [loadBoard, loadPosts]);

  const handleLoadMore = async () => {
    if (!boardId || !nextCursor) return;
    setLoadingMore(true);
    const { posts: morePosts, nextCursor: nc } = await fetchPosts(boardId, nextCursor);
    setPosts((prev) => [...prev, ...morePosts]);
    setNextCursor(nc);
    setLoadingMore(false);
  };

  const handleDelete = async (postId: string) => {
    const ok = await deletePost(postId);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  const accent = board ? COLOR_MAP[board.color] ?? '#64748b' : '#3b82f6';

  return (
    <PageShell
      width="lg"
      header={
        <PageHeader
          title={board?.name ?? 'Board'}
          subtitle={board?.description ?? undefined}
          back="/community"
          backLabel="Community"
          accent={accent}
          actions={
            !board?.is_locked && (
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                New Post
              </Button>
            )
          }
        >
          <div className="flex items-center gap-2 px-1 py-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Info className="w-3.5 h-3.5" />
              <span>Some content may be AI-generated.</span>
            </div>
            {board?.is_locked && (
              <span className="flex items-center gap-1 text-xs text-amber-400/80">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>
        </PageHeader>
      }
    >
      {loading ? (
        <LoadingState label="Loading posts..." />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-7 h-7" />}
          title="No posts yet"
          description={board?.is_locked ? 'This board is locked.' : 'Start the conversation with the first post.'}
          action={!board?.is_locked ? { label: 'Create post', onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
            >
              <PostCard
                post={post}
                onClick={() => navigate(`/community/post/${post.id}`)}
                onReactionToggled={loadPosts}
                onDelete={() => handleDelete(post.id)}
                canDelete={board?.is_owner || post.author_id === board?.owner_id}
              />
            </motion.div>
          ))}
          {nextCursor && (
            <div className="flex justify-center pt-4">
              <Button variant="secondary" size="sm" isLoading={loadingMore} onClick={handleLoadMore}>
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {boardId && (
        <CreatePostModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          boardId={boardId}
          onCreated={loadPosts}
        />
      )}
    </PageShell>
  );
}
