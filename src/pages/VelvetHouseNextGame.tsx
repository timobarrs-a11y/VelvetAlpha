import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanion, getCompanions, type Companion } from '../services/companionService';
import { loadAvatarUnlocks } from '../hooks/useAvatarUnlocks';
import { buildProfile, type PlayerProfile } from '../features/velvet-sims/simProfile';
import { isReadyMessage, isAvatarItemBoughtMessage, isLookChangedMessage } from '../games/velvet-house/bridge/protocol';
import { announceAvatarSaved, onAvatarSaved } from '../stores/avatarEditorStore';
import { applyAvatarChange } from '../utils/avatarConfig';
import { recordSimsPurchase } from '../services/avatarInventoryService';

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
  // Opened without a companion (from the lobby or hub), it's the one you last
  // talked to, preferring a companion over a coach.
  useEffect(() => {
    let cancelled = false;
    // What the player owns for their avatar, for the game's shop.
    const sendInventory = async (win: Window) => {
      const owned = (await loadAvatarUnlocks()).owned ?? [];
      if (!cancelled) win.postMessage({ type: 'velvet:avatarInventory', owned }, window.location.origin);
    };
    const onMessage = async (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow;
      if (!win || e.source !== win || e.origin !== window.location.origin) return;
      // Bought in the game: it's theirs everywhere now.
      if (isAvatarItemBoughtMessage(e.data)) {
        if (await recordSimsPurchase(e.data.itemId)) sendInventory(win);
        return;
      }
      // Changed clothes in the game: save it to their avatar, so the avatar
      // screen, toolbar and chats show what they're wearing.
      if (isLookChangedMessage(e.data)) {
        await saveTopFromGame(e.data.top);
        return;
      }
      if (!isReadyMessage(e.data)) return;
      sendInventory(win);
      sendProfile(win);
    };
    // Who's playing, with their avatars as they are right now.
    const sendProfile = async (win: Window) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const pickCompanion = async () => {
        if (companionId) return getCompanion(companionId);
        const all = await getCompanions(user.id);
        return all.find(c => c.relationship_type !== 'mentor') ?? all[0] ?? null;
      };
      const [{ data: player }, companion, unlocks] = await Promise.all([
        supabase.from('user_profiles').select('name, nickname, avatar_config, favorite_color').eq('id', user.id).maybeSingle(),
        pickCompanion(),
        loadAvatarUnlocks(),
      ]);
      if (!companion || cancelled) return;
      win.postMessage(buildProfile(player as PlayerProfile | null, companion as Companion, true, unlocks), window.location.origin);
    };
    // The game's tops that the avatar has no match for come across as a tee in the same colour.
    let savingFromGame = false;
    const saveTopFromGame = async (top: { style: string; color: string; accent?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !/^#[0-9a-f]{6}$/i.test(top.color)) return;
      const { data } = await supabase.from('user_profiles').select('avatar_config').eq('id', user.id).maybeSingle();
      const outfit = top.style === 'blazer' ? 'suit' : ['linen', 'chef', 'labcoat', 'pirate'].includes(top.style) ? top.style as 'linen' : 'tee';
      const config = applyAvatarChange(data?.avatar_config, {
        outfit, outfitColor: top.color,
        ...(top.accent && /^#[0-9a-f]{6}$/i.test(top.accent) ? { outfitAccent: top.accent } : {}),
      });
      const { error } = await supabase.from('user_profiles').update({ avatar_config: config }).eq('id', user.id);
      if (error) return;
      savingFromGame = true;
      announceAvatarSaved({ target: { kind: 'user' }, config });
      savingFromGame = false;
    };
    // Edited an avatar while the game is open: the game shows it straight away.
    // (Not the save the game itself just asked for, or a hoodie would turn back into a tee.)
    const offSaved = onAvatarSaved(() => {
      const win = iframeRef.current?.contentWindow;
      if (win && !savingFromGame) sendProfile(win);
    });
    window.addEventListener('message', onMessage);
    return () => { cancelled = true; offSaved(); window.removeEventListener('message', onMessage); };
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
