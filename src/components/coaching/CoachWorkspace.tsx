import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageCircle, Plus, Send, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { getCompanions, updateLastMessageTime, type CompanionWithLastMessage } from '../../services/companionService';
import { ChatService, type CoachSurface } from '../../services/chatService';
import { getMessageTrackingInfo } from '../../services/messageTrackingService';
import { useMessages, useSendMessage } from '../../features/chat/hooks';
import { safeRandomUUID } from '../../utils/uuid';
import { Avatar } from '../Avatar';
import { AtlasMarkdown } from '../AtlasMarkdown';
import { companionAvatarConfig } from '../lobby';
import type { CoachPanelHandle } from './useCoachPanel';

const VISIBLE_MESSAGES = 40;

const INTRO: Record<CoachSurface, string> = {
  progress: "Let's look at where you stand. Ask me how a goal is going, or tell me what you did and I'll log it.",
  plans: "Let's build your plan. If we haven't set the goal yet, we'll start there, then I'll lay out the steps.",
  commitments: "Let's turn your plan into things you'll actually do this week, with dates.",
  library: 'Ask for reading, a routine, a practice set, a worksheet or a checklist and I will make it here.',
};

function useIsDesktop(): boolean {
  const query = '(min-width: 1024px)';
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return matches;
}

interface CoachPanelProps {
  surface: CoachSurface;
  coach: CoachPanelHandle;
  preferredCoachId?: string | null;
  quickPrompts: string[];
  /** Called after every coach reply with the ids it created or changed (may be empty). */
  onCoachChanged: (ids: string[]) => void;
  onClose?: () => void;
}

function CoachPanel({ surface, coach, preferredCoachId, quickPrompts, onCoachChanged, onClose }: CoachPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState<CompanionWithLastMessage[] | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfMessages, setOutOfMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getCompanions(userId).then(all => {
      if (cancelled) return;
      const mentors = all.filter(c => c.relationship_type === 'mentor');
      setCoaches(mentors);
      const preferred = preferredCoachId && mentors.find(c => c.id === preferredCoachId);
      setCoachId((preferred || mentors[0])?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [userId, preferredCoachId]);

  const activeCoach = coaches?.find(c => c.id === coachId) ?? null;
  const { data: messages, appendOptimistic, replaceOptimistic, removeOptimistic } = useMessages(user?.id, coachId);
  const messageCallbacks = useMemo(() => ({ appendOptimistic, replaceOptimistic, removeOptimistic }), [appendOptimistic, replaceOptimistic, removeOptimistic]);
  const saveMessage = useSendMessage(messageCallbacks);

  const visible = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content && (!m.message_type || m.message_type === 'text'))
    .slice(-VISIBLE_MESSAGES);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visible.length, sending]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || !user || !activeCoach || sending) return;
    setError(null);

    const tracking = await getMessageTrackingInfo(user.id);
    if (tracking && !tracking.canSendMessage) {
      setOutOfMessages(true);
      return;
    }

    setSending(true);
    setDraft('');
    try {
      await saveMessage({ userId: user.id, companionId: activeCoach.id, role: 'user', content, clientMessageId: safeRandomUUID() });
      const profile = await ChatService.getUserProfile();
      if (!profile) throw new Error('Could not load your profile. Please try again.');
      const result = await ChatService.sendMessageWithSignals(content, activeCoach.id, profile, surface);
      await saveMessage({
        userId: user.id,
        companionId: activeCoach.id,
        role: 'assistant',
        content: result.assistantMessage,
        clientMessageId: safeRandomUUID(),
        ...(result.coachArtifacts && result.coachArtifacts.length > 0 ? { metadata: { coach_artifacts: result.coachArtifacts } } : {}),
      });
      onCoachChanged([
        ...(result.coachingChanges ?? []).map(c => c.entityId),
        ...(result.uiActions ?? []).flatMap(a => a.highlightIds),
        ...(result.coachArtifacts ?? []).map(a => a.id),
      ]);
      updateLastMessageTime(activeCoach.id).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }, [user, activeCoach, sending, saveMessage, surface, onCoachChanged]);

  // A page asked the coach something (empty-state button etc.): send it once.
  useEffect(() => {
    if (!coach.request || !activeCoach || sending) return;
    const { text } = coach.request;
    coach.consume();
    send(text);
  }, [coach, activeCoach, sending, send]);

  const addCoach = () => {
    sessionStorage.setItem('onboardingIntent', 'coaches');
    sessionStorage.setItem('onboardingRelationshipType', 'mentor');
    navigate('/expert-selection');
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[rgba(12,10,30,0.55)]">
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
        {activeCoach ? (
          <>
            <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-emerald-400/60">
              <Avatar config={companionAvatarConfig(activeCoach)} className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              {coaches && coaches.length > 1 ? (
                <select
                  value={activeCoach.id}
                  onChange={e => setCoachId(e.target.value)}
                  className="max-w-full truncate rounded-md bg-transparent text-sm font-semibold text-white focus:outline-none"
                  aria-label="Choose coach"
                >
                  {coaches.map(c => <option key={c.id} value={c.id} className="bg-[#14122a]">{c.custom_name}</option>)}
                </select>
              ) : (
                <p className="truncate text-sm font-semibold text-white">{activeCoach.custom_name}</p>
              )}
              <p className="truncate text-[11px] text-white/55">Your coach · picks up from your chats</p>
            </div>
          </>
        ) : (
          <p className="flex-1 text-sm font-semibold text-white">Coach</p>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close coach">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {coaches !== null && coaches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-white/70">You don't have a coach yet. Add one and they'll work through this with you, right here.</p>
          <button type="button" onClick={addCoach} className="flex items-center gap-1.5 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-500">
            <Plus className="h-4 w-4" /> Add a coach
          </button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {visible.length === 0 && !sending && (
              <p className="rounded-2xl bg-white/[0.04] px-3.5 py-3 text-sm text-white/75">{INTRO[surface]}</p>
            )}
            {visible.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'user' ? (
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-pink-600/80 px-3.5 py-2 text-sm text-white">{m.content}</p>
                ) : (
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white/[0.06] px-3.5 py-2 text-sm text-white/90">
                    <AtlasMarkdown content={m.content} />
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-white/55">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {activeCoach?.custom_name ?? 'Your coach'} is working on it…
              </div>
            )}
          </div>

          {error && <p className="px-4 pb-2 text-xs text-rose-300">{error}</p>}
          {outOfMessages && (
            <p className="px-4 pb-2 text-xs text-amber-200">
              You're out of messages for now.{' '}
              <button type="button" onClick={() => navigate('/pricing')} className="font-semibold underline">See plans</button>
            </p>
          )}

          {!sending && quickPrompts.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
              {quickPrompts.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  disabled={!activeCoach}
                  className="flex-shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-pink-400/50 hover:bg-pink-500/10 hover:text-white disabled:opacity-40"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={e => { e.preventDefault(); send(draft); }}
            className="flex items-end gap-2 border-t border-white/8 p-3"
          >
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
              }}
              rows={1}
              placeholder={activeCoach ? `Ask ${activeCoach.custom_name}…` : 'Loading your coach…'}
              disabled={!activeCoach || sending}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-pink-400/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!activeCoach || sending || !draft.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-pink-600 text-white transition-colors hover:bg-pink-500 disabled:opacity-40"
              aria-label="Send to coach"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

interface CoachWorkspaceProps extends Omit<CoachPanelProps, 'onClose'> {
  children: ReactNode;
}

/**
 * Lays a coaching page out beside its coach: a docked panel on desktop, a
 * bottom sheet behind a floating button on smaller screens.
 */
export function CoachWorkspace({ children, coach, ...panelProps }: CoachWorkspaceProps) {
  const isDesktop = useIsDesktop();

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>

      {isDesktop ? (
        <aside className="flex w-[380px] flex-shrink-0 border-l border-white/8">
          <CoachPanel coach={coach} {...panelProps} />
        </aside>
      ) : (
        <>
          {!coach.open && (
            <button
              type="button"
              onClick={() => coach.setOpen(true)}
              className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/40 transition-colors hover:bg-pink-500"
            >
              <MessageCircle className="h-4 w-4" /> Coach
            </button>
          )}
          {coach.open && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end">
              <button type="button" className="absolute inset-0 bg-black/50" onClick={() => coach.setOpen(false)} aria-label="Close coach" />
              <div className="relative h-[80vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0c0a1e]">
                <CoachPanel coach={coach} {...panelProps} onClose={() => coach.setOpen(false)} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
