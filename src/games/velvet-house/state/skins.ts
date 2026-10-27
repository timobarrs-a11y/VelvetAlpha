/**
 * Looks: the same piece drawn differently. A look never changes a footprint, a height or a spot, so buying one can only
 * ever restyle what is already standing; it never moves anything or changes where the household uses it.
 */
import { TYPES, type ObjectInstance } from './objects';
import type { CatalogEntry } from './catalog';

/** The floor of the house the one good spot of each piece is on. */
export const MAIN_FLOOR = 1;

/** The piece on the main floor a skinned catalog entry restyles, or null if its type is not standing there (then it is placed as new). */
export function skinTarget(objs: ObjectInstance[], item: Pick<CatalogEntry, 'type' | 'skin'>): ObjectInstance | null {
  if (!item.type || !item.skin) return null;
  const here = objs.filter((o) => o.type === item.type && o.level === MAIN_FLOOR);
  // Prefer a piece that does not wear the look yet, so a second purchase restyles the next one rather than the same one.
  return here.find((o) => o.skin !== item.skin) ?? here[0] ?? null;
}

/** The colour a bought look starts in: the one picked, else the first the entry offers, else none (the look's own). */
export function skinColour(item: Pick<CatalogEntry, 'cols'>, picked?: string): string | undefined {
  return picked ?? item.cols?.[0];
}

/** Put a look on a piece. The old colour belonged to the old look, so it goes. */
export function wearSkin(o: ObjectInstance, skin: string, col?: string): void {
  o.skin = skin;
  if (col) o.col = col; else delete o.col;
}

/** A catalog entry's skin must be one its type has. */
export function skinExists(type: string | undefined, skin: string | undefined): boolean {
  return !!type && !!skin && !!TYPES[type]?.skins?.[skin];
}
