import { useState, useRef } from 'react';
import { ModalShell } from '../../shared/ui/ModalShell';
import { Input, Textarea } from '../../shared/ui';
import { Button } from '../../shared/ui/Button';
import { toast } from '../../shared/ui';
import { reportContent } from '../../services/communityService';
import { SmiliePicker } from './SmiliePicker';
import { PollCreator } from './PollCreator';
import { SMILIES, smilieUrl } from '../../config/smilieRegistry';

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
  const [postSmilie, setPostSmilie] = useState<string | null>(null);
  const [showSmilieGrid, setShowSmilieGrid] = useState(false);
  const [smilieFilter, setSmilieFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pollData, setPollData] = useState<{ question: string; options: string[] } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertSmilieAtCursor = (code: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setBody((prev) => `${prev}:${code}: `);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = `${body.slice(0, start)}:${code}: ${body.slice(end)}`;
    setBody(newText);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + code.length + 3;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    const { createPost } = await import('../../services/communityService');
    const post = await createPost({ board_id: boardId, title: title.trim(), body: body.trim(), post_smilie: postSmilie });
    setSubmitting(false);
    if (post) {
      if (pollData && pollData.options.length >= 2) {
        const { createPoll } = await import('../../services/communityService');
        await createPoll({ post_id: post.id, question: pollData.question, options: pollData.options });
      }
      toast.success('Post published!');
      setTitle('');
      setBody('');
      setPostSmilie(null);
      setPollData(null);
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
        {/* Post smilie / mood selector */}
        <div>
          <label className="label-base mb-1.5 block">Post mood (optional)</label>
          <div className="flex items-center gap-2">
            {postSmilie && (
              <div className="relative flex-shrink-0">
                <img
                  src={smilieUrl(postSmilie) ?? undefined}
                  alt={`:${postSmilie}:`}
                  style={{ height: 28, width: 'auto' }}
                  className="rounded"
                />
                <button
                  type="button"
                  onClick={() => setPostSmilie(null)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 text-[10px]"
                >
                  x
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSmilieGrid((v) => !v)}
              className="text-xs text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15 transition-colors"
            >
              {postSmilie ? 'Change mood' : 'Pick a mood smilie'}
            </button>
          </div>
          {showSmilieGrid && (
            <div className="mt-2 rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="px-3 py-2 border-b border-white/8">
                <input
                  type="text"
                  value={smilieFilter}
                  onChange={(e) => setSmilieFilter(e.target.value)}
                  placeholder="Search smilies..."
                  className="w-full bg-transparent text-sm text-white/80 placeholder-white/30 outline-none"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto p-2" style={{ maxHeight: 200 }}>
                <div className="grid grid-cols-8 gap-1">
                  {(smilieFilter.trim()
                    ? SMILIES.filter((s) => s.code.includes(smilieFilter.toLowerCase()) || s.label.toLowerCase().includes(smilieFilter.toLowerCase()))
                    : SMILIES
                  ).map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        setPostSmilie(s.code);
                        setShowSmilieGrid(false);
                        setSmilieFilter('');
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                        postSmilie === s.code ? 'bg-white/15 ring-1 ring-white/30' : 'hover:bg-white/8'
                      }`}
                      title={`:${s.code}:`}
                    >
                      <img
                        src={`/smilies/${s.file}`}
                        alt={`:${s.code}:`}
                        style={{ height: 22, width: 'auto' }}
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label-base">Body</label>
            <SmiliePicker onInsert={insertSmilieAtCursor} />
          </div>
          <textarea
            ref={bodyRef}
            className="ds-input min-h-[120px] max-h-64 resize-none w-full rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/80 placeholder-white/30 outline-none focus:border-white/15 transition-colors"
            placeholder="Share your thoughts... type :name: to insert a smilie, or paste a YouTube link to embed a video"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
          />
        </div>
        <PollCreator onPollChange={setPollData} />
      </div>
    </ModalShell>
  );
}

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
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
      toast.success(board.is_approved ? 'Board created!' : 'Board submitted for approval.');
      setName('');
      setDescription('');
      setColor('blue');
      onCreated();
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
        <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
          <p className="text-xs text-white/40 leading-relaxed">
            New boards require moderator approval before becoming visible to the community.
            You'll be able to see your board while it's pending, but no one can post in it until it's approved.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
