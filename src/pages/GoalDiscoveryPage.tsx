import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Check } from 'lucide-react';
import { VELVET_THEME } from '../config/velvetTheme';
import { supabase } from '../shared/supabase/client';

interface ChatMessage {
  role: 'velvet' | 'user';
  content: string;
}

type Phase = 'conversing' | 'extracting' | 'provisioning' | 'complete';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const GoalDiscoveryPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>('conversing');
  const [coachName, setCoachName] = useState('');
  const [expertName, setExpertName] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const hasInitialized = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

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

        const response = await fetch(`${FUNCTION_BASE}/goal-discovery-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: [] }),
        });

        if (!response.ok) throw new Error('Failed to start conversation');
        const data = await response.json();

        transcriptRef.current = [{ role: 'velvet', content: data.reply }];
        setMessages([{ role: 'velvet', content: data.reply }]);
      } catch {
        setError('Something went wrong starting the conversation. Please refresh.');
      }
    })();
  }, [navigate]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking || phase !== 'conversing') return;

    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedTranscript = [...transcriptRef.current, userMsg];
    transcriptRef.current = updatedTranscript;
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${FUNCTION_BASE}/goal-discovery-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: updatedTranscript }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();

      const velvetMsg: ChatMessage = { role: 'velvet', content: data.reply };
      transcriptRef.current = [...updatedTranscript, velvetMsg];
      setMessages(prev => [...prev, velvetMsg]);

      if (data.isComplete) {
        await handleCompletion(updatedTranscript, velvetMsg);
      }
    } catch {
      setError('Connection issue. Please try sending your message again.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleCompletion = async (finalTranscript: ChatMessage[], lastVelvetMsg: ChatMessage) => {
    setPhase('extracting');
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fullTranscript = [...finalTranscript, lastVelvetMsg].filter(
        m => m.role === 'user' || (m.role === 'velvet' && m.content)
      );

      const extractResponse = await fetch(`${FUNCTION_BASE}/extract-goal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ transcript: fullTranscript }),
      });

      if (!extractResponse.ok) throw new Error('Extraction failed');
      const extracted = await extractResponse.json();

      setPhase('provisioning');

      const coachResponse = await fetch(`${FUNCTION_BASE}/sync-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          goalType: extracted.goalType,
          goalText: extracted.goalText,
          accountabilityLevel: extracted.accountabilityLevel,
          coachName: extracted.coachName,
          coachGender: extracted.coachGender,
          expertId: extracted.expertId,
        }),
      });

      if (!coachResponse.ok) throw new Error('Coach provisioning failed');
      const coachData = await coachResponse.json();

      setCoachName(coachData.coachName || 'your coach');
      setExpertName(coachData.expertName || '');
      setPhase('complete');
    } catch {
      setError('Something went wrong setting up your coach. You can continue and we\'ll retry later.');
      setTimeout(() => {
        navigate('/user-questionnaire', { replace: true });
      }, 2500);
    } finally {
      setIsThinking(false);
    }
  };

  const handleContinue = () => {
    navigate('/user-questionnaire', { replace: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderPhaseOverlay = () => {
    if (phase === 'conversing') return null;

    const phaseContent: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
      extracting: {
        icon: <Sparkles className="w-7 h-7 text-blue-300 animate-pulse" />,
        title: 'Understanding your goal...',
        subtitle: 'I\'m making sense of what you told me.',
      },
      provisioning: {
        icon: <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />,
        title: 'Finding your coach...',
        subtitle: 'Matching you with someone who can help.',
      },
      complete: {
        icon: <Check className="w-7 h-7 text-emerald-400" />,
        title: coachName ? `Meet ${coachName}` : 'Your coach is ready',
        subtitle: expertName ? `Your ${expertName.toLowerCase()} is ready to help.` : 'Your coach is ready to help.',
      },
    };

    const content = phaseContent[phase];
    if (!content) return null;

    return (
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
              {content.icon}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{content.title}</h2>
          <p className="text-blue-200/70 text-base mb-8">{content.subtitle}</p>

          {phase === 'complete' && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              onClick={handleContinue}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl text-white font-bold text-base transition-all"
              style={{
                background: VELVET_THEME.button.primary,
                boxShadow: VELVET_THEME.button.primaryGlow,
              }}
            >
              Now let's learn more about you
            </motion.button>
          )}

          {phase !== 'complete' && (
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
          )}
        </motion.div>
      </motion.div>
    );
  };

  if (error && messages.length === 0) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: VELVET_THEME.bg }}
      >
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: VELVET_THEME.bg }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_THEME.radial }} />

      <div className="relative flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 pt-8 pb-4">
        <div className="text-center mb-6 flex-shrink-0">
          <div className="flex justify-center mb-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            >
              <Sparkles className="w-6 h-6 text-blue-300" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Velvet</h1>
          <p className="text-blue-200/50 text-sm mt-1">Let's find what you're working toward</p>
        </div>

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

          {isThinking && phase === 'conversing' && (
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

        {phase === 'conversing' && (
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
                className="flex-1 px-4 py-3 rounded-2xl border text-[15px] text-white placeholder:text-blue-200/40 focus:outline-none resize-none overflow-hidden transition-all"
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
                style={{
                  background: VELVET_THEME.button.primary,
                  boxShadow: input.trim() ? VELVET_THEME.button.primaryGlow : 'none',
                }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {error && (
              <p className="text-rose-300/70 text-xs mt-2 px-1">{error}</p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>{renderPhaseOverlay()}</AnimatePresence>
    </div>
  );
};
