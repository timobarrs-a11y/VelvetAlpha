import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { createStatus, STATUS_MAX_LENGTH } from '../../services/progressFeedService';
import { toast } from '../../shared/ui/Toast';

/** "What's on your mind?" box. Calls `onPosted` after a status is saved. */
export function StatusComposer({ onPosted, placeholder = "What's on your mind?" }: {
  onPosted: () => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const trimmed = text.trim();
  const left = STATUS_MAX_LENGTH - text.length;

  const submit = async () => {
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await createStatus(trimmed);
      setText('');
      onPosted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post that. Try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 focus-within:border-sky-400/30 transition-colors">
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, STATUS_MAX_LENGTH))}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
        rows={2}
        maxLength={STATUS_MAX_LENGTH}
        placeholder={placeholder}
        aria-label="Write a status"
        className="w-full resize-none bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none leading-relaxed"
      />
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
        <span className={`text-[11px] tabular-nums ${left < 40 ? 'text-amber-300' : 'text-white/25'}`}>
          {text.length > 0 ? `${left} left` : 'Friends can like and comment'}
        </span>
        <button
          onClick={submit}
          disabled={!trimmed || posting}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-sky-500/80 hover:bg-sky-500 transition-colors disabled:opacity-30 disabled:hover:bg-sky-500/80"
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Post
        </button>
      </div>
    </div>
  );
}
