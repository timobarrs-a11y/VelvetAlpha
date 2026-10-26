import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Globe } from 'lucide-react';
import { Button } from '../shared/ui';
import { AppNavRadial } from './AppNavRadial';
import { LanguageInputToolbar } from './LanguageInputToolbar';
import { getDraft, setDraft, clearDraft } from '../utils/draftCache';
import { HelperSearchSheet } from '../features/search/HelperSearchSheet';
import type { HelperSearchRequest } from '../features/search/searchTopics';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  characterName: string;
  companionId?: string;
  lastMessageText?: string;
  showNavRadial?: boolean;
  draftScope?: string;
  showLanguageToolbar?: boolean;
  /** Coaches and assistants: a search button that asks what the search is for. */
  helperSearch?: { userId: string; onSearch: (req: HelperSearchRequest) => void };
}

const MAX_TEXTAREA_HEIGHT = 120;

export const ChatInput = ({ onSend, disabled, characterName, companionId, lastMessageText, showNavRadial = true, draftScope, showLanguageToolbar = false, helperSearch }: ChatInputProps) => {
  const draftKey = draftScope ?? companionId ?? '';
  const [input, setInput] = useState(() => (draftKey ? getDraft(draftKey) : ''));
  const [isFocused, setIsFocused] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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

  const insertChar = useCallback((char: string) => {
    const el = textareaRef.current;
    if (!el) {
      setInput(prev => prev + char);
      return;
    }
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const next = input.slice(0, start) + char + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + char.length;
      el.setSelectionRange(pos, pos);
    });
  }, [input]);

  return (
    <form onSubmit={handleSubmit} className="m-0 flex gap-1.5 sm:gap-2 items-end flex-1">
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

      {helperSearch && companionId && (
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          disabled={disabled}
          aria-label={`Search the web with ${characterName}`}
          title="Search the web"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-black/8 bg-white/85 text-gray-500 hover:text-rose-500 disabled:opacity-40"
        >
          <Globe className="h-[18px] w-[18px]" />
        </button>
      )}
      {searchOpen && helperSearch && companionId && (
        <HelperSearchSheet
          userId={helperSearch.userId}
          companionId={companionId}
          helperName={characterName}
          onSearch={helperSearch.onSearch}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div className="flex-1 relative">
        {showLanguageToolbar && companionId && (
          <LanguageInputToolbar companionId={companionId} onInsert={insertChar} />
        )}
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
          className={`block w-full min-h-[40px] px-4 sm:px-5 py-2 leading-6 rounded-xl border transition-all duration-200 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none overflow-y-auto scrollbar-hide ${
            isFocused
              ? 'border-rose-300 bg-white shadow-lg shadow-rose-100/40 ring-2 ring-rose-50'
              : 'border-black/8 bg-white/85 hover:border-black/12 shadow-sm'
          } disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:border-black/8`}
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
        />
      </div>

      <Button
        type="submit"
        disabled={disabled || !input.trim()}
        size="md"
        className="!p-0 !h-10 !w-10 !rounded-xl flex-shrink-0 flex items-center justify-center"
      >
        <Send className="w-[18px] h-[18px]" />
      </Button>
    </form>
  );
};
