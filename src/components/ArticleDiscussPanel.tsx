import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, Loader2, ClipboardPaste, AlertCircle } from 'lucide-react';
import { Avatar } from './Avatar';
import { companionAvatarConfig } from './lobby/lobbyUtils';
import { newsService, type ArticleConversationTurn } from '../services/newsService';
import type { CompanionWithLastMessage } from '../services/companionService';

const MAX_CHARS = 8000;

interface ArticleDiscussPanelProps {
  open: boolean;
  articleId: string | null;
  companion: CompanionWithLastMessage | null;
  articleTitle?: string;
  onClose: () => void;
}

export function ArticleDiscussPanel({ open, articleId, companion, articleTitle, onClose }: ArticleDiscussPanelProps) {
  const [turns, setTurns] = useState<ArticleConversationTurn[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTurns, setLoadingTurns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !articleId || !companion) {
      setTurns([]);
      setPasteText('');
      setError(null);
      return;
    }
    setLoadingTurns(true);
    newsService.getArticleConversationForCompanion(articleId, companion.id).then(result => {
      setTurns(result);
      setLoadingTurns(false);
    });
  }, [open, articleId, companion]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  if (!open || !companion) return null;

  const charCount = pasteText.length;
  const overLimit = charCount > MAX_CHARS;
  const canSubmit = pasteText.trim().length > 0 && !overLimit && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !articleId || !companion) return;
    setLoading(true);
    setError(null);
    setTruncated(false);

    const textToSave = pasteText.trim();
    setPasteText('');

    const userTurn = await newsService.saveArticleConversationTurn(articleId, companion.id, 'user', textToSave);
    if (userTurn) {
      setTurns(prev => [...prev, userTurn]);
    }

    const priorTurns = turns.map(t => ({ role: t.role, content: t.content }));

    const result = await newsService.callArticleDiscuss(articleId, companion.id, textToSave, priorTurns);

    if (!result) {
      setError('Could not get a response. Please try again.');
      setLoading(false);
      return;
    }

    setTruncated(result.truncated);

    const assistantTurn = await newsService.saveArticleConversationTurn(articleId, companion.id, 'assistant', result.reply);
    if (assistantTurn) {
      setTurns(prev => [...prev, assistantTurn]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/15 shadow-2xl"
          style={{ background: 'rgba(15, 15, 28, 0.97)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10 flex-shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
              <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate" style={{ fontFamily: companion.font_family ?? undefined }}>
                {companion.custom_name}
              </p>
              <p className="text-xs text-white/40 truncate">
                Discussing: {articleTitle ?? 'this article'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Message thread */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
            {loadingTurns ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
              </div>
            ) : turns.length === 0 && !loading ? (
              <div className="text-center py-8 px-4">
                <ClipboardPaste className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40 leading-relaxed">
                  Paste the article text below and {companion.custom_name} will discuss it with you.
                </p>
                <p className="text-xs text-white/25 mt-2">
                  The conversation stays here, scoped to this article. It won't affect your companion's long-term memory.
                </p>
              </div>
            ) : (
              <>
                {turns.map((turn) => (
                  <MessageBubble key={turn.id} turn={turn} companion={companion} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-white/40 text-xs">
                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                      <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                {truncated && (
                  <div className="flex items-center gap-2 text-amber-400/70 text-xs px-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    The article was long — {companion.custom_name} responded to the first part that was pasted.
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-red-400/80 text-xs px-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Paste area */}
          <div className="border-t border-white/10 p-3 flex-shrink-0">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste the article text here..."
              rows={3}
              className="w-full text-sm text-white/90 placeholder-white/25 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:border-white/25 transition-colors"
              style={{ fontFamily: undefined }}
              disabled={loading}
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${overLimit ? 'text-red-400' : 'text-white/30'}`}>
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  canSubmit
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Discuss
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function MessageBubble({ turn, companion }: { turn: ArticleConversationTurn; companion: CompanionWithLastMessage }) {
  const isUser = turn.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-full h-full rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            You
          </div>
        ) : (
          <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-sky-500/20 border border-sky-400/20 text-white/90 rounded-br-sm'
            : 'bg-white/8 border border-white/10 text-white/85 rounded-bl-sm'
        }`}
        style={!isUser ? { fontFamily: companion.font_family ?? undefined } : undefined}
      >
        {turn.content}
      </div>
    </motion.div>
  );
}
