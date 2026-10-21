import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, AtSign } from 'lucide-react';
import type { SpaceMember } from '../../types/spaces';

interface Props {
  onSend: (body: string, replyToId?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  replyTo?: { id: string; authorName: string } | null;
  onCancelReply?: () => void;
  members?: SpaceMember[];
}

export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = 'Send a message...',
  maxLength = 2000,
  replyTo,
  onCancelReply,
  members = [],
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const filteredMembers = members.filter(m =>
    !mentionQuery || m.display_name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 8);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, maxLength);
    setText(val);

    const cursorPos = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch && members.length > 0) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
      mentionStartRef.current = cursorPos - atMatch[0].length;
    } else {
      setShowMentions(false);
      mentionStartRef.current = -1;
    }
  };

  const insertMention = useCallback((member: SpaceMember) => {
    const cursorPos = textareaRef.current?.selectionStart ?? text.length;
    const start = mentionStartRef.current >= 0 ? mentionStartRef.current : cursorPos;
    const token = `<@${member.user_id}>`;
    const newText = text.slice(0, start) + token + ' ' + text.slice(cursorPos);
    setText(newText);
    setShowMentions(false);
    mentionStartRef.current = -1;
    requestAnimationFrame(() => {
      const pos = start + token.length + 1;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }, [text]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

  const remaining = maxLength - text.length;
  const showCounter = remaining < 200;

  return (
    <div className="flex-shrink-0 px-3 py-3 border-t border-white/8 relative">
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
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowMentions(false), 150)}
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

      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-white/10 bg-[var(--ds-surface-2)] shadow-2xl overflow-hidden z-20 max-h-48 overflow-y-auto">
          {filteredMembers.map((m, i) => (
            <button
              key={m.user_id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
              className={`w-full flex items-center gap-2 px-3 py-2 transition-colors text-left ${
                i === mentionIndex ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <AtSign className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" />
              <span className="text-sm text-ink">{m.display_name}</span>
              {m.tags[0] && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${m.tags[0].color}20`, color: m.tags[0].color }}
                >
                  {m.tags[0].name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {showCounter && (
        <p className={`text-[10px] mt-1 text-right ${remaining < 50 ? 'text-rose-400' : 'text-ink-muted'}`}>
          {remaining} characters left
        </p>
      )}
    </div>
  );
}
