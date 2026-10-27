import { validateGarment, type Garment } from './garment';
import type { OwnedCloth } from './clothing';

/**
 * The plain clothes the shop has always sold, as recipes, so they can be remixed in the Design Studio. They still
 * draw the way they always did when worn as they are; this is a starting point for something new.
 */
const TOPS: Record<string, Partial<Garment> & { cut: string }> = {
  tee: { cut: 'tee', fabric: 'cotton' },
  tank: { cut: 'tank', fabric: 'cotton' },
  hoodie: { cut: 'hoodie', fabric: 'fleece', details: { drawstring: true } },
  sweater: { cut: 'sweater', fabric: 'knit', pattern: { kind: 'stripes', colors: ['#f2eee8'], scale: 1, angle: 0, density: 0.4, seed: 1 } },
  flannel: { cut: 'button-up', fabric: 'flannel', details: { buttons: true, pocket: true }, pattern: { kind: 'plaid', colors: ['#2b2b30', '#e8dcc0'], scale: 1.2, angle: 0, density: 0.5, seed: 2 } },
  blazer: { cut: 'blazer', fabric: 'cotton', details: { buttons: true } },
  denim: { cut: 'jacket', fabric: 'denim', details: { pocket: true, wash: 0.5 } },
  puffer: { cut: 'jacket', fabric: 'puffer' },
  dress: { cut: 'dress', fabric: 'cotton' },
  jersey: { cut: 'tee', fabric: 'cotton', pattern: { kind: 'stripes', colors: ['#ffffff'], scale: 0.8, angle: 0, density: 0.3, seed: 3 } },
};
const BOTTOMS: Record<string, Partial<Garment> & { cut: string }> = {
  'c-jeans': { cut: 'straight', fabric: 'denim', details: { wash: 0.4 } },
  'c-joggers': { cut: 'slim', fabric: 'fleece' },
  'c-chinos': { cut: 'straight', fabric: 'cotton' },
  'c-shorts': { cut: 'shorts', fabric: 'cotton' },
  'c-skirt': { cut: 'skirt', fabric: 'cotton' },
};

/** A recipe for a piece from the shop's classic range, or null for anything else (the avatar's own pieces, hats, shoes). */
export function clothToGarment(c: OwnedCloth): Garment | null {
  if (c.recipe) return c.recipe;
  const spec = c.slot === 'top' ? TOPS[c.style] : c.slot === 'bottom' ? BOTTOMS[c.id] ?? (c.style === 'shorts' ? BOTTOMS['c-shorts'] : c.style === 'skirt' ? BOTTOMS['c-skirt'] : undefined) : undefined;
  if (!spec || c.id.startsWith('sig-') || c.id.startsWith('w-')) return null;
  return validateGarment({ ...spec, v: 1, slot: c.slot === 'top' && c.style === 'dress' ? 'dress' : c.slot === 'top' && ['blazer', 'denim', 'puffer'].includes(c.style) ? 'outer' : c.slot, base: c.col, name: c.name, tags: [], rarity: 'common' });
}
