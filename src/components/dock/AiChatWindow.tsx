import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Loader2, Maximize2, Minus, Send, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { updateLastMessageTime, type CompanionWithLastMessage } from '../../services/companionService';
import { ChatService, type CoachSurface } from '../../services/chatService';
import { getMessageTrackingInfo } from '../../services/messageTrackingService';
import { useMessages, useSendMessage } from '../../features/chat/hooks';
import { safeRandomUUID } from '../../utils/uuid';
import { supabase } from '../../shared/supabase/client';
import { Avatar } from '../Avatar';
import { AtlasMarkdown } from '../AtlasMarkdown';
import { companionAvatarConfig } from '../lobby';

const VISIBLE_MESSAGES = 40;

const SURFACE_LABEL: Record<CoachSurface, string> = {
  progress: 'Progress',
  plans: 'Plans',
  commitments: 'Commitments',
  library: 'Library',
};

const SURFACE_INTRO: Record<CoachSurface, string> = {
  progress: "Let's look at where you stand. Ask me how a goal is going, or tell me what you did and I'll log it.",
  plans: "Let's build your plan. If we haven't set the goal yet, we'll start there, then I'll lay out the steps.",
  commitments: "Let's turn your plan into things you'll actually do this week, with dates.",
  library: 'Ask for reading, a routine, a practice set, a worksheet or a checklist and I will make it here.',
};

interface CoachChange { entityType: string; entityId: string; action: string }
interface CoachArtifact { id: string; artifactType: string; title: string }

const ENTITY_LABEL: Record<string, [string, string]> = {
  goal: ['Goal', 'goals'],
  plan: ['Plan', 'plans'],
  plan_step: ['Step', 'steps'],
  commitment: ['Commitment', 'commitments'],
};

const ENTITY_ROUTE: Record<string, string> = {
  goal: '/coaching-progress',
  plan: '/coaching-commitments?view=plans',
  plan_step: '/coaching-commitments?view=plans',
  commitment: '/coaching-commitments',
};

/** "✓ Plan created", "✓ 3 steps created": one card per kind of change in a reply. */
function DoneCards({ changes, artifacts, onOpen }: { changes: CoachChange[]; artifacts: CoachArtifact[]; onOpen: (route: string) => void }) {
  const groups = new Map<string, { type: string; action: string; count: number }>();
  for (const c of changes) {
    const k = `${c.entityType}:${c.action}`;
    const g = groups.get(k);
    if (g) g.count += 1; else groups.set(k, { type: c.entityType, action: c.action, count: 1 });
  }
  const cards = [
    ...[...groups.values()].map(g => {
      const [one, many] = ENTITY_LABEL[g.type] ?? ['Item', 'items'];
      return { key: `${g.type}:${g.action}`, text: g.count > 1 ? `${g.count} ${many} ${g.action}` : `${one} ${g.action}`, route: ENTITY_ROUTE[g.type] ?? '/coaching-progress' };
    }),
    ...artifacts.map(a => ({ key: `artifact:${a.id}`, text: `Saved to your library: ${a.title}`, route: '/coaching-library' })),
  ];
  if (cards.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {cards.map(card => (
        <button
          key={card.key}
          type="button"
          onClick={() => onOpen(card.route)}
          className="flex w-full items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-left text-xs text-emerald-100 transition-colors hover:bg-emerald-500/15"
        >
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1 truncate font-medium">{card.text}</span>
          <span className="flex flex-shrink-0 items-center text-emerald-300/80">View <ChevronRight className="h-3 w-3" /></span>
        </button>
      ))}
    </div>
  );
}

interface AiChatWindowProps {
  companion: CompanionWithLastMessage;
  /** Set when this is a coach and the user is on a coaching page. */
  surface?: CoachSurface;
  quickPrompts?: string[];
  onCoachChanged?: (ids: string[]) => void;
  pending: { text: string; nonce: number } | null;
  onConsumePending: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

/**
 * A dock window for an AI companion or coach. It runs on the same thread as
 * the full chat screen, so memory carries over both ways.
 */
export function AiChatWindow({ companion, surface, quickPrompts = [], onCoachChanged, pending, onConsumePending, onMinimize, onClose }: AiChatWindowProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCoach = companion.relationship_type === 'mentor';
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfMessages, setOutOfMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, appendOptimistic, replaceOptimistic, removeOptimistic, setMessages } = useMessages(user?.id, companion.id);
  const messageCallbacks = useMemo(() => ({ appendOptimistic, replaceOptimistic, removeOptimistic }), [appendOptimistic, replaceOptimistic, removeOptimistic]);
  const saveMessage = useSendMessage(messageCallbacks);

  const visible = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content && (!m.message_type || m.message_type === 'text'))
    .slice(-VISIBLE_MESSAGES);

  // Messages saved elsewhere (the chat screen, another device, or a proactive
  // message from this companion) appear here live.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dock-thread-${companion.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `companion_id=eq.${companion.id}` }, (payload) => {
        const row = payload.new as (typeof messages)[number];
        if (row.user_id !== userId) return;
        setMessages(prev => prev.some(m => m.id === row.id || (row.client_message_id && m.client_message_id === row.client_message_id))
          ? prev
          : [...prev, row]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, companion.id, setMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visible.length, sending]);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || !user || sending) return;
    setError(null);

    const tracking = await getMessageTrackingInfo(user.id);
    if (tracking && !tracking.canSendMessage) {
      setOutOfMessages(true);
      return;
    }

    setSending(true);
    setDraft('');
    try {
      await saveMessage({ userId: user.id, companionId: companion.id, role: 'user', content, clientMessageId: safeRandomUUID() });
      const profile = await ChatService.getUserProfile();
      if (!profile) throw new Error('Could not load your profile. Please try again.');
      const result = await ChatService.sendMessageWithSignals(content, companion.id, profile, isCoach ? surface : undefined);
      const metadata: Record<string, unknown> = {};
      if (result.coachArtifacts && result.coachArtifacts.length > 0) metadata.coach_artifacts = result.coachArtifacts;
      if (result.coachingChanges && result.coachingChanges.length > 0) metadata.coach_changes = result.coachingChanges;
      await saveMessage({
        userId: user.id,
        companionId: companion.id,
        role: 'assistant',
        content: result.assistantMessage,
        clientMessageId: safeRandomUUID(),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      });
      onCoachChanged?.([
        ...(result.coachingChanges ?? []).map(c => c.entityId),
        ...(result.uiActions ?? []).flatMap(a => a.highlightIds),
        ...(result.coachArtifacts ?? []).map(a => a.id),
      ]);
      updateLastMessageTime(companion.id).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }, [user, companion.id, isCoach, sending, saveMessage, surface, onCoachChanged]);

  // Something on the page asked this companion a question: send it once.
  useEffect(() => {
    if (!pending || sending) return;
    onConsumePending();
    send(pending.text);
  }, [pending, sending, onConsumePending, send]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-white/8 px-3 py-2.5">
        <div className={`h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border-2 ${isCoach ? 'border-emerald-400/70' : 'border-pink-400/60'}`}>
          <Avatar config={companionAvatarConfig(companion)} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{companion.custom_name}</p>
          <p className="truncate text-[10px] text-white/55">
            {isCoach ? 'Coach' : 'Companion'}
            {isCoach && surface ? <> · <span className="text-emerald-300">on {SURFACE_LABEL[surface]}</span></> : null}
          </p>
        </div>
        <button type="button" onClick={() => { onMinimize(); navigate(`/chat?companion=${companion.id}`); }} className="flex-shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Open full chat with ${companion.custom_name}`} title="Open full chat">
          <Maximize2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onMinimize} className="flex-shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Minimize ${companion.custom_name}`} title="Minimize">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="flex-shrink-0 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Close ${companion.custom_name}`} title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {visible.length === 0 && !sending && (
          <p className="rounded-2xl bg-white/[0.04] px-3.5 py-3 text-sm text-white/75">
            {isCoach && surface ? SURFACE_INTRO[surface] : `Say hi to ${companion.custom_name}.`}
          </p>
        )}
        {visible.map(m => {
          const meta = (m.metadata ?? {}) as { coach_changes?: CoachChange[]; coach_artifacts?: CoachArtifact[] };
          return (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'user' ? (
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-pink-600/80 px-3.5 py-2 text-sm text-white [overflow-wrap:anywhere]">{m.content}</p>
              ) : (
                <div className="min-w-0 max-w-[92%]">
                  <div className="dock-md overflow-x-auto rounded-2xl rounded-bl-md bg-white/[0.06] px-3.5 py-2 text-sm text-white/90 [overflow-wrap:anywhere]">
                    <AtlasMarkdown content={m.content} />
                  </div>
                  <DoneCards
                    changes={Array.isArray(meta.coach_changes) ? meta.coach_changes : []}
                    artifacts={Array.isArray(meta.coach_artifacts) ? meta.coach_artifacts : []}
                    onOpen={navigate}
                  />
                </div>
              )}
            </div>
          );
        })}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-white/55">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {companion.custom_name} is {isCoach ? 'working on it' : 'typing'}…
          </div>
        )}
      </div>

      {error && <p className="px-3 pb-2 text-xs text-rose-300">{error}</p>}
      {outOfMessages && (
        <p className="px-3 pb-2 text-xs text-amber-200">
          You're out of messages for now.{' '}
          <button type="button" onClick={() => navigate('/pricing')} className="font-semibold underline">See plans</button>
        </p>
      )}

      {!sending && quickPrompts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
          {quickPrompts.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="flex-shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-pink-400/50 hover:bg-pink-500/10 hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); send(draft); }} className="flex items-end gap-2 border-t border-white/8 p-2.5">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); }
          }}
          rows={1}
          placeholder={`Message ${companion.custom_name}…`}
          disabled={sending}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-pink-400/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-pink-600 text-white transition-colors hover:bg-pink-500 disabled:opacity-40"
          aria-label={`Send to ${companion.custom_name}`}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
