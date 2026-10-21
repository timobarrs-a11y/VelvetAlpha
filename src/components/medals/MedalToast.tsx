import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../shared/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { MedalBadge } from './MedalBadge';

interface MedalToastData {
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'legendary';
  icon: string;
}

export function MedalToastHost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState<MedalToastData | null>(null);
  const [visible, setVisible] = useState(false);
  const shownIdsRef = useState<Set<string>>(new Set())[0];

  const showToast = useCallback((data: MedalToastData) => {
    setToast(data);
    setVisible(true);
    setTimeout(() => {
      setVisible(false);
      setTimeout(() => setToast(null), 400);
    }, 5000);
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('medal-toast');
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const notif = payload.new as any;
        if (notif.type !== 'badge' || !notif.meta) return;
        if (shownIdsRef.has(notif.id)) return;
        shownIdsRef.add(notif.id);
        showToast({
          name: notif.meta.name ?? 'A new medal',
          tier: notif.meta.tier ?? 'bronze',
          icon: notif.meta.icon ?? 'Award',
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, showToast, shownIdsRef]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: visible ? 0 : 400, opacity: visible ? 1 : 0 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
          onClick={() => navigate('/medals')}
          className="fixed top-20 right-4 z-[60] cursor-pointer"
        >
          <div
            className="flex items-center gap-3 p-3.5 rounded-2xl min-w-[300px] shadow-2xl"
            style={{ background: 'var(--ds-surface-3)', border: '1px solid var(--ds-border-strong)' }}
          >
            <MedalBadge icon={toast.icon} tier={toast.tier} size="md" />
            <div className="flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-400">Medal Earned</p>
              <p className="text-sm font-semibold text-ink mt-0.5">You earned <span className="text-pink-300">{toast.name}</span></p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
