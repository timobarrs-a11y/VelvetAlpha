import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CompanionWithLastMessage } from '../../services/companionService';
import { getCompanionUnreadCounts } from '../../services/companionReadService';
import { supabase } from '../../shared/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import type { CoachSurface } from '../../services/chatService';

/**
 * The bottom dock: one Messages window (friends, requests, Velvet Rope) plus a
 * window per AI companion or coach, so a friend, a companion and a coach can
 * all be open at once. Coaching pages register here so the coach window knows
 * which page the user is on and can light up what it creates.
 */

export const MESSAGES_KEY = 'messages';
/** A friend code from an /add/<code> link, waiting for the dock to open Messages with it. */
export const PENDING_FRIEND_CODE_KEY = 'velvet.pending_friend_code';
export const aiKey = (companionId: string) => `ai:${companionId}`;

export interface DockWindow {
  key: string;
  companionId?: string;
  minimized: boolean;
}

export interface CoachSurfaceRegistration {
  surface: CoachSurface;
  quickPrompts: string[];
  preferredCoachId?: string | null;
  /** Called after every coach reply with the ids it created or changed (may be empty). */
  onCoachChanged: (ids: string[]) => void;
}

interface PendingSend {
  text: string;
  nonce: number;
}

interface DockApi {
  windows: DockWindow[];
  companions: CompanionWithLastMessage[];
  messagesView: 'conversations' | 'requests';
  /** Friend code to add when Messages opens (from a share link). */
  pendingFriendCode: string | null;
  coachSurface: CoachSurfaceRegistration | null;
  /** The coach a coaching page talks to: its preferred coach, else the first. */
  pageCoachId: string | null;
  /** Unread messages per companion id, e.g. a companion who messaged while you talked to your coach. */
  unread: Record<string, number>;
  clearUnread: (companionId: string) => void;
  openMessages: (view?: 'conversations' | 'requests') => void;
  /** Open Messages and add someone by friend code. */
  addFriendByCode: (code: string) => void;
  openCompanion: (companionId: string, send?: string) => void;
  minimize: (key: string) => void;
  restore: (key: string) => void;
  close: (key: string) => void;
  pendingFor: (key: string) => PendingSend | null;
  consumePending: (key: string) => void;
  registerCoachSurface: (reg: CoachSurfaceRegistration | null) => void;
}

const DockContext = createContext<DockApi | null>(null);

const COACH_DISMISSED_KEY = 'velvet.dock.coach-dismissed';

export function DockProvider({ companions, children }: { companions: CompanionWithLastMessage[]; children: ReactNode }) {
  // Ordered by recency: the last window is the one most recently opened or restored.
  const [windows, setWindows] = useState<DockWindow[]>([]);
  const [messagesView, setMessagesView] = useState<'conversations' | 'requests'>('conversations');
  const [pendingFriendCode, setPendingFriendCode] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, PendingSend>>({});
  const [coachSurface, setCoachSurface] = useState<CoachSurfaceRegistration | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const userId = user?.id;

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    setUnread(await getCompanionUnreadCounts());
  }, [userId]);

  // Messages from companions and coaches (replies or proactive) arrive live; a
  // slow poll covers dropped connections.
  useEffect(() => {
    if (!userId) return;
    refreshUnread();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`dock-unread-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `user_id=eq.${userId}` }, (payload) => {
        if ((payload.new as { role?: string }).role !== 'assistant') return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(refreshUnread, 800);
      })
      .subscribe();
    const poll = setInterval(refreshUnread, 60000);
    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [userId, refreshUnread]);

  // A share link saved a friend code: open Messages with it once signed in.
  useEffect(() => {
    if (!userId) return;
    let code: string | null = null;
    try {
      code = sessionStorage.getItem(PENDING_FRIEND_CODE_KEY);
      sessionStorage.removeItem(PENDING_FRIEND_CODE_KEY);
    } catch { /* storage blocked */ }
    if (code) {
      setPendingFriendCode(code);
      setMessagesView('conversations');
      setWindows(prev => [...prev.filter(w => w.key !== MESSAGES_KEY), { key: MESSAGES_KEY, minimized: false }]);
    }
  }, [userId]);

  const clearUnread = useCallback((companionId: string) => {
    setUnread(prev => {
      if (!prev[companionId]) return prev;
      const next = { ...prev };
      delete next[companionId];
      return next;
    });
  }, []);

  const bringToFront = useCallback((key: string, companionId?: string) => {
    setWindows(prev => [...prev.filter(w => w.key !== key), { key, companionId, minimized: false }]);
  }, []);

  const openMessages = useCallback((view: 'conversations' | 'requests' = 'conversations') => {
    setMessagesView(view);
    bringToFront(MESSAGES_KEY);
  }, [bringToFront]);

  const addFriendByCode = useCallback((code: string) => {
    setPendingFriendCode(code.replace(/\D/g, ''));
    setMessagesView('conversations');
    bringToFront(MESSAGES_KEY);
  }, [bringToFront]);

  const openCompanion = useCallback((companionId: string, send?: string) => {
    const key = aiKey(companionId);
    bringToFront(key, companionId);
    if (send) setPending(prev => ({ ...prev, [key]: { text: send, nonce: Date.now() } }));
  }, [bringToFront]);

  const minimize = useCallback((key: string) => {
    setWindows(prev => prev.map(w => w.key === key ? { ...w, minimized: true } : w));
  }, []);

  const restore = useCallback((key: string) => {
    setWindows(prev => {
      const w = prev.find(x => x.key === key);
      return w ? [...prev.filter(x => x.key !== key), { ...w, minimized: false }] : prev;
    });
  }, []);

  const close = useCallback((key: string) => {
    setWindows(prev => prev.filter(w => w.key !== key));
    setPending(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const pendingFor = useCallback((key: string) => pending[key] ?? null, [pending]);
  const consumePending = useCallback((key: string) => {
    setPending(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const mentors = useMemo(() => companions.filter(c => c.relationship_type === 'mentor'), [companions]);
  const pageCoachId = coachSurface
    ? (mentors.find(c => c.id === coachSurface.preferredCoachId) ?? mentors[0])?.id ?? null
    : null;

  const api = useMemo<DockApi>(() => ({
    windows, companions, messagesView, pendingFriendCode, coachSurface, pageCoachId, unread, clearUnread,
    openMessages, addFriendByCode, openCompanion, minimize, restore, close,
    pendingFor, consumePending, registerCoachSurface: setCoachSurface,
  }), [windows, companions, messagesView, pendingFriendCode, coachSurface, pageCoachId, unread, clearUnread, openMessages, addFriendByCode, openCompanion, minimize, restore, close, pendingFor, consumePending]);

  return <DockContext.Provider value={api}>{children}</DockContext.Provider>;
}

export function useDock(): DockApi {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error('useDock must be used inside <DockProvider />');
  return ctx;
}

/**
 * Used by a coaching page: tells the dock's coach which page it is on, opens
 * the coach (once per session on wide screens, unless the user closed it) and
 * returns `ask` for empty states and buttons to hand the coach a message.
 */
export function useDockCoach(reg: CoachSurfaceRegistration) {
  const dock = useDock();
  const navigate = useNavigate();
  const { registerCoachSurface, openCompanion, pageCoachId, windows } = dock;
  const regRef = useRef(reg);
  regRef.current = reg;

  const promptsKey = reg.quickPrompts.join('|');
  useEffect(() => {
    registerCoachSurface({
      surface: reg.surface,
      quickPrompts: promptsKey ? promptsKey.split('|') : [],
      preferredCoachId: reg.preferredCoachId,
      onCoachChanged: (ids) => regRef.current.onCoachChanged(ids),
    });
  }, [registerCoachSurface, reg.surface, promptsKey, reg.preferredCoachId]);

  useEffect(() => () => registerCoachSurface(null), [registerCoachSurface]);

  // Bring the coach in when the page opens, on screens with room for it.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || !pageCoachId) return;
    autoOpened.current = true;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(COACH_DISMISSED_KEY) === '1'; } catch { /* storage blocked */ }
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (!dismissed && wide && !windows.some(w => w.key === aiKey(pageCoachId) && !w.minimized)) {
      openCompanion(pageCoachId);
    }
  }, [pageCoachId, windows, openCompanion]);

  const ask = useCallback((text: string) => {
    if (pageCoachId) {
      openCompanion(pageCoachId, text);
      return;
    }
    // No coach yet: send them to pick one.
    sessionStorage.setItem('onboardingIntent', 'coaches');
    sessionStorage.setItem('onboardingRelationshipType', 'mentor');
    navigate('/expert-selection');
  }, [pageCoachId, openCompanion, navigate]);

  return { ask, hasCoach: !!pageCoachId };
}

/** Remember that the user closed the coach so pages stop auto-opening it this session. */
export function markCoachDismissed() {
  try { sessionStorage.setItem(COACH_DISMISSED_KEY, '1'); } catch { /* storage blocked */ }
}
