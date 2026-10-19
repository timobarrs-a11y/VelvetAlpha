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
    <>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 w-12 h-12 rounded-full flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white shadow-lg transition-colors"
        style={{ boxShadow: '0 8px 24px -6px rgba(244,63,94,0.5)' }}
        title="Friends & messages"
        aria-label="Open friends and messages"
      >
        <Users className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-rose-600 text-[10px] font-bold flex items-center justify-center border-2 border-rose-500">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && <MessagingOverlay onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
