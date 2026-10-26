import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanion } from '../services/companionService';
import { loadAvatarUnlocks } from '../hooks/useAvatarUnlocks';
import { buildProfile, type PlayerProfile } from '../features/velvet-sims/simProfile';
import { isReadyMessage } from '../games/velvet-house/bridge/protocol';

const GAME_PATH = '/games/velvet-house-next/index.html';

export function VelvetHouseNextGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Every time the game starts it asks who's playing. Answer with the real
  // avatars (heads and signature outfits), so changes show on the next visit.
  useEffect(() => {
    if (!companionId) return;
    let cancelled = false;
    const onMessage = async (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow;
      if (!win || e.source !== win || e.origin !== window.location.origin || !isReadyMessage(e.data)) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [{ data: player }, companion, unlocks] = await Promise.all([
        supabase.from('user_profiles').select('name, nickname, avatar_config, favorite_color').eq('id', user.id).maybeSingle(),
        getCompanion(companionId),
        loadAvatarUnlocks(),
      ]);
      if (!companion || cancelled) return;
      win.postMessage(buildProfile(player as PlayerProfile | null, companion, true, unlocks), window.location.origin);
    };
    window.addEventListener('message', onMessage);
    return () => { cancelled = true; window.removeEventListener('message', onMessage); };
  }, [companionId]);

  const handleExit = () => {
    navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
  };

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
        <span className="text-white/40 text-xs font-medium tracking-wide">VELVET SIMS (PREVIEW)</span>
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

      <iframe
        ref={iframeRef}
        src={`${GAME_PATH}${companionId ? `?companion=${encodeURIComponent(companionId)}` : ''}`}
        title="Velvet Sims (Preview)"
        className="flex-1 w-full border-0"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
