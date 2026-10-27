import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getDailyObjectives, OBJECTIVES, OBJECTIVES_CHANGED, type ObjectiveKey,
} from '../../services/dailyObjectivesService';

const REFRESH_MS = 60_000;

/**
 * Which of today's objectives are done, kept fresh: on load, whenever they move to another page
 * (usually right after doing one), when the tab comes back into view, when the app reports
 * something, and once a minute.
 */
export function useDailyObjectives(enabled = true) {
  const { pathname } = useLocation();
  const [done, setDone] = useState<Set<ObjectiveKey>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setDone(await getDailyObjectives());
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

  return { done, count: done.size, total: OBJECTIVES.length, loaded, refresh };
}
