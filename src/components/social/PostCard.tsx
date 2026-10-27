import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Layers, Target, Trophy, Flame, Heart, MessageCircle, MessageSquare,
  Loader2, Send, Trash2,
} from 'lucide-react';
import { PublicProfileImage } from '../PublicProfileImage';
import { Avatar } from '../Avatar';
import { migrateAvatarConfig } from '../../utils/avatarConfig';
import type { AvatarConfigV2 } from '../../types/avatar-v2';
import { timeAgo } from '../../utils/timeAgo';
import { ProgressPostWithAuthor, POST_TYPE_LABELS, deletePost } from '../../services/progressFeedService';
import {
  toggleLike,
  getComments,
  addComment,
  deleteComment,
  PostComment,
} from '../../services/postInteractionService';
import { AuthoredBadge } from './AuthoredBadge';

const POST_ICONS: Record<string, React.ElementType> = {
  check: Check,
  layers: Layers,
  target: Target,
  trophy: Trophy,
  flame: Flame,
  message: MessageSquare,
};

function CommentItem({ comment, currentUserId, onDelete }: {
  comment: PostComment;
  currentUserId: string | null;
  onDelete: (id: string) => void;
}) {
  const avatarConfig = comment.author_avatar_config ? migrateAvatarConfig(comment.author_avatar_config) : null;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
        {avatarConfig ? (
          <Avatar config={avatarConfig as AvatarConfigV2} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/30">
            {(comment.author_name ?? 'M').slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white">{comment.author_name}</span>
          {comment.is_bot && (
            <AuthoredBadge size="xs" />
          )}
          <span className="text-[10px] text-white/25">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-xs text-white/60 leading-relaxed mt-0.5 break-words">{comment.body}</p>
      </div>
      {currentUserId === comment.user_id && !comment.is_bot && (
        <button
          onClick={() => onDelete(comment.id)}
          aria-label="Delete comment"
          className="p-1 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/**
 * One post in a feed: a member's status or an automatic progress post, with
 * likes and comments. The parent owns like state so counts stay right when the
 * same post is liked, reloaded, or shown twice.
 */
export function PostCard({ post, index, liked, currentUserId, onLikeChange, onDeleted }: {
  post: ProgressPostWithAuthor;
  index: number;
  liked: boolean;
  currentUserId: string | null;
  onLikeChange: (postId: string, liked: boolean) => void;
  onDeleted?: (postId: string) => void;
}) {
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);

  const isStatus = post.post_type === 'status';
  const isOwn = currentUserId === post.user_id;
  const meta = POST_TYPE_LABELS[post.post_type] ?? { label: post.post_type, icon: 'check', color: '#94a3b8' };
  const Icon = POST_ICONS[meta.icon] ?? Check;
  const postProfile = {
    avatar_config: post.author_avatar_config,
    profile_image_type: (post.author_profile_image_type ?? 'avatar') as 'avatar' | 'smilie',
    profile_smilie_code: post.author_profile_smilie_code ?? null,
  };

  const handleToggleLike = async () => {
    if (liking) return;
    setLiking(true);
    onLikeChange(post.id, !liked);
    const nowLiked = await toggleLike(post.id);
    if (nowLiked === liked) onLikeChange(post.id, liked); // server disagreed; put it back
    setLiking(false);
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    const data = await getComments(post.id);
    setComments(data);
    setCommentCount(data.length);
    setCommentsLoading(false);
  };

  const handleToggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    const newComment = await addComment(post.id, commentText);
    if (newComment) {
      // Reload to get enriched author info
      await loadComments();
      setCommentText('');
    }
    setSubmitting(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    setCommentCount(n => Math.max(0, n - 1));
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Delete this post?')) return;
    if (await deletePost(post.id)) onDeleted?.(post.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/12 transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => navigate(`/member/${post.user_id}`)}
          className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 hover:border-white/20 transition-colors"
        >
          <PublicProfileImage profile={postProfile} className="h-full w-full" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/member/${post.user_id}`)}
              className="text-sm font-semibold text-white truncate hover:text-pink-300 transition-colors"
            >
              {post.author_name}
            </button>
            {post.author_is_bot && (
              <AuthoredBadge size="sm" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="flex items-center gap-1 text-xs" style={{ color: meta.color }}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>
            <span className="text-xs text-white/30">{timeAgo(post.created_at)}</span>
          </div>
        </div>
        {isOwn && isStatus && onDeleted && (
          <button
            onClick={handleDeletePost}
            aria-label="Delete post"
            className="p-1.5 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        {isStatus ? (
          <p className="text-[15px] text-white/85 leading-relaxed whitespace-pre-wrap break-words">{post.body}</p>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-white mb-1">{post.title}</h3>
            {post.body && (
              <p className="text-sm text-white/50 leading-relaxed line-clamp-3">{post.body}</p>
            )}
          </>
        )}
      </div>

      {/* Engagement bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.06]">
        <button
          onClick={handleToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            liked ? 'text-pink-400' : 'text-white/40 hover:text-pink-300'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
          <span className="tabular-nums">{post.like_count}</span>
        </button>
        <button
          onClick={handleToggleComments}
          aria-expanded={showComments}
          aria-label="Comments"
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-sky-300 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="tabular-nums">{commentCount}</span>
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 border-t border-white/[0.06]">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-3">
                  {isStatus ? 'No comments yet. Say something!' : 'No comments yet. Be the first to encourage them!'}
                </p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {comments.map(c => (
                    <CommentItem key={c.id} comment={c} currentUserId={currentUserId} onDelete={handleDeleteComment} />
                  ))}
                </div>
              )}

              {/* Comment input */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(); }}
                  maxLength={500}
                  placeholder="Write a comment..."
                  aria-label="Write a comment"
                  className="flex-1 rounded-lg px-3 py-2 text-xs bg-white/5 border border-white/10 text-white outline-none focus:border-sky-400/30"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
                  aria-label="Send comment"
                  className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/20 text-sky-300 hover:bg-sky-500/25 transition-colors disabled:opacity-30"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
