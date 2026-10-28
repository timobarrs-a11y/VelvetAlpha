import { sameCloth } from './garment';
import type { OwnedCloth } from './clothing';
import type { AgentLook } from './agents';

/**
 * Saved outfits and the rule for changing into them: a top and bottoms kept together for an occasion, worn
 * automatically when the person starts a matching activity, and changed back when it ends. Pure, so the rule is tested.
 */
export const OCCASIONS = ['everyday', 'work', 'workout', 'sleep', 'date', 'party', 'winter', 'summer'] as const;
export type Occasion = typeof OCCASIONS[number];

export const OCCASION_LABEL: Record<Occasion, string> = {
  everyday: 'Everyday', work: 'Work', workout: 'Workout', sleep: 'Sleep', date: 'Date night', party: 'Party', winter: 'Winter', summer: 'Summer',
};

/** A closet piece named by its id and colour (a few old pieces share an id and differ only in colour). */
export interface PieceRef { id: string; col: string }
export interface SavedOutfit { id: string; name: string; occasion: Occasion; top?: PieceRef; bottom?: PieceRef }

const ACT_OCCASION: Record<string, Occasion> = {
  sleep: 'sleep', nap: 'sleep',
  workout: 'workout', lift: 'workout', stretch: 'workout', boxing: 'workout', shadowbox: 'workout', bike: 'workout', jumprope: 'workout', yardWorkout: 'workout', swim: 'workout',
  freelance: 'work', work: 'work',
  dance: 'party', danceTogether: 'party', soloDance: 'party', gDance: 'party', jukebox: 'party', mixDrinks: 'party', glam: 'party',
  eatOut: 'date', movie: 'date',
};

/** What an activity calls for, if anything. */
export const occasionForAct = (act: string | null | undefined): Occasion | null => (act ? ACT_OCCASION[act] ?? null : null);

/** Winter and summer outfits are worn in their season when nothing more specific applies (season index 0 spring, 1 summer, 2 fall, 3 winter). */
export const seasonOccasion = (seasonIdx: number): Occasion | null => (seasonIdx === 3 ? 'winter' : seasonIdx === 1 ? 'summer' : null);

export function wornRefs(look: Pick<AgentLook, 'top' | 'bottom' | 'topStyle' | 'bottomStyle' | 'topGarment' | 'bottomGarment'>, closet: OwnedCloth[]): { top?: PieceRef; bottom?: PieceRef } {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const top = closet.find((c) => c.slot === 'top' && (c.recipe ? !!look.topGarment && sameCloth(c.recipe, look.topGarment) : !look.topGarment && c.style === look.topStyle && same(c.col, look.top)));
  const bottom = closet.find((c) => c.slot === 'bottom' && (c.recipe ? !!look.bottomGarment && sameCloth(c.recipe, look.bottomGarment) : !look.bottomGarment && c.style === (look.bottomStyle || 'pants') && same(c.col, look.bottom)));
  return { top: top && { id: top.id, col: top.col }, bottom: bottom && { id: bottom.id, col: bottom.col } };
}

export const findPiece = (closet: OwnedCloth[], ref: PieceRef | undefined): OwnedCloth | undefined =>
  ref ? closet.find((c) => c.id === ref.id && c.col.toLowerCase() === ref.col.toLowerCase()) : undefined;

/** The newest saved outfit for an occasion whose pieces are still in the closet. */
export function outfitFor(outfits: SavedOutfit[], occasion: Occasion, closet: OwnedCloth[]): SavedOutfit | undefined {
  for (let i = outfits.length - 1; i >= 0; i--) {
    const o = outfits[i];
    if (o.occasion !== occasion) continue;
    if ((o.top && !findPiece(closet, o.top)) || (o.bottom && !findPiece(closet, o.bottom))) continue;
    if (o.top || o.bottom) return o;
  }
  return undefined;
}

export interface AutoState { active: Occasion | null; prior: { top?: PieceRef; bottom?: PieceRef } | null }
export const NEW_AUTO: AutoState = { active: null, prior: null };

export type AutoMove = { wear: { top?: PieceRef; bottom?: PieceRef }; why: string } | null;

/**
 * Decides whether to change clothes now. `act` is what the person is doing (null when idle or walking), `seasonIdx` the
 * season. When an activity or season has a saved outfit they change into it, remembering what they had on; when it
 * ends they go back to their everyday outfit, or to what they were wearing before.
 */
export function nextAuto(
  state: AutoState,
  now: { act: string | null; seasonIdx: number; worn: { top?: PieceRef; bottom?: PieceRef } },
  outfits: SavedOutfit[],
  closet: OwnedCloth[],
): { state: AutoState; move: AutoMove } {
  const wanted = occasionForAct(now.act) ?? seasonOccasion(now.seasonIdx);
  const outfit = wanted ? outfitFor(outfits, wanted, closet) : undefined;
  const desired = outfit ? wanted : null;
  if (desired === state.active) return { state, move: null };
  if (desired && outfit) {
    return {
      state: { active: desired, prior: state.active ? state.prior : now.worn },
      move: { wear: { top: outfit.top, bottom: outfit.bottom }, why: OCCASION_LABEL[desired].toLowerCase() },
    };
  }
  // The occasion is over: back to the everyday outfit, or to whatever they had on before.
  const everyday = outfitFor(outfits, 'everyday', closet);
  const back = everyday ? { top: everyday.top, bottom: everyday.bottom } : state.prior ?? {};
  return { state: NEW_AUTO, move: { wear: back, why: 'the day' } };
}
