import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Info, Lock, Pin, MessageCircle, Heart, Clock } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { PageHeader } from '../shared/ui/PageHeader';
import { Button } from '../shared/ui/Button';
import { LoadingState } from '../shared/ui/LoadingState';
import { EmptyState } from '../shared/ui/EmptyState';
import { CreatePostModal, ReportModal } from '../components/community/CommunityComponents';
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

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardWithCounts | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);

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
        <div className="rounded-xl border border-white/8 overflow-hidden">
          {/* Table header */}
          <div className="hidden md:flex items-center px-4 py-2.5 bg-white/[0.03] border-b border-white/8 text-[11px] font-bold tracking-wider uppercase text-white/30">
            <div className="flex-1 min-w-0">Thread</div>
            <div className="w-24 shrink-0">Author</div>
            <div className="w-16 text-center shrink-0">Replies</div>
            <div className="w-16 text-center shrink-0">Likes</div>
            <div className="w-20 text-right shrink-0">Activity</div>
          </div>

          {/* Thread rows */}
          <div className="divide-y divide-white/[0.06]">
            {posts.map((post) => {
              const initials = post.author_name.slice(0, 2).toUpperCase();
              const canDelete = board?.is_owner || post.author_id === board?.owner_id;
              return (
                <div
                  key={post.id}
                  className="group flex items-center px-4 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  {/* Title + preview */}
                  <button
                    onClick={() => navigate(`/community/post/${post.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      {post.is_pinned && (
                        <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />
                      )}
                      <span className="text-sm font-semibold text-white truncate hover:text-sky-300 transition-colors">
                        {post.title}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 truncate leading-relaxed pr-4">
                      {post.body}
                    </p>
                  </button>

                  {/* Author */}
                  <div className="hidden md:flex w-24 shrink-0 items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-rose-400/50 to-violet-400/50 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">
                      {initials}
                    </div>
                    <span className="text-xs text-white/50 truncate">{post.author_name}</span>
                  </div>

                  {/* Replies */}
                  <div className="hidden md:flex w-16 shrink-0 justify-center">
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <MessageCircle className="w-3 h-3" />
                      {post.comment_count}
                    </span>
                  </div>

                  {/* Likes */}
                  <div className="hidden md:flex w-16 shrink-0 justify-center">
                    <span className="flex items-center gap-1 text-xs text-white/40">
                      <Heart className="w-3 h-3" />
                      {post.reaction_count}
                    </span>
                  </div>

                  {/* Activity */}
                  <div className="hidden md:flex w-20 shrink-0 justify-end items-center gap-1">
                    <Clock className="w-3 h-3 text-white/25" />
                    <span className="text-xs text-white/30">{timeAgo(post.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-1 rounded text-white/25 hover:text-red-400 hover:bg-white/5 transition-colors text-xs"
                        aria-label="Delete post"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => setReportPostId(post.id)}
                      className="p-1 rounded text-white/25 hover:text-amber-400 hover:bg-white/5 transition-colors text-xs"
                      aria-label="Report post"
                    >
                      Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" size="sm" isLoading={loadingMore} onClick={handleLoadMore}>
            Load more
          </Button>
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

      {reportPostId && (
        <ReportModal
          isOpen={!!reportPostId}
          onClose={() => setReportPostId(null)}
          targetId={reportPostId}
          targetType="post"
        />
      )}
    </PageShell>
  );
}
