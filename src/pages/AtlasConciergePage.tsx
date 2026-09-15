import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Compass } from 'lucide-react';
import { VELVET_THEME } from '../config/velvetTheme';
import { supabase } from '../shared/supabase/client';
import { AtlasTransitionOverlay } from '../components/AtlasTransitionOverlay';
import { useTypingEffect, useWritingIndicator } from '../hooks/useTypingEffect';

interface ChatMessage {
  role: 'atlas' | 'user';
  content: string;
  id: number;
}

type Phase = 'goal' | 'provisioning' | 'transitioning';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const AMBIENT_ORBS = [
  { x: '-8%', y: '10%', w: 520, h: 520, color: 'rgba(244,114,182,0.07)', blur: 120, dur: 30 },
  { x: '65%', y: '60%', w: 440, h: 440, color: 'rgba(192,132,252,0.06)', blur: 110, dur: 36 },
  { x: '30%', y: '-10%', w: 380, h: 380, color: 'rgba(244,63,94,0.05)', blur: 100, dur: 42 },
];

let msgIdCounter = 0;

function StreamingAtlasMessage({ content, isLatest }: { content: string; isLatest: boolean }) {
  const { displayedText, showCursor } = useTypingEffect(content, isLatest, { speed: 45 });
  return (
    <span>
      {displayedText}
      {showCursor && (
        <motion.span
          className="inline-block w-[2px] h-[1.1em] ml-0.5 align-text-bottom rounded-full"
          style={{ background: 'rgba(244,114,182,0.7)' }}
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'steps(2)' }}
        />
      )}
    </span>
  );
}

function AtlasThinkingIndicator({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex justify-start"
    >
      <div className="flex flex-col gap-2">
        <div
          className="px-5 py-4 rounded-2xl rounded-bl-md"
          style={{
            background: VELVET_THEME.colors.glassCard,
            border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-[6px] h-[6px] rounded-full"
                  style={{ background: 'rgba(244,114,182,0.6)' }}
                  animate={{
                    y: [0, -6, 0],
                    opacity: [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: [0.45, 0, 0.55, 1],
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <motion.p
          className="text-[11px] ml-1"
          style={{ color: 'rgba(244,114,182,0.5)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {label}
        </motion.p>
      </div>
    </motion.div>
  );
}

export const AtlasConciergePage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>('goal');
  const [coachName, setCoachName] = useState('');
  const [coachId, setCoachId] = useState('');
  const [expertDomain, setExpertDomain] = useState('');
  const [error, setError] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [latestAtlasId, setLatestAtlasId] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const hasInitialized = useRef(false);
  const phaseRef = useRef<Phase>('goal');

  const writingLabel = useWritingIndicator(isThinking);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const updatePhase = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/splash', { replace: true });
          return;
        }

        const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ phase: 'goal', messages: [] }),
        });

        if (!response.ok) throw new Error('Failed to start conversation');
        const data = await response.json();

        const id = ++msgIdCounter;
        const atlasMsg: ChatMessage = { role: 'atlas', content: data.reply, id };
        transcriptRef.current = [atlasMsg];
        setMessages([atlasMsg]);
        setLatestAtlasId(id);
      } catch {
        setError('Something went wrong starting the conversation. Please refresh.');
      }
    })();
  }, [navigate]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    if (phase === 'provisioning' || phase === 'transitioning') return;

    setInput('');

    const userId = ++msgIdCounter;
    const userMsg: ChatMessage = { role: 'user', content: text, id: userId };
    const updatedTranscript = [...transcriptRef.current, userMsg];
    transcriptRef.current = updatedTranscript;
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const currentPhase = phaseRef.current;

      const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phase: currentPhase,
          messages: updatedTranscript,
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();

      const atlasId = ++msgIdCounter;
      const atlasMsg: ChatMessage = { role: 'atlas', content: data.reply, id: atlasId };
      transcriptRef.current = [...updatedTranscript, atlasMsg];
      setMessages(prev => [...prev, atlasMsg]);
      setLatestAtlasId(atlasId);

      if (data.isComplete && currentPhase === 'goal') {
        await handleGoalComplete(updatedTranscript, atlasMsg);
      }
    } catch {
      setError('Connection issue. Please try sending your message again.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleGoalComplete = async (finalTranscript: ChatMessage[], lastAtlasMsg: ChatMessage) => {
    updatePhase('provisioning');
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fullTranscript = [...finalTranscript, lastAtlasMsg].filter(
        m => m.role === 'user' || (m.role === 'atlas' && m.content)
      );

      const provisionStart = Date.now();

      const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phase: 'provisioning',
          transcript: fullTranscript,
        }),
      });

      if (!response.ok) throw new Error('Provisioning failed');
      const data = await response.json();

      setCoachName(data.coachName || 'your coach');
      setCoachId(data.coachId || '');
      setExpertDomain(data.expertDomain || '');

      const transitionMsg = `Your coach ${data.coachName} is ready${data.expertDomain ? ` — they'll help you with ${data.expertDomain}` : ''}. Now let me learn a bit about you so I can personalize everything. This'll take about 90 seconds.`;
      const transId = ++msgIdCounter;
      setMessages(prev => [...prev, { role: 'atlas', content: transitionMsg, id: transId }]);
      setLatestAtlasId(transId);

      const elapsed = Date.now() - provisionStart;
      const minDelay = Math.max(0, 3000 - elapsed);

      setTimeout(() => {
        updatePhase('transitioning');
        setShowTransition(true);
        setIsThinking(false);
      }, minDelay + 2000);
    } catch {
      setError('Something went wrong setting up your coach. You can continue and we\'ll retry later.');
      setTimeout(() => {
        navigate('/user-questionnaire', { replace: true });
      }, 2500);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const phaseLabels: Record<Phase, string> = {
    goal: 'Step 1 of 2 — What are you working toward?',
    provisioning: 'Finding your coach...',
    transitioning: 'Getting ready for the next step...',
  };

  if (error && messages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: VELVET_THEME.bg }}>
        <div className="text-center max-w-md">
          <p className="text-white/80 text-lg mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{ background: VELVET_THEME.button.primary }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const transitionMessage = coachName
    ? `Your coach ${coachName} is ready${expertDomain ? ` to help you with ${expertDomain}` : ''}.`
    : 'Your coach is ready.';
  const transitionSubMessage = 'Now I need to know about you. A few quick questions to personalize everything — takes about 90 seconds.';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: VELVET_THEME.bg }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_THEME.radial }} />

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.024]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px',
        }}
      />

      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {AMBIENT_ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: orb.x,
              top: orb.y,
              width: orb.w,
              height: orb.h,
              borderRadius: '50%',
              background: orb.color,
              filter: `blur(${orb.blur}px)`,
            }}
            animate={{
              x: ['0%', i % 2 === 0 ? '3%' : '-2%', '0%'],
              y: ['0%', i % 2 === 0 ? '2%' : '-1.5%', '0%'],
            }}
            transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative z-10 flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pt-8 pb-4">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <div className="flex justify-center mb-3">
            <motion.div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            >
              {/* Compass glow pulse */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'radial-gradient(circle, rgba(244,114,182,0.15) 0%, transparent 70%)',
                }}
                animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              <Compass className="w-6 h-6 text-ink-secondary relative z-10" />
            </motion.div>
          </div>
          <h1 className="text-xl font-bold text-white">Atlas</h1>
          <p className="text-ink-muted text-sm mt-1 flex items-center justify-center gap-1.5">
            {phase === 'goal' ? <Compass className="w-4 h-4" /> : <Sparkles className="w-4 h-4 animate-pulse" />}
            {phaseLabels[phase]}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'text-rose-50 rounded-bl-md'
                  }`}
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
                          boxShadow: '0 2px 12px rgba(244,63,94,0.25)',
                        }
                      : {
                          background: VELVET_THEME.colors.glassCard,
                          border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                        }
                  }
                >
                  {msg.role === 'atlas' ? (
                    <StreamingAtlasMessage
                      content={msg.content}
                      isLatest={msg.id === latestAtlasId}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isThinking && (
              <AtlasThinkingIndicator label={writingLabel} />
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input — only during goal phase */}
        {phase === 'goal' && (
          <div className="flex-shrink-0 pb-2">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                rows={1}
                disabled={isThinking}
                className="flex-1 px-4 py-3 rounded-2xl border text-[15px] text-white placeholder:text-ink-subtle focus:outline-none resize-none overflow-hidden transition-all"
                style={{
                  background: VELVET_THEME.colors.glassCard,
                  borderColor: VELVET_THEME.colors.glassBorder,
                  minHeight: '48px',
                  maxHeight: '100px',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: VELVET_THEME.button.primary }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Provisioning overlay */}
        <AnimatePresence>
          {phase === 'provisioning' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(7,9,15,0.92)', backdropFilter: 'blur(16px)' }}
            >
              {/* Overlay ambient orbs */}
              {AMBIENT_ORBS.map((orb, i) => (
                <motion.div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: orb.x,
                    top: orb.y,
                    width: orb.w * 0.7,
                    height: orb.h * 0.7,
                    borderRadius: '50%',
                    background: orb.color,
                    filter: `blur(${orb.blur}px)`,
                  }}
                  animate={{
                    x: ['0%', i % 2 === 0 ? '4%' : '-3%', '0%'],
                    y: ['0%', '2%', '0%'],
                  }}
                  transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
                />
              ))}

              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="relative text-center px-8 max-w-md"
              >
                {/* Rotating compass */}
                <div className="flex justify-center mb-6">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center relative"
                    style={{
                      background: VELVET_THEME.colors.glassCard,
                      border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-3xl"
                      style={{
                        background: 'radial-gradient(circle, rgba(244,114,182,0.2) 0%, transparent 70%)',
                      }}
                      animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.15, 0.85] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    >
                      <Compass className="w-7 h-7 text-rose-300" />
                    </motion.div>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Finding your coach...</h2>
                <p className="text-ink-secondary text-base mb-8">Matching you with someone who can help.</p>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'rgba(244,114,182,0.5)' }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Atlas transition overlay -> navigates to questionnaire */}
      <AtlasTransitionOverlay
        message={transitionMessage}
        subMessage={transitionSubMessage}
        destination="/user-questionnaire"
        visible={showTransition}
        autoAdvanceMs={3000}
        onAdvance={() => {
          if (coachId) sessionStorage.setItem('atlasCoachId', coachId);
        }}
      />
    </div>
  );
};
