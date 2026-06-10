import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Plus, Loader2, AlertCircle, X, CreditCard as Edit2, Check, Globe, CalendarPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { atlasService, AtlasConversation, AtlasMessage, AtlasUsageInfo, AtlasCalendarEvent, AtlasNavigationIntent } from '../services/atlasService';
import { AtlasMarkdown } from './AtlasMarkdown';
import { AppNavRadial } from './AppNavRadial';
import { setAppBridgeContext } from '../services/appBridgeStore';
import { supabase } from '../shared/supabase/client';

interface AtlasCanvasProps {
  conversationId: string;
  voice: 'masculine' | 'feminine' | null;
  onNewConversation: () => void;
  onBack: () => void;
}

const GREETING_TEMPLATES = [
  (name: string) => `Good to have you back, ${name}. What are we working on today?`,
  (name: string) => `${name}. Ready when you are. What's the mission?`,
  (name: string) => `Hey ${name} — what are we building today?`,
  (name: string) => `${name}. I'm briefed and standing by. What do you need?`,
  (name: string) => `Back at it, ${name}. What's on the agenda?`,
];

const GREETING_TEMPLATES_MORNING = [
  (name: string) => `Good morning, ${name}. What are we tackling today?`,
  (name: string) => `Morning, ${name}. Fresh start — what's first on the list?`,
  (name: string) => `${name}. Good morning. Let's make it count. What do you need?`,
];

const GREETING_TEMPLATES_EVENING = [
  (name: string) => `Evening, ${name}. What do you need to get done?`,
  (name: string) => `${name}. Long day? Let's wrap it up right. What's the task?`,
  (name: string) => `Evening, ${name}. Still at it — I respect that. What are we working on?`,
];

const FIRST_TIME_GREETINGS = [
  (name: string) => `Welcome, ${name}. I'm Atlas — your personal chief of staff. What can I help you with?`,
  (name: string) => `${name}, good to meet you. Atlas, at your service. What are we working on?`,
];

function getGreeting(firstName: string, isFirstEver: boolean): string {
  if (isFirstEver) {
    const pool = FIRST_TIME_GREETINGS;
    return pool[Math.floor(Math.random() * pool.length)](firstName);
  }
  const hour = new Date().getHours();
  let pool: ((name: string) => string)[];
  if (hour >= 5 && hour < 12) {
    pool = GREETING_TEMPLATES_MORNING;
  } else if (hour >= 18 || hour < 5) {
    pool = GREETING_TEMPLATES_EVENING;
  } else {
    pool = GREETING_TEMPLATES;
  }
  return pool[Math.floor(Math.random() * pool.length)](firstName);
}

function getTimeBasedSuggestions(isFirstEver: boolean): string[] {
  const hour = new Date().getHours();
  if (isFirstEver) {
    return [
      'Write a professional bio for me',
      'Help me brainstorm ideas for a project',
      'Explain something I\'ve been curious about',
      'Review and improve my writing',
    ];
  }
  if (hour >= 5 && hour < 12) {
    return [
      'Help me plan my day and prioritize tasks',
      'Draft a morning email or message',
      'Summarize key points from a document',
      'Create an outline for something I\'m working on',
    ];
  }
  if (hour >= 12 && hour < 17) {
    return [
      'Help me write or edit something',
      'Research a topic I\'m working on',
      'Debug or review my code',
      'Brainstorm solutions to a problem',
    ];
  }
  return [
    'Summarize what I worked on today',
    'Draft a recap or update message',
    'Review and polish my writing',
    'Help me plan for tomorrow',
  ];
}

function AtlasAvatar({ isThinking = false, size = 'md' }: { isThinking?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-14 h-14' : 'w-8 h-8';
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xl' : 'text-xs';
  return (
    <div className={`${dims} relative flex-shrink-0`}>
      <div className={`${dims} rounded-lg bg-[#0f1117] border border-white/20 flex items-center justify-center overflow-hidden`}>
        <span className={`font-bold ${textSize} text-white/90 tracking-widest select-none`}>A</span>
      </div>
      {isThinking && (
        <motion.div
          className="absolute inset-0 rounded-lg border border-white/40"
          animate={{ opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}

export function AtlasCanvas({ conversationId, voice, onNewConversation, onBack }: AtlasCanvasProps) {
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<AtlasConversation | null>(null);
  const [messages, setMessages] = useState<AtlasMessage[]>([]);
  const [greetingMessage, setGreetingMessage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [usage, setUsage] = useState<AtlasUsageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [userName, setUserName] = useState<string>('');
  const [totalConversationCount, setTotalConversationCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState<string>('');
  const [searchingWeb, setSearchingWeb] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
  const [lastCalendarEvent, setLastCalendarEvent] = useState<AtlasCalendarEvent | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<AtlasNavigationIntent | null>(null);
  const calendarToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    if (!pendingNavigation) return;
    const timer = setTimeout(() => {
      if (pendingNavigation.seedText) {
        setAppBridgeContext({
          sourceApp: 'atlas',
          topic: pendingNavigation.seedText,
          seedText: pendingNavigation.seedText,
        });
      }
      navigate(pendingNavigation.route);
    }, 1800);
    return () => clearTimeout(timer);
  }, [pendingNavigation, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, greetingMessage]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    try {
      setIsLoading(true);
      setGreetingMessage(null);

      const [conv, msgs, usageInfo] = await Promise.all([
        atlasService.getConversation(conversationId),
        atlasService.getMessages(conversationId),
        atlasService.getUsageInfo(),
      ]);

      const { data: { user } } = await supabase.auth.getUser();
      let firstName = '';
      let convCount = 0;

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.name) {
          firstName = profile.name.split(' ')[0];
        }

        const { count } = await supabase
          .from('atlas_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        convCount = count || 0;
      }

      setConversation(conv);
      setTitleInput(conv?.title || 'New Conversation');
      setMessages(msgs);
      setUsage(usageInfo);
      setUserName(firstName);
      setTotalConversationCount(convCount);
      setLastUpdated(conv?.updated_at || null);

      if (msgs.length === 0 && firstName) {
        const isFirstEver = convCount <= 1;
        const greeting = getGreeting(firstName, isFirstEver);
        setGreetingMessage(greeting);
      }
    } catch (err) {
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    if (usage && !usage.isUnlimited && !usage.canSend) {
      navigate('/pricing?returnTo=/atlas');
      return;
    }

    setInput('');
    setIsSending(true);
    setError(null);
    setGreetingMessage(null);
    setStreamingText('');
    setSearchingWeb(false);
    setLastSearchQuery(null);

    const optimisticUser: AtlasMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      user_id: '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const savedUser = await atlasService.insertMessage(conversationId, 'user', text);
      setMessages(prev => prev.map(m => m.id === optimisticUser.id ? savedUser : m));

      const history = messages.map(m => ({ role: m.role, content: m.content }));
      setSearchingWeb(true);

      const { text: replyText } = await atlasService.sendMessage(
        conversationId,
        text,
        history,
        userName || undefined,
        (chunk) => {
          setSearchingWeb(false);
          setStreamingText(prev => prev + chunk);
        },
        (meta) => {
          setSearchingWeb(false);
          if (meta.searchPerformed) {
            setLastSearchQuery(meta.searchQuery);
          }
        },
        (calEvent) => {
          setLastCalendarEvent(calEvent);
          if (calendarToastTimer.current) clearTimeout(calendarToastTimer.current);
          calendarToastTimer.current = setTimeout(() => setLastCalendarEvent(null), 6000);
        },
        (navIntent) => {
          setPendingNavigation(navIntent);
        },
        voice
      );

      setStreamingText('');
      setSearchingWeb(false);

      const savedAssistant = await atlasService.insertMessage(conversationId, 'assistant', replyText);
      setMessages(prev => [...prev, savedAssistant]);

      await atlasService.touchConversation(conversationId);

      if (!usage?.isUnlimited) {
        await atlasService.incrementUsage();
        setUsage(prev => prev ? {
          ...prev,
          messagesUsedToday: prev.messagesUsedToday + 1,
          canSend: prev.messagesUsedToday + 1 < prev.dailyLimit,
        } : prev);
      }

      if (messages.length === 0) {
        const autoTitle = text.length > 50 ? text.slice(0, 47) + '...' : text;
        await atlasService.updateConversationTitle(conversationId, autoTitle);
        setConversation(prev => prev ? { ...prev, title: autoTitle } : prev);
        setTitleInput(autoTitle);
      }
    } catch (err) {
      setStreamingText('');
      setSearchingWeb(false);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== optimisticUser.id));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, isSending, messages, conversationId, usage, navigate, userName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveTitle = async () => {
    const t = titleInput.trim();
    if (!t || !conversation) { setEditingTitle(false); return; }
    await atlasService.updateConversationTitle(conversationId, t);
    setConversation(prev => prev ? { ...prev, title: t } : prev);
    setEditingTitle(false);
  };

  const adjustTextareaHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const getLastSeenLabel = (): string | null => {
    if (!lastUpdated || messages.length === 0) return null;
    const d = new Date(lastUpdated);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor(diffMs / 3600000);
    if (days === 0 && hours < 1) return null;
    if (days === 0) return `Picking up from ${hours}h ago`;
    if (days === 1) return 'Picking up from yesterday';
    if (days < 7) return `Picking up from ${days} days ago`;
    return `Picking up from ${d.toLocaleDateString()}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
      </div>
    );
  }

  const remaining = usage ? (usage.isUnlimited ? null : usage.dailyLimit - usage.messagesUsedToday) : null;
  const suggestions = getTimeBasedSuggestions(totalConversationCount <= 1);
  const lastSeenLabel = getLastSeenLabel();
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/8 bg-[#0a0a0f]/95 backdrop-blur-xl flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <AtlasAvatar size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  ref={titleInputRef}
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="flex-1 bg-white/8 border border-white/15 rounded px-2 py-0.5 text-sm text-white outline-none focus:border-white/30 min-w-0"
                />
                <button onClick={handleSaveTitle} className="p-1 text-white/60 hover:text-white transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="p-1 text-white/40 hover:text-white/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-1.5 text-left max-w-full"
              >
                <span className="font-semibold text-white text-sm truncate">{conversation?.title || 'New Conversation'}</span>
                <Edit2 className="w-3 h-3 text-white/30 group-hover:text-white/60 transition-colors flex-shrink-0" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
            <span className="text-[10px] text-white/35 font-medium tracking-wide uppercase">Active</span>
          </div>
        </div>

        {remaining !== null && (
          <span className="text-xs text-white/35 flex-shrink-0">
            {remaining} / {usage?.dailyLimit} free
          </span>
        )}

        <button
          onClick={onNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg text-xs font-medium text-white/70 hover:text-white transition-all flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        {!hasMessages && !isSending ? (
          <div className="flex flex-col h-full">
            {/* Greeting zone */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center"
              >
                <AtlasAvatar size="lg" />
                <div className="mt-5 mb-2">
                  <span className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase">Atlas</span>
                </div>
                {greetingMessage ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                    className="text-white/80 text-base font-medium max-w-sm leading-relaxed"
                  >
                    {greetingMessage}
                  </motion.p>
                ) : (
                  <p className="text-white/60 text-base font-medium max-w-sm leading-relaxed">
                    What are we working on today?
                  </p>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-10"
              >
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="text-left px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/18 text-sm text-white/50 hover:text-white/80 transition-all leading-relaxed"
                  >
                    {suggestion}
                  </button>
                ))}
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Last-seen continuity marker */}
            {lastSeenLabel && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 py-1"
              >
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-xs text-white/25 font-medium whitespace-nowrap">{lastSeenLabel}</span>
                <div className="flex-1 h-px bg-white/8" />
              </motion.div>
            )}

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <AtlasAvatar size="sm" />
                )}
                <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  {msg.role === 'user' ? (
                    <div className="inline-block max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-white/10 border border-white/12 text-white text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="text-white/90 text-sm leading-relaxed">
                      <AtlasMarkdown content={msg.content} />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isSending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <AtlasAvatar size="sm" isThinking={!streamingText} />
                <div className="flex-1 min-w-0">
                  {streamingText ? (
                    <div className="text-white/90 text-sm leading-relaxed">
                      <AtlasMarkdown content={streamingText} />
                      <motion.span
                        className="inline-block w-0.5 h-4 bg-white/60 ml-0.5 align-middle"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    </div>
                  ) : searchingWeb ? (
                    <div className="flex items-center gap-2 py-2 text-white/40 text-sm">
                      <Globe className="w-3.5 h-3.5 animate-pulse" />
                      <span>Searching the web...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 py-2">
                      {[0, 1, 2].map(j => (
                        <motion.div
                          key={j}
                          className="w-1.5 h-1.5 rounded-full bg-white/40"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, delay: j * 0.2, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {!isSending && lastSearchQuery && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-xs text-white/25 pl-10"
              >
                <Globe className="w-3 h-3" />
                <span>Searched: {lastSearchQuery}</span>
              </motion.div>
            )}

            <AnimatePresence>
              {lastCalendarEvent && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2 pl-10"
                >
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                    <CalendarPlus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      <span className="font-medium">{lastCalendarEvent.title}</span>
                      {' '}added to your calendar
                      {lastCalendarEvent.event_date && (
                        <span className="text-emerald-400/70">
                          {' '}— {new Date(lastCalendarEvent.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Upgrade nudge when limit hit */}
      {usage && !usage.isUnlimited && !usage.canSend && (
        <div className="px-4 sm:px-6 pb-2">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
              <span className="text-amber-300/90">Daily free limit reached ({usage.dailyLimit} messages).</span>
              <button
                onClick={() => navigate('/pricing?returnTo=/atlas')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-colors flex-shrink-0"
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
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

      {/* Navigation toast */}
      <AnimatePresence>
        {pendingNavigation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="px-4 sm:px-6 pb-2"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/15 border border-sky-500/25 text-sky-300 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                <span>Taking you to <span className="font-semibold capitalize">{pendingNavigation.destination}</span>...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className={`flex items-end gap-2 rounded-2xl border transition-all ${
            usage && !usage.isUnlimited && !usage.canSend
              ? 'bg-white/3 border-white/8 opacity-60'
              : 'bg-white/6 border-white/12 focus-within:border-white/25 focus-within:bg-white/8'
          }`}>
            <div className="pl-2 pb-2 flex-shrink-0">
              <AppNavRadial
                currentApp="atlas"
                seedText={messages.length > 0 ? messages[messages.length - 1].content.slice(0, 120) : undefined}
                theme="dark"
              />
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => { setInput(e.target.value); adjustTextareaHeight(e.target); }}
              onKeyDown={handleKeyDown}
              placeholder={userName ? `Ask Atlas something, ${userName}...` : 'Ask Atlas anything...'}
              disabled={isSending || (usage ? (!usage.isUnlimited && !usage.canSend) : false)}
              rows={1}
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 px-2 py-3.5 outline-none resize-none leading-relaxed"
              style={{ minHeight: '50px', maxHeight: '160px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isSending || (usage ? (!usage.isUnlimited && !usage.canSend) : false)}
              className="m-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 bg-white/10 hover:bg-white/18 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          <p className="text-center text-white/20 text-xs mt-2">
            Shift+Enter for new line · Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
