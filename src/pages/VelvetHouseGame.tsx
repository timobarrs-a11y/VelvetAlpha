import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanion } from '../services/companionService';
import { loadVelvetHouseSave, saveVelvetHouseProgress, saveVelvetHouseHistory, maybeSnapshotHistory } from '../services/velvetHouseDatabase';
import { buildProfile, type PlayerProfile } from '../features/velvet-sims/simProfile';
import { sampleGameTurn } from '../services/velvetGameTurn';
import { isRestartedMessage, isReadyMessage, isVidSearchMessage, sanitizeMessage } from '../games/velvet-house/bridge/protocol';

const GAME_PATH = '/games/velvet-house/index.html';
const SAVE_KEY_PREFIX = 'velvet-house-v1';
const RESTART_KEY_PREFIX = 'velvet-house-restart-pending';
const SYNC_INTERVAL_MS = 30_000;

function saveKeyFor(companionId: string) {
  return `${SAVE_KEY_PREFIX}:${companionId}`;
}
function restartKeyFor(companionId: string) {
  return `${RESTART_KEY_PREFIX}:${companionId}`;
}
export function VelvetHouseGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saveReady, setSaveReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncToSupabase = useCallback(async () => {
    if (!companionId) return;
    const key = saveKeyFor(companionId);
    const restartKey = restartKeyFor(companionId);
    const restartPending = localStorage.getItem(restartKey) === '1';
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);

        if (restartPending) {
          // The game was restarted — the local save is a fresh day-1 game.
          // Before overwriting the cloud, back up the old cloud save to history
          // so the previous house is still recoverable.
          try {
            const oldCloud = await loadVelvetHouseSave(companionId);
            if (oldCloud) {
              await saveVelvetHouseHistory(companionId, oldCloud);
            }
          } catch { /* best-effort backup */ }

          // Force-upload the fresh save, bypassing the rollback guard
          // (which would reject a lower day number).
          await saveVelvetHouseProgress(companionId, parsed, true);
          await maybeSnapshotHistory(companionId, parsed);
          localStorage.removeItem(restartKey);
        } else {
          await saveVelvetHouseProgress(companionId, parsed);
          await maybeSnapshotHistory(companionId, parsed);
        }
      }
    } catch {
      // next interval retries
    }
  }, [companionId]);

  const handleExit = useCallback(() => {
    syncToSupabase();
    navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
  }, [companionId, navigate, syncToSupabase]);

  const connectGame = useCallback(async (needsProfile: boolean) => {
    const win = iframeRef.current?.contentWindow as (Window & { __velvet?: { setSample?: (f: unknown) => void } }) | null;
    if (!win || !companionId) return;

    win.__velvet?.setSample?.((input: unknown, opts?: { signal?: AbortSignal }) =>
      sampleGameTurn(companionId, input, opts?.signal));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: player }, companion] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('name, nickname, avatar_config, favorite_color')
        .eq('id', user.id)
        .maybeSingle(),
      getCompanion(companionId),
    ]);
    if (!companion) {
      setError("We couldn't find this companion. Head back to the lobby and pick one.");
      return;
    }
    win.postMessage(buildProfile(player as PlayerProfile | null, companion, needsProfile), window.location.origin);
  }, [companionId]);

  useEffect(() => {
    if (!companionId) {
      setError('No companion selected. Choose a companion from the lobby to play Velvet Sims.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      const clean = sanitizeMessage(msg as Record<string, unknown>);
      if (isReadyMessage(clean)) {
        setLoading(false);
        connectGame(clean.needsProfile === true).catch(() => {});
      }
      if (isVidSearchMessage(clean)) {
        const seq = clean.seq;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-video-search`;
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ query: clean.query, userContext: 'Velvet Sims in-game TV' }),
        })
          .then(r => r.json())
          .then(data => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'velvet:vidResults', seq, videos: data.videos || [] },
              window.location.origin,
            );
          })
          .catch(() => {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'velvet:vidResults', seq, videos: [] },
              window.location.origin,
            );
          });
      }
      if (isRestartedMessage(clean)) {
        // Remember the restart so the next sync force-uploads the fresh save.
        // The flag survives reload/tab close so we don't lose the restart intent.
        localStorage.setItem(restartKeyFor(companionId), '1');

        // Try an immediate upload in case the local save already has the fresh game.
        syncToSupabase().catch(() => {});
      }
    };
    const onUnload = () => { syncToSupabase(); };

    window.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', onUnload);
    const timer = setInterval(syncToSupabase, SYNC_INTERVAL_MS);

    (async () => {
      const key = saveKeyFor(companionId);
      const restartKey = restartKeyFor(companionId);
      const restartPending = localStorage.getItem(restartKey) === '1';

      try {
        if (restartPending) {
          // The player restarted last session but the fresh save never got
          // uploaded. Keep the local save (the fresh game) instead of
          // overwriting it with the old cloud save.
          // If there's no local save at all, leave local storage empty so the
          // game starts fresh — do NOT reload the old cloud save (that would
          // undo the restart).
          const localRaw = localStorage.getItem(key);
          if (!localRaw) {
            localStorage.removeItem(key);
          }
        } else {
          const save = await loadVelvetHouseSave(companionId);
          if (save) {
            // Cloud save exists — write it to the per-companion key.
            // Before overwriting, stash the previous local save into history for recovery.
            const prev = localStorage.getItem(key);
            if (prev) {
              try { await saveVelvetHouseHistory(companionId, JSON.parse(prev)); } catch { /* non-fatal */ }
            }
            localStorage.setItem(key, JSON.stringify(save));
          } else {
            // No cloud save for this companion — clear any stale local key
            // so we don't load another companion's house (the bleed bug).
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Cloud unreachable — keep whatever local key exists for this companion.
      }
      if (!cancelled) setSaveReady(true);
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('message', onMessage);
      window.removeEventListener('beforeunload', onUnload);
      clearInterval(timer);
      syncToSupabase();
    };
  }, [companionId, connectGame, syncToSupabase]);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f] z-50">
        <div className="text-center max-w-sm px-6">
          <p className="text-white/60 text-sm mb-4">{error}</p>
          <button
            onClick={() => navigate('/lobby')}
            className="px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/10 flex-shrink-0">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit
        </button>
        <span className="text-white/40 text-xs font-medium tracking-wide">VELVET HOUSE</span>
        <div className="w-16" />
      </div>

      {loading && (
        <div className="absolute inset-0 top-12 flex items-center justify-center bg-[#0a0a0f] z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            <p className="text-white/40 text-sm">Loading Velvet Sims...</p>
          </div>
        </div>
      )}

      {saveReady && (
        <iframe
          ref={iframeRef}
          src={`${GAME_PATH}?companion=${encodeURIComponent(companionId ?? '')}`}
          title="Velvet Sims"
          className="flex-1 w-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
}
