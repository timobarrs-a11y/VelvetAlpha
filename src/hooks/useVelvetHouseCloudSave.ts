import { useCallback, useEffect, useState } from 'react';
import {
  loadVelvetHouseSave, saveVelvetHouseProgress, saveVelvetHouseHistory, maybeSnapshotHistory,
} from '../services/velvetHouseDatabase';

// The game keeps its save in this browser (it has no account of its own). This
// puts a copy of it in the player's account, and brings it back on a new
// device: the cloud save is loaded into local storage before the game starts,
// and local storage is copied up every 30 seconds and when leaving.
const SAVE_KEY_PREFIX = 'velvet-house-v1';
const RESTART_KEY_PREFIX = 'velvet-house-restart-pending';
const SYNC_INTERVAL_MS = 30_000;

const saveKeyFor = (companionId: string) => `${SAVE_KEY_PREFIX}:${companionId}`;
const restartKeyFor = (companionId: string) => `${RESTART_KEY_PREFIX}:${companionId}`;

/**
 * @param companionId whose house this is (null until known)
 * @param settled true once it's certain whether there is a companion; with none, the game starts without a cloud save
 */
export function useVelvetHouseCloudSave(companionId: string | null, settled: boolean) {
  const [saveReady, setSaveReady] = useState(false);

  const sync = useCallback(async () => {
    if (!companionId) return;
    const restartKey = restartKeyFor(companionId);
    const restartPending = localStorage.getItem(restartKey) === '1';
    try {
      const raw = localStorage.getItem(saveKeyFor(companionId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (restartPending) {
        // Restarted: keep the old house recoverable, then replace it with the fresh game.
        try {
          const oldCloud = await loadVelvetHouseSave(companionId);
          if (oldCloud) await saveVelvetHouseHistory(companionId, oldCloud);
        } catch { /* best-effort backup */ }
        await saveVelvetHouseProgress(companionId, parsed, true);
        await maybeSnapshotHistory(companionId, parsed);
        localStorage.removeItem(restartKey);
      } else {
        await saveVelvetHouseProgress(companionId, parsed);
        await maybeSnapshotHistory(companionId, parsed);
      }
    } catch { /* the next interval retries */ }
  }, [companionId]);

  // The game says it restarted: the next upload replaces the cloud save.
  const noteRestart = useCallback(() => {
    if (!companionId) return;
    try { localStorage.setItem(restartKeyFor(companionId), '1'); } catch { /* storage blocked */ }
    sync().catch(() => {});
  }, [companionId, sync]);

  useEffect(() => {
    if (!companionId) {
      if (settled) setSaveReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const key = saveKeyFor(companionId);
      try {
        if (localStorage.getItem(restartKeyFor(companionId)) !== '1') {
          const save = await loadVelvetHouseSave(companionId);
          if (save) {
            // Before replacing a local save, keep it in history.
            const prev = localStorage.getItem(key);
            if (prev) { try { await saveVelvetHouseHistory(companionId, JSON.parse(prev)); } catch { /* non-fatal */ } }
            localStorage.setItem(key, JSON.stringify(save));
          } else if (!localStorage.getItem(key)) {
            // Nothing in the cloud or for this companion yet. A house saved before saves were
            // per companion lives under the plain key: adopt it rather than starting over.
            const older = localStorage.getItem(SAVE_KEY_PREFIX);
            if (older) localStorage.setItem(key, older);
          }
          // (A local save with nothing in the cloud is kept, and uploaded by the next sync.)
        }
      } catch { /* cloud unreachable: keep whatever is local */ }
      if (!cancelled) setSaveReady(true);
    })();

    const onUnload = () => { sync(); };
    window.addEventListener('beforeunload', onUnload);
    const timer = setInterval(sync, SYNC_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeunload', onUnload);
      clearInterval(timer);
      sync();
    };
  }, [companionId, settled, sync]);

  return { saveReady, noteRestart, sync };
}
