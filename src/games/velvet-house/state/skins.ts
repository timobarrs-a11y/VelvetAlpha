/**
 * Looks: the same piece drawn differently. A look never changes a footprint, a height or a spot, so buying one can only
 * ever restyle what is already standing; it never moves anything or changes where the household uses it.
 */
import { TYPES, colsOf, isFixed, kindOf, modelsOf, type ObjectInstance } from './objects';
import { CATALOG, type CatalogEntry } from './catalog';

/** The floor of the house the one good spot of each piece is on. */
export const MAIN_FLOOR = 1;

/** The pieces the upstairs packs restyle: the bedroom's and the bathroom's. */
export const UPSTAIRS_TYPES: ReadonlySet<string> = new Set(['bed', 'nightstand', 'dresser', 'wardrobe', 'toilet', 'vanity', 'shower', 'bathtub']);
const UPSTAIRS = 2;

/**
 * Whether a model of this type takes the place of the piece of its kind that stands in the house, rather than being set
 * down as one more: true for a fixed piece with more than one model (the fridge, in its one good spot).
 */
export function swapsInPlace(type: string): boolean {
  return isFixed(type) && modelsOf(kindOf(type)).length > 1;
}

/**
 * The piece a catalog entry restyles, or null if nothing of it is standing there (then it is placed as new). A look
 * restyles a piece of its type; a model of a fixed piece (the chest freezer) takes the place of whichever model of that
 * kind stands there. The bedroom and bath pieces live upstairs, so their looks restyle the ones there; everything else,
 * the main floor's.
 */
export function skinTarget(objs: ObjectInstance[], item: Pick<CatalogEntry, 'type' | 'skin'>): ObjectInstance | null {
  if (!item.type) return null;
  const swaps = swapsInPlace(item.type);
  if (!item.skin && !swaps) return null;
  const kind = kindOf(item.type);
  const floor = UPSTAIRS_TYPES.has(kind) ? UPSTAIRS : MAIN_FLOOR;
  const here = objs.filter((o) => (swaps ? kindOf(o.type) === kind : o.type === item.type) && o.level === floor);
  // Prefer a piece that does not wear the look yet, so a second purchase restyles the next one rather than the same one.
  return here.find((o) => o.type !== item.type || o.skin !== item.skin) ?? here[0] ?? null;
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

export interface LookChoice { id: string; name: string; active: boolean }

/** A look choice's id: the skin ('' for the stock look) of the piece's own type, or `type:skin` for another model. */
export function lookId(o: Pick<ObjectInstance, 'type'>, type: string, skin: string): string {
  return type === o.type ? skin : `${type}:${skin}`;
}

/** The model and look a choice id names, for this piece. */
export function parseLook(o: Pick<ObjectInstance, 'type'>, id: string): { type: string; skin: string } {
  const i = id.indexOf(':');
  return i < 0 ? { type: o.type, skin: id } : { type: id.slice(0, i), skin: id.slice(i + 1) };
}

/**
 * The looks a piece can wear right now, for the Arrange bar: its stock look always, plus every look of its type the player
 * has bought; for a piece with other models, also each model the player has (its stock look and the looks of it they
 * bought). The kind's own model always counts as had: the house came with it. Empty when it has nothing to choose between.
 */
export function looksFor(o: Pick<ObjectInstance, 'type' | 'skin'>, owned: ReadonlySet<string>): LookChoice[] {
  const models = swapsInPlace(o.type) ? [o.type, ...modelsOf(kindOf(o.type)).filter((m) => m !== o.type)] : [o.type];
  const out: LookChoice[] = [];
  for (const m of models) {
    const bought = CATALOG.filter((c) => c.type === m && owned.has(c.id));
    if (m !== o.type && m !== kindOf(m) && !bought.length) continue;
    const skins = TYPES[m]?.skins ?? {};
    const have = new Set(bought.filter((c) => c.skin).map((c) => c.skin!));
    if (m === o.type && o.skin) have.add(o.skin);
    const active = m === o.type ? (o.skin && skins[o.skin] ? o.skin : '') : null;
    out.push({ id: lookId(o, m, ''), name: TYPES[m].name ?? m, active: active === '' });
    for (const id of Object.keys(skins).filter((k) => have.has(k))) out.push({ id: lookId(o, m, id), name: skins[id].name, active: active === id });
  }
  return out.length > 1 ? out : [];
}

/** Change a piece to one of its looks ('' is the stock look). The colour stays if the new look has it, else starts at the new look's first. */
export function changeLook(o: ObjectInstance, skin: string): void {
  if (skin) o.skin = skin; else delete o.skin;
  const cols = colsOf(o);
  if (!cols) delete o.col; else if (!o.col || !cols.includes(o.col)) o.col = cols[0];
}

/** Put a model's look on a piece that has just become that model (its old colour belonged to the old one). */
export function wearModel(o: ObjectInstance, skin: string | undefined, col?: string): void {
  if (skin) o.skin = skin; else delete o.skin;
  const cols = colsOf(o);
  if (col && (!cols || cols.includes(col))) o.col = col; else if (cols) o.col = cols[0]; else delete o.col;
}
