import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Compass, CalendarCheck } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useTypingEffect, useWritingIndicator } from '../hooks/useTypingEffect';
import { ShellProvider, useShell } from '../shells/ShellProvider';
import { PageHeader } from '../shared/ui';
import { AtlasFadeTyping } from '../shells/slots/AtlasFadeTyping';
import { AtlasBackgroundScene } from '../shells/slots/AtlasBackgroundScene';
import { updateSetupProgress } from '../services/setupProgressService';
import { coherentRandomize } from '../components/AvatarCreatorV2';
import { sanitizeAvatarConfigForSave } from '../services/avatarSaveService';
import { useAvatarEditor, onAvatarSaved } from '../stores/avatarEditorStore';
import type { AvatarConfigV2 } from '../types/avatar-v2';
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
}

// goal: the conversation · meet: who'll carry it · walkthrough: plan to calendar
// billboard: one last question · done: off to Today
type Phase = 'goal' | 'meet' | 'walkthrough' | 'billboard' | 'done';

interface Recommendation {
  helperName: string;
  helperGender: 'male' | 'female';
  kind: 'coach' | 'assistant';
  expertDomain: string;
  expertId: string | null;
  isCustomExpert: boolean;
  accountabilityLevel: string;
  goalText: string;
  recommendationText: string;
}

interface Provisioned {
  helperId: string;
  goalId: string;
  goalText: string;
}

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
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

function saveState(state: SavedState) {
  try { sessionStorage.setItem(ATLAS_STATE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

function loadState(): SavedState | null {
  try {
    const raw = sessionStorage.getItem(ATLAS_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    return Array.isArray(parsed.messages) && parsed.messages.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function clearState() {
  try { sessionStorage.removeItem(ATLAS_STATE_KEY); } catch { /* storage blocked */ }
}

/** Where the user is: their hour for the greeting, their date and offset for scheduling. */
function localContext() {
  const now = new Date();
  return {
    localHour: now.getHours(),
    localDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    tzOffset: now.getTimezoneOffset(),
  };
}

async function callAtlas(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...localContext(), ...body }),
  });
  if (!response.ok) throw new Error(`atlas-onboarding ${body.phase}: ${response.status}`);
  return response.json();
}

let msgIdCounter = 0;

function StreamingAtlasMessage({ content, isLatest }: { content: string; isLatest: boolean }) {
  const { displayedText, showCursor } = useTypingEffect(content, isLatest, { speed: 45 });
  return (
    <span className="whitespace-pre-line">
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
  const provisioning = useRef<Promise<Provisioned | null> | null>(null);
  const writingLabel = useWritingIndicator(isThinking, 4000);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, phase]);

  const addAtlas = useCallback((content: string, extra: Partial<ChatMessage> = {}) => {
    const id = ++msgIdCounter;
    const msg: ChatMessage = { role: 'atlas', content, id, ...extra };
    transcriptRef.current = [...transcriptRef.current, msg];
    setMessages(prev => [...prev, msg]);
    setLatestAtlasId(id);
  }, []);

  // Start, or pick up where they left off in this tab.
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const saved = loadState();
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
          (profile?.name && profile.name !== 'babe' && profile.name !== 'there' && profile?.birthday && profile?.gender)
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
  }, [navigate, addAtlas]);

  useEffect(() => {
    if (messages.length === 0) return;
    saveState({ messages, phase, recommendation, helperAvatar, provisioned, plan, summary, latestAtlasId, msgIdCounter });
  }, [messages, phase, recommendation, helperAvatar, provisioned, plan, summary, latestAtlasId]);

  // A look changed in the avatar editor shows on the Meet card straight away.
  useEffect(() => onAvatarSaved(saved => {
    if (saved.target.kind === 'companion' && saved.target.id === provisioned?.helperId) setHelperAvatar(saved.config);
  }), [provisioned?.helperId]);

  const handleGoalComplete = async () => {
    setIsThinking(true);
    try {
      const transcript = transcriptRef.current.filter(m => m.content).map(({ role, content }) => ({ role, content }));
      const data = await callAtlas({ phase: 'confirm', transcript });
      const rec = data.recommendation as Recommendation;
      setRecommendation(rec);
      setHelperAvatar(coherentRandomize(rec.helperGender));
      setPhase('meet');
    } catch {
      setError("I couldn't find the right person just now. Please try sending your last message again.");
    } finally {
      setIsThinking(false);
    }
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

  /** Creates the assistant or coach and the goal, once. */
  const ensureProvisioned = (): Promise<Provisioned | null> => {
    if (provisioned) return Promise.resolve(provisioned);
    if (provisioning.current) return provisioning.current;
    if (!recommendation) return Promise.resolve(null);
    provisioning.current = (async () => {
      try {
        const avatarConfig = helperAvatar ? await sanitizeAvatarConfigForSave(helperAvatar) : null;
        const transcript = transcriptRef.current.filter(m => m.content).map(({ role, content }) => ({ role, content }));
        const data = await callAtlas({
          phase: 'provisioning',
          transcript,
          recommendation,
          helperName: recommendation.helperName,
          avatarConfig,
        });
        const result = { helperId: data.helperId as string, goalId: data.goalId as string, goalText: data.goalText as string };
        setProvisioned(result);
        if (data.helperId) sessionStorage.setItem('atlasCoachId', data.helperId);
        return result;
      } catch {
        setError("Something went wrong setting them up. Please try again.");
        return null;
      } finally {
        provisioning.current = null;
      }
    })();
    return provisioning.current;
  };

  const handleContinue = async () => {
    if (!recommendation) return;
    setIsThinking(true);
    setError('');
    const ready = await ensureProvisioned();
    if (!ready) {
      setIsThinking(false);
      return;
    }
    try {
      const transcript = transcriptRef.current.filter(m => m.content).map(({ role, content }) => ({ role, content }));
      const data = await callAtlas({
        phase: 'plan',
        transcript,
        goalText: ready.goalText,
        helper: { name: recommendation.helperName, kind: recommendation.kind, domain: recommendation.expertDomain },
      });
      setPlan(data.plan);
      setSummary(data.summary);
      setPhase('walkthrough');
    } catch {
      setError("I couldn't draft the plan just now. Tap Continue to try again.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleRename = async (name: string) => {
    if (!recommendation) return;
    setRecommendation({ ...recommendation, helperName: name });
    const ready = await ensureProvisioned();
    if (ready) await supabase.from('companions').update({ custom_name: name }).eq('id', ready.helperId);
  };

  const handleChangeLook = () => {
    if (provisioned) useAvatarEditor.getState().open({ kind: 'companion', id: provisioned.helperId });
  };

  const handleRefine = () => {
    setRecommendation(null);
    setHelperAvatar(null);
    setPhase('goal');
    addAtlas("Of course. Tell me what I've got wrong, and we'll set it right.");
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
    clearState();
    navigate('/lobby?arrived=1', { replace: true });
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

      <PageHeader title="Atlas" icon={Compass} accent="var(--shell-accent)" back="/lobby" />

      <div className="relative z-10 flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 sm:px-6 pt-6 pb-6">
        <main className="w-full flex flex-col">
          <div
            className="rounded-[1.75rem] overflow-hidden flex flex-col"
            style={{ border: '1px solid var(--shell-border)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.025)' }}
          >
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3" style={{ maxHeight: 'calc(100vh - 160px)' }}>
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
                        {isUser ? msg.content : <StreamingAtlasMessage content={msg.content} isLatest={msg.id === latestAtlasId} />}
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
                  onChangeAnything={() => { ensureProvisioned(); }}
                  onChangeLook={handleChangeLook}
                  onRename={handleRename}
                  onRefine={handleRefine}
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
