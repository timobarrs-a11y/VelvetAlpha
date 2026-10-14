import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getCompanion, type Companion } from '../services/companionService';
import { getCompanionMemory, type CompanionMemory } from '../services/memoryService';
import { loadVelvetHouseSave, saveVelvetHouseProgress } from '../services/velvetHouseDatabase';
import { saveCompanionMemory } from '../services/memoryService';

const GAME_PATH = '/games/velvet-house/index.html';
const SAVE_KEY = 'velvet-house-v1';
const SYNC_INTERVAL_MS = 30_000;

export function VelvetHouseGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const companionIdRef = useRef<string | null>(companionId);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleExit = useCallback(() => {
    if (companionId) {
      navigate(`/chat?companion=${companionId}`);
    } else {
      navigate('/lobby');
    }
  }, [companionId, navigate]);

  // Sync localStorage save → Supabase
  const syncToSupabase = useCallback(async () => {
    const cid = companionIdRef.current;
    if (!cid) return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saveData = JSON.parse(raw);
      await saveVelvetHouseProgress(cid, saveData);
    } catch {
      // best-effort
    }
  }, []);

  // Inject companion profile into the game via postMessage
  const sendProfile = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    const cid = companionIdRef.current;
    if (!cid) return;

    try {
      const { data: { user } } = await import('../shared/supabase/client').then(m => m.supabase.auth.getUser());
      if (!user) return;

      const [companion, memory] = await Promise.all([
        getCompanion(cid),
        getCompanionMemory(user.id, cid),
      ]);

      if (!companion) return;

      const profile = buildProfilePayload(companion, memory);
      iframe.contentWindow.postMessage(
        { type: 'velvet:profile', ...profile },
        window.location.origin,
      );
    } catch {
      // best-effort
    }
  }, []);

  // Inject the voice shim via the game's setSample hook
  const injectVoiceShim = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    const cid = companionIdRef.current;
    if (!cid) return;

    const gameWindow = iframe.contentWindow as any;

    // The game exposes window.__velvet.setSample(fn) as an injection point
    if (gameWindow.__velvet && typeof gameWindow.__velvet.setSample === 'function') {
      gameWindow.__velvet.setSample(async (input: any, _opts: any) => {
        try {
          const lastUser = Array.isArray(input)
            ? [...input].reverse().find((m: any) => m.role === 'user')
            : null;
          const message = lastUser?.content ?? '';

          const supa = await import('../shared/supabase/client');
          const { data: { session } } = await supa.supabase.auth.getSession();
          const token = session?.access_token;
          if (!token) return { text: 'I need you to sign in first.' };

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-turn`;
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({
              companionId: cid,
              message,
              mode: 'chat',
            }),
          });

          if (!res.ok) {
            return { text: '...hm, connection issue. Try again?' };
          }

          const data: any = await res.json();
          return { text: data.assistantMessage ?? '' };
        } catch {
          return { text: '...something went wrong. Try again?' };
        }
      });
    }
  }, []);

  // Handle postMessages from the game
  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg.type !== 'string') return;

    switch (msg.type) {
      case 'velvet:ready': {
        // Game is loaded and requesting a profile
        setLoading(false);
        await sendProfile();
        injectVoiceShim();
        break;
      }
      case 'velvet:profileApplied': {
        // Profile was accepted by the game
        break;
      }
      case 'velvet:memory': {
        // Game produced a memory moment — persist to companion memory
        if (msg.text && companionIdRef.current) {
          await persistMemory(msg.text);
        }
        break;
      }
      case 'velvet:moment': {
        // Game produced a moment — log for potential insights integration
        break;
      }
    }
  }, [sendProfile, injectVoiceShim]);

  // Persist an in-game memory to the companion's memory table
  const persistMemory = useCallback(async (text: string) => {
    const cid = companionIdRef.current;
    if (!cid) return;
    try {
      const supa = await import('../shared/supabase/client');
      const { data: { user } } = await supa.supabase.auth.getUser();
      if (!user) return;

      const existing = await getCompanionMemory(user.id, cid);
      if (existing) {
        const updatedJson = { ...existing.memory_json };
        updatedJson.key_moments = [
          ...(updatedJson.key_moments || []),
          { summary: text, emotional_weight: 'medium' as const },
        ].slice(-20);
        await saveCompanionMemory(
          user.id,
          cid,
          updatedJson,
          existing.memory_text,
          existing.messages_processed,
          existing.last_message_id ?? '',
        );
      }
    } catch {
      // best-effort
    }
  }, []);

  // On mount: load save from Supabase → localStorage, set up listeners
  useEffect(() => {
    if (!companionId) {
      setError('No companion selected. Choose a companion from the lobby to play Velvet House.');
      setLoading(false);
      return;
    }

    companionIdRef.current = companionId;

    (async () => {
      // Load save from Supabase and write to localStorage for the game to pick up
      const save = await loadVelvetHouseSave(companionId);
      if (save) {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        } catch {
          // localStorage might be full or unavailable
        }
      }

      // Set up postMessage listener
      window.addEventListener('message', handleMessage);

      // Set up periodic save sync
      syncTimerRef.current = setInterval(syncToSupabase, SYNC_INTERVAL_MS);

      // Sync on page exit
      const onBeforeUnload = () => { syncToSupabase(); };
      window.addEventListener('beforeunload', onBeforeUnload);
      setLoading(false);

      return () => {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('beforeunload', onBeforeUnload);
        if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      };
    })();

    return () => {
      window.removeEventListener('message', handleMessage);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [companionId, handleMessage, syncToSupabase]);

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0f] z-50">
        <div className="text-center max-w-sm px-6">
          <p className="text-ink-muted text-sm mb-4">{error}</p>
          <button
            onClick={handleExit}
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
      {/* Exit bar */}
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

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 top-12 flex items-center justify-center bg-[#0a0a0f] z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            <p className="text-white/40 text-sm">Loading Velvet House...</p>
          </div>
        </div>
      )}

      {/* Game iframe */}
      <iframe
        ref={iframeRef}
        src={GAME_PATH}
        title="Velvet House"
        className="flex-1 w-full border-0"
        allow="autoplay; fullscreen"
        onLoad={() => {
          // Try injecting voice shim after iframe loads
          setTimeout(injectVoiceShim, 500);
        }}
      />
    </div>
  );
}

function buildProfilePayload(
  companion: Companion,
  memory: CompanionMemory | null,
) {
  const personality = [
    companion.communication_style,
    companion.humor_style,
    companion.signature_voice,
  ].filter(Boolean).join('. ');

  const likes = [
    ...(companion.hobbies || []),
    companion.interest_text,
  ].filter(Boolean) as string[];

  const memories: string[] = [];
  if (memory) {
    const mj = memory.memory_json;
    if (mj.key_moments) {
      memories.push(...mj.key_moments.map(km => km.summary));
    }
    if (mj.relationship_with_companion?.inside_jokes) {
      memories.push(...mj.relationship_with_companion.inside_jokes);
    }
    if (mj.relationship_with_companion?.nicknames) {
      memories.push(...mj.relationship_with_companion.nicknames);
    }
  }

  const look = companion.avatar_config
    ? JSON.stringify(companion.avatar_config)
    : companion.favorite_color ?? '';

  return {
    player: {
      name: 'You',
      look: '',
    },
    companion: {
      name: companion.custom_name,
      pronoun: companion.gender === 'male' ? 'he' : 'she',
      personality: personality || 'warm, curious, playful',
      look,
      memories: memories.slice(0, 10),
      likes,
      dislikes: [],
    },
  };
}
