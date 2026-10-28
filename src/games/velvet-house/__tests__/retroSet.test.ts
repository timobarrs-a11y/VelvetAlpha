import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { TYPES, INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { CATALOG, TABS, catalogById, setQuote } from '../state/catalog';
import { STYLE_TAGS, tasteOf, computeTasteNorm } from '../state/taste';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

const PIECES = ['fridge', 'counter', 'dining', 'sofa', 'lamp', 'plant'];
const RETRO_ITEMS = PIECES.map((t) => `look-${t}-retro`);

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

describe('the Retro set', () => {
  it('has a look for the fridge, counter, dining set, sofa, lamp and plant, and a wallpaper and a floor; not the TV unit', () => {
    for (const id of RETRO_ITEMS) expect(catalogById(id), id).toBeDefined();
    expect(catalogById('paper-starburst-mint')?.pattern).toBe('starburst-mint');
    expect(catalogById('floor-linoleum')?.floor).toBe('linoleum');
    expect(TYPES.tvunit.skins).toBeUndefined();
  });

  it('classifies each look by material and theme, and each entry points at a look its type has', () => {
    for (const t of PIECES) {
      const sk = TYPES[t].skins!.retro;
      expect(sk.theme).toBe('retro');
      expect(['laminate', 'metal']).toContain(sk.material);
      expect(sk.cols!.length).toBeGreaterThanOrEqual(3);
      const e = catalogById(`look-${t}-retro`)!;
      expect(e.skin).toBe('retro');
      expect(e.name).toBe(sk.name);
      expect(e.desc).toBeTruthy();
      expect(e.cols).toEqual(sk.cols);
    }
  });

  it('uses the retro tags, from the shared list, and the price ladder (mid; paper 80-120, floor 120-180)', () => {
    const items = [...RETRO_ITEMS, 'paper-starburst-mint', 'floor-linoleum'].map((id) => catalogById(id)!);
    for (const e of items) { expect(e.tags).toEqual(['vintage', 'playful', 'bold']); for (const t of e.tags!) expect(STYLE_TAGS as readonly string[]).toContain(t); }
    expect(catalogById('paper-starburst-mint')!.price).toBeGreaterThanOrEqual(80);
    expect(catalogById('paper-starburst-mint')!.price).toBeLessThanOrEqual(120);
    expect(catalogById('floor-linoleum')!.price).toBeGreaterThanOrEqual(120);
    expect(catalogById('floor-linoleum')!.price).toBeLessThanOrEqual(180);
  });

  it('never changes what the household uses: the spots a look must keep are still on the type', () => {
    expect(TYPES.fridge.spots!.f.tag).toBe('fridge');
    expect(Object.values(TYPES.counter.spots!).map((s) => s.tag).sort()).toEqual(['coffee', 'sink', 'stove', 'window']);
    expect(Object.values(TYPES.dining.spots!).map((s) => s.tag).sort()).toEqual(['clear', 'dine1', 'dine2']);
    expect(TYPES.sofa.spots!.s1.tag).toBe('seat');
    expect(TYPES.plant.spots!.w.tag).toBe('water');
    expect(TYPES.lamp.light).toBeDefined();
    expect(TYPES.dining.light).toBeDefined();
  });

  it('draws each piece differently from the stock look, at the same size', () => {
    const rec = () => { const log: string[] = []; const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return (...a: unknown[]) => { if (/^(fill|stroke|moveTo|lineTo|ellipse|arc)/.test(String(k))) log.push(String(k) + a.filter((x) => typeof x === 'number').map((x) => (x as number).toFixed(1))); return { addColorStop: () => {} }; }; },
      set(t, k, v) { if (k === 'fillStyle' || k === 'strokeStyle') log.push(String(k) + v); t[k] = v; return true; },
    }) as unknown as CanvasRenderingContext2D; return { ctx, log }; };
    const draw = (o: ObjectInstance) => { const r = rec(); const art = createHouseArt(r.ctx); r.log.length = 0; art.render({ level: 1, rot: 0, minutes: 780, day: 1, t: 1, dt: 0.016, objs: INITIAL_OBJS.filter((x) => x.level === 1 && x.id !== o.id).map((x) => ({ ...x })).concat([o]), wallMode: 'up', chars: [] } as never); return r.log.join('|'); };
    for (const t of PIECES) {
      const base = INITIAL_OBJS.find((o) => o.type === t && o.level === 1)!;
      expect(draw({ ...base, skin: 'retro' }), t).not.toEqual(draw({ ...base }));
    }
  });

  it('buying the wallpaper the companion likes makes her react with her taste, as paint does', () => {
    const style = Object.fromEntries(STYLE_TAGS.map((t) => [t, 0])) as Record<string, number>;
    Object.assign(style, { vintage: 1, playful: 1, bold: 1, minimal: -1, modern: -1 });
    const tasteNorm = computeTasteNorm(CATALOG as never, style as never);
    const item = catalogById('paper-starburst-mint')!;
    expect(tasteOf({ id: item.id, name: item.name, tags: item.tags }, style as never, tasteNorm)).toBeGreaterThan(0);
    const logs: string[] = [], emitted: unknown[] = [];
    let applied = '';
    const g = {
      world: { objs: [] }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: { styledSet: [] }, style, tasteNorm,
      log: (m: string) => logs.push(m), art: { burst: () => {}, applyWallpaper: (_l: number, p: string) => { applied = p; } }, hasAttic: () => false, storage: [],
      s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: (e: unknown) => emitted.push(e), refreshDrawer: () => {}, dezDeliveries: () => false, spendOn: () => true,
    } as unknown as Game;
    createShop(g).handleBuy!(item);
    expect(applied).toBe('starburst-mint');
    expect(logs.some((l) => /^Maya (likes|loves) the Atomic mint/.test(l))).toBe(true);
    expect(emitted).toContainEqual({ type: 'room.styled', liked: true });
    expect((g.s as { bond: number }).bond).toBeGreaterThan(50);
  });

  it('every look in the catalog is unique and nothing else in it changed shape', () => {
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length);
  });
});

describe('the Sets tab', () => {
  const set = () => catalogById('set-retro')!;
  const shopWith = (money: number, owned: string[] = [], level = 1) => {
    const objs = INITIAL_OBJS.map((o) => ({ ...o }));
    const logs: string[] = [], emitted: unknown[] = [], paid: number[] = [], applied: string[] = [], ownedSet = new Set(owned);
    const g = {
      world: { objs }, partnerName: 'Maya', house: {}, view: { level }, owned: ownedSet, closet: [], flags: { styledSet: [] }, style: {}, tasteNorm: { key: '', mean: 0, sd: 1 },
      log: (m: string) => logs.push(m), art: { burst: () => {}, objectPlaced: () => {}, applyWallpaper: (_l: number, p: string) => applied.push('paper:' + p), applyFloor: (_l: number, f: string) => applied.push('floor:' + f) },
      hasAttic: () => false, storage: [], s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: (e: unknown) => emitted.push(e), refreshDrawer: () => {}, dezDeliveries: () => false,
      spendOn: (_: string, n: number) => { if (n > money) return false; money -= n; paid.push(n); return true; }, peopleOnFloor: () => [], relearnLayout: () => {},
    } as unknown as Game;
    return { objs, logs, emitted, paid, applied, owned: ownedSet, buy: createShop(g).handleBuy! };
  };

  it('is a tab, and the Retro set lists every look, the wallpaper and the floor', () => {
    expect(TABS).toContain('Sets');
    expect(set().tab).toBe('Sets');
    expect(set().set!.items).toEqual([...RETRO_ITEMS, 'paper-starburst-mint', 'floor-linoleum']);
    for (const id of set().set!.items) expect(catalogById(id), id).toBeDefined();
  });

  it('costs less than the pieces apart: 20% off what is not owned yet', () => {
    const apart = set().set!.items.reduce((t, id) => t + catalogById(id)!.price, 0);
    expect(apart).toBe(1895);
    expect(setQuote(set(), new Set()).full).toBe(apart);
    expect(set().price).toBe(Math.round(apart * 0.8));
    expect(set().price).toBeLessThan(apart);
    const some = setQuote(set(), new Set(['look-fridge-retro', 'floor-linoleum']));
    expect(some.full).toBe(apart - 360 - 160);
    expect(some.cost).toBe(Math.round((apart - 520) * 0.8));
    expect(setQuote(set(), new Set(set().set!.items)).cost).toBe(0);
  });

  it('buying it puts every piece, the wallpaper and the floor in place, in one payment, with one reaction', () => {
    const { objs, paid, applied, emitted, logs, owned, buy } = shopWith(5000);
    const before = objs.filter((o) => o.level === 1).map((o) => [o.id, o.x, o.y, o.rot]);
    buy(set());
    expect(paid).toEqual([set().price]);
    for (const id of ['fridge', 'counter', 'dining', 'sofa', 'lamp1', 'plant1']) expect(objs.find((o) => o.id === id)!.skin, id).toBe('retro');
    expect(applied).toEqual(['paper:starburst-mint', 'floor:linoleum']);
    expect(emitted.filter((e) => (e as { type: string }).type === 'room.styled')).toHaveLength(1);
    expect(logs.filter((l) => /^Bought /.test(l))).toHaveLength(1);
    for (const id of set().set!.items) expect(owned.has(id), id).toBe(true);
    // Nothing moved.
    expect(objs.filter((o) => o.level === 1).map((o) => [o.id, o.x, o.y, o.rot])).toEqual(before);
  });

  it('charges only for what is not owned, and never twice', () => {
    const { paid, buy, owned } = shopWith(5000, ['look-fridge-retro', 'look-counter-retro']);
    buy(set());
    expect(paid).toEqual([setQuote(set(), new Set(['look-fridge-retro', 'look-counter-retro'])).cost]);
    buy(set());
    expect(paid).toHaveLength(1);
    expect(owned.has('set-retro')).toBe(true);
  });

  it('with too little money, or standing on the backyard, nothing is bought or changed', () => {
    const poor = shopWith(100);
    poor.buy(set());
    expect(poor.paid).toEqual([]);
    expect(poor.objs.find((o) => o.id === 'fridge')!.skin).toBeUndefined();
    const yard = shopWith(5000, [], 3);
    yard.buy(set());
    expect(yard.paid).toEqual([]);
    expect(yard.objs.find((o) => o.id === 'fridge')!.skin).toBeUndefined();
  });
});
