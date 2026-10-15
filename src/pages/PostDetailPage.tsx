import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Info, Pin, Heart, HandHeart, UserRound, Clock } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { PageHeader } from '../shared/ui/PageHeader';
import { Button } from '../shared/ui/Button';
import { Textarea } from '../shared/ui';
import { LoadingState } from '../shared/ui/LoadingState';
import { toast } from '../shared/ui';
import { ReportModal } from '../components/community/CommunityComponents';
import {
  fetchPost,
  fetchComments,
  createComment,
  deleteComment,
  deletePost,
  toggleReaction,
} from '../services/communityService';
import type { PostWithAuthor, CommentWithAuthor, ReactionType } from '../types/community';

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const REACTIONS: { type: ReactionType; label: string; icon: typeof Heart; color: string }[] = [
  { type: 'like', label: 'Like', icon: Heart, color: 'text-rose-400' },
  { type: 'support', label: 'Support', icon: HandHeart, color: 'text-emerald-400' },
  { type: 'relate', label: 'Relate', icon: UserRound, color: 'text-sky-400' },
];

export default function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostWithAuthor | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState<string>('');
  const [optimisticReaction, setOptimisticReaction] = useState<ReactionType | null>(null);
  const [optimisticCount, setOptimisticCount] = useState(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    const p = await fetchPost(postId);
    setPost(p);
    if (p) {
      setBoardId(p.board_id);
      setOptimisticReaction(p.user_reaction ?? null);
      setOptimisticCount(p.reaction_count);
    }
  }, [postId]);

  const loadComments = useCallback(async () => {
    if (!postId) return;
    const c = await fetchComments(postId);
    setComments(c);
  }, [postId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadPost(), loadComments()]);
      setLoading(false);
    })();
  }, [loadPost, loadComments]);

  useEffect(() => {
    if (!boardId) return;
    (async () => {
      const { fetchBoard } = await import('../services/communityService');
      const b = await fetchBoard(boardId);
      if (b) setBoardName(b.name);
    })();
  }, [boardId]);

  const handleReact = async (type: ReactionType) => {
    if (!postId) return;
    const wasActive = optimisticReaction === type;
    setOptimisticReaction(wasActive ? null : type);
    setOptimisticCount((c) => c + (wasActive ? -1 : 1));
    try {
      await toggleReaction(postId, 'post', type);
      await loadPost();
    } catch {
      setOptimisticReaction(post?.user_reaction ?? null);
      setOptimisticCount(post?.reaction_count ?? 0);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentBody.trim() || !postId) return;
    setSubmitting(true);
    const c = await createComment({ post_id: postId, body: commentBody.trim() });
    setSubmitting(false);
    if (c) {
      setCommentBody('');
      await loadComments();
      await loadPost();
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      toast.error('Could not post comment. Try again.');
    }
  };

  const handleDeletePost = async () => {
    if (!postId) return;
    const ok = await deletePost(postId);
    if (ok) {
      toast.success('Post deleted.');
      navigate(boardId ? `/community/board/${boardId}` : '/community');
    } else {
      toast.error('Could not delete post.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await deleteComment(commentId);
    if (ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      await loadPost();
    } else {
      toast.error('Could not delete comment.');
    }
  };

  if (loading) {
    return (
      <PageShell width="md" header={<PageHeader title="Loading..." back="/community" />}>
        <LoadingState label="Loading post..." />
      </PageShell>
    );
  }

  if (!post) {
    return (
      <PageShell width="md" header={<PageHeader title="Post not found" back="/community" />}>
        <div className="text-center py-16 text-white/50">
          <p>This post may have been deleted.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => navigate('/community')}>
            Back to community
          </Button>
        </div>
      </PageShell>
    );
  }

  const postInitials = post.author_name.slice(0, 2).toUpperCase();

  return (
    <PageShell
      width="md"
      header={
        <PageHeader
          title="Thread"
          subtitle={boardName || undefined}
          back={boardId ? `/community/board/${boardId}` : '/community'}
          backLabel={boardName || 'Board'}
        >
          <div className="flex items-center gap-2 px-1 py-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Info className="w-3.5 h-3.5" />
              <span>Some content may be AI-generated.</span>
            </div>
          </div>
        </PageHeader>
      }
    >
      <div className="flex flex-col gap-4 pb-8">
        {/* Original post -- forum style with left author sidebar */}
        <div className="flex gap-4">
          {/* Author sidebar */}
          <div className="w-28 flex-shrink-0 flex flex-col items-center gap-1 pt-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400/60 to-violet-400/60 flex items-center justify-center text-sm font-bold text-white">
              {postInitials}
            </div>
            <span className="text-xs font-semibold text-white/80 text-center break-all leading-tight">
              {post.author_name}
            </span>
            <span className="text-[10px] text-white/30 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo(post.created_at)}
            </span>
            {post.is_pinned && (
              <Pin className="w-3 h-3 text-amber-400 mt-1" fill="currentColor" />
            )}
          </div>

          {/* Post body */}
          <div className="flex-1 min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <h1 className="text-base font-bold text-white leading-tight">{post.title}</h1>
            <p className="text-sm text-white/70 mt-2 leading-relaxed whitespace-pre-wrap">{post.body}</p>

            {/* Reaction bar */}
            <div className="flex items-center gap-1 mt-4 pt-3 border-t border-white/[0.06]">
              {REACTIONS.map(({ type, label, icon: Icon, color }) => {
                const active = optimisticReaction === type;
                return (
                  <button
                    key={type}
                    onClick={() => handleReact(type)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? `${color} bg-white/8`
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                    aria-label={label}
                    aria-pressed={active}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'fill-current' : ''}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
              <span className="text-xs text-white/30 ml-1 tabular-nums">{optimisticCount}</span>
              <div className="flex-1" />
              <span className="flex items-center gap-1 text-xs text-white/30">
                <MessageCircle className="w-3.5 h-3.5" />
                {post.comment_count}
              </span>
            </div>
          </div>
        </div>

        {/* Comments header */}
        <div className="flex items-center gap-2 px-1 pt-2">
          <MessageCircle className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white/60">
            {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
          </h2>
        </div>

        {/* Comment list -- same sidebar layout */}
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {comments.map((comment) => {
              const initials = comment.author_name.slice(0, 2).toUpperCase();
              return (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex gap-4 group"
                >
                  <div className="w-28 flex-shrink-0 flex flex-col items-center gap-1 pt-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400/50 to-emerald-400/50 flex items-center justify-center text-xs font-bold text-white">
                      {initials}
                    </div>
                    <span className="text-xs font-semibold text-white/80 text-center break-all leading-tight">
                      {comment.author_name}
                    </span>
                    <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3">
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="text-[10px] text-white/20 hover:text-red-400 transition-colors mt-1 opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {comments.length === 0 && (
            <p className="text-sm text-white/30 text-center py-6">
              No replies yet. Be the first to respond.
            </p>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Reply input */}
        {!post.is_locked && (
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[var(--ds-surface-2)]/80 backdrop-blur-md border-t border-white/8">
            <div className="flex items-end gap-2">
              <Textarea
                placeholder="Write a reply..."
                rows={1}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="min-h-[40px] max-h-32"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
              <Button
                size="sm"
                isLoading={submitting}
                disabled={!commentBody.trim()}
                onClick={handleSubmitComment}
                leftIcon={<Send className="w-3.5 h-3.5" />}
                className="flex-shrink-0"
              >
                Reply
              </Button>
            </div>
          </div>
        )}

        {post.is_locked && (
          <p className="text-sm text-white/30 text-center py-4">This post is locked for new comments.</p>
        )}
      </div>

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetId={post.id}
        targetType="post"
      />
    </PageShell>
  );
}
