import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
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

export function MessagingOverlayMount({ inkColor = '#f0eeff', inkMuted = '#9990cc' }: MessagingOverlayMountProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [hasMessages, setHasMessages] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!user) return;
    try {
      const convs = await getConversationList();
      const total = convs.reduce((sum, c) => sum + c.unread_count, 0);
      setUnread(total);
      setHasMessages(convs.length > 0);
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

  return (
    <div className="w-full">
      {!open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center px-3 py-1.5"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
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

      <AnimatePresence>
        {open && <MessagingOverlay embedded onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
