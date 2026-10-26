import { useCallback, useEffect, useState } from 'react';
import {
  loadVelvetHouseSaveCopies, saveVelvetHouseProgress, saveVelvetHouseHistory, maybeSnapshotHistory, compareSaveProgress,
} from '../services/velvetHouseDatabase';
import { migrateSave, repairFromV1 } from '../games/velvet-house/state/saveMigration';

// The game keeps its save in this browser (it has no account of its own). This puts a copy of it in the
// player's account, and brings it back on a new device: before the game starts, the newer of the cloud save and
// this browser's save is put in the game's slot, and the slot is copied up every 30 seconds and when leaving.
//
// The live game has its own slot (`velvet-sims:<id>`). The legacy game's slot and restart flag are different
// keys, so neither game can overwrite the other's local progress.
const SAVE_KEY_PREFIX = 'velvet-sims';
const RESTART_KEY_PREFIX = 'velvet-sims-restart-pending';
const SYNC_INTERVAL_MS = 30_000;

const saveKeyFor = (companionId: string) => `${SAVE_KEY_PREFIX}:${companionId}`;
const restartKeyFor = (companionId: string) => `${RESTART_KEY_PREFIX}:${companionId}`;

function readLocal(key: string): Record<string, unknown> | null {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}

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
          const old = await loadVelvetHouseSaveCopies(companionId);
          const oldCloud = old?.v2 ?? old?.v1;
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
          const copies = await loadVelvetHouseSaveCopies(companionId);
          const cloudRaw = copies ? (copies.v1 && copies.v2 ? (compareSaveProgress(copies.v1, copies.v2) > 0 ? copies.v1 : copies.v2) : copies.v2 ?? copies.v1) : null;
          const cloud = cloudRaw ? migrateSave(cloudRaw) : null;
          const local = migrateSave(readLocal(key));
          // The newer one wins, so progress made offline is not thrown away by an older cloud copy.
          let chosen = cloud && local ? (compareSaveProgress(local as never, cloud as never) > 0 ? local : cloud) : cloud ?? local;
          if (chosen) {
            const usedCloud = chosen === cloud;
            // Anything the old save bug destroyed comes back from the cloud's v1 copy.
            chosen = repairFromV1(chosen, copies?.v1 ?? null);
            // Replacing a different local save: keep it in history.
            if (usedCloud && local) { try { await saveVelvetHouseHistory(companionId, local as never); } catch { /* non-fatal */ } }
            localStorage.setItem(key, JSON.stringify(chosen));
          }
          // With nothing in the cloud or the new slot, a house saved by the older page is brought across by the
          // game itself on first load (LEGACY_SAVE_KEY in the game).
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
