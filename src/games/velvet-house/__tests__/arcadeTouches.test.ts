import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { TYPES, INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { CATALOG, catalogById, setQuote } from '../state/catalog';
import { STYLE_TAGS } from '../state/taste';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// The Arcade finishing touches: a rug, two wall pieces, a decor cluster and a hero piece, sold apart and as one bundle.
const ITEMS = ['rug-arcade', 'wobj-marquee', 'wobj-pixelprint', 'cartridges', 'pinball'];
const TAGS = ['playful', 'bold', 'vintage'];

function stubCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return () => gradient; },
    set(t, k, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
beforeAll(() => {
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas'
    ? ({ width: 640, height: 440, getContext: () => stubCtx() } as unknown as HTMLCanvasElement) : realCreate(tag))) as typeof document.createElement);
});

const shopWith = (money: number, owned: string[] = [], level = 1) => {
  const objs = INITIAL_OBJS.map((o) => ({ ...o }));
  const logs: string[] = [], paid: number[] = [], hung: Array<[number, string, string | undefined]> = [], ownedSet = new Set(owned);
  const g = {
    world: { objs }, partnerName: 'Maya', house: {}, view: { level }, owned: ownedSet, closet: [], flags: { styledSet: [] }, style: {}, tasteNorm: { key: '', mean: 0, sd: 1 },
    log: (m: string) => logs.push(m), art: { burst: () => {}, objectPlaced: () => {}, hangWallObj: (l: number, t: string, c?: string) => { hung.push([l, t, c]); return true; } },
    hasAttic: () => false, storage: [], s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => false,
    spendOn: (_: string, n: number) => { if (n > money) return false; money -= n; paid.push(n); return true; }, peopleOnFloor: () => [], relearnLayout: () => {},
  } as unknown as Game;
  return { objs, logs, paid, hung, owned: ownedSet, buy: createShop(g).handleBuy! };
};

describe('the Arcade finishing touches', () => {
  const set = () => catalogById('touches-arcade')!;

  it('is a bundle in Sets of five pieces that each exist, with the arcade tags and the set discount', () => {
    expect(set().tab).toBe('Sets');
    expect(set().set!.items).toEqual(ITEMS);
    for (const id of ITEMS) { const e = catalogById(id)!; expect(e, id).toBeDefined(); expect(e.tags, id).toEqual(TAGS); for (const t of e.tags!) expect(STYLE_TAGS as readonly string[]).toContain(t); }
    const apart = ITEMS.reduce((t, id) => t + catalogById(id)!.price, 0);
    expect(set().price).toBe(Math.round(apart * 0.8));
    expect(setQuote(set(), new Set(ITEMS)).cost).toBe(0);
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });

  it('has the pieces behind it: a rug type, two wall pieces, a small decor cluster and a pinball machine someone can play', () => {
    expect(TYPES.rugarcade.rug).toBe(true);
    expect(TYPES.cartridges.small).toBe(true);
    expect(TYPES.pinball.spots!.p.tag).toBe('pinball');
    expect(TYPES.pinball.light).toBeDefined();
    expect(catalogById('wobj-marquee')!.icon).toBe('wobj');
    expect(catalogById('pinball')!.tab).toBe('Hobbies');
  });

  it('buying the bundle is one payment: the rug, the cartridges and the pinball land on the floor, the two wall pieces are hung', () => {
    const { objs, paid, hung, owned, buy, logs } = shopWith(5000);
    buy(set());
    expect(paid).toEqual([set().price]);
    for (const t of ['rugarcade', 'cartridges', 'pinball']) expect(objs.some((o) => o.type === t && o.level === 1), t).toBe(true);
    expect(hung).toEqual([[1, 'marquee', '#F4C430'], [1, 'pixelprint', '#19E6F0']]);
    for (const id of ITEMS) expect(owned.has(id), id).toBe(true);
    expect(logs.filter((l) => /^Bought /.test(l))).toHaveLength(1);
  });

  it('a wall piece bought on its own is hung on the floor you are looking at, and never from the backyard', () => {
    const inside = shopWith(500);
    inside.buy(catalogById('wobj-print')!);
    expect(inside.paid).toEqual([50]);
    expect(inside.hung).toEqual([[1, 'print', '#E0A43A']]);
    const yard = shopWith(500, [], 3);
    yard.buy(catalogById('wobj-print')!);
    expect(yard.paid).toEqual([]);
    expect(yard.hung).toEqual([]);
  });

  it('hangs a wall piece on a back wall at eye height, each new one on a free stretch, and draws it', () => {
    const art = createHouseArt(stubCtx());
    expect(art.hangWallObj(1, 'marquee', '#F4C430')).toBe(true);
    expect(art.hangWallObj(1, 'pixelprint')).toBe(true);
    expect(art.hangWallObj(1, 'nonsense')).toBe(false);
    const walls = art.exportLooks().WALLOBJS as Array<{ type: string; level: number; p: string; u: number; z: number }>;
    expect(walls.map((w) => w.type)).toEqual(['marquee', 'pixelprint']);
    for (const w of walls) { expect(w.level).toBe(1); expect(['L', 'B']).toContain(w.p); expect(w.z).toBeGreaterThan(0.8); }
    const [a, b] = walls;
    if (a.p === b.p) expect(Math.abs(a.u - b.u)).toBeGreaterThan(0.7);
    const objs = INITIAL_OBJS.filter((x) => x.level === 1).map((x) => ({ ...x }));
    const extra: ObjectInstance[] = [{ id: 'rug1', type: 'rugarcade', level: 1, x: 3, y: 4, rot: 0 }, { id: 'cart1', type: 'cartridges', level: 1, x: 1, y: 1, rot: 0 }, { id: 'pin1', type: 'pinball', level: 1, x: 6, y: 2, rot: 0 }];
    expect(() => art.render({ level: 1, rot: 0, minutes: 780, day: 1, t: 1, dt: 0.016, objs: objs.concat(extra), wallMode: 'up', cam: { x: 0, y: 0, zoom: 1 } } as never)).not.toThrow();
  });
});
