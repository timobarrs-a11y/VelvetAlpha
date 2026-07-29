import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Send, Eye, User, Bot, MessageSquare, Zap, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import {
  createRoNSession, getMessages, getSession, sendUserMessage, endSession,
  subscribeToMessages, subscribeToSession, tryClaimSession, fallbackToAI,
  RoNSession, RoNMessage, RoNGenderFilter, RoNVerdict, RoNRole,
} from '../services/realOrNotService';

type Phase = 'lobby' | 'matching' | 'chat' | 'reveal';

const BASE_TYPING_DELAY_MS = 900;

/**
 * 50/50 coin flip — even when humans are in the pool we only try to claim
 * one half the time. The other half we go straight to AI. This keeps the
 * split truly random with no discernible pattern for the end-user.
 */
function shouldTryHuman(): boolean {
  return Math.random() < 0.5;
}

/**
 * Neutral waiting durations — some "matches" resolve instantly, some after
 * a few seconds, making the timing feel organic regardless of AI vs human.
 */
function randomWaitMs(): number {
  return 5000 + Math.random() * 5000;
}

function useAIReply(sessionId: string | null) {
  return useCallback(async () => {
    if (!sessionId) return;
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ron-ai-reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (err) {
      console.error('[RoN] AI reply error:', err);
    }
  }, [sessionId]);
}

function LobbyView({ onStart, isLoading }: { onStart: (gender: RoNGenderFilter) => void; isLoading: boolean }) {
  const [gender, setGender] = useState<RoNGenderFilter>('any');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#060a0f] text-white flex flex-col items-center justify-center px-6">
      <button
        onClick={() => navigate('/lobby')}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-10"
      >
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-2">
            <Zap className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">The Velvet Rope</h1>
          <p className="text-gray-400 leading-relaxed text-base">
            Step beyond the Velvet Rope into a meta-space filled with humans and AI alike — the catch? You don't know which is which. Deeply intelligent avatars with their own lives and stories, mixed with real people from around the world. Everything's anonymous but the conversation. So... are you game?
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-3">
          {[
            { icon: <MessageSquare className="w-4 h-4 text-sky-400" />, text: "No names. No profiles. Just pure conversation." },
            { icon: <Eye className="w-4 h-4 text-amber-400" />, text: "Real people and AI avatars share the same space — tell them apart." },
            { icon: <Zap className="w-4 h-4 text-emerald-400" />, text: "The AI doesn't know if you're real either. Neither does anyone." },
            { icon: <AlertCircle className="w-4 h-4 text-rose-400" />, text: "Privacy is built in. The rope keeps it exclusive." },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
              {item.icon}
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Match me with
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'any', label: 'Anyone' },
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ] as Array<{ value: RoNGenderFilter; label: string }>).map(opt => (
              <button
                key={opt.value}
                onClick={() => setGender(opt.value)}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  gender === opt.value
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/8 hover:text-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onStart(gender)}
          disabled={isLoading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500
            text-white font-bold text-lg shadow-lg shadow-amber-500/20
            hover:from-amber-400 hover:to-orange-400 transition-all
            disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Stepping beyond...' : 'Step Beyond'}
        </motion.button>
      </motion.div>
    </div>
  );
}

function MatchingView({ onCancel }: { onCancel: () => void }) {
  const lines = [
    { top: 'Stepping beyond...', sub: 'Who will you get?' },
    { top: 'The rope is lifting.', sub: 'Someone is waiting on the other side.' },
    { top: 'Scanning the room...', sub: 'Faces blur. Names mean nothing here.' },
    { top: 'Almost there.', sub: 'Human or otherwise — you\'ll find out.' },
    { top: 'Pulling someone in...', sub: 'The match is forming.' },
  ];
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLineIndex(prev => (prev + 1) % lines.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#060a0f] text-white flex flex-col items-center justify-center px-6">
      <button
        onClick={onCancel}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Cancel
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-10 max-w-sm w-full"
      >
        <div className="relative mx-auto w-28 h-28">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: '1px solid rgba(184,71,107,0.2)' }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-3 rounded-full"
            style={{ border: '1px solid rgba(184,71,107,0.35)' }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
          <motion.div
            className="absolute inset-6 rounded-full"
            style={{ border: '1px solid rgba(184,71,107,0.5)' }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(128,0,32,0.15)', border: '1px solid rgba(128,0,32,0.4)' }}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="font-bold text-2xl" style={{ color: '#c0607a' }}>?</span>
            </motion.div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={lineIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="space-y-2"
          >
            <p className="text-white font-semibold text-xl tracking-tight">{lines[lineIndex].top}</p>
            <p className="text-gray-500 text-sm leading-relaxed">{lines[lineIndex].sub}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3, 4].map(i => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{ background: '#b8476b' }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function ChatBubble({ msg, isMe, showTime }: { msg: RoNMessage; isMe: boolean; showTime: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}
    >
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isMe
            ? 'bg-sky-600 text-white rounded-br-sm'
            : 'bg-white/10 text-gray-100 rounded-bl-sm border border-white/10'
        }`}
      >
        {msg.content}
      </div>
      {showTime && (
        <span className="text-[10px] text-gray-600 px-1 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {time}
        </span>
      )}
    </motion.div>
  );
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2"
    >
      <div className="bg-white/10 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center">
        {[0, 150, 300].map(d => (
          <div
            key={d}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-600">{name} is typing</span>
    </motion.div>
  );
}

function ChatView({
  session,
  messages,
  myRole,
  onSend,
  onEnd,
  onLeave,
  isThinking,
}: {
  session: RoNSession;
  messages: RoNMessage[];
  myRole: RoNRole;
  onSend: (text: string) => void;
  onEnd: (verdict: RoNVerdict) => void;
  onLeave: () => void;
  isThinking: boolean;
}) {
  const [text, setText] = useState('');
  const [showVerdictPanel, setShowVerdictPanel] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const opponentName = session.is_b_ai ? (session.ai_persona_name || 'Anonymous') : 'Anonymous';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    textareaRef.current?.focus();
    onSend(trimmed);
  };

  const msgCount = messages.length;

  return (
    <div className="h-screen flex flex-col bg-[#060a0f] text-white">
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-white/5 flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <Zap className="w-5 h-5" style={{ color: '#b8476b' }} />
            <div>
              <span className="font-bold text-white text-lg">The Velvet Rope</span>
              <span className="ml-3 text-sm text-white/40">{opponentName}</span>
            </div>
          </div>

          <button
            onClick={() => setShowVerdictPanel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold"
            style={{ background: 'rgba(128,0,32,0.15)', border: '1px solid rgba(128,0,32,0.4)', color: '#c0607a' }}
          >
            <Eye className="w-3.5 h-3.5" />
            Make Your Call
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 && !isThinking && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-700 text-sm">Waiting for the first message...</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_role === myRole;
          const isLast = i === messages.length - 1;
          const prevMsg = messages[i - 1];
          const showTime = isLast || (prevMsg && prevMsg.sender_role !== msg.sender_role);
          return (
            <ChatBubble
              key={msg.id}
              msg={msg}
              isMe={isMe}
              showTime={!!showTime}
            />
          );
        })}
        <AnimatePresence>
          {isThinking && <TypingIndicator name={opponentName} />}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-white/8 bg-[#0a1018]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Say something..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5
              text-sm text-white placeholder-gray-600 resize-none
              focus:outline-none focus:border-sky-500/50 transition-colors
              leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center
              rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed
              transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showVerdictPanel && (
          <motion.div
            className="absolute inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowVerdictPanel(false)} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative z-10 w-full max-w-md mx-4 mb-6 bg-[#0e1520] border border-white/15
                rounded-3xl p-6 space-y-5 shadow-2xl"
            >
              <div className="text-center space-y-1">
                <h3 className="font-bold text-lg text-white">What's your verdict?</h3>
                <p className="text-gray-500 text-sm">
                  {msgCount} message{msgCount !== 1 ? 's' : ''} exchanged. Make your call.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onEnd('human')}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl
                    bg-emerald-500/10 border border-emerald-500/30 text-emerald-400
                    hover:bg-emerald-500/20 transition-all"
                >
                  <User className="w-7 h-7" />
                  <span className="font-bold">Real Human</span>
                </button>
                <button
                  onClick={() => onEnd('ai')}
                  className="flex flex-col items-center gap-2 py-5 rounded-2xl
                    bg-rose-500/10 border border-rose-500/30 text-rose-400
                    hover:bg-rose-500/20 transition-all"
                >
                  <Bot className="w-7 h-7" />
                  <span className="font-bold">It's an AI</span>
                </button>
              </div>

              <button
                onClick={() => setShowVerdictPanel(false)}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Keep chatting
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLeaveConfirm(false)} />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative z-10 w-full max-w-sm bg-[#0e1520] border border-white/15
                rounded-3xl p-6 space-y-5 shadow-2xl text-center"
            >
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-white">Leave this chat?</h3>
                <p className="text-gray-500 text-sm">You'll go back to the lobby without making a verdict.</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={onLeave}
                  className="w-full py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 font-semibold transition-all text-sm"
                >
                  Leave
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/8 font-semibold transition-all text-sm"
                >
                  Stay in chat
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RevealView({
  session,
  verdict,
  myRole,
  messageCount,
  onPlayAgain,
}: {
  session: RoNSession;
  verdict: RoNVerdict;
  myRole: RoNRole;
  messageCount: number;
  onPlayAgain: () => void;
}) {
  const navigate = useNavigate();
  const [latestSession, setLatestSession] = useState<RoNSession | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const updated = await getSession(session.id);
      if (updated) setLatestSession(updated);
    }, 2000);
    return () => clearTimeout(timer);
  }, [session.id]);

  const wasCorrect = verdict === (session.is_b_ai ? 'ai' : 'human');
  const seed = session.ai_persona_seed as Record<string, unknown>;

  const opponentVerdictRaw = myRole === 'a'
    ? (latestSession?.b_verdict ?? null)
    : (latestSession?.a_verdict ?? null);
  const opponentVerdict = opponentVerdictRaw as RoNVerdict;

  return (
    <div className="min-h-screen bg-[#060a0f] text-white flex flex-col items-center justify-center px-6">
      <button
        onClick={() => navigate('/lobby')}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Lobby
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full text-center space-y-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, delay: 0.2 }}
          className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center
            ${wasCorrect
              ? 'bg-emerald-500/20 border-2 border-emerald-500/50'
              : 'bg-rose-500/20 border-2 border-rose-500/50'
            }`}
        >
          {session.is_b_ai
            ? <Bot className={`w-12 h-12 ${wasCorrect ? 'text-emerald-400' : 'text-rose-400'}`} />
            : <User className={`w-12 h-12 ${wasCorrect ? 'text-emerald-400' : 'text-rose-400'}`} />
          }
        </motion.div>

        <div className="space-y-3">
          <h2 className={`text-3xl font-bold ${wasCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
            {wasCorrect ? 'You got it right!' : 'You were fooled.'}
          </h2>
          <p className="text-gray-400 text-base leading-relaxed">
            {session.is_b_ai
              ? `That was ${session.ai_persona_name || 'an AI'} — a language model playing the role of a real person.`
              : 'That was actually a real human being on the other end.'
            }
          </p>

          {session.is_b_ai && !!seed?.voice_archetype && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-2 mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">The persona you were talking to</p>
              <p className="text-sm text-gray-300 font-medium">{session.ai_persona_name} · {seed.age as string}</p>
              <p className="text-xs text-gray-500">{seed.voice_archetype as string}</p>
              {!!seed.background && (
                <p className="text-xs text-gray-600 italic">{seed.background as string}</p>
              )}
            </div>
          )}

          {!session.is_b_ai && opponentVerdict && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-1"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Your opponent's verdict</p>
              <p className="text-sm text-gray-300">
                They thought you were{' '}
                <span className={opponentVerdict === 'human' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {opponentVerdict === 'human' ? 'a real human' : 'an AI'}
                </span>
                {opponentVerdict === 'human' ? ' — they were right.' : ' — they were wrong.'}
              </p>
            </motion.div>
          )}

          <p className="text-gray-600 text-sm mt-2">
            {messageCount} message{messageCount !== 1 ? 's' : ''} exchanged
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onPlayAgain}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500
              text-white font-bold text-base shadow-lg shadow-amber-500/20 transition-all"
          >
            Play Again
          </motion.button>
          <button
            onClick={() => navigate('/lobby')}
            className="w-full py-3 rounded-2xl border border-white/10 text-gray-400 hover:text-gray-200 hover:bg-white/5 font-semibold text-sm transition-all"
          >
            Back to Lobby
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function RealOrNotPage() {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [session, setSession] = useState<RoNSession | null>(null);
  const [messages, setMessages] = useState<RoNMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verdict, setVerdict] = useState<RoNVerdict>(null);
  const [myRole, setMyRole] = useState<RoNRole>('a');

  const triggerAIReply = useAIReply(session?.id ?? null);
  const channelRef = useRef<ReturnType<typeof subscribeToMessages> | null>(null);
  const sessionChannelRef = useRef<ReturnType<typeof subscribeToSession> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genderFilterRef = useRef<RoNGenderFilter>('any');

  const syncMessages = useCallback(async (sessionId: string) => {
    try {
      const history = await getMessages(sessionId);
      if (history.length > 0) {
        setMessages(history);
        setIsThinking(false);
      }
    } catch {
      // silent
    }
  }, []);

  const startAISession = useCallback(async (sess: RoNSession) => {
    setSession(sess);
    setPhase('chat');
    const delay = BASE_TYPING_DELAY_MS + Math.random() * 400;
    setIsThinking(true);
    const sessionId = sess.id;
    setTimeout(async () => {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ron-ai-reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(console.error);
    }, delay);

    setTimeout(() => syncMessages(sessionId), delay + 8000);
  }, [syncMessages]);

  useEffect(() => {
    if (!session) return;

    const thinkingTimeoutRef = { id: 0 as unknown as ReturnType<typeof setTimeout> };
    const opponentRole: 'a' | 'b' = myRole === 'a' ? 'b' : 'a';

    const sub = subscribeToMessages(
      session.id,
      (msg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        if (msg.sender_role === opponentRole) {
          setIsThinking(false);
          clearTimeout(thinkingTimeoutRef.id);
        }
      },
      () => {
        if (session.status === 'active') {
          setPhase('chat');
        }
        if (session.is_b_ai && myRole === 'a') {
          setIsThinking(true);
          const delay = BASE_TYPING_DELAY_MS + Math.random() * 400;
          setTimeout(() => triggerAIReply(), delay);

          thinkingTimeoutRef.id = setTimeout(() => {
            syncMessages(session.id);
          }, 8000);
        }
      },
    );

    channelRef.current = sub;

    return () => {
      sub.unsubscribe();
      clearTimeout(thinkingTimeoutRef.id);
    };
  }, [session?.id, session?.is_b_ai, myRole]);

  const handleStart = async (gender: RoNGenderFilter) => {
    if (isLoading) return;
    genderFilterRef.current = gender;

    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setPhase('matching');

      const waitMs = randomWaitMs();

      await new Promise(resolve => setTimeout(resolve, waitMs));

      const goHuman = shouldTryHuman();

      if (goHuman) {
        const match = await tryClaimSession(user.id, gender);

        if (match.claimed && match.sessionId) {
          const claimedSession = await getSession(match.sessionId);
          if (claimedSession) {
            setSession(claimedSession);
            setMyRole('b');
            setMessages([]);
            setPhase('chat');
            setIsLoading(false);
            return;
          }
        }
      }

      const newSession = await createRoNSession(user.id, gender);
      setSession(newSession);
      setMyRole('a');
      setMessages([]);

      if (goHuman) {
        const sessionSub = subscribeToSession(newSession.id, (updated) => {
          if (updated.status === 'active' && updated.participant_b_id) {
            if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
            sessionSub.unsubscribe();
            setSession(updated);
            setPhase('chat');
          }
        });
        sessionChannelRef.current = sessionSub;

        fallbackTimerRef.current = setTimeout(async () => {
          sessionSub.unsubscribe();
          const aiSession = await fallbackToAI(newSession.id, gender);
          if (aiSession) {
            await startAISession(aiSession);
          }
        }, 12_000);
      } else {
        const aiSession = await fallbackToAI(newSession.id, gender);
        if (aiSession) {
          await startAISession(aiSession);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('[RoN] Start error:', err);
      setIsLoading(false);
      setPhase('lobby');
    }
  };

  const handleSend = async (text: string) => {
    if (!session) return;
    try {
      await sendUserMessage(session.id, myRole, text);

      if (session.is_b_ai && myRole === 'a') {
        setIsThinking(true);
        const sessionId = session.id;
        const delay = BASE_TYPING_DELAY_MS + Math.random() * 1000;
        setTimeout(() => triggerAIReply(), delay);
        setTimeout(() => syncMessages(sessionId), delay + 8000);
      }
    } catch (err) {
      console.error('[RoN] Send error:', err);
    }
  };

  const handleEnd = async (v: RoNVerdict) => {
    if (!session) return;
    setVerdict(v);
    await endSession(session.id, v, myRole);
    setPhase('reveal');
  };

  const handleLeave = () => {
    cleanup();
    setPhase('lobby');
  };

  const cleanup = () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    sessionChannelRef.current?.unsubscribe();
    sessionChannelRef.current = null;
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setSession(null);
    setMyRole('a');
    setMessages([]);
    setVerdict(null);
    setIsThinking(false);
    setIsLoading(false);
  };

  const handlePlayAgain = () => {
    cleanup();
    setPhase('lobby');
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LobbyView onStart={handleStart} isLoading={isLoading} />
          </motion.div>
        )}
        {phase === 'matching' && (
          <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <MatchingView onCancel={handleLeave} />
          </motion.div>
        )}
        {phase === 'chat' && session && (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ChatView
              session={session}
              messages={messages}
              myRole={myRole}
              onSend={handleSend}
              onEnd={handleEnd}
              onLeave={handleLeave}
              isThinking={isThinking}
            />
          </motion.div>
        )}
        {phase === 'reveal' && session && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <RevealView
              session={session}
              verdict={verdict}
              myRole={myRole}
              messageCount={messages.length}
              onPlayAgain={handlePlayAgain}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
