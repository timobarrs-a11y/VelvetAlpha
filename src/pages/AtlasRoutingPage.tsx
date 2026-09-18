import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useTypingEffect } from '../hooks/useTypingEffect';

interface ChatMessage {
  role: 'atlas' | 'user';
  content: string;
  id: number;
}

interface NavigationIntent {
  destination: string;
  route: string;
}

interface AtlasRoutingPageProps {
  setupState?: { hasCoach: boolean; hasCompanion: boolean };
  onComplete?: (route: string) => void;
}

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export function AtlasRoutingPage({ setupState: initialSetupState, onComplete }: AtlasRoutingPageProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [setupState, setSetupState] = useState(initialSetupState || { hasCoach: false, hasCompanion: false });
  const [userName, setUserName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const msgIdRef = useRef(0);
  const transcriptRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (hasInitialized) return;
    setHasInitialized(true);
    initChat();
  }, [hasInitialized]);

  const initChat = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/splash', { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.name && profile.name !== 'babe' && profile.name !== 'there') {
        setUserName(profile.name);
      }

      const { data: companions } = await supabase
        .from('companions')
        .select('id, relationship_type')
        .eq('user_id', session.user.id)
        .eq('is_active', true);

      const hasCoach = companions?.some(c => c.relationship_type === 'mentor') ?? false;
      const hasCompanion = companions?.some(c => c.relationship_type !== 'mentor') ?? false;
      setSetupState({ hasCoach, hasCompanion });

      const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phase: 'routing',
          messages: [],
          setupState: { hasCoach, hasCompanion },
          userName: profile?.name || null,
        }),
      });

      const data = await response.json();
      if (data.reply) {
        const atlasMsg: ChatMessage = { role: 'atlas', content: data.reply, id: msgIdRef.current++ };
        setMessages([atlasMsg]);
        transcriptRef.current = [atlasMsg];
      }
    } catch {
      navigate('/lobby', { replace: true });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim(), id: msgIdRef.current++ };
    const updatedTranscript = [...transcriptRef.current, userMsg];
    setMessages(prev => [...prev, userMsg]);
    transcriptRef.current = updatedTranscript;
    setInput('');
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phase: 'routing',
          messages: updatedTranscript.map(m => ({ role: m.role, content: m.content })),
          setupState,
          userName,
        }),
      });

      const data = await response.json();
      if (data.reply) {
        const atlasMsg: ChatMessage = { role: 'atlas', content: data.reply, id: msgIdRef.current++ };
        setMessages(prev => [...prev, atlasMsg]);
        transcriptRef.current = [...updatedTranscript, atlasMsg];
      }

      if (data.navigationIntent) {
        const intent = data.navigationIntent as NavigationIntent;
        setTimeout(() => {
          if (onComplete) {
            onComplete(intent.route);
          } else {
            navigate(intent.route, { replace: true });
          }
        }, 1500);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'atlas', content: "Something went wrong. Let's try that again.", id: msgIdRef.current++ }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b14] flex flex-col">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-rose-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[400px] rounded-full bg-pink-600/5 blur-[100px]" />
      </div>

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto relative z-10 px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/10 border border-rose-500/30 flex items-center justify-center">
            <span className="text-rose-400 font-bold text-sm">A</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Atlas</h1>
            <p className="text-gray-500 text-xs">Your setup guide</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scroll">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} isLatest={msg.id === messages[messages.length - 1]?.id && msg.role === 'atlas'} />
          ))}
          {isThinking && <ThinkingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Tell Atlas what you want to do..."
            rows={1}
            className="w-full px-5 py-3.5 bg-white/[0.04] border border-white/10 text-white placeholder-gray-600 rounded-2xl resize-none focus:border-rose-400/40 focus:outline-none focus:ring-2 focus:ring-rose-500/10 transition-all text-sm"
            disabled={isThinking}
          />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isLatest }: { message: ChatMessage; isLatest: boolean }) {
  const isAtlas = message.role === 'atlas';
  const typedContent = useTypingEffect(isAtlas && isLatest ? message.content : '', isAtlas && isLatest, { speed: 35 });
  const displayContent = isAtlas && isLatest ? typedContent : message.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isAtlas ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isAtlas
            ? 'bg-white/[0.04] border border-white/10 text-gray-200 rounded-bl-md'
            : 'bg-rose-500/15 border border-rose-500/20 text-white rounded-br-md'
        }`}
      >
        {displayContent}
        {isAtlas && isLatest && typedContent.length < message.content.length && (
          <motion.span
            className="inline-block w-0.5 h-4 bg-rose-400 ml-0.5"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}

function ThinkingIndicator() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="bg-white/[0.04] border border-white/10 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-gray-500"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
