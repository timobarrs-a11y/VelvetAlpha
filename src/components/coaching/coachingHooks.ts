import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../shared/supabase/client';

/** Ids the coach just created or changed, highlighted on the page for a few seconds. */
export function useCoachHighlight(durationMs = 6000) {
  const [highlighted, setHighlighted] = useState<Set<string>>(() => new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setHighlighted(new Set(ids));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlighted(new Set()), durationMs);
  }, [durationMs]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { highlighted, flash };
}

export const HIGHLIGHT_CLASS = 'ring-2 ring-pink-400/70 ring-offset-2 ring-offset-transparent transition-shadow';

/**
 * Reload when any of the user's coaching rows change, whether from the coach
 * panel, the chat screen or another device. RLS limits events to the user's rows.
 */
export function useCoachingRealtime(userId: string | null | undefined, tables: string[], onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const tableKey = tables.join(',');

  useEffect(() => {
    if (!userId) return;
    let channel = supabase.channel(`coaching-${tableKey}-${userId}-${Date.now()}`);
    for (const table of tableKey.split(',')) {
      // Steps have no user_id column; RLS still scopes them to this user.
      const filter = table === 'coach_plan_steps' ? undefined : `user_id=eq.${userId}`;
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => onChangeRef.current());
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, tableKey]);
}
