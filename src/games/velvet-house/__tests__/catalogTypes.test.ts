import { describe, it, expect } from 'vitest';
import { CATALOG } from '../state/catalog';
import { TYPES } from '../state/objects';

describe('the shop', () => {
  it('only sells pieces the house can hold, and no id twice', () => {
    const ids = new Set<string>();
    for (const e of CATALOG) {
      expect(ids.has(e.id), `duplicate id ${e.id}`).toBe(false);
      ids.add(e.id);
      if (e.type) expect(TYPES[e.type], `${e.id} sells unknown type ${e.type}`).toBeDefined();
    }
  });
  it('stocks the Decor tab with more than a handful of pieces', () => {
    const decor = CATALOG.filter((e) => e.tab === 'Decor');
    expect(decor.length).toBeGreaterThanOrEqual(15);
    for (const t of ['candles', 'basket', 'coatrack', 'bookstack', 'eucalyptus', 'bust', 'umbrella', 'tablelamp', 'candelabra', 'blanketladder', 'plantstand', 'woodstool']) expect(decor.some((e) => e.type === t), t).toBe(true);
  });
  it('sells the dining set, desk, treadmill and weights that come with the house, for a second one', () => {
    for (const t of ['dining', 'desk', 'tread', 'gym']) expect(CATALOG.some((e) => e.type === t), t).toBe(true);
  });
});
