import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, MessageCircle, Info, Pin, Clock, ChevronRight,
} from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { CommunityHeroHeader } from '../components/community/CommunityHeroHeader';
import { Button } from '../shared/ui/Button';
import { Textarea } from '../shared/ui';
import { LoadingState } from '../shared/ui/LoadingState';
import { toast } from '../shared/ui';
import { ReportModal } from '../components/community/CommunityComponents';
import { SmilieText } from '../components/community/SmilieText';
import { SmiliePicker, SmilieReactionPicker } from '../components/community/SmiliePicker';
import { smilieUrl } from '../config/smilieRegistry';
import {
  fetchPost,
  fetchComments,
  createComment,
  deleteComment,
  deletePost,
  toggleReaction,
  fetchReactionAggregates,
} from '../services/communityService';
import type { PostWithAuthor, CommentWithAuthor, SmilieReactionAggregate } from '../types/community';

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

function ReactionRow({
  aggregates,
  userReaction,
  onReact,
}: {
  aggregates: SmilieReactionAggregate[];
  userReaction: string | null;
  onReact: (code: string) => void;
}) {
  if (aggregates.length === 0) return null;
  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {aggregates.map((agg) => {
        const url = smilieUrl(agg.reaction_type);
        if (!url) return null;
        const isMine = userReaction === agg.reaction_type;
        return (
          <button
            key={agg.reaction_type}
            onClick={() => onReact(agg.reaction_type)}
            className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs transition-all ${
              isMine
                ? 'bg-white/10 ring-1 ring-white/20'
                : 'bg-white/[0.03] hover:bg-white/8'
            }`}
            title={isMine ? 'Click to remove your reaction' : 'Click to react'}
          >
            <img src={url} alt={`:${agg.reaction_type}:`} style={{ height: 18, width: 'auto' }} loading="lazy" />
            <span className="tabular-nums text-white/60 font-medium">{agg.count}</span>
          </button>
        );
      })}
    </div>
  );
}

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
  const [boardColor, setBoardColor] = useState<string>('#3b82f6');
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    const p = await fetchPost(postId);
    setPost(p);
    if (p) setBoardId(p.board_id);
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
      if (b) {
        setBoardName(b.name);
        const COLORS: Record<string, string> = {
          blue: '#3b82f6', rose: '#f43f5e', emerald: '#10b981', amber: '#f59e0b',
          violet: '#8b5cf6', slate: '#64748b', teal: '#14b8a6', pink: '#ec4899',
        };
        setBoardColor(COLORS[b.color] ?? '#64748b');
      }
    })();
  }, [boardId]);

  const handlePostReact = async (code: string) => {
    if (!postId) return;
    const wasActive = post?.user_reaction === code;
    setPost((prev) =>
      prev
        ? {
            ...prev,
            user_reaction: wasActive ? null : code,
            reaction_count: prev.reaction_count + (wasActive ? -1 : 1),
            reaction_aggregates: updateAggregates(prev.reaction_aggregates, prev.user_reaction, wasActive ? null : code),
          }
        : prev,
    );
    try {
      await toggleReaction(postId, 'post', code);
      await loadPost();
    } catch {
      await loadPost();
    }
  };

  const handleCommentReact = async (commentId: string, code: string) => {
    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return;
    const wasActive = comment.user_reaction === code;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              user_reaction: wasActive ? null : code,
              reaction_aggregates: updateAggregates(c.reaction_aggregates, c.user_reaction, wasActive ? null : code),
            }
          : c,
      ),
    );
    try {
      await toggleReaction(commentId, 'comment', code);
      await loadComments();
    } catch {
      await loadComments();
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

  const insertSmilieAtCursor = (code: string) => {
    const textarea = replyTextareaRef.current;
    if (!textarea) {
      setCommentBody((prev) => `${prev}:${code}: `);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = `${commentBody.slice(0, start)}:${code}: ${commentBody.slice(end)}`;
    setCommentBody(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + code.length + 3;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  if (loading) {
    return (
      <PageShell width="lg" header={<CommunityHeroHeader title="Loading..." accent="#3b82f6" back="/community" />}>
        <LoadingState label="Loading post..." />
      </PageShell>
    );
  }

  if (!post) {
    return (
      <PageShell width="lg" header={<CommunityHeroHeader title="Post not found" accent="#3b82f6" back="/community" />}>
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
  const accentSoft = `${boardColor}1a`;

  return (
    <PageShell
      width="lg"
      header={
        <CommunityHeroHeader
          title={post.title}
          subtitle={boardName || undefined}
          accent={boardColor}
          icon={MessageCircle}
          back={boardId ? `/community/board/${boardId}` : '/community'}
          backLabel={boardName || 'Board'}
          meta={
            <div className="flex items-center gap-1.5 text-[11px] text-white/25">
              <Info className="w-3 h-3" />
              <span>Some content may be AI-generated.</span>
            </div>
          }
        />
      }
    >
      <div className="flex flex-col gap-5 pb-8">
        {/* Board context pill */}
        {boardName && (
          <button
            onClick={() => navigate(boardId ? `/community/board/${boardId}` : '/community')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors self-start"
          >
            <span
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ background: accentSoft }}
            >
              <MessageCircle className="w-3 h-3" style={{ color: boardColor }} />
            </span>
            <span>{boardName}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}

        {/* Original post -- forum style with left author sidebar */}
        <div className="flex gap-4">
          {/* Author sidebar */}
          <div className="w-32 flex-shrink-0 flex flex-col items-center gap-2 pt-4">
            <div
              className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-400/60 to-violet-400/60 flex items-center justify-center text-sm font-bold text-white ring-2 ring-white/10"
            >
              {postInitials}
            </div>
            <span className="text-xs font-semibold text-white/85 text-center break-all leading-tight">
              {post.author_name}
            </span>
            <span className="text-[10px] text-white/30 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo(post.created_at)}
            </span>
            {post.is_pinned && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400/80 mt-0.5">
                <Pin className="w-3 h-3" fill="currentColor" />
                Pinned
              </span>
            )}
          </div>

          {/* Post body */}
          <div
            className="flex-1 min-w-0 rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden"
            style={{ borderTopColor: `${boardColor}40` }}
          >
            <div className="p-5">
              <h1 className="text-lg font-bold text-white leading-tight">{post.title}</h1>
              <div className="text-sm text-white/75 mt-3 leading-relaxed whitespace-pre-wrap">
                <SmilieText text={post.body} />
              </div>
            </div>

            {/* Reaction bar */}
            <div className="flex items-center flex-wrap gap-2 px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
              <SmilieReactionPicker onReact={handlePostReact} />
              <ReactionRow
                aggregates={post.reaction_aggregates ?? []}
                userReaction={post.user_reaction ?? null}
                onReact={handlePostReact}
              />
              <div className="flex-1" />
              <span className="flex items-center gap-1 text-xs text-white/30">
                <MessageCircle className="w-3.5 h-3.5" />
                {post.comment_count}
              </span>
            </div>
          </div>
        </div>

        {/* Comments header */}
        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-white/40" />
            <h2 className="text-sm font-bold text-white/60">
              {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
            </h2>
          </div>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        {/* Comment list */}
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
                  <div className="w-32 flex-shrink-0 flex flex-col items-center gap-1.5 pt-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400/50 to-emerald-400/50 flex items-center justify-center text-xs font-bold text-white">
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
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4">
                      <div className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                        <SmilieText text={comment.body} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <SmilieReactionPicker
                        onReact={(code) => handleCommentReact(comment.id, code)}
                      />
                      <ReactionRow
                        aggregates={comment.reaction_aggregates ?? []}
                        userReaction={comment.user_reaction ?? null}
                        onReact={(code) => handleCommentReact(comment.id, code)}
                      />
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-[10px] text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-auto"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {comments.length === 0 && (
            <div className="text-center py-8 rounded-xl border border-dashed border-white/8">
              <p className="text-sm text-white/30">No replies yet. Be the first to respond.</p>
            </div>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Reply input */}
        {!post.is_locked && (
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-[var(--ds-surface-2)]/80 backdrop-blur-md border-t border-white/8">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] focus-within:border-white/15 transition-colors">
              <Textarea
                placeholder="Write a reply..."
                rows={2}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="min-h-[44px] max-h-32 border-0 bg-transparent focus:ring-0 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSubmitComment();
                  }
                }}
              />
              <div className="flex items-center justify-between px-3 pb-2.5">
                <div className="flex items-center gap-1">
                  <SmiliePicker onInsert={insertSmilieAtCursor} />
                  <span className="text-[10px] text-white/25">
                    Cmd+Enter to send
                  </span>
                </div>
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

function updateAggregates(
  aggregates: SmilieReactionAggregate[] | undefined,
  oldReaction: string | null,
  newReaction: string | null,
): SmilieReactionAggregate[] {
  const map = new Map<string, number>();
  for (const a of aggregates ?? []) {
    map.set(a.reaction_type, a.count);
  }
  if (oldReaction) {
    const c = map.get(oldReaction);
    if (c !== undefined) {
      if (c <= 1) map.delete(oldReaction);
      else map.set(oldReaction, c - 1);
    }
  }
  if (newReaction) {
    map.set(newReaction, (map.get(newReaction) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([reaction_type, count]) => ({ reaction_type, count }));
}
