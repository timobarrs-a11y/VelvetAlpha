import { helperPronouns } from '../features/arrival/helperPronouns';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Compass, CalendarCheck } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { useTypingEffect, useWritingIndicator } from '../hooks/useTypingEffect';
import { ShellProvider, useShell } from '../shells/ShellProvider';
import { ArrivalProgress } from '../features/arrival/ArrivalProgress';
import { AtlasFadeTyping } from '../shells/slots/AtlasFadeTyping';
import { AtlasBackgroundScene } from '../shells/slots/AtlasBackgroundScene';
import { getSetupProgress, updateSetupProgress } from '../services/setupProgressService';
import { sanitizeAvatarConfigForSave } from '../services/avatarSaveService';
import type { AvatarConfigV2 } from '../types/avatar-v2';
import { callAtlas } from '../features/arrival/atlasApi';
import { ARRIVAL_ROUTES } from '../features/arrival/arrivalRoutes';
import { setHomeLayout } from '../hooks/useHomeLayout';
import { Highlighted } from '../features/arrival/Highlighted';
import {
  clearPlanJob, loadPlanJob, resumePlanJob, startPlanJob, type JobDeps, type PlanJob, type Provisioned, type Recommendation,
} from '../features/arrival/arrivalPlanJob';
import { MeetCard } from '../features/arrival/MeetCard';
import { PlanWalkthrough, type PlanSummary } from '../features/arrival/PlanWalkthrough';
import { formatDay } from '../features/arrival/arrivalUtils';
import type { ArrivalPlan } from '../../supabase/functions/_shared/atlasArrival';
import { ArrivalTheme } from '../features/arrival/ArrivalTheme';

interface ChatMessage {
  role: 'atlas' | 'user';
  content: string;
  id: number;
  chips?: string[];
  pencilled?: { title: string; date: string }[];
  /** Feature words to bold and colour, like "plan". */
  highlight?: string[];
}

// The arrival visits Atlas twice, with the avatar and house in between:
// goal: the conversation, ending when the goal, its deadline and why are clear
// handoff: the goal is locked and the plan is being drafted; off to make an avatar
// meet: back with the plan drafted, and who'll carry it · walkthrough: plan to calendar
// billboard: one last question · done: off to Today
type Phase = 'goal' | 'handoff' | 'meet' | 'walkthrough' | 'billboard' | 'done';

const ATLAS_STATE_KEY = 'atlas_arrival_state';

interface SavedState {
  messages: ChatMessage[];
  phase: Phase;
  recommendation: Recommendation | null;
  helperAvatar: AvatarConfigV2 | null;
  provisioned: Provisioned | null;
  plan: ArrivalPlan | null;
  summary: PlanSummary | null;
  latestAtlasId: number;
  msgIdCounter: number;
}

// Kept in the browser per account, so someone who leaves part-way (or taps
// Finish later) comes back to the same conversation. Gone after a week.
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;
const stateKey = (userId: string) => `${ATLAS_STATE_KEY}:${userId}`;

function saveState(userId: string, state: SavedState) {
  try { localStorage.setItem(stateKey(userId), JSON.stringify({ ...state, savedAt: Date.now() })); } catch { /* storage full or blocked */ }
}

function loadState(userId: string): SavedState | null {
  try {
    const raw = localStorage.getItem(stateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState & { savedAt?: number };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > KEEP_FOR_MS) return null;
    return Array.isArray(parsed.messages) && parsed.messages.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function clearState(userId: string) {
  try { localStorage.removeItem(stateKey(userId)); } catch { /* storage blocked */ }
}

const jobDeps: JobDeps = { call: callAtlas, sanitizeAvatar: sanitizeAvatarConfigForSave };

let msgIdCounter = 0;

function StreamingAtlasMessage({ content, isLatest, highlight = [] }: { content: string; isLatest: boolean; highlight?: string[] }) {
  const { displayedText, showCursor } = useTypingEffect(content, isLatest, { speed: 45 });
  return (
    <span className="whitespace-pre-line">
      <Highlighted text={displayedText} words={highlight} />
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

const BILLBOARD_QUESTION = 'One last thing. Shall I put this goal on your billboard in town, so your neighbors can cheer you on?';
const BILLBOARD_CHIPS = ['Yes, put it up', 'Keep it to myself'];

function AtlasConciergeInner() {
  const navigate = useNavigate();
  const { manifest } = useShell();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [phase, setPhase] = useState<Phase>('goal');
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [helperAvatar, setHelperAvatar] = useState<AvatarConfigV2 | null>(null);
  const [provisioned, setProvisioned] = useState<Provisioned | null>(null);
  const [plan, setPlan] = useState<ArrivalPlan | null>(null);
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [error, setError] = useState('');
  const [latestAtlasId, setLatestAtlasId] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<ChatMessage[]>([]);
  const hasInitialized = useRef(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [needsRetry, setNeedsRetry] = useState(false);
  const writingLabel = useWritingIndicator(isThinking, 4000);

  // Keep the newest words in view. The chat sits at the bottom whenever it is opened, restored or added
  // to, and stays there as the line types out and the cards below it appear (which change its height
  // after the first scroll). Someone who scrolls up to reread is left where they are until the next message.
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const toBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    else el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    stickToBottom.current = true;
    toBottom(messages.length > 1);
    messagesEndRef.current?.scrollIntoView?.({ block: 'end', behavior: 'auto' });
  }, [messages.length, isThinking, phase, toBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => { if (stickToBottom.current) toBottom(); });
    observer.observe(content);
    return () => observer.disconnect();
  }, [toBottom]);

  const addAtlas = useCallback((content: string, extra: Partial<ChatMessage> = {}) => {
    const id = ++msgIdCounter;
    const msg: ChatMessage = { role: 'atlas', content, id, ...extra };
    transcriptRef.current = [...transcriptRef.current, msg];
    setMessages(prev => [...prev, msg]);
    setLatestAtlasId(id);
  }, []);

  const applyJob = useCallback((job: PlanJob) => {
    setRecommendation(job.recommendation ?? null);
    setHelperAvatar(job.helperAvatar ?? null);
    setProvisioned(job.provisioned ?? null);
    setPlan(job.plan ?? null);
    setSummary(job.summary ?? null);
  }, []);

  /** Back from the avatar and house: the plan that was drafted meanwhile, and who will carry it. */
  const bringBack = useCallback(async (uid: string): Promise<boolean> => {
    const pending = resumePlanJob(uid, jobDeps);
    if (!pending) return false;
    setError('');
    setNeedsRetry(false);
    setIsThinking(true);
    const job = await pending;
    setIsThinking(false);
    if (job.status !== 'ready' || !job.recommendation) {
      setError("I couldn't finish your plan just now.");
      setNeedsRetry(true);
      return true;
    }
    applyJob(job);
    const name = job.recommendation.helperName;
    const role = job.recommendation.kind === 'coach' ? 'coach' : 'assistant';
    addAtlas(
      `Splendid work. Your plan is ready for you to look over. And I'd like you to meet ${name}, your ${role}. From here, ${name} is the one to ask about all of this, and I rather think you'll find ${helperPronouns(job.recommendation.helperGender).object} good company.`,
      { highlight: ['plan'] },
    );
    setPhase('meet');
    return true;
  }, [addAtlas, applyJob]);

  // Start, or pick up where they left off in this tab.
  useEffect(() => {
    if (hasInitialized.current || !userId) return;
    hasInitialized.current = true;

    (async () => {
      try {
        const progress = await getSetupProgress(userId);
        const returning = progress?.step === 'arrival_atlas' && !!loadPlanJob(userId);
        const saved = loadState(userId);
        if (saved) {
          msgIdCounter = saved.msgIdCounter;
          transcriptRef.current = saved.messages;
          setMessages(saved.messages);
          setLatestAtlasId(saved.latestAtlasId);
          setPhase(saved.phase);
          setRecommendation(saved.recommendation);
          setHelperAvatar(saved.helperAvatar);
          setProvisioned(saved.provisioned);
          setPlan(saved.plan);
          setSummary(saved.summary);
          if (returning && (saved.phase === 'goal' || saved.phase === 'handoff')) await bringBack(userId);
          return;
        }

        if (returning && (await bringBack(userId))) return;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('profile_completed, name, nickname, birthday, gender')
          .eq('id', userId)
          .maybeSingle();
        const profileComplete = !!(
          profile?.profile_completed ||
          ((profile?.nickname?.trim() || (profile?.name && profile.name !== 'babe' && profile.name !== 'there')) && profile?.birthday && profile?.gender)
        );
        if (!profileComplete) {
          navigate('/user-questionnaire', { replace: true });
          return;
        }
        const data = await callAtlas({ phase: 'goal', messages: [] });
        addAtlas(data.reply, { chips: data.chips });
      } catch {
        setError('Something went wrong starting the conversation. Please refresh.');
      }
    })();
  }, [navigate, addAtlas, bringBack, userId]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (userId) saveState(userId, { messages, phase, recommendation, helperAvatar, provisioned, plan, summary, latestAtlasId, msgIdCounter });
  }, [messages, phase, recommendation, helperAvatar, provisioned, plan, summary, latestAtlasId, userId]);

  /**
   * The goal, its deadline and why it matters are clear. Atlas starts drafting the plan in the
   * background and sends them off to make their avatar and pick their house; he is waiting with
   * it when they get back.
   */
  const handleGoalComplete = async () => {
    if (!userId) return;
    const transcript = transcriptRef.current.filter(m => m.content).map(({ role, content }) => ({ role, content }));
    startPlanJob(userId, transcript, jobDeps).catch(() => {});
    await updateSetupProgress(userId, { step: 'arrival_look' });
    addAtlas(
      "Very good. I'll get working on a plan for this for you right now. In the meantime, it's time to create your digital avatar.",
      { highlight: ['plan'] },
    );
    setPhase('handoff');
  };

  const send = async (text: string) => {
    if (!text.trim() || isThinking || phase !== 'goal') return;
    setInput('');
    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), id: ++msgIdCounter };
    const updated = [...transcriptRef.current, userMsg];
    transcriptRef.current = updated;
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    try {
      const data = await callAtlas({
        phase: 'goal',
        messages: updated.map(({ role, content }) => ({ role, content })),
      });
      setIsThinking(false);
      if (data.reply) addAtlas(data.reply, { chips: data.chips, pencilled: data.pencilled });
      if (data.isComplete) await handleGoalComplete();
    } catch {
      setError('Connection issue. Please try sending your message again.');
      setIsThinking(false);
    }
  };

  const handleContinue = () => {
    if (plan && summary) setPhase('walkthrough');
  };

  const handleCommitPlan = async () => {
    if (!plan || !provisioned) return;
    setIsThinking(true);
    setError('');
    try {
      await callAtlas({ phase: 'commit_plan', goalId: provisioned.goalId, helperId: provisioned.helperId, plan });
      setPhase('billboard');
      addAtlas(BILLBOARD_QUESTION, { chips: BILLBOARD_CHIPS });
    } catch {
      setError("I couldn't put it on your calendar just now. Please try again.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleBillboard = async (answer: string) => {
    if (!provisioned) return;
    const show = answer === BILLBOARD_CHIPS[0];
    const userMsg: ChatMessage = { role: 'user', content: answer, id: ++msgIdCounter };
    transcriptRef.current = [...transcriptRef.current, userMsg];
    setMessages(prev => [...prev, userMsg]);
    await supabase.from('user_goals').update({ show_on_profile: show }).eq('id', provisioned.goalId);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await updateSetupProgress(user.id, { step: 'complete' });
    addAtlas(show
      ? `Very good. It's up. Your first step is waiting for you in Today, and ${recommendation?.helperName ?? 'your helper'} will be in touch.`
      : `As you wish. Your first step is waiting for you in Today, and ${recommendation?.helperName ?? 'your helper'} will be in touch.`);
    setPhase('done');
  };

  const finish = () => {
    if (userId) { clearState(userId); clearPlanJob(userId); }
    // First time home: the V3 lobby, with their coach's chat popping up.
    setHomeLayout('v3');
    navigate(`/lobby?arrived=1${provisioned ? `&coach=${provisioned.helperId}` : ''}`, { replace: true });
  };

  const ease = manifest.motion.ease;
  const durBase = manifest.motion.durationBase / 1000;
  const lastAtlas = [...messages].reverse().find(m => m.role === 'atlas');
  const chips = !isThinking && (phase === 'goal' || phase === 'billboard') && lastAtlas?.id === latestAtlasId ? lastAtlas.chips ?? [] : [];

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

      {/* The last step of the arrival: Atlas, introduced in the middle, under the progress strip. */}
      <header className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-6">
        <div className="relative">
          <ArrivalProgress step={phase === 'goal' || phase === 'handoff' ? 0 : 3} accent="var(--shell-accent)" />
        </div>
        <div className="mt-6 flex flex-col items-center text-center">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--shell-accent) 18%, transparent)',
              boxShadow: '0 0 0 1px color-mix(in srgb, var(--shell-accent) 45%, transparent), 0 8px 30px color-mix(in srgb, var(--shell-accent) 25%, transparent)',
            }}
            aria-hidden
          >
            <Compass className="h-7 w-7" style={{ color: 'var(--shell-accent)' }} />
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight" style={{ color: 'var(--shell-text-primary)', fontFamily: '"Bricolage Grotesque", sans-serif' }}>
            Atlas
          </h1>
          <p className="text-sm" style={{ color: 'var(--shell-text-muted)' }}>Your concierge at Velvet</p>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 sm:px-6 pt-4 pb-6">
        <main className="w-full flex flex-col">
          <div
            className="rounded-[1.75rem] overflow-hidden flex flex-col"
            style={{ border: '1px solid var(--shell-border)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)' }}
          >
            <div
              ref={scrollRef}
              onScroll={e => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
              }}
              className="flex-1 overflow-y-auto p-4 sm:p-6"
              style={{ maxHeight: 'calc(100dvh - 260px)' }}
            >
              <div ref={contentRef} className="space-y-3">
              <AnimatePresence>
                {messages.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: durBase, ease }}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[88%] px-4 sm:px-5 py-4 rounded-2xl text-[15px] leading-relaxed ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
                        style={{
                          background: isUser ? 'var(--shell-user-bubble)' : 'var(--shell-agent-bubble)',
                          color: isUser ? 'var(--shell-user-bubble-text)' : 'var(--shell-agent-bubble-text)',
                          border: isUser ? 'none' : '1px solid var(--shell-border-strong)',
                          backdropFilter: isUser ? 'none' : 'blur(12px)',
                        }}
                      >
                        {isUser ? msg.content : <StreamingAtlasMessage content={msg.content} isLatest={msg.id === latestAtlasId} highlight={msg.highlight} />}
                      </div>
                      {msg.pencilled?.map(p => (
                        <p key={p.title} className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--shell-text-muted)' }}>
                          <CalendarCheck className="w-3.5 h-3.5" style={{ color: 'var(--shell-accent)' }} />
                          Pencilled in: {p.title} · {formatDay(p.date)}
                        </p>
                      ))}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {chips.length > 0 && (
                <div className="flex flex-col items-end gap-2 pt-1">
                  {chips.map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => (phase === 'billboard' ? handleBillboard(chip) : send(chip))}
                      className="max-w-[88%] rounded-2xl px-4 py-2.5 text-left text-sm transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--shell-accent-soft)', border: '1px solid var(--shell-border)', color: 'var(--shell-text-primary)' }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {phase === 'meet' && recommendation && helperAvatar && (
                <MeetCard
                  name={recommendation.helperName}
                  kind={recommendation.kind}
                  domain={recommendation.expertDomain}
                  avatarConfig={helperAvatar}
                  text={recommendation.recommendationText}
                  busy={isThinking}
                  created={!!provisioned}
                  onContinue={handleContinue}
                />
              )}

              {phase === 'walkthrough' && plan && summary && recommendation && (
                <PlanWalkthrough
                  plan={plan}
                  summary={summary}
                  helper={{ name: recommendation.helperName, kind: recommendation.kind }}
                  onChangeCommitmentDate={(i, date) => setPlan(p => p && ({
                    ...p,
                    commitments: p.commitments.map((c, j) => (j === i ? { ...c, dueDate: date } : c)),
                  }))}
                  onConfirm={handleCommitPlan}
                  busy={isThinking}
                />
              )}

              {phase === 'handoff' && (
                <div className="flex justify-start pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(ARRIVAL_ROUTES.look)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                    style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
                  >
                    Create my avatar
                  </button>
                </div>
              )}

              {needsRetry && !isThinking && userId && (
                <div className="flex justify-start pt-1">
                  <button
                    type="button"
                    onClick={() => { bringBack(userId); }}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                    style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
                  >
                    Try again
                  </button>
                </div>
              )}

              {phase === 'done' && (
                <div className="flex justify-start pt-1">
                  <button
                    type="button"
                    onClick={finish}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                    style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
                  >
                    Go to Today
                  </button>
                </div>
              )}

              <AnimatePresence>
                {isThinking && <AtlasFadeTyping label={writingLabel} />}
              </AnimatePresence>

              {error && !isThinking && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl text-sm leading-relaxed"
                  style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: 'var(--shell-text-primary)' }}
                >
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
              </div>
            </div>

            {phase === 'goal' && (
              <div className="p-3 sm:p-4" style={{ borderTop: '1px solid var(--shell-border)' }}>
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    placeholder={chips.length > 0 ? 'Or say it in your own words' : manifest.copy.inputPlaceholder}
                    rows={2}
                    disabled={isThinking}
                    aria-label="Message Atlas"
                    className="flex-1 bg-transparent border-0 px-3 py-2 text-[15px] leading-relaxed resize-none focus:outline-none"
                    style={{ color: 'var(--shell-text-primary)', minHeight: '54px', maxHeight: '120px' }}
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={!input.trim() || isThinking}
                    aria-label="Send to Atlas"
                    className="flex-shrink-0 w-11 h-11 mb-0.5 rounded-xl flex items-center justify-center transition-all hover:scale-[1.03] disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export const AtlasConciergePage = () => (
  <ShellProvider agentId="atlas" forceDark>
    <ArrivalTheme>
      <AtlasConciergeInner />
    </ArrivalTheme>
  </ShellProvider>
);
