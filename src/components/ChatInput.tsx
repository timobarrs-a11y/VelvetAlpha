import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../shared/ui';
import { AppNavRadial } from './AppNavRadial';
import { getDraft, setDraft, clearDraft } from '../utils/draftCache';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  characterName: string;
  companionId?: string;
  lastMessageText?: string;
  showNavRadial?: boolean;
  draftScope?: string;
}

const MAX_TEXTAREA_HEIGHT = 120;

export const ChatInput = ({ onSend, disabled, characterName, companionId, lastMessageText, showNavRadial = true, draftScope }: ChatInputProps) => {
  const draftKey = draftScope ?? companionId ?? '';
  const [input, setInput] = useState(() => (draftKey ? getDraft(draftKey) : ''));
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + 'px';
  };

  useEffect(() => { resize(); }, [input]);

  useEffect(() => {
    if (!draftKey) return;
    setDraft(draftKey, input);
  }, [draftKey, input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
      if (draftKey) clearDraft(draftKey);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !disabled) {
        onSend(input.trim());
        setInput('');
        if (draftKey) clearDraft(draftKey);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 items-end flex-1">
      {showNavRadial && (
        <div className="flex-shrink-0 pb-1">
          <AppNavRadial
            companionId={companionId}
            currentApp="chat"
            seedText={lastMessageText}
            theme="light"
          />
        </div>
      )}

      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            disabled ? 'Upgrade to continue chatting' : `Message ${characterName}...`
          }
          disabled={disabled}
          rows={1}
          className={`w-full px-4 sm:px-5 py-2.5 rounded-2xl border-2 transition-all duration-200 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none overflow-y-auto ${
            isFocused
              ? 'border-rose-400 bg-white shadow-lg shadow-rose-100/50 ring-4 ring-rose-50'
              : 'border-gray-200 bg-white/90 hover:border-gray-300 shadow-sm'
          } disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:border-gray-200`}
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
      </div>

      <Button
        type="submit"
        disabled={disabled || !input.trim()}
        size="md"
        className="!p-2.5 !rounded-2xl flex-shrink-0"
      >
        <Send className="w-5 h-5" />
      </Button>
    </form>
  );
};
