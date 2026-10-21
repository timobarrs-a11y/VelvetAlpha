import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSend: (body: string, replyToId?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  replyTo?: { id: string; authorName: string } | null;
  onCancelReply?: () => void;
}

export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Send a message...',
  maxLength = 2000,
  replyTo,
  onCancelReply,
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    try {
      await onSend(trimmed, replyTo?.id);
      setText('');
      onCancelReply?.();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remaining = maxLength - text.length;
  const showCounter = remaining < 200;

  return (
    <div className="flex-shrink-0 px-3 py-3 border-t border-white/8">
      {replyTo && (
        <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-white/5">
          <span className="text-xs text-ink-muted">
            Replying to <span className="text-ink font-medium">{replyTo.authorName}</span>
          </span>
          <button
            onClick={onCancelReply}
            className="text-xs text-ink-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value.slice(0, maxLength))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || sending}
          className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors resize-none disabled:opacity-50"
          style={{ minHeight: 40, maxHeight: 120 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {showCounter && (
        <p className={`text-[10px] mt-1 text-right ${remaining < 50 ? 'text-rose-400' : 'text-ink-muted'}`}>
          {remaining} characters left
        </p>
      )}
    </div>
  );
}
