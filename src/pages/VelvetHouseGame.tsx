import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanion, type Companion } from '../services/companionService';
import { loadVelvetHouseSave, saveVelvetHouseProgress } from '../services/velvetHouseDatabase';

const GAME_PATH = '/games/velvet-house/index.html';
const SAVE_KEY = 'velvet-house-v1';
const SYNC_INTERVAL_MS = 30_000;
const GAME_TURN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/velvet-game-turn`;

type GameLook = { skin?: string; hair?: string; hairColor?: string; top?: string; eyeColor?: string; facialHair?: string; glasses?: string; gender?: 'male' | 'female' };
type GameGender = 'male' | 'female';
type GameError = Error & { code?: string };

interface PlayerProfile {
  name: string | null;
  nickname: string | null;
  avatar_config: Record<string, unknown> | null;
  favorite_color: string | null;
}

const COLOR_HEX: Record<string, string> = {
  red: '#A63A2C', burgundy: '#8A2D54', maroon: '#8A2D54', pink: '#D97A9B', orange: '#D9763A',
  yellow: '#E0A43A', gold: '#E0A43A', green: '#4F7A4A', teal: '#3D6B73', blue: '#4A5DA8',
  navy: '#2E3D6B', purple: '#6B4A8A', lavender: '#9A86B8', brown: '#7A4E31', black: '#2B2B30',
  white: '#F2EEE8', gray: '#6B6F86', grey: '#6B6F86',
};

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function colorToHex(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const key = color.toLowerCase().split(/\W+/).find((w: string) => COLOR_HEX[w]);
  return key ? COLOR_HEX[key] : undefined;
}

function hairFor(style: unknown, length: unknown): string {
  if (style === 'afro') return 'afro';
  if (style === 'bun') return 'bun';
  if (style === 'ponytail') return 'ponytail';
  if (style === 'braids') return 'braids';
  if (style === 'locs') return 'locs';
  if (style === 'wavy') return 'wavy';
  if (style === 'buzz') return 'buzz';
  if (style === 'fade') return 'fade';
  if (style === 'short' || length === 'short') return 'short';
  if (length === 'long') return 'long';
  return 'short';
}

function toGameLook(avatar: Record<string, unknown> | null | undefined, favoriteColor?: string | null): GameLook | undefined {
  if (!avatar || typeof avatar !== 'object') return undefined;
  const female = avatar.gender === 'female';
  const length = avatar.hairLength ?? (female ? 'long' : 'short');
  const gender: GameGender = avatar.gender === 'female' ? 'female' : 'male';
  return {
    skin: isHex(avatar.skinTone) ? avatar.skinTone : undefined,
    hairColor: isHex(avatar.hairColor) ? avatar.hairColor : undefined,
    hair: hairFor(avatar.hairStyle, length),
    top: colorToHex(favoriteColor),
    eyeColor: isHex(avatar.eyeColor) ? avatar.eyeColor : undefined,
    facialHair: typeof avatar.facialHair === 'string' ? avatar.facialHair : undefined,
    glasses: typeof avatar.glasses === 'string' ? avatar.glasses : undefined,
    gender,
  };
}

function buildProfile(player: PlayerProfile | null, companion: Companion, includeLooks: boolean) {
  const personality = [companion.communication_style, companion.humor_style, companion.signature_voice]
    .filter(Boolean)
    .join('. ');
  const likes = [...(companion.hobbies || []), companion.interest_text, companion.favorite_color]
    .filter(Boolean) as string[];

  return {
    type: 'velvet:profile',
    player: {
      name: (player?.nickname || player?.name || '').trim().slice(0, 16),
      look: includeLooks ? toGameLook(player?.avatar_config, player?.favorite_color) : undefined,
    },
    companion: {
      name: companion.custom_name,
      pronoun: companion.gender === 'male' ? 'he' : 'she',
      gender: companion.gender,
      personality: personality || 'warm, curious, playful',
      look: includeLooks
        ? toGameLook(companion.avatar_config as Record<string, unknown> | undefined, companion.favorite_color)
        : undefined,
      memories: [],
      likes,
      dislikes: [],
    },
  };
}

function gameError(code: string): GameError {
  const err = new Error(code) as GameError;
  err.code = code;
  return err;
}

async function sampleGameTurn(companionId: string, input: unknown, signal?: AbortSignal): Promise<{ text: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw gameError('unavailable');

  let res: Response;
  try {
    res = await fetch(GAME_TURN_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ companionId, input }),
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw gameError('cancelled');
    throw gameError('unavailable');
  }

  const data = await res.json().catch(() => null);
  if (res.status === 429 || data?.error === 'rate_limited') throw gameError('rate_limited');
  if (data?.error === 'refused') throw gameError('refused');
  if (!res.ok || typeof data?.text !== 'string') throw gameError('unavailable');
  return { text: data.text };
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
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) await saveVelvetHouseProgress(companionId, JSON.parse(raw));
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
      setError('No companion selected. Choose a companion from the lobby to play Velvet House.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'velvet:ready') {
        setLoading(false);
        connectGame(msg.needsProfile === true).catch(() => {});
      }
      if (msg.type === 'velvet:vidSearch' && typeof msg.query === 'string') {
        const seq = msg.seq;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-video-search`;
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
          body: JSON.stringify({ query: msg.query, userContext: 'Velvet House in-game TV' }),
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
    };
    const onUnload = () => { syncToSupabase(); };

    window.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', onUnload);
    const timer = setInterval(syncToSupabase, SYNC_INTERVAL_MS);

    (async () => {
      try {
        const save = await loadVelvetHouseSave(companionId);
        if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch {
        // falls back to whatever is already stored on this device
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
            <p className="text-white/40 text-sm">Loading Velvet House...</p>
          </div>
        </div>
      )}

      {saveReady && (
        <iframe
          ref={iframeRef}
          src={GAME_PATH}
          title="Velvet House"
          className="flex-1 w-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
}
