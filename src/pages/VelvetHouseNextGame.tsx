import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanion, getCompanions, type Companion } from '../services/companionService';
import { CompanionPicker } from '../features/velvet-sims/CompanionPicker';
import { houseDay } from '../features/velvet-sims/houseDays';
import { loadAvatarUnlocks } from '../hooks/useAvatarUnlocks';
import { buildProfile, avatarFromGameLook, buildAvatarLook, type PlayerProfile } from '../features/velvet-sims/simProfile';
import { lookUnlock, resolveLookForDisplay } from '../data/avatarCatalog';
import {
  isReadyMessage, isAvatarItemBoughtMessage, isLookChangedMessage, isRestartedMessage,
  isSampleRequestMessage, isSampleCancelMessage, isDesignsRequestMessage, isStartRequestedMessage, isMenuReadyMessage,
  isPromoRequestMessage, isHousesRequestMessage, isVisitMessage,
} from '../games/velvet-house/bridge/protocol';
import { toGameTurnInput } from '../games/velvet-house/bridge/chatInput';
import { sampleGameTurn } from '../services/velvetGameTurn';
import { runDesignsOp } from '../services/velvetDesigns';
import { claimVelvetPromo } from '../services/velvetPromo';
import { runHousesOp } from '../services/velvetHouseVisits';
import { useVelvetHouseCloudSave } from '../hooks/useVelvetHouseCloudSave';
import { announceAvatarSaved, onAvatarSaved } from '../stores/avatarEditorStore';
import { applyAvatarChange, migrateAvatarConfig } from '../utils/avatarConfig';
import { recordSimsPurchase } from '../services/avatarInventoryService';
import { isHelper } from '../utils/relationshipType';
import { SOMEONE_NEW_ROUTE } from '../services/setupProgressService';
import { getMyPlot } from '../services/worldService';
import { markReturnToHouse, clearReturnToHouse } from '../services/velvetHouseReturn';
import { townSlot } from '../features/velvet-world/art/streetArt.js';

const GAME_PATH = '/games/velvet-house-next/index.html';

export function VelvetHouseNextGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryCompanionId = searchParams.get('companion');
  // Back from a friend's house: straight into this one, with no title screen.
  const queryStart = searchParams.get('start') === 'continue' ? 'continue' : null;
  // Opened without a companion (from the lobby or hub), it's the one you last
  // talked to, preferring a companion over a coach.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [settled, setSettled] = useState(!!queryCompanionId);
  // With more than one companion, Start asks who is moving in; picking someone other than who the page opened with
  // replaces the game with a fresh house for them.
  const [chosen, setChosen] = useState<{ id: string; start: 'new' | 'continue' } | null>(null);
  const [choosing, setChoosing] = useState<'new' | 'continue' | null>(null);
  const [days, setDays] = useState<Record<string, number | null>>({});
  const [options, setOptions] = useState<Companion[]>([]);
  const optionsReady = useRef<Promise<Companion[]>>(Promise.resolve([]));
  const companionId = chosen?.id ?? queryCompanionId ?? pickedId;
  const { saveReady, noteRestart } = useVelvetHouseCloudSave(companionId, settled);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Back in the house with a companion: the trip out is over.
  useEffect(() => { if (companionId) clearReturnToHouse(); }, [companionId]);
  const [loading, setLoading] = useState(true);

  // Everyone who could move in: companions, not coaches or assistants.
  useEffect(() => {
    let cancelled = false;
    optionsReady.current = (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const all = user ? await getCompanions(user.id) : [];
        const list = all.filter(c => !isHelper(c.relationship_type)) as Companion[];
        const reached = Object.fromEntries(await Promise.all(list.map(async (c) => [c.id, await houseDay(c.id)] as const)));
        if (!cancelled) { setOptions(list); setDays(reached); }
        return list.map(c => ({ ...c, __day: reached[c.id] })) as Companion[];
      } catch { return []; }
    })();
    return () => { cancelled = true; };
  }, []);

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
      // A promo code typed in the game: once per account, so it's claimed for this house first.
      if (isPromoRequestMessage(e.data)) {
        const { seq, code } = e.data;
        const status = await claimVelvetPromo(code, companionId);
        win.postMessage({ type: 'velvet:promoResult', seq, status }, window.location.origin);
        return;
      }
      // Friends' houses: the list, and opening or closing this player's own, run as the player.
      if (isHousesRequestMessage(e.data)) {
        const { seq, op, open } = e.data;
        const r = await runHousesOp(op, open);
        win.postMessage({ type: 'velvet:housesResult', seq, ...r }, window.location.origin);
        return;
      }
      // Off to a friend's house (the game saved this one first).
      if (isVisitMessage(e.data)) {
        navigate(`/velvet-house/visit/${e.data.owner}${companionId ? `?from=${encodeURIComponent(companionId)}` : ''}`);
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
      // The game's title screen: Start with more than one companion asks who is moving in.
      if (isStartRequestedMessage(e.data)) { setChoosing(e.data.mode); return; }
      // The title screen is up (no bridge yet), and the game itself says ready: both want to know who there is to pick.
      if (isMenuReadyMessage(e.data) || isReadyMessage(e.data)) {
        optionsReady.current.then((list) => {
          const houses = list.filter((c) => (c as Companion & { __day?: number | null }).__day != null).length;
          if (!cancelled) win.postMessage({ type: 'velvet:companions', count: list.length, houses }, window.location.origin);
        });
      }
      if (!isReadyMessage(e.data)) return;
      sendInventory(win);
      sendProfile(win);
    };
    // Who's playing, with their avatars as they are right now.
    const sendProfile = async (win: Window) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      // Their house in town goes first, so the drive-up that opens a new game can show it.
      getMyPlot().then((mine) => {
        if (!mine || cancelled) return;
        const slot = townSlot(mine.slot_index);
        win.postMessage({
          type: 'velvet:plot',
          plot: { member: mine.is_member, config: { house: mine.house, sign: mine.sign, ...(mine.yard ?? {}) }, earned: mine.earned, address: slot.address },
        }, window.location.origin);
      }).catch(() => { /* no plot yet: the drive-up shows a starter house */ });
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
  }, [companionId, noteRestart, navigate]);

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
              onClick={() => { markReturnToHouse(); navigate(SOMEONE_NEW_ROUTE); }}
              className="rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3 font-bold"
            >
              Meet a companion
            </button>
            <button type="button" onClick={() => { clearReturnToHouse(); navigate('/lobby'); }} className="py-2 text-sm text-white/60 hover:text-white">
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

      {choosing && (
        <CompanionPicker
          companions={options}
          currentId={companionId}
          mode={choosing}
          days={days}
          onPick={(id) => {
            const mode = choosing;
            setChoosing(null);
            if (id === companionId) iframeRef.current?.contentWindow?.postMessage({ type: 'velvet:startGo' }, window.location.origin);
            // Someone else: back to their house if they have one and that is what was asked, otherwise a new one.
            else { setLoading(true); setChosen({ id, start: mode === 'continue' && days[id] != null ? 'continue' : 'new' }); }
          }}
          onCancel={() => { setChoosing(null); iframeRef.current?.contentWindow?.postMessage({ type: 'velvet:startCancel' }, window.location.origin); }}
        />
      )}

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
        key={chosen?.id ?? 'initial'}
        src={`${GAME_PATH}${companionId ? `?companion=${encodeURIComponent(companionId)}${chosen ? `&start=${chosen.start}` : queryStart ? `&start=${queryStart}` : ''}` : ''}`}
        title="Velvet Sims (Preview)"
        className="flex-1 w-full border-0"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        onLoad={() => setLoading(false)}
      />
      )}
    </div>
  );
}
