import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Check, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import { VELVET_THEME } from '../config/velvetTheme';
import { supabase } from '../shared/supabase/client';
import { supabase as supabaseClient } from '../shared/supabase/client';

interface ChatMessage {
  role: 'velvet' | 'user';
  content: string;
}

type Phase = 'conversing' | 'extracting' | 'provisioning' | 'complete' | 'error';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const GOAL_TYPE_OPTIONS = [
  { value: 'health_fitness', label: 'Health & Fitness' },
  { value: 'reading', label: 'Reading' },
  { value: 'creative', label: 'Creative' },
  { value: 'habit', label: 'Habit' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'skill', label: 'Skill' },
  { value: 'project', label: 'Project' },
];

export const GoalDiscoveryPage = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>('conversing');
  const [coachName, setCoachName] = useState('');
  const [expertName, setExpertName] = useState('');
  const [error, setError] = useState('');
  const [retryState, setRetryState] = useState<{ kind: 'init' | 'send' | 'extract' | 'provision'; transcript?: ChatMessage[]; lastVelvet?: ChatMessage } | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const hasInitialized = useRef(false);

  // Manual goal entry form state
  const [manualGoal, setManualGoal] = useState({
    goalType: 'health_fitness',
    goalText: '',
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  const initConversation = useCallback(async () => {
    setError('');
    setRetryState(null);
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

      if (!response.ok) throw new Error(`Failed to start conversation (${response.status})`);
      const data = await response.json();

      transcriptRef.current = [{ role: 'velvet', content: data.reply }];
      setMessages([{ role: 'velvet', content: data.reply }]);
    } catch {
      setError('Something went wrong starting the conversation.');
      setRetryState({ kind: 'init' });
    }
  }, [navigate]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    initConversation();
  }, [initConversation]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking || phase !== 'conversing') return;

    setInput('');
    setError('');
    setRetryState(null);

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

      if (!response.ok) throw new Error(`Failed to get response (${response.status})`);
      const data = await response.json();

      const velvetMsg: ChatMessage = { role: 'velvet', content: data.reply };
      transcriptRef.current = [...updatedTranscript, velvetMsg];
      setMessages(prev => [...prev, velvetMsg]);

      if (data.isComplete) {
        await handleCompletion(updatedTranscript, velvetMsg);
      }
    } catch {
      // Roll back the optimistic user message so the transcript stays clean on retry
      transcriptRef.current = transcriptRef.current.filter(m => m !== userMsg);
      setMessages(prev => prev.filter(m => m !== userMsg));
      setError('Connection issue. Your message wasn\'t sent — please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleCompletion = async (finalTranscript: ChatMessage[], lastVelvetMsg: ChatMessage) => {
    await runExtractionAndProvisioning(finalTranscript, lastVelvetMsg);
  };

  const runExtractionAndProvisioning = async (finalTranscript: ChatMessage[], lastVelvetMsg: ChatMessage) => {
    setPhase('extracting');
    setIsThinking(true);
    setError('');
    setRetryState(null);

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

      if (!extractResponse.ok) throw new Error(`Extraction failed (${extractResponse.status})`);
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

      if (!coachResponse.ok) throw new Error(`Coach provisioning failed (${coachResponse.status})`);
      const coachData = await coachResponse.json();

      setCoachName(coachData.coachName || 'your coach');
      setExpertName(coachData.expertName || '');
      setPhase('complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      const isProvision = msg.includes('provisioning') || phase === 'provisioning';
      setError(msg);
      setRetryState({
        kind: isProvision ? 'provision' : 'extract',
        transcript: finalTranscript,
        lastVelvet: lastVelvetMsg,
      });
      setPhase('error');
    } finally {
      setIsThinking(false);
    }
  };

  const handleRetry = async () => {
    if (!retryState) return;
    if (retryState.kind === 'init') {
      await initConversation();
    } else if (retryState.kind === 'extract' || retryState.kind === 'provision') {
      if (retryState.transcript && retryState.lastVelvet) {
        await runExtractionAndProvisioning(retryState.transcript, retryState.lastVelvet);
      }
    }
  };

  const handleManualGoalSubmit = async () => {
    if (!manualGoal.goalText.trim()) return;
    setPhase('provisioning');
    setIsThinking(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Insert goal directly via Supabase client
      const { data: goalData, error: goalErr } = await supabaseClient
        .from('user_goals')
        .insert({
          title: manualGoal.goalText.trim(),
          goal_type: manualGoal.goalType,
          status: 'active',
          source: 'manual_entry',
        })
        .select('id')
        .maybeSingle();

      if (goalErr || !goalData) {
        throw new Error('Could not save your goal. Please try again.');
      }

      // Try to provision a coach with the manual goal info
      const coachResponse = await fetch(`${FUNCTION_BASE}/sync-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          goalType: manualGoal.goalType,
          goalText: manualGoal.goalText,
          accountabilityLevel: 'moderate',
        }),
      });

      let coachData: { coachName?: string; expertName?: string } = {};
      if (coachResponse.ok) {
        coachData = await coachResponse.json();
      }

      setCoachName(coachData.coachName || 'your coach');
      setExpertName(coachData.expertName || '');
      setPhase('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setPhase('error');
      setRetryState({ kind: 'provision' });
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

    if (phase === 'error') {
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
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Something went wrong</h2>
            <p className="text-ink-secondary text-sm mb-6">{error || 'An unexpected error occurred.'}</p>

            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold text-sm transition-all"
                style={{ background: VELVET_THEME.button.primary, boxShadow: VELVET_THEME.button.primaryGlow }}
              >
                <RefreshCw className="w-4 h-4" /> Try again
              </button>

              {retryState && (retryState.kind === 'extract' || retryState.kind === 'provision') && (
                <button
                  onClick={() => setShowManualEntry(true)}
                  className="text-ink-secondary text-sm hover:text-white transition-colors underline underline-offset-4"
                >
                  Skip and enter my goal manually
                </button>
              )}

              <button
                onClick={handleContinue}
                className="text-ink-muted text-xs hover:text-white/70 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        </motion.div>
      );
    }

    const phaseContent: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
      extracting: {
        icon: <Sparkles className="w-7 h-7 text-ink-secondary animate-pulse" />,
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
          <p className="text-ink-secondary text-base mb-8">{content.subtitle}</p>

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

  if (error && messages.length === 0 && retryState?.kind === 'init') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: VELVET_THEME.bg }}
      >
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: VELVET_THEME.colors.glassCard, border: `1px solid ${VELVET_THEME.colors.glassBorder}` }}
            >
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <p className="text-white/80 text-lg mb-2">{error}</p>
          <p className="text-ink-muted text-sm mb-6">We couldn't start the conversation. Please try again.</p>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => initConversation()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold"
              style={{ background: VELVET_THEME.button.primary }}
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
            <button
              onClick={() => setShowManualEntry(true)}
              className="text-ink-secondary text-sm hover:text-white transition-colors underline underline-offset-4"
            >
              Enter my goal manually instead
            </button>
          </div>
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
              <Sparkles className="w-6 h-6 text-ink-secondary" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Velvet</h1>
          <p className="text-ink-muted text-sm mt-1">Let's find what you're working toward</p>
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

      {/* Manual goal entry modal */}
      <AnimatePresence>
        {showManualEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(13,15,60,0.88)', backdropFilter: 'blur(12px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: VELVET_THEME.colors.glassCard, border: `1px solid ${VELVET_THEME.colors.glassBorder}` }}
            >
              <h2 className="text-xl font-bold text-white mb-2">What are you working toward?</h2>
              <p className="text-ink-muted text-sm mb-5">Tell us your goal and we'll match you with a coach.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                    Goal type
                  </label>
                  <select
                    value={manualGoal.goalType}
                    onChange={(e) => setManualGoal(prev => ({ ...prev, goalType: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white border focus:outline-none"
                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: VELVET_THEME.colors.glassBorder }}
                  >
                    {GOAL_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
                    Describe your goal
                  </label>
                  <textarea
                    value={manualGoal.goalText}
                    onChange={(e) => setManualGoal(prev => ({ ...prev, goalText: e.target.value }))}
                    placeholder="e.g., I want to run a 5K by spring, or I want to write 500 words every day"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-ink-subtle border focus:outline-none resize-none"
                    style={{ background: 'rgba(0,0,0,0.2)', borderColor: VELVET_THEME.colors.glassBorder }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowManualEntry(false); setPhase('conversing'); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-ink-muted hover:text-white transition-colors"
                >
                  Back to chat
                </button>
                <button
                  onClick={handleManualGoalSubmit}
                  disabled={!manualGoal.goalText.trim() || isThinking}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: VELVET_THEME.button.primary, boxShadow: VELVET_THEME.button.primaryGlow }}
                >
                  {isThinking ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Setting up...</>
                  ) : (
                    <>Continue <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{renderPhaseOverlay()}</AnimatePresence>
    </div>
  );
};
