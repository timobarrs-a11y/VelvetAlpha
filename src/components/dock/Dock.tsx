import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, UserPlus } from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { MessagingOverlay } from '../MessagingOverlay';
import { getConversationList, getIncomingRequests } from '../../shared/supabase/queries/messaging';
import { AiChatWindow } from './AiChatWindow';
import { FriendChatWindow } from './FriendChatWindow';
import { markCompanionRead } from '../../services/companionReadService';
import { MESSAGES_KEY, aiKey, markCoachDismissed, useDock, type DockWindow } from './DockContext';

const HIDDEN_PATHS = ['/splash', '/signin', '/signup', '/onboarding'];
const SURFACE_LABEL = { progress: 'Progress', plans: 'Plans', commitments: 'Commitments', library: 'Library' } as const;

/** How many windows fit side by side: three on wide screens, one on phones. */
function useWindowCapacity(): number {
  const read = () => (typeof window === 'undefined' ? 1 : window.innerWidth >= 1280 ? 3 : window.innerWidth >= 900 ? 2 : 1);
  const [capacity, setCapacity] = useState(read);
  useEffect(() => {
    const onResize = () => setCapacity(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return capacity;
}

function useInbox(userId: string | undefined) {
  const [unread, setUnread] = useState(0);
  const [requests, setRequests] = useState<{ id: string; name: string }[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const seenRequests = useRef<Set<string> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [convs, incoming] = await Promise.all([
        getConversationList(),
        getIncomingRequests().catch(() => []),
      ]);
      setUnread(convs.reduce((sum, c) => sum + c.unread_count, 0));
      const mapped = (incoming || []).map((r) => ({
        id: (r as { friendship_id?: string }).friendship_id ?? r.user_id,
        name: r.display_name,
      }));
      setRequests(mapped);

      const currentIds = new Set(mapped.map((r) => r.id));
      if (seenRequests.current === null) {
        seenRequests.current = currentIds;
      } else {
        const newOnes = mapped.filter((r) => !seenRequests.current!.has(r.id));
        if (newOnes.length > 0) {
          setBubble(newOnes.length === 1
            ? `${newOnes[0].name} wants to be friends`
            : `${newOnes[0].name} and ${newOnes.length - 1} other${newOnes.length - 1 > 1 ? 's' : ''} want to be friends`);
          if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
          bubbleTimer.current = setTimeout(() => setBubble(null), 8000);
        }
        seenRequests.current = currentIds;
      }
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const interval = setInterval(refresh, 20000);
    const channel = supabase
      .channel('im-inbox-watch')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'im_messages' }, () => { refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'im_friendships' }, () => { refresh(); })
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const dismissBubble = () => {
    setBubble(null);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  };

  return { badge: unread + requests.length, bubble, dismissBubble };
}

/**
 * Room for a chat window: from the bottom of the top bar to the top of the
 * dock. Measured, because phone browsers (iPhone Safari especially) report a
 * viewport taller than what's visible, and the top bar can wrap to two rows.
 */
function useWindowRoom(barRef: React.RefObject<HTMLDivElement>): number | null {
  const [room, setRoom] = useState<number | null>(null);
  useEffect(() => {
    const measure = () => {
      const bar = barRef.current;
      if (!bar) return;
      const header = document.querySelector('header');
      const top = header ? header.getBoundingClientRect().bottom : 0;
      setRoom(Math.max(200, Math.floor(bar.getBoundingClientRect().top - top - 8)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    const header = document.querySelector('header');
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (header) ro?.observe(header);
    return () => {
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [barRef]);
  return room;
}

function WindowFrame({ children, fullWidth, room }: { children: ReactNode; fullWidth: boolean; room: number | null }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className={`flex h-[min(70vh,600px)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-white/10 shadow-2xl shadow-black/50 ${fullWidth ? 'w-full' : 'w-[360px]'}`}
      style={{ background: 'var(--ds-surface, #1a1a2e)', ...(room ? { maxHeight: room } : {}) }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The bottom dock bar and the chat windows that rise from it: Messages (real
 * friends) plus one window per AI companion or coach, side by side.
 */
export function Dock() {
  const { user } = useAuth();
  const location = useLocation();
  const dock = useDock();
  const capacity = useWindowCapacity();
  const barRef = useRef<HTMLDivElement>(null);
  const room = useWindowRoom(barRef);
  const inbox = useInbox(user?.id);

  // Anything the user is looking at counts as read: an open dock window, or
  // that companion's full chat screen.
  const shownCompanionIds = dock.windows.filter(w => !w.minimized).slice(-capacity)
    .map(w => w.companionId).filter((id): id is string => !!id);
  const chatScreenId = location.pathname === '/chat' ? new URLSearchParams(location.search).get('companion') : null;
  const readingKey = [...shownCompanionIds, ...(chatScreenId ? [chatScreenId] : [])].sort().join(',');
  const { unread, clearUnread } = dock;
  useEffect(() => {
    if (!readingKey) return;
    for (const id of readingKey.split(',')) {
      if (unread[id]) {
        clearUnread(id);
        markCompanionRead(id).catch(() => {});
      }
    }
  }, [readingKey, unread, clearUnread]);

  // The message popup fades on its own.
  const { toast, dismissToast } = dock;
  useEffect(() => {
    if (!toast || toast.sticky) return;
    const t = setTimeout(dismissToast, 6000);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  if (!user || HIDDEN_PATHS.some(p => location.pathname.startsWith(p))) return null;

  const companionById = new Map(dock.companions.map(c => [c.id, c]));
  const shown = dock.windows.filter(w => !w.minimized).slice(-capacity);
  const shownKeys = new Set(shown.map(w => w.key));
  const openKeys = new Set(dock.windows.map(w => w.key));

  const toggle = (key: string, open: () => void) => {
    if (shownKeys.has(key)) dock.minimize(key);
    else if (openKeys.has(key)) dock.restore(key);
    else open();
  };

  const closeWindow = (w: DockWindow) => {
    if (w.companionId && w.companionId === dock.pageCoachId) markCoachDismissed();
    dock.close(w.key);
  };

  // Coaches first, then companions.
  const heads = [...dock.companions].sort((a, b) =>
    Number(b.relationship_type === 'mentor') - Number(a.relationship_type === 'mentor'));

  return (
    <div className="relative w-full">
      {/* Windows rise from the bar, newest on the right */}
      <div className={`pointer-events-none absolute bottom-full z-50 flex items-end gap-2 ${capacity === 1 ? 'inset-x-0' : 'right-0 pr-3'}`}>
        <AnimatePresence initial={false}>
          {shown.map(w => {
            if (w.key === MESSAGES_KEY) {
              return (
                <div key={w.key} className={`pointer-events-auto ${capacity === 1 ? 'w-full' : ''}`}>
                  <WindowFrame fullWidth={capacity === 1} room={room}>
                    <MessagingOverlay
                      embedded
                      initialView={dock.messagesView}
                      initialFriendCode={dock.pendingFriendCode}
                      onClose={() => dock.close(MESSAGES_KEY)}
                      onMinimize={() => dock.minimize(MESSAGES_KEY)}
                      onOpenChat={(t, g) => dock.openFriend(t, g, true)}
                    />
                  </WindowFrame>
                </div>
              );
            }
            if (w.friend) {
              return (
                <div key={w.key} className={`pointer-events-auto ${capacity === 1 ? 'w-full' : ''}`}>
                  <WindowFrame fullWidth={capacity === 1} room={room}>
                    <FriendChatWindow friend={w.friend} gameRequest={w.game} onMinimize={() => dock.minimize(w.key)} onClose={() => dock.close(w.key)} />
                  </WindowFrame>
                </div>
              );
            }
            const companion = w.companionId ? companionById.get(w.companionId) : undefined;
            if (!companion) return null;
            const isPageCoach = companion.id === dock.pageCoachId && !!dock.coachSurface;
            return (
              <div key={w.key} className={`pointer-events-auto ${capacity === 1 ? 'w-full' : ''}`}>
                <WindowFrame fullWidth={capacity === 1} room={room}>
                  <AiChatWindow
                    companion={companion}
                    surface={isPageCoach ? dock.coachSurface!.surface : undefined}
                    quickPrompts={isPageCoach ? dock.coachSurface!.quickPrompts : []}
                    onCoachChanged={isPageCoach ? dock.coachSurface!.onCoachChanged : undefined}
                    pending={dock.pendingFor(w.key)}
                    onConsumePending={() => dock.consumePending(w.key)}
                    onMinimize={() => dock.minimize(w.key)}
                    onClose={() => closeWindow(w)}
                  />
                </WindowFrame>
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* The bar */}
      {/* Same warm white as the top bar: the two read as one frame around the page. */}
      <div ref={barRef} className="relative flex h-[52px] items-center gap-2 border-t border-[#f5cfe0] bg-gradient-to-r from-[#fff7fa] to-[#fdf0f5] px-2 text-[#2a1424] sm:px-3">

        <div className="relative">
          <AnimatePresence>
            {dock.toast && !inbox.bubble && (
              <motion.button
                key={dock.toast.nonce}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={() => { const t = dock.toast!; dock.openFriend(t.friend, t.game); dock.dismissToast(); }}
                className="absolute bottom-full left-0 z-50 mb-2 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-amber-300/40 bg-[#1d1a10] px-3 py-2 text-left text-xs text-amber-50 shadow-lg"
                role="status"
              >
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-300 text-[11px] font-bold text-[#1d1a10]">
                  {dock.toast.friend.peerName.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 truncate"><span className="font-semibold text-amber-200">{dock.toast.friend.peerName}</span> {dock.toast.text}</span>
                {dock.toast.game && (
                  <span className="ml-1 flex-shrink-0 rounded-md bg-amber-300 px-2 py-0.5 font-semibold text-[#1d1a10]">Play</span>
                )}
                {dock.toast.sticky && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); dock.dismissToast(); }}
                    className="ml-1 flex-shrink-0 text-amber-100/50 hover:text-amber-100"
                    aria-label="Dismiss"
                  >
                    ×
                  </span>
                )}
              </motion.button>
            )}
            {inbox.bubble && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onClick={() => { dock.openMessages('requests'); inbox.dismissBubble(); }}
                className="absolute bottom-full left-0 mb-2 flex items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-[#14122a] px-3 py-2 text-xs font-semibold text-white shadow-lg"
                role="status"
              >
                <UserPlus className="h-3.5 w-3.5 text-pink-400" />
                {inbox.bubble}
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => toggle(MESSAGES_KEY, () => dock.openMessages())}
            className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
              shownKeys.has(MESSAGES_KEY)
                ? 'border-pink-400 bg-pink-500 text-white'
                : 'border-[#2a1424]/12 bg-white text-[#2a1424]/85 hover:bg-pink-50'
            }`}
            aria-pressed={shownKeys.has(MESSAGES_KEY)}
            title="Friends HQ"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Friends HQ</span>
            {inbox.badge > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white">
                {inbox.badge > 9 ? '9+' : inbox.badge}
              </span>
            )}
          </button>
        </div>

        {(heads.length > 0 || dock.windows.some(w => w.friend)) && <div className="h-6 w-px flex-shrink-0 bg-[#2a1424]/12" />}

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide">
          {heads.map(c => {
            const key = aiKey(c.id);
            const isCoach = c.relationship_type === 'mentor';
            const isShown = shownKeys.has(key);
            const isMinimized = openKeys.has(key) && !isShown;
            const onPage = c.id === dock.pageCoachId && dock.coachSurface;
            const count = dock.unread[c.id] ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(key, () => dock.openCompanion(c.id))}
                className={`relative flex h-9 flex-shrink-0 items-center gap-2 rounded-lg border-l-[3px] px-3 text-xs font-semibold transition-colors ${
                  isCoach ? 'border-l-emerald-500' : 'border-l-pink-500'
                } ${
                  isShown
                    ? 'bg-white text-[#2a1424] shadow-sm'
                    : isMinimized || onPage
                      ? 'bg-white/70 text-[#2a1424]/90 hover:bg-white'
                      : 'text-[#2a1424]/70 hover:bg-white/70 hover:text-[#2a1424]'
                }`}
                aria-pressed={isShown}
                title={`${c.custom_name}${isCoach ? ' · coach' : ''}${count ? ` · ${count} new` : ''}`}
              >
                <span className="max-w-[140px] truncate">{c.custom_name}</span>
                {onPage && <span className="hidden font-normal text-emerald-600 sm:inline">· {SURFACE_LABEL[dock.coachSurface!.surface]}</span>}
                {!isShown && count > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                    aria-label={`${count} unread from ${c.custom_name}`}
                  >
                    {count > 9 ? '9+' : count}
                  </motion.span>
                )}
              </button>
            );
          })}
          {dock.windows.filter(w => w.friend).map(w => {
            const f = w.friend!;
            const isShown = shownKeys.has(w.key);
            const count = dock.friendUnread[f.peerId] ?? 0;
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => toggle(w.key, () => dock.openFriend(f))}
                className={`relative flex h-9 flex-shrink-0 items-center gap-2 rounded-lg border-l-[3px] border-l-amber-400 px-3 text-xs font-semibold transition-colors ${
                  isShown ? 'bg-amber-200 text-amber-950 shadow-sm' : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                }`}
                aria-pressed={isShown}
                title={`${f.peerName} · friend${count ? ` · ${count} new` : ''}`}
              >
                <span className="max-w-[140px] truncate">{f.peerName}</span>
                {!isShown && count > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
                    aria-label={`${count} unread from ${f.peerName}`}
                  >
                    {count > 9 ? '9+' : count}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
