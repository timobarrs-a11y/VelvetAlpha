import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Minus, ChevronUp, UserPlus } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { MessagingOverlay } from './MessagingOverlay';
import { getConversationList, getIncomingRequests } from '../shared/supabase/queries/messaging';

const HIDDEN_PATHS = [
  '/splash', '/signin', '/signup', '/onboarding',
];

interface MessagingOverlayMountProps {
  inkColor?: string;
  inkMuted?: string;
}

type DockState = 'closed' | 'open' | 'minimized';

export function MessagingOverlayMount({ inkColor = '#f0eeff', inkMuted = '#9990cc' }: MessagingOverlayMountProps) {
  const { user } = useAuth();
  const [dockState, setDockState] = useState<DockState>('closed');
  const [unread, setUnread] = useState(0);
  const [requests, setRequests] = useState<{ id: string; name: string }[]>([]);
  const [bubble, setBubble] = useState<string | null>(null);
  const [openOn, setOpenOn] = useState<'conversations' | 'requests'>('conversations');
  const seenRequests = useRef<Set<string> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const [convs, incoming] = await Promise.all([
        getConversationList(),
        getIncomingRequests().catch(() => []),
      ]);
      const total = convs.reduce((sum, c) => sum + c.unread_count, 0);
      setUnread(total);

      const mapped = (incoming || []).map((r) => ({
        id: (r as any).friendship_id ?? r.user_id,
        name: r.display_name,
      }));
      setRequests(mapped);

      const currentIds = new Set(mapped.map((r) => r.id));
      if (seenRequests.current === null) {
        seenRequests.current = currentIds;
      } else {
        const newOnes = mapped.filter((r) => !seenRequests.current!.has(r.id));
        if (newOnes.length > 0) {
          const text = newOnes.length === 1
            ? `${newOnes[0].name} wants to be friends`
            : `${newOnes[0].name} and ${newOnes.length - 1} other${newOnes.length - 1 > 1 ? 's' : ''} want to be friends`;
          setBubble(text);
          if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
          bubbleTimer.current = setTimeout(() => setBubble(null), 8000);
        }
        seenRequests.current = currentIds;
      }
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refreshUnread();
    const interval = setInterval(refreshUnread, 20000);
    return () => clearInterval(interval);
  }, [user, refreshUnread]);

  useEffect(() => {
    if (!user) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel('im-inbox-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'im_messages' },
        () => { refreshUnread(); },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, refreshUnread]);

  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (!user) return null;
  if (HIDDEN_PATHS.some(p => path.startsWith(p))) return null;

  const open = dockState === 'open';
  const minimized = dockState === 'minimized';

  return (
    <div className="relative w-full">
      {/* Docked chat panel — grows upward from the bar */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: 20, scaleY: 0.9 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute bottom-full right-0 z-50 w-[100vw] sm:w-[400px] h-[min(70vh,640px)] flex flex-col overflow-hidden rounded-t-2xl border border-white/10 border-b-0 shadow-2xl"
            style={{ background: 'var(--ds-surface, #1a1a2e)', transformOrigin: 'bottom right' }}
          >
            <MessagingOverlay
              embedded
              initialView={openOn}
              onClose={() => setDockState('closed')}
              onMinimize={() => setDockState('minimized')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized tab — sits inside the bar, shows unread + name */}
      <AnimatePresence>
        {minimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="flex items-center justify-center px-2 py-1.5"
          >
            <button
              onClick={() => setDockState('open')}
              className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10"
              style={{ color: inkColor }}
              title="Open messages"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Messages</span>
              {unread + requests.length > 0 && (
                <span
                  className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
                >
                  {unread + requests.length > 9 ? '9+' : unread + requests.length}
                </span>
              )}
              <ChevronUp className="h-3 w-3 text-ink-muted" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Closed launcher — single button in the bar */}
      {dockState === 'closed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center gap-2"
        >
          {/* Friend request bubble */}
          <AnimatePresence>
            {bubble && (
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                onClick={() => { setOpenOn('requests'); setDockState('open'); setBubble(null); if (bubbleTimer.current) clearTimeout(bubbleTimer.current); }}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/8"
                role="status"
              >
                <UserPlus className="h-3.5 w-3.5 text-rose-400" />
                <span>{bubble}</span>
              </motion.button>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setOpenOn('conversations'); setDockState('open'); }}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 transition-colors hover:bg-white/8"
            style={{ color: inkColor }}
            title="Instant messages"
            aria-label="Open instant messages"
          >
            <MessageCircle className="h-4 w-4" />
            {unread + requests.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-2 border-[#0c0b20] bg-rose-500 px-1 text-[9px] font-bold text-white"
              >
                {unread + requests.length > 9 ? '9+' : unread + requests.length}
              </motion.span>
            )}
            {unread + requests.length > 0 && (
              <span className="absolute inset-0 rounded-full ring-2 ring-rose-500/40 animate-pulse" />
            )}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
