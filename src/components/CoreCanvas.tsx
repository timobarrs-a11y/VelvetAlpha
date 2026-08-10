import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Plus, Loader2, AlertCircle, X, Check,
  Copy, RefreshCw, Pencil, Square, Terminal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { coreService, CoreConversation, CoreMessage, CoreUsageInfo } from '../services/coreService';
import { CoreMarkdown } from './CoreMarkdown';
import { AppNavRadial } from './AppNavRadial';

interface CoreCanvasProps {
  conversationId: string;
  onNewConversation: () => void;
  onBack: () => void;
  onTitleChange?: (id: string, title: string) => void;
}

const STARTER_PROMPTS = [
  'Summarize this and pull out the action items',
  'Help me write a reply to this email',
  'Explain how this works, simply',
  'Draft an outline for what I\'m working on',
];

function CoreGlyph({ size = 'md', pulse = false }: { size?: 'sm' | 'md' | 'lg'; pulse?: boolean }) {
  const dims = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-14 h-14' : 'w-8 h-8';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className={`${dims} relative flex-shrink-0`}>
      <div className={`${dims} rounded-lg bg-slate-800/80 border border-slate-500/30 flex items-center justify-center`}>
        <Terminal className={`${icon} text-slate-300`} />
      </div>
      {pulse && (
        <motion.div
          className="absolute inset-0 rounded-lg border border-slate-400/40"
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

function CopyButton({ text, label = false }: { text: string; label?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {label && (copied ? 'Copied' : 'Copy')}
    </button>
  );
}

export function CoreCanvas({ conversationId, onNewConversation, onBack, onTitleChange }: CoreCanvasProps) {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<CoreConversation | null>(null);
  const [messages, setMessages] = useState<CoreMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [usage, setUsage] = useState<CoreUsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const partialRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText, isSending]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const loadConversation = async () => {
    try {
      setIsLoading(true);
      const [conv, msgs, usageInfo, name] = await Promise.all([
        coreService.getConversation(conversationId),
        coreService.getMessages(conversationId),
        coreService.getUsageInfo(),
        coreService.getUserName(),
      ]);
      setConversation(conv);
      setMessages(msgs);
      setUsage(usageInfo);
      setUserName(name);
    } catch {
      setError('Failed to load thread.');
    } finally {
      setIsLoading(false);
    }
  };

  const canSend = !usage || usage.isUnlimited || usage.canSend;

  const bumpUsage = () => {
    setUsage(prev => prev && !prev.isUnlimited ? {
      ...prev,
      messagesUsedToday: prev.messagesUsedToday + 1,
      canSend: prev.messagesUsedToday + 1 < prev.dailyLimit,
    } : prev);
  };

  // Core turn: stream an assistant reply for `userText`, given prior history.
  const runAssistantTurn = useCallback(async (
    userText: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ) => {
    setIsSending(true);
    setError(null);
    setStreamingText('');
    partialRef.current = '';
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reply = await coreService.sendMessage(userText, history, {
        userName: userName || undefined,
        signal: controller.signal,
        onChunk: (chunk) => {
          partialRef.current += chunk;
          setStreamingText(prev => prev + chunk);
        },
      });

      setStreamingText('');
      if (reply) {
        const saved = await coreService.insertMessage(conversationId, 'assistant', reply);
        setMessages(prev => [...prev, saved]);
        await coreService.touchConversation(conversationId);
        if (!usage?.isUnlimited) bumpUsage();
      }
    } catch (err) {
      setStreamingText('');
      if (controller.signal.aborted) {
        // Preserve whatever streamed before the user hit stop.
        const partial = partialRef.current.trim();
        if (partial) {
          const saved = await coreService.insertMessage(conversationId, 'assistant', partial);
          setMessages(prev => [...prev, saved]);
          await coreService.touchConversation(conversationId);
        }
      } else if (err instanceof Error && err.message === 'LIMIT_REACHED') {
        setUsage(prev => prev ? { ...prev, canSend: false } : prev);
        setError('Daily free limit reached.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to send message.');
      }
    } finally {
      setIsSending(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [conversationId, userName, usage]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (!canSend) { navigate('/pricing?returnTo=/core'); return; }

    setInput('');
    const wasEmpty = messages.length === 0;
    const history = messages.map(m => ({ role: m.role, content: m.content }));

    // Optimistic user message, then persist it.
    const optimistic: CoreMessage = {
      id: `temp-${Date.now()}`, conversation_id: conversationId, user_id: '',
      role: 'user', content: text, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const savedUser = await coreService.insertMessage(conversationId, 'user', text);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? savedUser : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setError('Failed to send message.');
      return;
    }

    if (wasEmpty) {
      const autoTitle = text.length > 48 ? text.slice(0, 45) + '…' : text;
      coreService.updateConversationTitle(conversationId, autoTitle).catch(() => {});
      setConversation(prev => prev ? { ...prev, title: autoTitle } : prev);
      onTitleChange?.(conversationId, autoTitle);
    }

    await runAssistantTurn(text, history);
  }, [input, isSending, canSend, messages, conversationId, navigate, runAssistantTurn, onTitleChange]);

  const handleStop = () => { abortRef.current?.abort(); };

  const handleRegenerate = useCallback(async () => {
    if (isSending) return;
    const lastIdx = messages.length - 1;
    if (lastIdx < 1 || messages[lastIdx].role !== 'assistant') return;
    const userMsg = messages[lastIdx - 1];
    if (userMsg.role !== 'user') return;

    const assistant = messages[lastIdx];
    await coreService.deleteMessage(assistant.id);
    const history = messages.slice(0, lastIdx - 1).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => prev.slice(0, lastIdx));
    await runAssistantTurn(userMsg.content, history);
  }, [isSending, messages, runAssistantTurn]);

  const beginEdit = (msg: CoreMessage) => { setEditingId(msg.id); setEditText(msg.content); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const handleEditResend = useCallback(async (msg: CoreMessage) => {
    const newText = editText.trim();
    if (!newText || isSending) { cancelEdit(); return; }
    const idx = messages.findIndex(m => m.id === msg.id);
    if (idx < 0) { cancelEdit(); return; }

    cancelEdit();
    const prior = messages.slice(0, idx);
    // Drop the edited turn and everything after it, in the DB and locally.
    await coreService.deleteMessagesFrom(conversationId, msg.created_at, true);
    setMessages(prior);

    try {
      const savedUser = await coreService.insertMessage(conversationId, 'user', newText);
      setMessages([...prior, savedUser]);
    } catch {
      setError('Failed to resend message.');
      return;
    }
    const history = prior.map(m => ({ role: m.role, content: m.content }));
    await runAssistantTurn(newText, history);
  }, [editText, isSending, messages, conversationId, runAssistantTurn]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  const remaining = usage && !usage.isUnlimited ? usage.dailyLimit - usage.messagesUsedToday : null;
  const hasMessages = messages.length > 0;
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return i;
    return -1;
  })();

  return (
    <div className="flex flex-col h-full bg-[#0a0c10]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/8 bg-[#0a0c10]/95 backdrop-blur-xl flex-shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-white/8 rounded-lg transition-colors text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <CoreGlyph size="md" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-white text-sm truncate block">{conversation?.title || 'New thread'}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400/70" />
            <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Core · assistant</span>
          </div>
        </div>
        {remaining !== null && (
          <span className="text-xs text-slate-500 flex-shrink-0">{Math.max(0, remaining)} / {usage?.dailyLimit} free</span>
        )}
        <button
          onClick={onNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/6 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {!hasMessages && !isSending ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <CoreGlyph size="lg" />
            <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase mt-5 mb-2">Core</p>
            <p className="text-slate-300 text-base font-medium max-w-sm leading-relaxed">
              When you just need to get something done.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-10">
              {STARTER_PROMPTS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left px-4 py-3 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 hover:border-white/16 text-sm text-slate-400 hover:text-slate-200 transition-all leading-relaxed"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg, idx) => (
              <div key={msg.id} className={`group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {msg.role === 'user' ? (
                  editingId === msg.id ? (
                    <div className="w-full max-w-[85%]">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditResend(msg); }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        autoFocus
                        rows={2}
                        className="w-full bg-white/8 border border-slate-500/40 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none resize-none focus:border-slate-400/60"
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                        <button
                          onClick={() => handleEditResend(msg)}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-white text-slate-900 text-xs font-medium rounded-lg transition-colors"
                        >
                          Save & resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="inline-block max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/10 border border-white/12 text-white text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton text={msg.content} />
                        <button
                          onClick={() => beginEdit(msg)}
                          disabled={isSending}
                          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                          title="Edit & resend"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <div className="w-full flex gap-3">
                    <CoreGlyph size="sm" />
                    <div className="flex-1 min-w-0 text-sm">
                      <CoreMarkdown content={msg.content} />
                      <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CopyButton text={msg.content} label />
                        {idx === lastAssistantIdx && idx === messages.length - 1 && (
                          <button
                            onClick={handleRegenerate}
                            disabled={isSending}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
                            title="Regenerate"
                          >
                            <RefreshCw className="w-3 h-3" />Regenerate
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="w-full flex gap-3">
                <CoreGlyph size="sm" pulse={!streamingText} />
                <div className="flex-1 min-w-0 text-sm">
                  {streamingText ? (
                    <>
                      <CoreMarkdown content={streamingText} />
                      <motion.span
                        className="inline-block w-0.5 h-4 bg-slate-400 ml-0.5 align-middle"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 py-2">
                      {[0, 1, 2].map(j => (
                        <motion.div
                          key={j}
                          className="w-1.5 h-1.5 rounded-full bg-slate-500"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, delay: j * 0.2, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Limit nudge */}
      {usage && !usage.isUnlimited && !usage.canSend && (
        <div className="px-4 sm:px-6 pb-2">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
            <span className="text-amber-300/90">Daily free limit reached ({usage.dailyLimit} Core messages).</span>
            <button
              onClick={() => navigate('/pricing?returnTo=/core')}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-colors flex-shrink-0"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="px-4 sm:px-6 pb-2"
          >
            <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/40 border border-red-500/25 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className={`flex items-end gap-2 rounded-2xl border transition-all ${
            !canSend ? 'bg-white/3 border-white/8 opacity-60' : 'bg-white/6 border-white/12 focus-within:border-slate-400/40 focus-within:bg-white/8'
          }`}>
            <div className="pl-2 pb-2 flex-shrink-0">
              <AppNavRadial
                currentApp="core"
                seedText={messages.length > 0 ? messages[messages.length - 1].content.slice(0, 120) : undefined}
                theme="dark"
              />
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); adjustHeight(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder={canSend ? 'Ask Core to get something done…' : 'Daily free limit reached'}
              disabled={isSending || !canSend}
              rows={1}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 px-2 py-3.5 outline-none resize-none leading-relaxed"
              style={{ minHeight: '50px', maxHeight: '180px' }}
            />
            {isSending ? (
              <button
                onClick={handleStop}
                className="m-2 w-9 h-9 rounded-xl flex items-center justify-center bg-white/12 hover:bg-white/20 transition-all"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 text-white fill-white" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !canSend}
                className="m-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 bg-slate-200 hover:bg-white disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4 text-slate-900" />
              </button>
            )}
          </div>
          <p className="text-center text-slate-600 text-xs mt-2">Core shares memory with your companions · Enter to send</p>
        </div>
      </div>
    </div>
  );
}
