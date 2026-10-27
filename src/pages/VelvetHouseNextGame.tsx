import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanion, getCompanions, type Companion } from '../services/companionService';
import { loadAvatarUnlocks } from '../hooks/useAvatarUnlocks';
import { buildProfile, avatarFromGameLook, buildAvatarLook, type PlayerProfile } from '../features/velvet-sims/simProfile';
import { lookUnlock, resolveLookForDisplay } from '../data/avatarCatalog';
import {
  isReadyMessage, isAvatarItemBoughtMessage, isLookChangedMessage, isRestartedMessage,
  isSampleRequestMessage, isSampleCancelMessage, isDesignsRequestMessage,
} from '../games/velvet-house/bridge/protocol';
import { toGameTurnInput } from '../games/velvet-house/bridge/chatInput';
import { sampleGameTurn } from '../services/velvetGameTurn';
import { runDesignsOp } from '../services/velvetDesigns';
import { useVelvetHouseCloudSave } from '../hooks/useVelvetHouseCloudSave';
import { announceAvatarSaved, onAvatarSaved } from '../stores/avatarEditorStore';
import { applyAvatarChange, migrateAvatarConfig } from '../utils/avatarConfig';
import { recordSimsPurchase } from '../services/avatarInventoryService';
import { isHelper } from '../utils/relationshipType';
import { SOMEONE_NEW_ROUTE } from '../services/setupProgressService';

const GAME_PATH = '/games/velvet-house-next/index.html';

export function VelvetHouseNextGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryCompanionId = searchParams.get('companion');
  // Opened without a companion (from the lobby or hub), it's the one you last
  // talked to, preferring a companion over a coach.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [settled, setSettled] = useState(!!queryCompanionId);
  const companionId = queryCompanionId ?? pickedId;
  const { saveReady, noteRestart } = useVelvetHouseCloudSave(companionId, settled);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (queryCompanionId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const all = await getCompanions(user.id);
          const pick = all.find(c => !isHelper(c.relationship_type)) ?? null;
          if (!cancelled && pick) setPickedId(pick.id);
        }
      } catch { /* start without a cloud save */ }
      if (!cancelled) setSettled(true);
    })();
    return () => { cancelled = true; };
  }, [queryCompanionId]);

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
    // AI turns the game asks for, run with the player's account.
    const turns = new Map<number, AbortController>();
    const answer = (win: Window, seq: number, body: { text?: string; error?: string }) =>
      win.postMessage({ type: 'velvet:sampleResult', seq, ...body }, window.location.origin);
    const onMessage = async (e: MessageEvent) => {
      const win = iframeRef.current?.contentWindow;
      if (!win || e.source !== win || e.origin !== window.location.origin) return;
      if (isSampleRequestMessage(e.data)) {
        const { seq, input } = e.data;
        if (!companionId) { answer(win, seq, { error: 'unavailable' }); return; }
        const ctrl = new AbortController();
        turns.set(seq, ctrl);
        try {
          const { text } = await sampleGameTurn(companionId, toGameTurnInput(input), ctrl.signal);
          if (!ctrl.signal.aborted) answer(win, seq, { text });
        } catch (err) {
          if (!ctrl.signal.aborted) answer(win, seq, { error: (err as { code?: string })?.code ?? 'unavailable' });
        } finally { turns.delete(seq); }
        return;
      }
      if (isSampleCancelMessage(e.data)) { turns.get(e.data.seq)?.abort(); return; }
      // Sharing designs with friends and the gallery, run as the player.
      if (isDesignsRequestMessage(e.data)) {
        const { seq, op, args } = e.data;
        const r = await runDesignsOp(op, args);
        win.postMessage({ type: 'velvet:designsResult', seq, ...r }, window.location.origin);
        return;
      }
      if (isRestartedMessage(e.data)) { noteRestart(); return; }
      // Bought in the game: it's theirs everywhere now.
      if (isAvatarItemBoughtMessage(e.data)) {
        if (await recordSimsPurchase(e.data.itemId)) sendInventory(win);
        return;
      }
      // Changed clothes in the game: save it to their avatar, so the avatar
      // screen, toolbar and chats show what they're wearing.
      if (isLookChangedMessage(e.data)) {
        await saveLookFromGame(e.data, win);
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
        return all.find(c => !isHelper(c.relationship_type)) ?? null;
      };
      const [{ data: player }, companion, unlocks] = await Promise.all([
        supabase.from('user_profiles').select('name, nickname, avatar_config, favorite_color').eq('id', user.id).maybeSingle(),
        pickCompanion(),
        loadAvatarUnlocks(),
      ]);
      if (!companion || cancelled) return;
      win.postMessage(buildProfile(player as PlayerProfile | null, companion as Companion, true, unlocks), window.location.origin);
    };
    // The shirt, pants and hat they changed into. Anything they may not wear is ignored, and a new hat
    // gets the game fresh head frames (the hat is part of the head).
    let savingFromGame = false;
    const saveLookFromGame = async (msg: Parameters<typeof avatarFromGameLook>[0], win: Window) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const change = avatarFromGameLook(msg);
      if (Object.keys(change).length === 0) return;
      const unlocks = await loadAvatarUnlocks();
      if (!lookUnlock(change, unlocks).ok) return;
      const { data } = await supabase.from('user_profiles').select('avatar_config').eq('id', user.id).maybeSingle();
      const config = applyAvatarChange(data?.avatar_config, change);
      const { error } = await supabase.from('user_profiles').update({ avatar_config: config }).eq('id', user.id);
      if (error || cancelled) return;
      savingFromGame = true;
      announceAvatarSaved({ target: { kind: 'user' }, config });
      savingFromGame = false;
      if (msg.hat !== undefined) win.postMessage(buildAvatarLook(resolveLookForDisplay(migrateAvatarConfig(config), unlocks)), window.location.origin);
    };
    // Edited an avatar while the game is open: the game shows it straight away.
    // (Not the save the game itself just asked for, or a hoodie would turn back into a tee.)
    const offSaved = onAvatarSaved(() => {
      const win = iframeRef.current?.contentWindow;
      if (win && !savingFromGame) sendProfile(win);
    });
    window.addEventListener('message', onMessage);
    return () => { cancelled = true; offSaved(); window.removeEventListener('message', onMessage); turns.forEach(c => c.abort()); };
  }, [companionId, noteRestart]);

  const handleExit = () => {
    navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
  };

  // A home you share with a companion: with no companion yet, invite them to
  // meet one rather than move a coach or assistant in.
  if (settled && !companionId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0f] p-6 text-white">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-extrabold">Velvet House is a home you share with a companion</h1>
          <p className="mt-3 text-white/70">Meet someone to move in with, and the house comes alive.</p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate(SOMEONE_NEW_ROUTE)}
              className="rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3 font-bold"
            >
              Meet a companion
            </button>
            <button type="button" onClick={() => navigate('/lobby')} className="py-2 text-sm text-white/60 hover:text-white">
              Not now
            </button>
          </div>
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

      {saveReady && (
      <iframe
        ref={iframeRef}
        src={`${GAME_PATH}${companionId ? `?companion=${encodeURIComponent(companionId)}` : ''}`}
        title="Velvet Sims (Preview)"
        className="flex-1 w-full border-0"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        onLoad={() => setLoading(false)}
      />
      )}
    </div>
  );
}
