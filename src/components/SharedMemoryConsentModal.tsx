import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Sparkles } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { Button } from '../shared/ui';

const STORAGE_KEY = 'velvet.shared_memory_consent_seen';

export function SharedMemoryConsentModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = sessionStorage.getItem(STORAGE_KEY);
        if (seen) return;
        const { data } = await supabase
          .from('user_profiles')
          .select('shared_memory_consent')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (data && data.shared_memory_consent === null) {
          setOpen(true);
        }
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const choose = async (consent: boolean) => {
    setSaving(true);
    try {
      await supabase
        .from('user_profiles')
        .update({ shared_memory_consent: consent })
        .eq('id', userId);
      sessionStorage.setItem(STORAGE_KEY, '1');
      setOpen(false);
    } catch { /* best-effort */ }
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className="bg-[#111118] border border-white/12 rounded-3xl max-w-md w-full p-8 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-pink-500/20 border border-primary-500/20 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-primary-400" />
            </div>

            <h2 className="text-xl font-bold text-white mb-3 font-display">A world that knows you</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              This is designed to be a world around you. When you tell your coach something important —
              your mom is sick, you got the job, you're moving — your companions know too.
              You never have to repeat yourself.
            </p>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8 mb-6 text-left">
              <Shield className="w-5 h-5 text-white/30 flex-shrink-0" />
              <p className="text-xs text-white/40 leading-relaxed">
                Anything you say should stay between you and one person stays private.
                You can turn this off anytime in settings.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={() => choose(false)}
                disabled={saving}
                className="flex-1"
              >
                Keep them separate
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => choose(true)}
                disabled={saving}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-1.5 inline" />
                Share memories
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
