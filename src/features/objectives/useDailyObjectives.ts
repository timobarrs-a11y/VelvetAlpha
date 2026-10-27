import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getDailyObjectives, OBJECTIVES_CHANGED, type ObjectiveRow,
} from '../../services/dailyObjectivesService';

const REFRESH_MS = 60_000;

/**
 * The objectives on offer and how far along they are, kept fresh: on load, whenever they move to another page
 * (usually right after doing one), when the tab comes back into view, when the app reports
 * something, and once a minute.
 */
export function useDailyObjectives(enabled = true) {
  const { pathname } = useLocation();
  const [rows, setRows] = useState<ObjectiveRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRows(await getDailyObjectives());
      setLoaded(true);
    } catch {
      /* the button just keeps what it had */
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, pathname, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener(OBJECTIVES_CHANGED, refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      window.removeEventListener(OBJECTIVES_CHANGED, refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  const count = rows.filter(r => r.done).length;
  return { rows, count, total: rows.length, core: rows.length > 0 && rows[0].core, loaded, refresh };
}
