import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { MessagingOverlay } from './MessagingOverlay';
import { getConversationList } from '../shared/supabase/queries/messaging';

const HIDDEN_PATHS = [
  '/splash', '/signin', '/signup', '/onboarding',
];

export function MessagingOverlayMount() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const convs = await getConversationList();
      setUnread(convs.reduce((sum, c) => sum + c.unread_count, 0));
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

  // Realtime: bump unread when a new DM arrives.
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

  // Hide on auth / splash / onboarding pages
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (!user) return null;
  if (HIDDEN_PATHS.some(p => path.startsWith(p))) return null;

  return (
    <div className="w-full">
      {!open && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setOpen(true)}
          className="flex min-h-[58px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-white/5"
          title="Friends & messages"
          aria-label="Open friends and messages"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white shadow-[0_8px_24px_-6px_rgba(244,63,94,0.5)]">
            <Users className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#0c0b20] bg-white px-1 text-[10px] font-bold text-rose-600">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-ink">Friends & messages</span>
            <span className="block text-[10px] text-ink-muted">Keep conversations close while you explore</span>
          </span>
          <span className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-medium text-ink-muted">Open</span>
        </motion.button>
      )}

      <AnimatePresence>
        {open && <MessagingOverlay embedded onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
