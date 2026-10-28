import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Undo2, BellOff } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';

const STORAGE_KEY = 'first-progress-post-seen';

// Velvet Sims is a full-screen game: the popup must never float over it.
const GAME_PATH_PREFIXES = ['/velvet-house'];

export function FirstPostWatcher() {
  const [popup, setPopup] = useState<{ postId: string; title: string } | null>(null);
  const knownPostRef = useRef<string | null>(null);
  const { pathname } = useLocation();
  const inGame = GAME_PATH_PREFIXES.some(p => pathname.startsWith(p));

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for existing posts the user hasn't been notified about
      const alreadySeen = sessionStorage.getItem(STORAGE_KEY) === 'true';
      if (alreadySeen) return;

      const { data: existing } = await supabase
        .from('progress_posts')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const first = existing[0];
        knownPostRef.current = first.id;
        setPopup({ postId: first.id, title: first.title });
        sessionStorage.setItem(STORAGE_KEY, 'true');
        return;
      }

      // Watch for new posts via realtime
      channel = supabase
        .channel('first-post-watcher')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'progress_posts', filter: `user_id=eq.${user.id}` },
          (payload) => {
            const newPost = payload.new as { id: string; title: string };
            if (knownPostRef.current === newPost.id) return;
            knownPostRef.current = newPost.id;
            setPopup({ postId: newPost.id, title: newPost.title });
            sessionStorage.setItem(STORAGE_KEY, 'true');
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleUndo = async () => {
    if (!popup) return;
    await supabase
      .from('progress_posts')
      .delete()
      .eq('id', popup.postId);
    setPopup(null);
  };

  const handleTurnOff = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('member_profiles')
        .update({ auto_posting_enabled: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    }
    setPopup(null);
  };

  // framer-motion writes its own transform onto the animated element, which replaces the Tailwind
  // translate-x-1/2 that centred it: the card then started at the middle and ran off the right edge.
  // The -50% goes through framer's `x` so the transforms compose.
  return (
    <AnimatePresence>
      {popup && !inGame && (
        <motion.div
          key="first-post-popup"
          initial={{ opacity: 0, x: '-50%', y: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: '-50%', y: 0, scale: 1 }}
          exit={{ opacity: 0, x: '-50%', y: 10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 z-[9998] w-[380px] max-w-[calc(100vw-2rem)]"
        >
          <div className="rounded-2xl border border-amber-200/60 bg-white shadow-xl overflow-hidden">
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4.5 h-4.5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">We shared your progress to your profile</p>
                <p className="text-xs text-ink-subtle mt-0.5">
                  No details were included — just a note that you completed something. Your profile visitors can see it.
                </p>
              </div>
              <button
                onClick={() => setPopup(null)}
                className="text-ink-subtle hover:text-ink p-0.5 rounded-lg hover:bg-surface-100 transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 pb-4">
              <button
                onClick={handleUndo}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink px-3 py-2 rounded-lg bg-surface-100 hover:bg-surface-200 transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button
                onClick={handleTurnOff}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle px-3 py-2 rounded-lg hover:bg-surface-100 transition-colors"
              >
                <BellOff className="w-3.5 h-3.5" /> Turn off auto-posts
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
