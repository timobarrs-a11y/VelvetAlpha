import type { Game } from '../kernel/game';
import type { OwnedCloth } from '../state/clothing';
import { bodyPart, encodeGarment, garmentStyle, generateGarment, priceOf, rollRarity, type Garment } from '../state/garment';
import { seedOf } from '../state/describeGarment';
import { tasteOf } from '../state/taste';
import { RNG } from '../state/rng';
import { remember } from '../state/memory';

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

  return { ownGarment, boutiqueFor, markBought, reactToOutfit, wearOutfitPiece, outfitId: idOf };
}
