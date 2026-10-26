import { describe, it, expect } from 'vitest';
import { createOutfit, BOUTIQUE_SIZE } from '../systems/outfit';
import { generateGarment } from '../state/garment';
import { rollStyle, computeTasteNorm } from '../state/taste';
import { CATALOG } from '../state/catalog';
import type { Game } from '../kernel/game';

function stub(day = 3) {
  const logs: string[] = [];
  const style = rollStyle(() => 0.9);
  const g = {
    closet: [], flags: {}, log: (m: string) => logs.push(m), partnerName: 'Maya', simName: 'Jordan', style,
    tasteNorm: computeTasteNorm(CATALOG as never, style), memStore: { coreMem: [], memories: [], pastMem: [] },
    world: { day }, s: { bond: 50 },
  } as unknown as Game;
  return { g, logs, api: createOutfit(g) as ReturnType<typeof createOutfit> & Record<string, (...a: never[]) => unknown> };
}

describe('the daily boutique', () => {
  it('is the same on the same day and different on another', () => {
    const a = stub(3).api.boutiqueFor!(3), b = stub(3).api.boutiqueFor!(3), c = stub(4).api.boutiqueFor!(4);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(a.map((i) => i.id)).not.toEqual(c.map((i) => i.id));
  });

  it('has six pieces from plain to special, priced', () => {
    const items = stub(7).api.boutiqueFor!(7);
    expect(items).toHaveLength(BOUTIQUE_SIZE);
    const order = ['common', 'uncommon', 'rare', 'one-of-a-kind'];
    const ranks = items.map((i) => order.indexOf(i.garment.rarity));
    expect([...ranks].sort()).toEqual(ranks);
    expect(items[0].garment.rarity).toBe('common');
    items.forEach((i) => { expect(i.price).toBeGreaterThanOrEqual(5); expect(i.bought).toBe(false); });
  });

  it('remembers what was bought today, and only today', () => {
    const { g, api } = stub(5);
    const first = api.boutiqueFor!(5)[0];
    api.markBought!(5, first.id);
    expect(api.boutiqueFor!(5).find((i) => i.id === first.id)!.bought).toBe(true);
    expect((g.flags.boutiqueBought as { day: number }).day).toBe(5);
    expect(api.boutiqueFor!(6).every((i) => !i.bought)).toBe(true);
  });
});

describe('owning a garment', () => {
  it('puts it in the closet once, with its style and colour', () => {
    const { g, api } = stub();
    const garment = generateGarment(11, { slot: 'bottom' });
    const piece = api.ownGarment!(garment);
    expect(api.ownGarment!(garment)).toBe(piece);
    expect(g.closet).toHaveLength(1);
    expect(piece.slot).toBe('bottom');
    expect(piece.col).toBe(garment.base);
    expect(piece.recipe).toEqual(garment);
  });
});

describe('what the partner thinks', () => {
  it('says something once a day per garment', () => {
    const { g, logs, api } = stub(2);
    const garment = generateGarment(21);
    api.reactToOutfit!(garment, 'wears');
    api.reactToOutfit!(garment, 'wears');
    expect(logs).toHaveLength(1);
    (g.world as { day: number }).day = 3;
    api.reactToOutfit!(garment, 'wears');
    expect(logs).toHaveLength(2);
  });

  it('moves the bond with taste and keeps it in range', () => {
    const { g, api } = stub(2);
    for (let s = 1; s <= 40; s++) { api.reactToOutfit!(generateGarment(s, { rarity: 'rare' }), 'bought'); }
    expect(g.s.bond).toBeGreaterThanOrEqual(0);
    expect(g.s.bond).toBeLessThanOrEqual(100);
  });
});
