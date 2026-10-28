import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { TYPES, INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { CATALOG, catalogById, setQuote } from '../state/catalog';
import { STYLE_TAGS } from '../state/taste';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// A theme's finishing touches: a rug, two wall pieces, a decor cluster and a hero piece with an activity, sold apart and as one bundle.
interface Touches { id: string; items: string[]; tags: string[]; floor: string[]; walls: Array<[string, string]>; hero: { type: string; tag: string } }
const BUNDLES: Touches[] = [
  { id: 'touches-arcade', items: ['rug-arcade', 'wobj-marquee', 'wobj-pixelprint', 'cartridges', 'pinball'], tags: ['playful', 'bold', 'vintage'], floor: ['rugarcade', 'cartridges', 'pinball'], walls: [['marquee', '#F4C430'], ['pixelprint', '#19E6F0']], hero: { type: 'pinball', tag: 'pinball' } },
  { id: 'touches-cuddle', items: ['rug-cuddle', 'wobj-rainbowarch', 'wobj-cloudlight', 'plushpile', 'cloudswing'], tags: ['soft', 'playful', 'cozy'], floor: ['rugcloud', 'plushpile', 'cloudswing'], walls: [['rainbowarch', '#F58A8A'], ['cloudlight', '#FFFFFF']], hero: { type: 'cloudswing', tag: 'swing' } },
  { id: 'touches-neon', items: ['rug-neon', 'wobj-neonbolt', 'wobj-holoposter', 'serverstack', 'vrpod'], tags: ['bold', 'modern', 'industrial'], floor: ['rugneon', 'serverstack', 'vrpod'], walls: [['neonbolt', '#19E6F0'], ['holoposter', '#111118']], hero: { type: 'vrpod', tag: 'vr' } },
  { id: 'touches-gothic', items: ['rug-gothic', 'wobj-stainedglass', 'wobj-sconce', 'grimoires', 'fortuneteller'], tags: ['luxe', 'vintage', 'cozy'], floor: ['ruggothic', 'grimoires', 'fortuneteller'], walls: [['stainedglass', '#8E2E3C'], ['sconce', '#2A2224']], hero: { type: 'fortuneteller', tag: 'fortune' } },
  { id: 'touches-candy', items: ['rug-candy', 'wobj-lollipops', 'wobj-candysign', 'candyjars', 'gumball'], tags: ['soft', 'playful', 'warm'], floor: ['rugcandy', 'candyjars', 'gumball'], walls: [['lollipops', '#F6B7CC'], ['candysign', '#F6B7CC']], hero: { type: 'gumball', tag: 'gumball' } },
  { id: 'touches-tropical', items: ['rug-tropical', 'wobj-tikimasks', 'wobj-flamingoneon', 'coconuts', 'tikibar'], tags: ['playful', 'natural', 'bold'], floor: ['rugtropical', 'coconuts', 'tikibar'], walls: [['tikimasks', '#8A5A3A'], ['flamingoneon', '#F08AA0']], hero: { type: 'tikibar', tag: 'tiki' } },
];

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

describe.each(BUNDLES)('the finishing touches $id', (B) => {
  const set = () => catalogById(B.id)!;

  it('is a bundle in Sets of five pieces that each exist, with the theme tags and the set discount', () => {
    expect(set().tab).toBe('Sets');
    expect(set().set!.items).toEqual(B.items);
    for (const id of B.items) { const e = catalogById(id)!; expect(e, id).toBeDefined(); expect(e.tags, id).toEqual(B.tags); for (const t of e.tags!) expect(STYLE_TAGS as readonly string[]).toContain(t); }
    const apart = B.items.reduce((t, id) => t + catalogById(id)!.price, 0);
    expect(set().price).toBe(Math.round(apart * 0.8));
    expect(setQuote(set(), new Set(B.items)).cost).toBe(0);
  });

  it('has the pieces behind it: a rug type, two wall pieces, a small decor cluster and a hero piece someone can use, with a light', () => {
    const [rug, deco, hero] = B.floor;
    expect(TYPES[rug].rug).toBe(true);
    expect(TYPES[deco].small).toBe(true);
    expect(hero).toBe(B.hero.type);
    expect(Object.values(TYPES[hero].spots!).map((s) => s.tag)).toContain(B.hero.tag);
    expect(TYPES[hero].light).toBeDefined();
    for (const [w] of B.walls) expect(catalogById(`wobj-${w}`)!.icon).toBe('wobj');
    expect(catalogById(hero)!.tab).toBe('Hobbies');
  });

  it('buying the bundle is one payment: the rug, the cluster and the hero land on the floor, the two wall pieces are hung', () => {
    const { objs, paid, hung, owned, buy, logs } = shopWith(5000);
    buy(set());
    expect(paid).toEqual([set().price]);
    for (const t of B.floor) expect(objs.some((o) => o.type === t && o.level === 1), t).toBe(true);
    expect(hung).toEqual(B.walls.map(([w, c]) => [1, w, c]));
    for (const id of B.items) expect(owned.has(id), id).toBe(true);
    expect(logs.filter((l) => /^Bought /.test(l))).toHaveLength(1);
  });

  it('draws the new pieces', () => {
    const art = createHouseArt(stubCtx());
    const objs = INITIAL_OBJS.filter((x) => x.level === 1).map((x) => ({ ...x }));
    const extra: ObjectInstance[] = B.floor.map((type, k) => ({ id: `${type}-t`, type, level: 1, x: 1 + k * 2.5, y: 3, rot: 0 }));
    for (const [w, c] of B.walls) expect(art.hangWallObj(1, w, c)).toBe(true);
    expect(() => art.render({ level: 1, rot: 0, minutes: 780, day: 1, t: 1, dt: 0.016, objs: objs.concat(extra), wallMode: 'up', cam: { x: 0, y: 0, zoom: 1 } } as never)).not.toThrow();
  });
});

describe('wall decor', () => {
  it('bought on its own is hung on the floor you are looking at, and never from the backyard', () => {
    const inside = shopWith(500);
    inside.buy(catalogById('wobj-print')!);
    expect(inside.paid).toEqual([50]);
    expect(inside.hung).toEqual([[1, 'print', '#E0A43A']]);
    const yard = shopWith(500, [], 3);
    yard.buy(catalogById('wobj-print')!);
    expect(yard.paid).toEqual([]);
    expect(yard.hung).toEqual([]);
  });

  it('hangs on a back wall at eye height, each new piece on a free stretch, and unknown types are refused', () => {
    const art = createHouseArt(stubCtx());
    expect(art.hangWallObj(1, 'marquee', '#F4C430')).toBe(true);
    expect(art.hangWallObj(1, 'pixelprint')).toBe(true);
    expect(art.hangWallObj(1, 'nonsense')).toBe(false);
    const walls = art.exportLooks().WALLOBJS as Array<{ type: string; level: number; p: string; u: number; z: number }>;
    expect(walls.map((w) => w.type)).toEqual(['marquee', 'pixelprint']);
    for (const w of walls) { expect(w.level).toBe(1); expect(['L', 'B']).toContain(w.p); expect(w.z).toBeGreaterThan(0.8); }
    const [a, b] = walls;
    if (a.p === b.p) expect(Math.abs(a.u - b.u)).toBeGreaterThan(0.7);
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });
});
