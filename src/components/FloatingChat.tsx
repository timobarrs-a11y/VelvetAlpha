import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Minus, ChevronUp } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCoachColor } from '../utils/coachColors';
import { companionAvatarConfig } from '../components/lobby';
import { Avatar } from '../components/Avatar';
import type { CompanionWithLastMessage } from '../services/companionService';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  created_at: string;
  companion_id: string;
}

interface FloatingChatState {
  companionId: string;
  messages: ChatMessage[];
}

export function FloatingChat() {
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [openCompanionId, setOpenCompanionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load companions (coaches + companions with recent messages)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('companions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false })
        .limit(6);
      if (data) setCompanions(data as CompanionWithLastMessage[]);
    })();
  }, []);

  // Realtime subscription for new assistant messages
  useEffect(() => {
    if (companions.length === 0) return;

    const { data: { user } } = supabase.auth.getUser();
    user?.then(({ data: ud }) => {
      if (!ud) return;
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const channel = supabase
        .channel('floating-chat-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversations',
            filter: `user_id=eq.${ud.id}`,
          },
          (payload) => {
            const newMsg = payload.new as ChatMessage;
            if (newMsg.role === 'assistant' && newMsg.companion_id) {
              setHasNewMessage(prev => ({ ...prev, [newMsg.companion_id]: true }));
              if (openCompanionId === newMsg.companion_id) {
                setMessages(prev => [...prev, newMsg]);
              }
            }
          },
        )
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [companions, openCompanionId]);

  // Load messages when opening a chat
  const loadMessages = useCallback(async (companionId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('conversations')
      .select('id, content, role, created_at, companion_id')
      .eq('companion_id', companionId)
      .order('created_at', { ascending: true })
      .limit(20);
    setMessages((data ?? []) as ChatMessage[]);
    setLoading(false);
    setHasNewMessage(prev => ({ ...prev, [companionId]: false }));
  }, []);

  const handleOpenCompanion = (companionId: string) => {
    setOpenCompanionId(companionId);
    setMinimized(false);
    loadMessages(companionId);
  };

  const handleSend = async () => {
    if (!input.trim() || !openCompanionId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      content: input.trim(),
      role: 'user',
      created_at: new Date().toISOString(),
      companion_id: openCompanionId,
    };
    setMessages(prev => [...prev, msg]);
    setInput('');

    await supabase.from('conversations').insert({
      user_id: user.id,
      companion_id: openCompanionId,
      content: msg.content,
      role: 'user',
    });

    // Navigate to full chat for AI response — the floating chat is for quick reading
    // The actual AI generation happens through the chat service
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openCompanion = companions.find(c => c.id === openCompanionId);
  const companionsWithNew = companions.filter(c => hasNewMessage[c.id]);

  return (
    <>
      {/* Minimized avatar bubbles */}
      <AnimatePresence>
        {(!openCompanionId || minimized) && companionsWithNew.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex gap-2"
          >
            {companionsWithNew.map(c => {
              const color = getCoachColor(c.coach_color);
              return (
                <motion.button
                  key={c.id}
                  onClick={() => handleOpenCompanion(c.id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="relative w-12 h-12 rounded-full overflow-hidden border-2"
                  style={{ borderColor: color.base, boxShadow: `0 0 12px ${color.glow}` }}
                  title={`New message from ${c.custom_name}`}
                >
                  <Avatar config={companionAvatarConfig(c)} className="w-full h-full" />
                  <span
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0d0d1a] animate-pulse"
                    style={{ background: color.base }}
                  />
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {openCompanionId && !minimized && openCompanion && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-80 h-[60vh] sm:h-96 flex flex-col rounded-2xl border border-white/10 overflow-hidden"
            style={{
              background: 'var(--ds-surface, #1a1a2e)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 p-3 border-b border-white/8 flex-shrink-0"
              style={{ background: getCoachColor(openCompanion.coach_color).soft }}
            >
              <button
                onClick={() => navigate(`/chat?companion=${openCompanion.id}`)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                  <Avatar config={companionAvatarConfig(openCompanion)} className="w-full h-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">{openCompanion.custom_name}</p>
                  <p className="text-[10px] text-ink-muted">Tap to open full chat</p>
                </div>
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setOpenCompanionId(null); setMessages([]); }}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-ink-muted">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-ink-muted">No messages yet. Say something!</p>
                </div>
              ) : (
                messages.slice(-15).map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-1.5 text-xs ${
                        msg.role === 'user'
                          ? 'bg-white/10 text-ink'
                          : 'text-ink'
                      }`}
                      style={msg.role === 'assistant' ? {
                        background: getCoachColor(openCompanion.coach_color).soft,
                        border: `1px solid ${getCoachColor(openCompanion.coach_color).border}`,
                      } : {}}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-2.5 border-t border-white/8 flex-shrink-0 flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Quick reply..."
                className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-muted/50 outline-none focus:bg-white/8 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors disabled:opacity-30"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fallback launcher button when no new messages but companions exist */}
      <AnimatePresence>
        {!openCompanionId && companionsWithNew.length === 0 && companions.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => handleOpenCompanion(companions[0].id)}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center bg-white/8 hover:bg-white/12 border border-white/10 transition-colors"
            title="Open chat"
          >
            <MessageCircle className="w-5 h-5 text-ink" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
