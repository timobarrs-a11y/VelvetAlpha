import type { Game } from '../kernel/game';
import type { OwnedCloth } from '../state/clothing';
import { bodyPart, encodeGarment, garmentStyle, generateGarment, priceOf, rollRarity, type Garment } from '../state/garment';
import { seedOf } from '../state/describeGarment';
import { tasteOf } from '../state/taste';
import { RNG } from '../state/rng';
import { remember } from '../state/memory';
import { seasonIdx, absMin } from '../state/time';
import { describeGarment } from '../state/describeGarment';
import { styleWords } from '../state/taste';
import { showDiscoveryCard } from '../ui/dialogue';
import { NEW_AUTO, OCCASION_LABEL, findPiece, nextAuto, wornRefs, type AutoState, type Occasion, type PieceRef, type SavedOutfit } from '../state/outfits';

/** Designed garments: owning them, wearing them, the daily boutique, and what the partner thinks. */
export interface BoutiqueItem { id: string; garment: Garment; price: number; bought: boolean }

export const BOUTIQUE_SIZE = 6;

export function createOutfit(g: Game): Partial<Game> {
  const { closet, flags, log, partnerName, style, tasteNorm, memStore, world } = g;

  const idOf = (garment: Garment): string => 'g-' + seedOf(encodeGarment(garment)).toString(36);

  /** The closet entry for a garment (made once, however many times it is bought or loaded). */
  function pieceOf(garment: Garment): OwnedCloth {
    const part = bodyPart(garment) ?? 'top';
    return { slot: part, style: garmentStyle(garment), col: garment.base, name: garment.name, id: idOf(garment), recipe: garment };
  }

  function ownGarment(garment: Garment): OwnedCloth {
    const piece = pieceOf(garment);
    if (!closet.some((c) => c.id === piece.id)) closet.push(piece);
    return closet.find((c) => c.id === piece.id)!;
  }

  /** Today's six: the same for everyone on the same day, from common basics to the odd rare find. */
  function boutiqueFor(day: number): BoutiqueItem[] {
    const bought = (flags.boutiqueBought as { day: number; ids: string[] } | undefined);
    const todays = bought && bought.day === day ? bought.ids : [];
    const rng = new RNG(day * 7919 + 17);
    const items = Array.from({ length: BOUTIQUE_SIZE }, (_, i) => {
      // The first is always a plain staple, the last is the day's special.
      const rarity = i === 0 ? 'common' : i === BOUTIQUE_SIZE - 1 ? (rng.chance(0.5) ? 'rare' : 'uncommon') : rollRarity(rng);
      const garment = generateGarment(day * 977 + i * 131 + 7, { rarity });
      return { id: idOf(garment), garment, price: priceOf(garment), bought: todays.includes(idOf(garment)) };
    });
    const order = ['common', 'uncommon', 'rare', 'one-of-a-kind'];
    return items.sort((a, b) => order.indexOf(a.garment.rarity) - order.indexOf(b.garment.rarity));
  }

  function markBought(day: number, id: string): void {
    const cur = flags.boutiqueBought as { day: number; ids: string[] } | undefined;
    flags.boutiqueBought = cur && cur.day === day ? { day, ids: [...cur.ids, id] } : { day, ids: [id] };
  }

  /** The partner's view of a garment, once a day per garment: a line in the log, a nudge to the bond, and sometimes a memory. */
  function reactToOutfit(garment: Garment, verb: 'wears' | 'made' | 'bought'): void {
    const seen = (flags.outfitReacted ??= {}) as Record<string, number>;
    const id = idOf(garment);
    if (seen[id] === world.day) return;
    seen[id] = world.day;
    const taste = tasteOf({ id, name: garment.name, tags: garment.tags }, style, tasteNorm);
    const what = `the ${garment.name.toLowerCase()}`;
    const lines: Record<number, string> = {
      2: `${partnerName} gasps. "${garment.name}? That is so you."`,
      1: `${partnerName} smiles at ${what}. "Nice."`,
      0: `${partnerName} looks over ${what}. "Hm, okay."`,
      '-1': `${partnerName} tilts their head at ${what}. "Brave choice."`,
      '-2': `${partnerName} winces at ${what}, politely.`,
    };
    log(lines[taste] ?? lines[0]);
    if (taste !== 0) g.s.bond = Math.max(0, Math.min(100, g.s.bond + taste * (verb === 'wears' ? 0.5 : 1)));
    if (taste >= 2 || taste <= -2) {
      remember(taste > 0 ? `Loved the ${garment.name.toLowerCase()} on ${g.simName}.` : `Did not like the ${garment.name.toLowerCase()}.`, taste > 0, memStore);
    }
  }

  /** Puts a closet piece on the player with the try-on moment: a close-up, and the partner's opinion. */
  function wearOutfitPiece(piece: OwnedCloth): void {
    g.wearPiece(piece);
    g.cameraBeat('closeup', 'jordan');
    log(`Changed into the ${piece.name}.`);
    if (piece.recipe) g.reactToOutfit(piece.recipe, 'wears');
    g.refreshDrawer();
  }

  // -- saved outfits and changing automatically ------------------------------------------------------------------
  const outfits = (): SavedOutfit[] => (flags.outfits ??= []) as SavedOutfit[];
  const autoOn = (): boolean => flags.autoOutfit !== false;
  let auto: AutoState = NEW_AUTO;

  function saveOutfit(name: string, occasion: Occasion): SavedOutfit | null {
    const refs = wornRefs(g.people[0].look, closet);
    if (!refs.top && !refs.bottom) return null;
    const outfit: SavedOutfit = { id: 'o' + Date.now().toString(36) + outfits().length, name: name.trim().slice(0, 24) || OCCASION_LABEL[occasion], occasion, ...refs };
    outfits().push(outfit);
    log(`Saved the ${outfit.name} outfit for ${OCCASION_LABEL[occasion].toLowerCase()}.`);
    return outfit;
  }

  function deleteOutfit(id: string): void {
    const list = outfits();
    const i = list.findIndex((o) => o.id === id);
    if (i >= 0) list.splice(i, 1);
  }

  const wearRefs = (refs: { top?: PieceRef; bottom?: PieceRef }): void => {
    for (const ref of [refs.top, refs.bottom]) { const p = findPiece(closet, ref); if (p) g.wearPiece(p); }
  };

  function wearOutfit(outfit: SavedOutfit): void {
    wearRefs(outfit);
    g.cameraBeat('closeup', 'jordan');
    log(`Changed into the ${outfit.name} outfit.`);
    g.refreshDrawer();
  }

  // -- parcels: rare pieces are ordered and arrive in the morning -----------------------------------------------
  interface Parcel { garment: Garment; at: number }
  const parcels = (): Parcel[] => (flags.parcels ??= []) as Parcel[];
  const needsOrder = (garment: Garment): boolean => garment.rarity === 'rare' || garment.rarity === 'one-of-a-kind';
  const isOrdered = (id: string): boolean => parcels().some((p) => idOf(p.garment) === id);

  function orderGarment(item: BoutiqueItem): boolean {
    if (item.bought || isOrdered(item.id)) return false;
    // It comes at 8 in the morning: today if it is not yet 8, otherwise tomorrow.
    const morning = world.minutes < 8 * 60 ? world.day : world.day + 1;
    parcels().push({ garment: item.garment, at: absMin(morning, 8 * 60) });
    return true;
  }

  function deliverParcels(): void {
    const now = absMin(world.day, world.minutes);
    const list = parcels();
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].at > now) continue;
      const [p] = list.splice(i, 1);
      ownGarment(p.garment);
      log(`A parcel came from the boutique: the ${p.garment.name}.`);
      showDiscoveryCard('A parcel for you', `A courier left the ${p.garment.name} at the door. It is in your closet.`);
      g.refreshDrawer();
    }
  }

  // -- a gift from the partner -----------------------------------------------------------------------------------
  const GIFT_MIN_BOND = 40;
  async function mayaGift(): Promise<{ ok: boolean; reason?: string; garment?: Garment }> {
    if (g.s.bond < GIFT_MIN_BOND) return { ok: false, reason: `${partnerName} doesn't know you well enough yet.` };
    if (flags.mayaGiftDay === world.day) return { ok: false, reason: `${partnerName} already made you something today.` };
    flags.mayaGiftDay = world.day;
    const loves = styleWords(style).loves;
    const r = await describeGarment(`a gift for ${g.simName}`, g.s.sample, { wearerName: g.simName, designerName: partnerName, designerWords: loves, tags: loves });
    const garment: Garment = { ...r.garment, name: r.garment.name };
    ownGarment(garment);
    g.s.bond = Math.min(100, g.s.bond + 2);
    log(`${partnerName} made you something: the ${garment.name}.`);
    remember(`${partnerName} designed the ${garment.name.toLowerCase()} as a gift.`, true, memStore);
    showDiscoveryCard(`A gift from ${partnerName}`, `${partnerName} designed the ${garment.name} for you. It is in your closet.`);
    g.refreshDrawer();
    return { ok: true, garment };
  }

  /** Called a few times a second: puts the player in the right clothes for what they are doing. */
  function outfitTick(): void {
    deliverParcels();
    if (!autoOn() || !outfits().length) return;
    const p = g.people[0];
    const act = p.task && p.task.phase === 'do' ? p.task.act : null;
    const r = nextAuto(auto, { act, seasonIdx: seasonIdx(world.day), worn: wornRefs(p.look, closet) }, outfits(), closet);
    auto = r.state;
    if (r.move) {
      wearRefs(r.move.wear);
      log(`${g.simName} changed for ${r.move.why}.`);
      g.refreshDrawer();
    }
  }

  return { ownGarment, boutiqueFor, markBought, reactToOutfit, wearOutfitPiece, outfitId: idOf, saveOutfit, deleteOutfit, wearOutfit, outfitTick, orderGarment, isOrdered, needsOrder, mayaGift };
}
