import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Minus, ChevronUp } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { MessagingOverlay } from './MessagingOverlay';
import { getConversationList } from '../shared/supabase/queries/messaging';

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const convs = await getConversationList();
      const total = convs.reduce((sum, c) => sum + c.unread_count, 0);
      setUnread(total);
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
              {unread > 0 && (
                <span
                  className="flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white"
                >
                  {unread > 9 ? '9+' : unread}
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
          className="flex items-center justify-center px-3 py-1.5"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setDockState('open')}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 transition-colors hover:bg-white/8"
            style={{ color: inkColor }}
            title="Instant messages"
            aria-label="Open instant messages"
          >
            <MessageCircle className="h-4 w-4" />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full border-2 border-[#0c0b20] bg-rose-500 px-1 text-[9px] font-bold text-white"
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
            {unread > 0 && (
              <span className="absolute inset-0 rounded-full ring-2 ring-rose-500/40 animate-pulse" />
            )}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
