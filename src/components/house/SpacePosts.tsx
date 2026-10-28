import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Pin, MessageCircle, Clock, ChevronRight, Flame, ArrowUpDown } from 'lucide-react';
import { Button } from '../../shared/ui/Button';
import { LoadingState } from '../../shared/ui/LoadingState';
import { EmptyState } from '../../shared/ui/EmptyState';
import { CreatePostModal, ReportModal } from '../community/CommunityComponents';
import { SmilieText } from '../community/SmilieText';
import { smilieUrl } from '../../config/smilieRegistry';
import {
  fetchBoard, fetchPosts, deletePost, fetchReadPostIds,
  type SortMode,
} from '../../services/communityService';
import { supabase } from '../../shared/supabase/client';
import type { BoardWithCounts, PostWithAuthor } from '../../types/community';

const HOT_THRESHOLD = 20;

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

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'replies', label: 'Most Replies' },
  { key: 'reactions', label: 'Most Reactions' },
];

/** A space's Posts tab, inside the House (it used to be its own page at /community/board/:id). */
export function SpacePosts({ boardId }: { boardId: string }) {
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardWithCounts | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [readPostIds, setReadPostIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    setBoard(null);
    setPosts([]);
    setReadPostIds(new Set());
    setNextCursor(null);
    fetchBoard(boardId).then(setBoard);
  }, [boardId]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { posts: initialPosts, nextCursor: nc } = await fetchPosts(boardId, undefined, sortMode);
    setPosts(initialPosts);
    setNextCursor(nc);
    setLoading(false);
    if (initialPosts.length > 0) {
      const readIds = await fetchReadPostIds(initialPosts.map((p) => p.id));
      setReadPostIds(readIds);
    }
  }, [boardId, sortMode]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const { posts: morePosts, nextCursor: nc } = await fetchPosts(boardId, nextCursor, sortMode);
    setPosts((prev) => [...prev, ...morePosts]);
    setNextCursor(nc);
    setLoadingMore(false);
    if (morePosts.length > 0) {
      const moreReadIds = await fetchReadPostIds(morePosts.map((p) => p.id));
      setReadPostIds((prev) => new Set([...prev, ...moreReadIds]));
    }
  };

  const handleDelete = async (postId: string) => {
    const ok = await deletePost(postId);
    if (ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const canPost = !!board && !board.is_locked && board.is_approved;

  return (
    <div className="flex-1 overflow-y-auto p-4 min-h-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          {!loading && posts.length > 0 && (
            <>
              <ArrowUpDown className="w-3.5 h-3.5 text-white/30" />
              <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-0.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSortMode(opt.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      sortMode === opt.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {canPost && (
            <Button size="sm" className="ml-auto" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
              New Post
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingState label="Loading posts..." />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-7 h-7" />}
            title="No posts yet"
            description={
              board?.is_locked
                ? 'This space is locked.'
                : board && !board.is_approved
                  ? 'This space is awaiting moderator approval.'
                  : 'Start the conversation with the first post.'
            }
            action={canPost ? { label: 'Create post', onClick: () => setShowCreate(true) } : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {posts.map((post, i) => {
              const initials = post.author_name.slice(0, 2).toUpperCase();
              const canDelete = board?.is_owner || post.author_id === currentUserId;
              const isHot = post.comment_count >= HOT_THRESHOLD;
              const isUnread = !readPostIds.has(post.id);
              return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="group"
            >
              <div
                className={`overflow-hidden rounded-xl border bg-white/[0.02] transition-all hover:bg-white/[0.04] hover:border-white/15 ${
                  post.is_pinned
                    ? 'border-amber-500/20'
                    : isUnread
                      ? 'border-sky-500/15'
                      : 'border-white/8'
                }`}
              >
                <div className="flex">
                <div className="relative w-24 sm:w-32 flex-shrink-0 self-stretch overflow-hidden">
                  {post.post_smilie && smilieUrl(post.post_smilie) ? (
                    <img
                      src={smilieUrl(post.post_smilie)!}
                      alt={`:${post.post_smilie}:`}
                      className="absolute inset-0 w-full h-full object-contain object-center p-1"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400/50 to-violet-400/50 flex items-center justify-center text-xs font-bold text-white">
                        {initials}
                      </div>
                    </div>
                  )}
                  {isUnread && (
                    <span className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-black/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                {post.is_pinned && (
                  <div className="flex items-center gap-1.5 px-4 pt-2.5 text-xs text-amber-400/70">
                    <Pin className="w-3 h-3" fill="currentColor" />
                    <span className="font-semibold">Pinned</span>
                  </div>
                )}

                <div className="flex items-start gap-3 p-4">
                  <button
                    onClick={() => navigate(`/community/post/${post.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-[15px] font-bold leading-snug group-hover:text-sky-300 transition-colors line-clamp-1 ${isUnread ? 'text-white' : 'text-white/70'}`}>
                        {post.title}
                      </h3>
                      {isHot && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-bold flex-shrink-0">
                          <Flame className="w-2.5 h-2.5" />
                          Hot
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/50 mt-1 line-clamp-2 leading-relaxed">
                      <SmilieText text={post.body} smilieSize={16} />
                    </p>
                    {post.edited_at && (
                      <span className="text-[10px] text-white/25 italic mt-1 inline-block">
                        (edited)
                      </span>
                    )}
                  </button>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-3 text-xs text-white/35">
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        <span className="tabular-nums">{post.comment_count}</span>
                      </span>
                      {post.reaction_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          {(post.reaction_aggregates ?? []).slice(0, 3).map((a) => {
                            const url = smilieUrl(a.reaction_type);
                            if (!url) return null;
                            return (
                              <img key={a.reaction_type} src={url} alt={`:${a.reaction_type}:`} style={{ height: 14, width: 'auto' }} loading="lazy" />
                            );
                          })}
                          <span className="tabular-nums ml-0.5">{post.reaction_count}</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/25 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                </div>
                </div>
                </div>

                <div className="flex items-center justify-between px-4 pb-3 pt-1">
                  <span className="text-xs text-white/40 truncate">
                    by <span className="text-white/60 font-medium">{post.author_name}</span>
                    {post.is_ai_generated && (
                      <span className="ml-1.5 text-[10px] text-violet-400/60">AI</span>
                    )}
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="px-2 py-1 rounded text-[11px] text-white/25 hover:text-red-400 hover:bg-white/5 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => setReportPostId(post.id)}
                      className="px-2 py-1 rounded text-[11px] text-white/25 hover:text-amber-400 hover:bg-white/5 transition-colors"
                    >
                      Report
                    </button>
                    <button
                      onClick={() => navigate(`/community/post/${post.id}`)}
                      className="p-1 rounded text-white/25 hover:text-sky-300 hover:bg-white/5 transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
              );
            })}

            {nextCursor && (
              <div className="flex justify-center pt-3">
                <Button variant="secondary" size="sm" isLoading={loadingMore} onClick={handleLoadMore}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreatePostModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        boardId={boardId}
        onCreated={loadPosts}
      />

      {reportPostId && (
        <ReportModal
          isOpen={!!reportPostId}
          onClose={() => setReportPostId(null)}
          targetId={reportPostId}
          targetType="post"
        />
      )}
    </div>
  );
}
