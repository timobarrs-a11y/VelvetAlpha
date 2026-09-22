import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Lightbulb, Send, Sparkles } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { AtlasTransitionOverlay } from '../components/AtlasTransitionOverlay';
import { useTypingEffect, useWritingIndicator } from '../hooks/useTypingEffect';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { ShellProvider, useShell } from '../shells/ShellProvider';
import { AtlasCrestHeader } from '../shells/slots/AtlasCrestHeader';
import { AtlasFadeTyping } from '../shells/slots/AtlasFadeTyping';
import { AtlasBackgroundScene } from '../shells/slots/AtlasBackgroundScene';
import { AtlasBriefCard } from '../shells/slots/AtlasBriefCard';

interface ChatMessage {
  role: 'atlas' | 'user';
  content: string;
  id: number;
  isRecommendation?: boolean;
}

type Phase = 'goal' | 'confirm' | 'provisioning' | 'transitioning';

interface CoachRecommendation {
  coachName: string;
  coachGender: string;
  expertDomain: string;
  expertId: string | null;
  isCustomExpert: boolean;
  accountabilityLevel: string;
  goalText: string;
  recommendationText: string;
}

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ATLAS_STATE_KEY = 'atlas_concierge_state';

interface SavedState {
  messages: ChatMessage[];
  phase: Phase;
  transcript: ChatMessage[];
  recommendation: CoachRecommendation | null;
  pendingTranscript: ChatMessage[];
  latestAtlasId: number;
  msgIdCounter: number;
}

function saveAtlasState(state: SavedState) {
  try {
    sessionStorage.setItem(ATLAS_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore quota errors */ }
}

function loadAtlasState(): SavedState | null {
  try {
    const raw = sessionStorage.getItem(ATLAS_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (!parsed.messages || !Array.isArray(parsed.messages) || parsed.messages.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAtlasState() {
  try {
    sessionStorage.removeItem(ATLAS_STATE_KEY);
  } catch { /* ignore */ }
}

let msgIdCounter = 0;

function StreamingAtlasMessage({ content, isLatest }: { content: string; isLatest: boolean }) {
  const { displayedText, showCursor } = useTypingEffect(content, isLatest, { speed: 45 });

  return (
    <span>
      {displayedText}
      {showCursor && (
        <motion.span
          className="inline-block w-[2px] h-[1.1em] ml-0.5 align-text-bottom rounded-full"
          style={{ background: 'var(--shell-accent)' }}
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </span>
  );
}

const phaseLabels: Record<Phase, string> = {
  goal: 'A quiet place to begin',
  confirm: 'Your coach match',
  provisioning: 'Setting up your coach\u2026',
  transitioning: 'Almost there\u2026',
};

const STARTER_PROMPTS = [
  'I want to feel more focused',
  'I have a goal but need a plan',
  'Something in my life feels stuck',
];

interface AtlasWelcomePanelProps {
  showPrompts: boolean;
  onPromptSelect: (prompt: string) => void;
}

function AtlasWelcomePanel({ showPrompts, onPromptSelect }: AtlasWelcomePanelProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex lg:flex-col lg:justify-between lg:min-h-[520px] lg:pt-8"
    >
      <div>
        <div className="flex items-center gap-2 mb-6" style={{ color: 'var(--shell-accent-text)' }}>
          <Sparkles className="w-4 h-4" />
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase">Your private briefing</span>
        </div>
        <h2
          className="text-4xl xl:text-5xl font-semibold leading-[1.08] mb-5"
          style={{ fontFamily: 'var(--shell-display-font)', color: 'var(--shell-text-primary)' }}
        >
          A clearer next step starts here.
        </h2>
        <p className="text-base leading-relaxed max-w-sm" style={{ color: 'var(--shell-text-secondary)' }}>
          Atlas helps you turn what is on your mind into a direction you can actually move toward. Start wherever you are.
        </p>
      </div>

      <div className="space-y-3 mt-8">
        {[
          ['01', 'Tell Atlas what matters right now'],
          ['02', 'Shape it into something actionable'],
          ['03', 'Meet the coach built for the journey'],
        ].map(([num, label]) => (
          <div key={num} className="flex items-center gap-3 text-sm" style={{ color: 'var(--shell-text-secondary)' }}>
            <span className="text-[10px] font-semibold tracking-widest" style={{ color: 'var(--shell-accent-text)' }}>{num}</span>
            <span>{label}</span>
          </div>
        ))}
        <div className="h-px w-16 mt-6" style={{ background: 'var(--shell-accent)' }} />
        <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--shell-text-muted)' }}>
          Nothing needs to be perfectly worded. Atlas will help you find the shape of it.
        </p>
      </div>

      {showPrompts && (
        <div className="mt-8 space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.16em] uppercase" style={{ color: 'var(--shell-text-muted)' }}>
            If it helps, begin with one of these
          </p>
          {STARTER_PROMPTS.map(prompt => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="group w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--shell-accent-soft)',
                border: '1px solid var(--shell-border)',
                color: 'var(--shell-text-primary)',
              }}
            >
              <span>{prompt}</span>
              <ArrowUpRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--shell-accent)' }} />
            </button>
          ))}
        </div>
      )}
    </motion.aside>
  );
}

function AtlasConciergeInner() {
  const navigate = useNavigate();
  const { manifest } = useShell();
  const reduced = usePrefersReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>('goal');
  const [coachName, setCoachName] = useState('');
  const [coachId, setCoachId] = useState('');
  const [expertDomain, setExpertDomain] = useState('');
  const [error, setError] = useState('');
  const [showTransition, setShowTransition] = useState(false);
  const [transitionDestination, setTransitionDestination] = useState('/atlas-routing');
  const [latestAtlasId, setLatestAtlasId] = useState(-1);
  const [recommendation, setRecommendation] = useState<CoachRecommendation | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const hasInitialized = useRef(false);
  const phaseRef = useRef<Phase>('goal');

  const writingLabel = useWritingIndicator(isThinking, 4000);

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

    const saved = loadAtlasState();
    if (saved) {
      msgIdCounter = saved.msgIdCounter;
      transcriptRef.current = saved.transcript;
      setMessages(saved.messages);
      setLatestAtlasId(saved.latestAtlasId);
      updatePhase(saved.phase);
      setRecommendation(saved.recommendation);
      setPendingTranscript(saved.pendingTranscript);
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/splash', { replace: true });
          return;
        }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('profile_completed, name, birthday, gender')
          .eq('id', session.user.id)
          .maybeSingle();

        const profileComplete = !!(
          profile?.profile_completed ||
          (profile?.name && profile.name !== 'babe' && profile.name !== 'there' &&
           profile?.birthday && profile?.gender)
        );

        if (!profileComplete) {
          navigate('/user-questionnaire', { replace: true });
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

  useEffect(() => {
    if (messages.length > 0) {
      saveAtlasState({
        messages,
        phase,
        transcript: transcriptRef.current,
        recommendation,
        pendingTranscript,
        latestAtlasId,
        msgIdCounter,
      });
    }
  }, [messages, phase, recommendation, pendingTranscript, latestAtlasId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;
    if (phase !== 'goal') return;

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
    updatePhase('confirm');
    setIsThinking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const fullTranscript = [...finalTranscript, lastAtlasMsg].filter(
        m => m.role === 'user' || (m.role === 'atlas' && m.content)
      );

      setPendingTranscript(fullTranscript);

      const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phase: 'confirm',
          transcript: fullTranscript,
        }),
      });

      if (!response.ok) throw new Error('Classification failed');
      const data = await response.json();

      if (data.recommendation) {
        const rec = data.recommendation as CoachRecommendation;
        setRecommendation(rec);

        const recId = ++msgIdCounter;
        const recMsg: ChatMessage = {
          role: 'atlas',
          content: rec.recommendationText,
          id: recId,
          isRecommendation: true,
        };
        transcriptRef.current = [...transcriptRef.current, recMsg];
        setMessages(prev => [...prev, recMsg]);
        setLatestAtlasId(recId);
      }
    } catch {
      setError('Something went wrong finding your coach. Please try again.');
    } finally {
      setIsThinking(false);
    }
  };

  const handleAcceptCoach = async () => {
    if (!recommendation) return;
    updatePhase('provisioning');
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
          phase: 'provisioning',
          transcript: pendingTranscript,
          recommendation,
        }),
      });

      if (!response.ok) throw new Error('Provisioning failed');
      const data = await response.json();

      setCoachName(data.coachName || recommendation.coachName);
      setCoachId(data.coachId || '');
      setExpertDomain(data.expertDomain || recommendation.expertDomain);

      if (data.goalText) sessionStorage.setItem('atlasGoalText', data.goalText);
      if (recommendation.coachGender) sessionStorage.setItem('atlasCoachGender', recommendation.coachGender);
      sessionStorage.setItem('atlasCoachName', data.coachName || recommendation.coachName);

      sessionStorage.setItem('atlasNextDestination', '/atlas-routing');
      setTransitionDestination('/coach-avatar');

      const transitionMsg = `Your coach ${data.coachName} is ready${data.expertDomain ? ` \u2014 they'll help you with ${data.expertDomain}` : ''}. Let's give them a face \u2014 customize every detail or randomize for an instant look.`;
      const transId = ++msgIdCounter;
      setMessages(prev => [...prev, { role: 'atlas', content: transitionMsg, id: transId }]);
      setLatestAtlasId(transId);

      setTimeout(() => {
        updatePhase('transitioning');
        setShowTransition(true);
        setIsThinking(false);
      }, 2500);
    } catch {
      setError('Something went wrong setting up your coach. You can continue and we\'ll retry later.');
      setTimeout(() => {
        navigate('/atlas-routing', { replace: true });
      }, 2500);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRefineCoach = () => {
    setRecommendation(null);
    updatePhase('goal');

    const refineId = ++msgIdCounter;
    const refineMsg: ChatMessage = {
      role: 'atlas',
      content: "No problem \u2014 let's dig a bit deeper. What specifically would you want to adjust about the goal or the kind of support you're looking for?",
      id: refineId,
    };
    transcriptRef.current = [...transcriptRef.current, refineMsg];
    setMessages(prev => [...prev, refineMsg]);
    setLatestAtlasId(refineId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const transitionMessage = coachName
    ? `Your coach ${coachName} is ready${expertDomain ? ` to help you with ${expertDomain}` : ''}.`
    : 'Your coach is ready.';
  const transitionSubMessage = 'Design their avatar next \u2014 pick a look, hit randomize, or skip and keep the default.';

  const ease = manifest.motion.ease;
  const durBase = manifest.motion.durationBase / 1000;
  const hasUserMessage = messages.some(message => message.role === 'user');
  const showStarterPrompts = phase === 'goal' && messages.length >= 1 && !isThinking && !hasUserMessage;

  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  if (error && messages.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--shell-bg)' }}>
        <div className="text-center max-w-md">
          <p className="text-lg mb-6" style={{ color: 'var(--shell-text-primary)' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-semibold"
            style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--shell-bg)' }}>
      <AtlasBackgroundScene />

      <div className="relative z-10 flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 pb-6 min-h-screen">
        <AtlasCrestHeader subtitle={phaseLabels[phase]} />

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(240px,0.78fr)_minmax(0,1.22fr)] gap-8 lg:gap-12 items-start">
          <AtlasWelcomePanel showPrompts={showStarterPrompts} onPromptSelect={handlePromptSelect} />

          <main className="w-full max-w-2xl lg:max-w-none mx-auto flex flex-col min-h-[520px]">
            <div
              className="flex-1 rounded-[1.75rem] p-4 sm:p-6 overflow-y-auto space-y-3"
              style={{
                background: 'rgba(10, 14, 31, 0.28)',
                border: '1px solid var(--shell-border)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex items-center gap-2 mb-5 px-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--shell-accent)' }} />
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'var(--shell-text-muted)' }}>
                  Atlas is listening
                </span>
              </div>

              <AnimatePresence>
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isRecommendation = msg.isRecommendation;

                  if (isRecommendation) {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <AtlasBriefCard
                          onAccept={handleAcceptCoach}
                          onRefine={handleRefineCoach}
                          acceptLabel="Yes, set me up"
                          refineLabel="Not quite, let me refine"
                          disabled={isThinking}
                        >
                          <StreamingAtlasMessage
                            content={msg.content}
                            isLatest={msg.id === latestAtlasId}
                          />
                        </AtlasBriefCard>
                      </div>
                    );
                  }

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: durBase, ease }}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] px-4 sm:px-5 py-4 rounded-2xl text-[15px] leading-relaxed ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
                        style={{
                          background: isUser ? 'var(--shell-user-bubble)' : 'var(--shell-agent-bubble)',
                          color: isUser ? 'var(--shell-user-bubble-text)' : 'var(--shell-agent-bubble-text)',
                          border: isUser ? 'none' : '1px solid var(--shell-border)',
                          backdropFilter: isUser ? 'none' : 'blur(12px)',
                          boxShadow: isUser ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
                        }}
                      >
                        {isUser ? msg.content : (
                          <StreamingAtlasMessage content={msg.content} isLatest={msg.id === latestAtlasId} />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <AnimatePresence>
                {isThinking && <AtlasFadeTyping label={writingLabel} />}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {showStarterPrompts && (
              <div className="lg:hidden mt-3 space-y-2">
                <p className="text-[11px] font-semibold tracking-[0.16em] uppercase px-1" style={{ color: 'var(--shell-text-muted)' }}>
                  Begin with one of these
                </p>
                {STARTER_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handlePromptSelect(prompt)}
                    className="group w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-sm transition-all hover:-translate-y-0.5"
                    style={{
                      background: 'var(--shell-accent-soft)',
                      border: '1px solid var(--shell-border)',
                      color: 'var(--shell-text-primary)',
                    }}
                  >
                    <span>{prompt}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--shell-accent)' }} />
                  </button>
                ))}
              </div>
            )}

            {phase === 'goal' && (
              <div className="mt-4">
                <div
                  className="rounded-2xl p-2 transition-all"
                  style={{
                    background: 'var(--shell-surface)',
                    border: '1px solid var(--shell-border-strong)',
                    boxShadow: 'var(--shell-shadow)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div className="flex items-end gap-2">
                    <div className="flex-1 flex items-start gap-3 px-3 py-2">
                      <Lightbulb className="w-4 h-4 mt-1 shrink-0" style={{ color: 'var(--shell-accent)' }} />
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={manifest.copy.inputPlaceholder}
                        rows={2}
                        disabled={isThinking}
                        className="w-full bg-transparent border-0 text-[15px] leading-relaxed resize-none overflow-hidden focus:outline-none"
                        style={{ color: 'var(--shell-text-primary)', minHeight: '54px', maxHeight: '120px' }}
                      />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isThinking}
                      aria-label="Send to Atlas"
                      className="flex-shrink-0 w-11 h-11 mb-0.5 rounded-xl flex items-center justify-center transition-all hover:scale-[1.03] disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-3 pb-1 pt-1 text-[10px]" style={{ color: 'var(--shell-text-muted)' }}>
                    <span>There is no perfect way to say it.</span>
                    <span className="hidden sm:inline">Enter to continue · Shift + Enter for a new line</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

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
              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={
                  reduced
                    ? { duration: 0.3 }
                    : { type: 'spring', stiffness: 200, damping: 18 }
                }
                className="relative text-center px-8 max-w-md"
              >
                <div className="flex justify-center mb-6">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center relative"
                    style={{
                      background: 'var(--shell-surface)',
                      border: '1px solid var(--shell-border-strong)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-3xl"
                      style={{
                        background: 'radial-gradient(circle, var(--shell-accent-soft) 0%, transparent 70%)',
                      }}
                      animate={reduced ? undefined : { opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.15, 0.85] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      animate={reduced ? undefined : { rotate: [0, 360] }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    >
                      <img
                        src={`data:image/svg+xml,${encodeURIComponent(manifest.crestSvg ?? '')}`}
                        alt="Atlas"
                        className="w-8 h-8 relative z-10"
                      />
                    </motion.div>
                  </div>
                </div>
                <h2
                  className="text-2xl font-bold mb-3"
                  style={{
                    fontFamily: 'var(--shell-display-font)',
                    color: 'var(--shell-text-primary)',
                  }}
                >
                  Setting up your coach…
                </h2>
                <p className="text-base mb-8" style={{ color: 'var(--shell-text-secondary)' }}>
                  Getting everything ready.
                </p>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'var(--shell-accent)' }}
                      animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AtlasTransitionOverlay
        message={transitionMessage}
        subMessage={transitionSubMessage}
        destination={transitionDestination}
        visible={showTransition}
        autoAdvanceMs={3000}
        onAdvance={() => {
          if (coachId) sessionStorage.setItem('atlasCoachId', coachId);
          if (recommendation?.goalText) sessionStorage.setItem('atlasGoalText', recommendation.goalText);
          if (recommendation?.coachGender) sessionStorage.setItem('atlasCoachGender', recommendation.coachGender);
          clearAtlasState();
        }}
      />
    </div>
  );
}

export const AtlasConciergePage = () => {
  return (
    <ShellProvider agentId="atlas" forceDark>
      <AtlasConciergeInner />
    </ShellProvider>
  );
};
