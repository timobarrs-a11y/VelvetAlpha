import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Layers, Target, Trophy, Flame, Heart, MessageCircle,
  Bot, Loader2, Sparkles, TrendingUp, Users, Send, Trash2,
} from 'lucide-react';
import { PublicProfileImage } from '../components/PublicProfileImage';
import { Avatar } from '../components/Avatar';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import type { AvatarConfigV2 } from '../types/avatar-v2';
import {
  getFeedPosts,
  getTrendingPosts,
  ProgressPostWithAuthor,
  POST_TYPE_LABELS,
} from '../services/progressFeedService';
import {
  toggleLike,
  getLikedPostIds,
  getComments,
  addComment,
  deleteComment,
  PostComment,
} from '../services/postInteractionService';
import { getAtlasIntroductions, AtlasIntroduction } from '../services/atlasIntroductionsService';
import { followUser } from '../services/memberProfileService';
import { supabase } from '../shared/supabase/client';
import { PageShell } from '../shared/ui/PageShell';
import { LoadingState } from '../shared/ui/LoadingState';
import { EmptyState } from '../shared/ui/EmptyState';

const POST_ICONS: Record<string, React.ElementType> = {
  check: Check,
  layers: Layers,
  target: Target,
  trophy: Trophy,
  flame: Flame,
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
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[9px] font-semibold">
              <Bot className="w-2 h-2" />
              Bot
            </span>
          )}
          <span className="text-[10px] text-white/25">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-xs text-white/60 leading-relaxed mt-0.5">{comment.body}</p>
      </div>
      {currentUserId === comment.user_id && !comment.is_bot && (
        <button
          onClick={() => onDelete(comment.id)}
          className="p-1 text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function PostCard({ post, index, liked, onToggleLike }: {
  post: ProgressPostWithAuthor;
  index: number;
  liked: boolean;
  onToggleLike: (postId: string) => void;
}) {
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const meta = POST_TYPE_LABELS[post.post_type] ?? { label: post.post_type, icon: 'check', color: '#94a3b8' };
  const Icon = POST_ICONS[meta.icon] ?? Check;
  const postProfile = {
    avatar_config: post.author_avatar_config,
    profile_image_type: (post.author_profile_image_type ?? 'avatar') as 'avatar' | 'smilie',
    profile_smilie_code: post.author_profile_smilie_code ?? null,
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const handleToggleLike = async () => {
    const result = await toggleLike(post.id);
    onToggleLike(post.id);
    void result;
  };

  const loadComments = async () => {
    setCommentsLoading(true);
    const data = await getComments(post.id);
    setComments(data);
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
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-semibold">
                <Bot className="w-2.5 h-2.5" />
                Bot
              </span>
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
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <h3 className="text-sm font-semibold text-white mb-1">{post.title}</h3>
        {post.body && (
          <p className="text-sm text-white/50 leading-relaxed line-clamp-3">{post.body}</p>
        )}
      </div>

      {/* Engagement bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.06]">
        <button
          onClick={handleToggleLike}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            liked ? 'text-pink-400' : 'text-white/40 hover:text-pink-300'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
          <span className="tabular-nums">{post.like_count + (liked ? 1 : 0)}</span>
        </button>
        <button
          onClick={handleToggleComments}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-sky-300 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="tabular-nums">{post.comment_count}</span>
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
                <p className="text-xs text-white/30 text-center py-3">No comments yet. Be the first to encourage them!</p>
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
                  className="flex-1 rounded-lg px-3 py-2 text-xs bg-white/5 border border-white/10 text-white outline-none focus:border-sky-400/30"
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
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

function IntroductionCard({ intro, onFollow }: {
  intro: AtlasIntroduction;
  onFollow: (userId: string) => void;
}) {
  const navigate = useNavigate();
  const [followed, setFollowed] = useState(false);

  const handleFollow = async () => {
    await followUser(intro.user_id);
    setFollowed(true);
    onFollow(intro.user_id);
  };

  const introProfile = {
    avatar_config: intro.avatar_config,
    profile_image_type: intro.profile_image_type as 'avatar' | 'smilie',
    profile_smilie_code: intro.profile_smilie_code,
  };

  const hasTitles = intro.shared_goal_titles && intro.shared_goal_titles.length > 0;
  const goalTypeLabels = (intro.shared_goal_types ?? []).map(t =>
    t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  );
  const connectionText = hasTitles
    ? `You're both working on ${intro.shared_goal_titles.slice(0, 2).join(' and ')}`
    : goalTypeLabels.length > 0
      ? `You're both working on a ${goalTypeLabels[0]} goal`
      : 'You share common goals';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] p-4"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
        <span className="text-xs font-semibold text-violet-300">Atlas suggests a connection</span>
      </div>
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/member/${intro.user_id}`)}
          className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 hover:border-white/20 transition-colors"
        >
          <PublicProfileImage profile={introProfile} className="h-full w-full" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(`/member/${intro.user_id}`)} className="text-sm font-semibold text-white truncate hover:text-pink-300 transition-colors">
              {intro.display_name}
            </button>
            {intro.is_bot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-semibold">
                <Bot className="w-2.5 h-2.5" />
                Bot
              </span>
            )}
          </div>
          {intro.headline && <p className="text-xs text-white/40 truncate mt-0.5">{intro.headline}</p>}
          <p className="text-xs text-violet-300/60 mt-1">{connectionText}</p>
        </div>
        <button
          onClick={handleFollow}
          disabled={followed}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
            followed ? 'bg-white/8 text-white/40' : 'bg-violet-500/80 hover:bg-violet-500 text-white'
          }`}
        >
          {followed ? 'Following' : 'Follow'}
        </button>
      </div>
    </motion.div>
  );
}

export default function ProgressFeedPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'following' | 'trending'>('following');
  const [posts, setPosts] = useState<ProgressPostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [introductions, setIntroductions] = useState<AtlasIntroduction[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = tab === 'following'
      ? await getFeedPosts(30)
      : await getTrendingPosts(30);
    setPosts(data);
    // Load like states
    if (data.length > 0) {
      const liked = await getLikedPostIds(data.map(p => p.id));
      setLikedIds(liked);
    }
    // Load Atlas introductions on the following tab
    if (tab === 'following') {
      const intros = await getAtlasIntroductions(3);
      setIntroductions(intros);
    } else {
      setIntroductions([]);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleToggleLike = (postId: string) => {
    setLikedIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  return (
    <PageShell
      width="md"
      header={
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <h1 className="text-lg font-bold text-white">Progress Feed</h1>
          </div>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/8">
        <button
          onClick={() => setTab('following')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'following' ? 'bg-pink-500/15 text-pink-300' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Following
        </button>
        <button
          onClick={() => setTab('trending')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === 'trending' ? 'bg-amber-500/15 text-amber-300' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Trending
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Atlas introductions */}
        {!loading && tab === 'following' && introductions.length > 0 && (
          <div className="space-y-2 mb-2">
            {introductions.map(intro => (
              <IntroductionCard
                key={intro.user_id}
                intro={intro}
                onFollow={() => setIntroductions(prev => prev.filter(i => i.user_id !== intro.user_id))}
              />
            ))}
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading feed..." />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-7 h-7" />}
            title={tab === 'following' ? 'No posts yet' : 'Nothing trending yet'}
            description={
              tab === 'following'
                ? 'Follow other members to see their progress here. Or check Trending for what the community is up to.'
                : 'Check back soon — posts from the community will show up here as members hit their goals.'
            }
            action={tab === 'following' ? { label: 'Discover members', onClick: () => navigate('/discover') } : undefined}
          />
        ) : (
          posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              index={i}
              liked={likedIds.has(post.id)}
              onToggleLike={handleToggleLike}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
