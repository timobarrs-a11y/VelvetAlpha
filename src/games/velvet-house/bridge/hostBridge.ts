import { postToParent, isProfileMessage, isValidOrigin, isVidResultsMessage, isAvatarInventoryMessage, isAvatarLookMessage, isPlotMessage, isCompanionsMessage } from '../bridge/protocol';
import { setCompanionCount } from './companions';
import { setOwnedAvatarItems } from '../bridge/avatarShop';
import { type SampleFn } from '../state/companionAI';
import { createHostSample } from '../bridge/hostSample';
import { validHeadSvgs, loadHeadImages } from '../state/headSprites';
import { validBodySvgs, loadBodyImages } from '../state/bodySprites';
import type { Game } from '../kernel/game';
import { createHostDesigns } from './hostDesigns';
import { humorKey, commKey } from '../content/banks';
import { checkPlacement } from '../state/arrange';
import type { ObjectInstance } from '../state/objects';

export function createHostBridge(g: Game): Partial<Game> {
  const { world, people, companionCfg } = g;
  // Bridge: ready
  postToParent({ type: 'velvet:ready', game: 'velvet-house', day: world.day, needsProfile: true });

  // Bridge: incoming messages
  const allowedOrigins: string[] = (() => {
    try { const origin = new URL(document.referrer).origin; return origin ? [origin] : []; } catch { return []; }
  })();

  // A friend who moves in is a roommate: the double bed becomes a single bed each, on day one of a new house.
  function roommateBeds(): void {
    if (g.flags.roommateBeds || world.day > 1) return;
    const i = world.objs.findIndex((o) => o.id === 'bed' && o.type === 'bed');
    if (i < 0) return;
    const bed = world.objs[i];
    const a: ObjectInstance = { id: 'bedA', type: 'bedA', level: bed.level, x: bed.x, y: bed.y, rot: bed.rot };
    const b: ObjectInstance = { id: 'bedB', type: 'bedB', level: bed.level, x: bed.x, y: bed.y + 1.15, rot: bed.rot };
    world.objs.splice(i, 1, a, b);
    if (!checkPlacement(world.objs, a, []).ok || !checkPlacement(world.objs, b, []).ok) { world.objs.splice(i, 2, bed); return; }
    g.flags.roommateBeds = true;
    g.relearnLayout(a);
  }

  window.addEventListener('message', (e: MessageEvent) => {
    if (!isValidOrigin(e.origin, allowedOrigins)) return;
    if (isAvatarLookMessage(e.data)) {
      // A new hat changes the head: the host redrew it.
      const svgs = validHeadSvgs(e.data.sprites);
      if (svgs) loadHeadImages(svgs).then((imgs) => { if (imgs.neutral) people[0].look.heads = imgs; }).catch(() => {});
      const hands = validBodySvgs(e.data.body);
      if (hands) loadBodyImages(hands).then((imgs) => { if (imgs.relaxed) people[0].look.body = imgs; }).catch(() => {});
      return;
    }
    if (isCompanionsMessage(e.data)) { setCompanionCount(e.data.count, e.data.houses ?? 0); return; }
    if (isPlotMessage(e.data)) {
      const p = e.data.plot;
      g.s.hostReady.plot = true;
      g.s.plot = { member: !!p.member, config: p.config as never, earned: Array.isArray(p.earned) ? p.earned.filter((x): x is string => typeof x === 'string') : [], ...(typeof p.address === 'string' ? { address: p.address.slice(0, 40) } : {}) };
      return;
    }
    if (isAvatarInventoryMessage(e.data)) {
      setOwnedAvatarItems(e.data.owned);
      return;
    }
    if (isProfileMessage(e.data)) {
      const d = e.data;
      // Apply profile
      const pName = d.player?.name;
      const cName = d.companion?.name;
      if (pName) people[0].name = pName.slice(0, 16);
      if (cName) people[1].name = cName.slice(0, 16);
      // The story says these names too, so it has to know them (it read the defaults when the game started).
      g.simName = people[0].name;
      g.partnerName = people[1].name;
      if (d.companion?.pronoun) companionCfg.pronoun = d.companion.pronoun;
      if (d.companion?.humor) g.s.voice.humor = humorKey(d.companion.humor);
      if (d.companion?.communication) g.s.voice.communication = commKey(d.companion.communication);
      if (d.companion?.relationship) { g.s.voice.relationship = d.companion.relationship; if (d.companion.relationship === 'friend') roommateBeds(); }
      if (d.companion?.personality) companionCfg.preset = d.companion.personality as 'warm' | 'calm' | 'bubbly' | 'dry';
      if (d.companion?.look) {
        const cl = d.companion.look;
        if (cl.skin) people[1].look.skin = cl.skin;
        if (cl.hairColor) people[1].look.hair = cl.hairColor;
        if (cl.top && !cl.outfit) people[1].look.top = cl.top;
        g.applyAvatar(people[1], cl, 'maya');
      }
      if (d.player?.look) {
        const pl = d.player.look;
        if (pl.skin) people[0].look.skin = pl.skin;
        if (pl.hairColor) people[0].look.hair = pl.hairColor;
        if (pl.top && !pl.outfit) people[0].look.top = pl.top;
        g.applyAvatar(people[0], pl, 'jordan');
      }
      g.s.hostReady.profile = true;
      const wasFromGame = companionCfg.source === 'game';
      companionCfg.source = 'velvet';
      postToParent({
        type: 'velvet:profileApplied', game: 'velvet-house', day: world.day,
        player: people[0].name, companion: people[1].name,
      });
      if (wasFromGame) {
        postToParent({
          type: 'velvet:companionCreated' as never, game: 'velvet-house',
          player: { name: people[0].name, look: { skin: people[0].look.skin, hairColor: people[0].look.hair, top: people[0].look.top } },
          companion: { name: people[1].name, pronoun: companionCfg.pronoun, personality: companionCfg.preset, look: { skin: people[1].look.skin, hairColor: people[1].look.hair, top: people[1].look.top } },
        } as never);
      }
    }
    if (isVidResultsMessage(e.data)) {
      const d = e.data;
      if (d.seq === vidSearchSeq && vidSearchCb) vidSearchCb(d.videos as { id: string; title: string; channelTitle: string; thumbnail: string }[]);
    }
  });

  // Video search: game sends vidSearch to parent, parent responds with vidResults
  let vidSearchSeq = 0;
  let vidSearchCb: ((videos: { id: string; title: string; channelTitle: string; thumbnail: string }[]) => void) | null = null;
  function doVidSearch(query: string, cb: (videos: { id: string; title: string; channelTitle: string; thumbnail: string }[]) => void): void {
    vidSearchSeq++;
    const seq = vidSearchSeq;
    vidSearchCb = cb;
    postToParent({ type: 'velvet:vidSearch' as never, game: 'velvet-house', query, seq } as never);
    setTimeout(() => { if (vidSearchSeq === seq && vidSearchCb) { vidSearchCb = null; cb([]); } }, 12000);
  }

  // Inside the Velvet app the host page answers AI turns; the older artifact-style provider still wins if present.
  g.s.sample = createHostSample();
  // Try to get sample function from parent
  try {
    const w = window as unknown as { claude?: { use?: (name: string) => Promise<SampleFn> } };
    if (w.claude?.use) {
      w.claude.use('sample').then((f) => { g.s.sample = f; }).catch(() => {});
    }
  } catch {}
  return { doVidSearch, designs: createHostDesigns() };
}
