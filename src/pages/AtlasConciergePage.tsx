import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Compass } from 'lucide-react';
import { VELVET_THEME } from '../config/velvetTheme';
import { supabase } from '../shared/supabase/client';
import { AtlasTransitionOverlay } from '../components/AtlasTransitionOverlay';

interface ChatMessage {
  role: 'atlas' | 'user';
  content: string;
}

type Phase = 'goal' | 'provisioning' | 'transitioning';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const hasInitialized = useRef(false);
  const phaseRef = useRef<Phase>('goal');

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

  // ── Initialize: start the goal discovery conversation ──────────────────

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

        const atlasMsg: ChatMessage = { role: 'atlas', content: data.reply };
        transcriptRef.current = [atlasMsg];
        setMessages([atlasMsg]);
      } catch {
        setError('Something went wrong starting the conversation. Please refresh.');
      }
    })();
  }, [navigate]);

  // ── Send message ──────────────────────────────────────────────────────

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    if (phase === 'provisioning' || phase === 'transitioning') return;

    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
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

      const atlasMsg: ChatMessage = { role: 'atlas', content: data.reply };
      transcriptRef.current = [...updatedTranscript, atlasMsg];
      setMessages(prev => [...prev, atlasMsg]);

      if (data.isComplete && currentPhase === 'goal') {
        await handleGoalComplete(updatedTranscript, atlasMsg);
      }
    } catch {
      setError('Connection issue. Please try sending your message again.');
    } finally {
      setIsThinking(false);
    }
  };

  // ── Goal phase complete → provision coach → transition to questionnaire ─

  const handleGoalComplete = async (finalTranscript: ChatMessage[], lastAtlasMsg: ChatMessage) => {
    updatePhase('provisioning');
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fullTranscript = [...finalTranscript, lastAtlasMsg].filter(
        m => m.role === 'user' || (m.role === 'atlas' && m.content)
      );

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

      // Show Atlas transition message in chat, then reveal the overlay
      const transitionMsg = `Your coach ${data.coachName} is ready${data.expertDomain ? ` — they'll help you with ${data.expertDomain}` : ''}. Now let me learn a bit about you so I can personalize everything. This'll take about 90 seconds.`;
      setMessages(prev => [...prev, { role: 'atlas', content: transitionMsg }]);

      setTimeout(() => {
        updatePhase('transitioning');
        setShowTransition(true);
        setIsThinking(false);
      }, 2000);
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

  // ── Render ─────────────────────────────────────────────────────────────

  const phaseLabels: Record<Phase, string> = {
    goal: 'Step 1 of 2 — What are you working toward?',
    provisioning: 'Setting up your coach...',
    transitioning: 'Getting ready for the next step...',
  };

  const phaseIcons: Record<Phase, React.ReactNode> = {
    goal: <Compass className="w-4 h-4" />,
    provisioning: <Sparkles className="w-4 h-4 animate-pulse" />,
    transitioning: <Sparkles className="w-4 h-4 animate-pulse" />,
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

      <div className="relative flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pt-8 pb-4">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <div className="flex justify-center mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            >
              <Compass className="w-6 h-6 text-ink-secondary" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Atlas</h1>
          <p className="text-ink-muted text-sm mt-1 flex items-center justify-center gap-1.5">
            {phaseIcons[phase]}
            {phaseLabels[phase]}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-md'
                      : 'text-blue-50 rounded-bl-md'
                  }`}
                  style={
                    msg.role === 'user'
                      ? {
                          background: 'linear-gradient(135deg, #3b5bdb 0%, #4c6ef5 100%)',
                          boxShadow: '0 2px 12px rgba(66,99,235,0.25)',
                        }
                      : {
                          background: VELVET_THEME.colors.glassCard,
                          border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                        }
                  }
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div
                className="px-5 py-4 rounded-2xl rounded-bl-md"
                style={{
                  background: VELVET_THEME.colors.glassCard,
                  border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                }}
              >
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-blue-300/60"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

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
              style={{ background: 'rgba(13,15,60,0.88)', backdropFilter: 'blur(12px)' }}
            >
              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="text-center px-8 max-w-md"
              >
                <div className="flex justify-center mb-6">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center"
                    style={{
                      background: VELVET_THEME.colors.glassCard,
                      border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                    }}
                  >
                    <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">Finding your coach...</h2>
                <p className="text-ink-secondary text-base mb-8">Matching you with someone who can help.</p>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-blue-300/60"
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

      {/* Atlas transition overlay → navigates to questionnaire */}
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
