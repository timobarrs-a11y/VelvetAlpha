import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, HandHeart, UserRound, MessageCircle, Pin, Trash2, Flag } from 'lucide-react';
import type { PostWithAuthor, ReactionType } from '../../types/community';
import { Card } from '../../shared/ui/Card';
import { Button } from '../../shared/ui/Button';
import { ModalShell } from '../../shared/ui/ModalShell';
import { Input, Textarea } from '../../shared/ui';
import { toast } from '../../shared/ui';
import { toggleReaction, reportContent } from '../../services/communityService';

const REACTIONS: { type: ReactionType; label: string; icon: typeof Heart; color: string }[] = [
  { type: 'like', label: 'Like', icon: Heart, color: 'text-rose-400' },
  { type: 'support', label: 'Support', icon: HandHeart, color: 'text-emerald-400' },
  { type: 'relate', label: 'Relate', icon: UserRound, color: 'text-sky-400' },
];

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

interface ReactionBarProps {
  postId: string;
  reactionCount: number;
  userReaction: ReactionType | null;
  commentCount: number;
  onCommentClick?: () => void;
  onReactionToggled?: () => void;
}

export function ReactionBar({
  postId,
  reactionCount,
  userReaction,
  commentCount,
  onCommentClick,
  onReactionToggled,
}: ReactionBarProps) {
  const [optimistic, setOptimistic] = useState<ReactionType | null>(userReaction);
  const [optimisticCount, setOptimisticCount] = useState(reactionCount);

  const handleReact = async (type: ReactionType) => {
    const wasActive = optimistic === type;
    setOptimistic(wasActive ? null : type);
    setOptimisticCount((c) => c + (wasActive ? -1 : 1));
    try {
      await toggleReaction(postId, 'post', type);
      onReactionToggled?.();
    } catch {
      setOptimistic(userReaction);
      setOptimisticCount(reactionCount);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-3">
      {REACTIONS.map(({ type, label, icon: Icon, color }) => {
        const active = optimistic === type;
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
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
      <span className="text-xs text-white/30 ml-1 tabular-nums">{optimisticCount}</span>
      <div className="flex-1" />
      {onCommentClick && (
        <button
          onClick={onCommentClick}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="tabular-nums">{commentCount}</span>
        </button>
      )}
    </div>
  );
}

interface PostCardProps {
  post: PostWithAuthor;
  onClick?: () => void;
  onReactionToggled?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

export function PostCard({ post, onClick, onReactionToggled, onDelete, canDelete }: PostCardProps) {
  const [showReport, setShowReport] = useState(false);

  const initials = post.author_name.slice(0, 2).toUpperCase();

  return (
    <>
      <Card padding="md" className="group cursor-pointer" interactive onClick={onClick}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400/60 to-violet-400/60 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/90 truncate">{post.author_name}</span>
              <span className="text-xs text-white/30">{timeAgo(post.created_at)}</span>
              {post.is_pinned && (
                <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />
              )}
            </div>
            <h3 className="text-[15px] font-bold text-white mt-1 leading-snug">{post.title}</h3>
            <p className="text-sm text-white/60 mt-1 line-clamp-3 leading-relaxed">{post.body}</p>
            <ReactionBar
              postId={post.id}
              reactionCount={post.reaction_count}
              userReaction={post.user_reaction}
              commentCount={post.comment_count}
              onCommentClick={onClick}
              onReactionToggled={onReactionToggled}
            />
          </div>
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canDelete && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                aria-label="Delete post"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReport(true);
              }}
              className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-white/5 transition-colors"
              aria-label="Report post"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Card>

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetId={post.id}
        targetType="post"
      />
    </>
  );
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'post' | 'comment' | 'board';
}

export function ReportModal({ isOpen, onClose, targetId, targetType }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    const ok = await reportContent({ target_type: targetType, target_id: targetId, reason: reason.trim() });
    setSubmitting(false);
    if (ok) {
      toast.success('Report submitted. Thank you.');
      setReason('');
      onClose();
    } else {
      toast.error('Could not submit report. Try again.');
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Report content"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="danger" size="sm" isLoading={submitting} onClick={handleSubmit} disabled={!reason.trim()}>
            Submit report
          </Button>
        </div>
      }
    >
      <Textarea
        label="Why are you reporting this?"
        placeholder="Describe the issue..."
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </ModalShell>
  );
}

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  onCreated: () => void;
}

export function CreatePostModal({ isOpen, onClose, boardId, onCreated }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    const { createPost } = await import('../../services/communityService');
    const post = await createPost({ board_id: boardId, title: title.trim(), body: body.trim() });
    setSubmitting(false);
    if (post) {
      toast.success('Post published!');
      setTitle('');
      setBody('');
      onCreated();
      onClose();
    } else {
      toast.error('Could not create post. Try again.');
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="New post"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" isLoading={submitting} onClick={handleSubmit} disabled={!title.trim() || !body.trim()}>
            Publish
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Title"
          placeholder="Give your post a title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          label="Body"
          placeholder="Share your thoughts..."
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5000}
        />
      </div>
    </ModalShell>
  );
}

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
}

const BOARD_COLORS = [
  { name: 'blue', hex: '#3b82f6' },
  { name: 'rose', hex: '#f43f5e' },
  { name: 'emerald', hex: '#10b981' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'violet', hex: '#8b5cf6' },
  { name: 'slate', hex: '#64748b' },
  { name: 'teal', hex: '#14b8a6' },
  { name: 'pink', hex: '#ec4899' },
];

export function CreateBoardModal({ isOpen, onClose, onCreated }: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('blue');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const { createBoard } = await import('../../services/communityService');
    const board = await createBoard({
      name: name.trim(),
      description: description.trim(),
      color,
      icon: 'MessageSquare',
    });
    setSubmitting(false);
    if (board) {
      toast.success('Board created!');
      setName('');
      setDescription('');
      setColor('blue');
      onCreated(board.id);
      onClose();
    } else {
      toast.error('Could not create board. Try again.');
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Create a board"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" isLoading={submitting} onClick={handleSubmit} disabled={!name.trim()}>
            Create board
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Board name"
          placeholder="e.g. Late Night Thoughts"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <Textarea
          label="Description"
          placeholder="What is this board about?"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
        />
        <div>
          <label className="label-base mb-2 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c.name)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c.name ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110' : 'opacity-50 hover:opacity-100'
                }`}
                style={{ background: c.hex }}
                aria-label={c.name}
              />
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
