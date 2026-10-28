import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookPen, X } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';

/** A coach or assistant gave real information about the goal and it was kept: say so, and say where. */
export function GoalNotesWatcher() {
  const userId = useAuth().user?.id;
  const navigate = useNavigate();
  const [note, setNote] = useState<{ id: string; title: string; goalId: string | null } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`goal-notes-watch-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goal_notes', filter: `user_id=eq.${userId}` }, payload => {
        const row = payload.new as { id: string; title: string; goal_id: string | null };
        setNote({ id: row.id, title: row.title, goalId: row.goal_id });
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setNote(null), 9000);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [userId]);

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          key={note.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="pointer-events-none fixed inset-x-0 bottom-[72px] z-[60] flex justify-center px-4"
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-[#1a1530]/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
            <NotebookPen className="h-4 w-4 shrink-0 text-sky-300" />
            <button
              type="button"
              onClick={() => { setNote(null); navigate(note.goalId ? `/notes?goal=${note.goalId}` : '/notes'); }}
              className="min-w-0 flex-1 text-left text-sm"
            >
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-sky-300">Saved to your notes</span>
              <span className="block truncate">{note.title}</span>
            </button>
            <button type="button" onClick={() => setNote(null)} aria-label="Dismiss" className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
