import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CompanionWithLastMessage } from '../../services/companionService';
import { getCompanionUnreadCounts } from '../../services/companionReadService';
import { supabase } from '../../shared/supabase/client';
import { setOnline, displayNames, getOrCreateConversation, getConversationList, messagePreview, parseGameInvite, type FriendGameId } from '../../shared/supabase/queries/messaging';
import { playDing } from './ding';
import { useAuth } from '../../auth/AuthProvider';
import type { CoachSurface } from '../../services/chatService';
import { isHelper } from '../../utils/relationshipType';

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
export const friendKey = (peerId: string) => `im:${peerId}`;

/** A real person's chat: the same shape Messages uses. */
export interface FriendTarget {
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
}

export interface DockWindow {
  key: string;
  companionId?: string;
  friend?: FriendTarget;
  /** A game to open in this friend's window (from an invite); nonce re-triggers it. */
  game?: { id: FriendGameId; nonce: number; /** You started it: send them an invite. */ invite?: boolean };
  minimized: boolean;
}

/** The "Leah: hey" popup above the dock for a message you haven't seen. */
export interface DockToast {
  friend: FriendTarget;
  text: string;
  nonce: number;
  /** Stays until tapped or closed (the welcome-back note, game invites). */
  sticky?: boolean;
  /** A game invite: tapping opens the game. */
  game?: FriendGameId;
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
  /** 'send' asks the companion now; 'draft' only fills the message box, for the person to edit and send. */
  mode?: 'send' | 'draft';
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
  /** Unread messages per friend (user id) whose window isn't showing. */
  friendUnread: Record<string, number>;
  /** Everyone you have a chat with, most recent first: the dock keeps the top few as tabs. */
  recentFriends: FriendTarget[];
  toast: DockToast | null;
  dismissToast: () => void;
  /** Open a chat with a real person as its own window. */
  openFriend: (friend: FriendTarget, game?: FriendGameId, invite?: boolean) => void;
  openMessages: (view?: 'conversations' | 'requests') => void;
  /** Open Messages and add someone by friend code. */
  addFriendByCode: (code: string) => void;
  openCompanion: (companionId: string, send?: string) => void;
  /** Open a companion's chat with a message already typed in the box, not sent. */
  draftToCompanion: (companionId: string, text: string) => void;
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

  // Friends see you online whenever Velvet is open in front of you. Hidden tabs
  // stop the heartbeat, so you drift to away and then offline on your own.
  useEffect(() => {
    if (!userId) return;
    const beat = () => { if (document.visibilityState === 'visible') setOnline(true).catch(() => {}); };
    beat();
    const heartbeat = setInterval(beat, 45000);
    const onUnload = () => { setOnline(false).catch(() => {}); };
    document.addEventListener('visibilitychange', beat);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', beat);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [userId]);

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

  // On phones a chat window covers the page, so going somewhere new folds the
  // open windows back into the dock (they stay there as tabs).
  const { pathname } = useLocation();
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) { firstPath.current = false; return; }
    if (window.innerWidth >= 900) return;
    setWindows(prev => (prev.some(w => !w.minimized) ? prev.map(w => ({ ...w, minimized: true })) : prev));
  }, [pathname]);

  const [friendUnread, setFriendUnread] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<DockToast | null>(null);
  const windowsRef = useRef(windows);
  windowsRef.current = windows;

  const openFriend = useCallback((friend: FriendTarget, game?: FriendGameId, invite = false) => {
    const key = friendKey(friend.peerId);
    setWindows(prev => {
      const existing = prev.find(w => w.key === key);
      return [...prev.filter(w => w.key !== key), {
        key,
        friend: existing?.friend ?? friend,
        game: game ? { id: game, nonce: Date.now(), invite } : existing?.game,
        minimized: false,
      }];
    });
    setFriendUnread(prev => {
      if (!prev[friend.peerId]) return prev;
      const next = { ...prev };
      delete next[friend.peerId];
      return next;
    });
    setToast(t => (t?.friend.peerId === friend.peerId ? null : t));
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  // The dock's friend tray: your conversations, most recent first, with their
  // unread counts (a chat open in front of you counts as read).
  const [recentFriends, setRecentFriends] = useState<FriendTarget[]>([]);
  const refreshRecent = useCallback(async () => {
    const convs = await getConversationList().catch(() => null);
    if (!convs) return null;
    const list = convs.filter(c => c.peer_id)
      .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
    setRecentFriends(list.map(c => ({ conversationId: c.id, peerId: c.peer_id, peerName: c.peer_name || 'A friend', peerAvatarUrl: c.peer_avatar_url })));
    const showing = new Set(windowsRef.current.filter(w => w.friend && !w.minimized).map(w => w.friend!.peerId));
    setFriendUnread(() => {
      const next: Record<string, number> = {};
      for (const c of list) if (c.unread_count > 0 && !showing.has(c.peer_id)) next[c.peer_id] = c.unread_count;
      return next;
    });
    return list;
  }, []);

  // The tray's list and unread counts load on sign-in and refresh each minute. No alert is raised for messages that
  // arrived while you were away: the tray already shows who messaged, and the unread counts show how many.
  useEffect(() => {
    if (!userId) return;
    refreshRecent();
    const poll = setInterval(refreshRecent, 60000);
    return () => clearInterval(poll);
  }, [userId, refreshRecent]);

  // Messages from friends: ding, pop up, and add their tab, unless their chat is
  // already open in front of you. RLS only delivers your own conversations.
  useEffect(() => {
    if (!userId) return;
    const names = new Map<string, string>();
    const nameOf = async (id: string) => {
      if (!names.has(id)) names.set(id, (await displayNames([id])).get(id) ?? 'A friend');
      return names.get(id)!;
    };
    const channel = supabase
      .channel(`dock-friends-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'im_messages' }, async (payload) => {
        const msg = payload.new as { conversation_id: string; sender_id: string; content: string };
        // Your own message moves that friend to the front of the tray.
        if (msg.sender_id === userId) { refreshRecent(); return; }
        const key = friendKey(msg.sender_id);
        const existing = windowsRef.current.find(w => w.key === key);
        // A game invite always alerts, even with their chat open, so it can't be missed.
        const game = parseGameInvite(msg.content);
        if (existing && !existing.minimized && !game) return;
        const friend: FriendTarget = existing?.friend ?? {
          conversationId: msg.conversation_id,
          peerId: msg.sender_id,
          peerName: await nameOf(msg.sender_id),
          peerAvatarUrl: null,
        };
        setRecentFriends(prev => [friend, ...prev.filter(f => f.peerId !== friend.peerId)]);
        if (!existing || existing.minimized) setFriendUnread(prev => ({ ...prev, [msg.sender_id]: (prev[msg.sender_id] ?? 0) + 1 }));
        setToast({ friend, text: messagePreview(msg.content), nonce: Date.now(), ...(game ? { game, sticky: true } : {}) });
        playDing();
      })
      // Someone accepted your request: open your chat with them.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'im_friendships', filter: `requester_id=eq.${userId}` }, async (payload) => {
        const row = payload.new as { addressee_id: string; status: string };
        const old = payload.old as { status?: string };
        if (row.status !== 'accepted' || old.status === 'accepted') return;
        const conversationId = await getOrCreateConversation(row.addressee_id).catch(() => null);
        if (!conversationId) return;
        const friend = { conversationId, peerId: row.addressee_id, peerName: await nameOf(row.addressee_id), peerAvatarUrl: null };
        openFriend(friend);
        setToast({ friend, text: 'accepted your friend request. Say hi!', nonce: Date.now() });
        playDing();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, openFriend, refreshRecent]);

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
    if (send) setPending(prev => ({ ...prev, [key]: { text: send, nonce: Date.now(), mode: 'send' } }));
  }, [bringToFront]);

  const draftToCompanion = useCallback((companionId: string, text: string) => {
    const key = aiKey(companionId);
    bringToFront(key, companionId);
    if (text) setPending(prev => ({ ...prev, [key]: { text, nonce: Date.now(), mode: 'draft' } }));
  }, [bringToFront]);

  const minimize = useCallback((key: string) => {
    setWindows(prev => prev.map(w => w.key === key ? { ...w, minimized: true } : w));
  }, []);

  const restore = useCallback((key: string) => {
    const peerId = key.startsWith('im:') ? key.slice(3) : null;
    if (peerId) {
      setFriendUnread(prev => {
        if (!prev[peerId]) return prev;
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    }
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

  const mentors = useMemo(() => companions.filter(c => isHelper(c.relationship_type)), [companions]);
  const pageCoachId = coachSurface
    ? (mentors.find(c => c.id === coachSurface.preferredCoachId) ?? mentors[0])?.id ?? null
    : null;

  const api = useMemo<DockApi>(() => ({
    windows, companions, messagesView, pendingFriendCode, coachSurface, pageCoachId, unread, clearUnread, friendUnread, recentFriends, toast, dismissToast, openFriend,
    openMessages, addFriendByCode, openCompanion, draftToCompanion, minimize, restore, close,
    pendingFor, consumePending, registerCoachSurface: setCoachSurface,
  }), [windows, companions, messagesView, pendingFriendCode, coachSurface, pageCoachId, unread, clearUnread, friendUnread, recentFriends, toast, dismissToast, openFriend, openMessages, addFriendByCode, openCompanion, draftToCompanion, minimize, restore, close, pendingFor, consumePending]);

  return <DockContext.Provider value={api}>{children}</DockContext.Provider>;
}

/** The dock when there is one, else null: for pieces that also render outside the signed-in workspace. */
export function useDockOptional(): DockApi | null {
  return useContext(DockContext);
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
  const { registerCoachSurface, openCompanion, draftToCompanion, pageCoachId, windows } = dock;
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

  /** Like ask, but the message is only typed into the box, for the person to read, change and send. */
  const draft = useCallback((text: string) => {
    if (pageCoachId) {
      draftToCompanion(pageCoachId, text);
      return;
    }
    sessionStorage.setItem('onboardingIntent', 'coaches');
    sessionStorage.setItem('onboardingRelationshipType', 'mentor');
    navigate('/expert-selection');
  }, [pageCoachId, draftToCompanion, navigate]);

  return { ask, draft, hasCoach: !!pageCoachId };
}

/** Remember that the user closed the coach so pages stop auto-opening it this session. */
export function markCoachDismissed() {
  try { sessionStorage.setItem(COACH_DISMISSED_KEY, '1'); } catch { /* storage blocked */ }
}
