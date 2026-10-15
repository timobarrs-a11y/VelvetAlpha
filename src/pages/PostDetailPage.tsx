import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Info, Pin, Trash2 } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { PageHeader } from '../shared/ui/PageHeader';
import { Button } from '../shared/ui/Button';
import { Textarea } from '../shared/ui';
import { LoadingState } from '../shared/ui/LoadingState';
import { toast } from '../shared/ui';
import { ReactionBar, ReportModal } from '../components/community/CommunityComponents';
import { fetchPost, fetchComments, createComment, deleteComment, deletePost } from '../services/communityService';
import type { PostWithAuthor, CommentWithAuthor } from '../types/community';

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
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    const p = await fetchPost(postId);
    setPost(p);
    if (p) {
      setBoardId(p.board_id);
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

  const initials = post.author_name.slice(0, 2).toUpperCase();

  return (
    <PageShell
      width="md"
      header={
        <PageHeader
          title="Post"
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
        {/* Post body */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-base p-6 rounded-2xl"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400/60 to-violet-400/60 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white/90">{post.author_name}</span>
                <span className="text-xs text-white/30">{timeAgo(post.created_at)}</span>
                {post.is_pinned && (
                  <Pin className="w-3 h-3 text-amber-400" fill="currentColor" />
                )}
              </div>
              <h1 className="text-lg font-bold text-white mt-2 leading-tight">{post.title}</h1>
              <p className="text-sm text-white/70 mt-2 leading-relaxed whitespace-pre-wrap">{post.body}</p>
              <ReactionBar
                postId={post.id}
                reactionCount={post.reaction_count}
                userReaction={post.user_reaction}
                commentCount={post.comment_count}
                onReactionToggled={loadPost}
              />
            </div>
          </div>
          <div className="flex justify-end gap-1 mt-3">
            <button
              onClick={() => setShowReport(true)}
              className="text-xs text-white/30 hover:text-amber-400 transition-colors"
            >
              Report
            </button>
          </div>
        </motion.div>

        {/* Comments section */}
        <div className="flex items-center gap-2 px-1">
          <MessageCircle className="w-4 h-4 text-white/40" />
          <h2 className="text-sm font-semibold text-white/60">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </h2>
        </div>

        {/* Comment list */}
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card-base p-4 rounded-xl"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-400/50 to-emerald-400/50 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {comment.author_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/90">{comment.author_name}</span>
                      <span className="text-xs text-white/30">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-white/70 mt-1 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {comments.length === 0 && (
            <p className="text-sm text-white/30 text-center py-6">
              No comments yet. Be the first to reply.
            </p>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment input */}
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
