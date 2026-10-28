import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { TYPES, INITIAL_OBJS, type ObjectInstance, type Material, type Theme } from '../state/objects';
import { CATALOG, catalogById, setQuote } from '../state/catalog';
import { STYLE_TAGS, tasteOf, computeTasteNorm } from '../state/taste';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// What every themed set must be. A new theme adds a line here and its own looks, and is held to the same rules.
interface ThemeSpec { theme: Theme; tags: string[]; materials: Material[]; paper: { id: string; pattern: string }; floor: { id: string; floor: string }; paperRange: [number, number]; floorRange: [number, number]; ladder: [number, number] }
const THEMES: ThemeSpec[] = [
  { theme: 'farmhouse', tags: ['cozy', 'natural', 'warm'], materials: ['wood', 'stone', 'metal', 'fabric'], paper: { id: 'paper-gingham-sage', pattern: 'gingham-sage' }, floor: { id: 'floor-barnwood', floor: 'barnwood' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [300, 450] },
  { theme: 'modern', tags: ['modern', 'minimal', 'cool'], materials: ['metal', 'glass', 'stone', 'fabric'], paper: { id: 'paper-pin-slate', pattern: 'pin-slate' }, floor: { id: 'floor-charcoal', floor: 'charcoal' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [450, 700] },
  { theme: 'scandi', tags: ['soft', 'minimal', 'natural'], materials: ['wood', 'fabric', 'metal'], paper: { id: 'paper-birch', pattern: 'birch' }, floor: { id: 'floor-nordic', floor: 'nordic' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [300, 450] },
  { theme: 'industrial', tags: ['industrial', 'bold', 'cool'], materials: ['metal', 'stone', 'wood', 'fabric'], paper: { id: 'paper-brick-white', pattern: 'brick-white' }, floor: { id: 'floor-poured', floor: 'poured' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [450, 700] },
  { theme: 'beach', tags: ['cool', 'natural', 'playful'], materials: ['wood', 'fabric', 'metal'], paper: { id: 'paper-stripe-nautical', pattern: 'stripe-nautical' }, floor: { id: 'floor-driftwood', floor: 'driftwood' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [300, 450] },
  { theme: 'deco', tags: ['luxe', 'bold', 'vintage'], materials: ['metal', 'stone', 'wood', 'fabric'], paper: { id: 'paper-deco-emerald', pattern: 'deco-emerald' }, floor: { id: 'floor-ivorygold', floor: 'ivorygold' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [450, 700] },
  { theme: 'japandi', tags: ['minimal', 'natural', 'cool'], materials: ['wood', 'stone', 'metal'], paper: { id: 'paper-shoji', pattern: 'shoji' }, floor: { id: 'floor-tatami', floor: 'tatami' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [300, 450] },
  { theme: 'boho', tags: ['warm', 'natural', 'playful'], materials: ['wood', 'fabric', 'metal'], paper: { id: 'paper-arches-terracotta', pattern: 'arches-terracotta' }, floor: { id: 'floor-jute', floor: 'jute' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [300, 450] },
  { theme: 'space', tags: ['modern', 'bold', 'playful'], materials: ['laminate', 'metal'], paper: { id: 'paper-orbit', pattern: 'orbit' }, floor: { id: 'floor-moon', floor: 'moon' }, paperRange: [80, 120], floorRange: [120, 180], ladder: [450, 700] },
];
const PIECES = ['fridge', 'counter', 'dining', 'sofa', 'lamp', 'plant'];
// What the household uses on each piece: a look must leave these where they are.
const KEEPS: Record<string, string[]> = { fridge: ['fridge'], counter: ['coffee', 'sink', 'stove', 'window'], dining: ['clear', 'dine1', 'dine2'], sofa: ['seat', 'seat'], plant: ['water'], lamp: [] };

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

for (const T of THEMES) {
  const ids = [...PIECES.map((p) => `look-${p}-${T.theme}`), T.paper.id, T.floor.id];
  describe(`the ${T.theme} set`, () => {
    it('has a look for the fridge, counter, dining set, sofa, lamp and plant, a wallpaper, a floor and a bundle; not the TV unit', () => {
      for (const id of ids) expect(catalogById(id), id).toBeDefined();
      expect(catalogById(T.paper.id)!.pattern).toBe(T.paper.pattern);
      expect(catalogById(T.floor.id)!.floor).toBe(T.floor.floor);
      expect(catalogById(`set-${T.theme}`)!.set!.items).toEqual(ids);
      expect(TYPES.tvunit.skins).toBeUndefined();
    });
    it('classifies each look by material and theme and points the entry at it', () => {
      for (const p of PIECES) {
        const sk = TYPES[p].skins![T.theme];
        expect(sk.theme).toBe(T.theme);
        expect(T.materials).toContain(sk.material);
        expect(sk.cols!.length).toBeGreaterThanOrEqual(3);
        const e = catalogById(`look-${p}-${T.theme}`)!;
        expect(e).toMatchObject({ skin: T.theme, name: sk.name, type: p });
        expect(e.desc).toBeTruthy();
        expect(e.cols).toEqual(sk.cols);
      }
    });
    it('uses its tags from the shared list, and the price ladder', () => {
      for (const id of ids) { const e = catalogById(id)!; expect(e.tags).toEqual(T.tags); for (const t of e.tags!) expect(STYLE_TAGS as readonly string[]).toContain(t); }
      const inR = (n: number, [lo, hi]: [number, number]) => n >= lo && n <= hi;
      expect(inR(catalogById(T.paper.id)!.price, T.paperRange)).toBe(true);
      expect(inR(catalogById(T.floor.id)!.price, T.floorRange)).toBe(true);
      const apart = ids.reduce((t, id) => t + catalogById(id)!.price, 0);
      expect(apart).toBeGreaterThan(T.ladder[0] * 3);
      expect(catalogById(`set-${T.theme}`)!.price).toBe(Math.round(apart * 0.8));
    });
    it('keeps what the household uses: the spots and lights stay on the type', () => {
      for (const p of PIECES) expect(Object.values(TYPES[p].spots ?? {}).map((s) => s.tag).sort(), p).toEqual(KEEPS[p].slice().sort());
      expect(TYPES.lamp.light).toBeDefined();
      expect(TYPES.dining.light).toBeDefined();
    });
    it('draws each piece differently from the stock look and from every other theme', () => {
      const draw = (o: ObjectInstance) => {
        const log: string[] = [];
        const ctx = new Proxy({} as Record<string | symbol, unknown>, {
          get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return (...a: unknown[]) => { if (/^(fill|stroke|moveTo|lineTo|ellipse|arc)/.test(String(k))) log.push(String(k) + a.filter((x) => typeof x === 'number').map((x) => (x as number).toFixed(1))); return { addColorStop: () => {} }; }; },
          set(t, k, v) { if (k === 'fillStyle' || k === 'strokeStyle') log.push(String(k) + v); t[k] = v; return true; },
        }) as unknown as CanvasRenderingContext2D;
        const art = createHouseArt(ctx); log.length = 0;
        art.render({ level: 1, rot: 0, minutes: 780, day: 1, t: 1, dt: 0.016, objs: INITIAL_OBJS.filter((x) => x.level === 1 && x.id !== o.id).map((x) => ({ ...x })).concat([o]), wallMode: 'up', chars: [] } as never);
        return log.join('|');
      };
      for (const p of PIECES) {
        const base = INITIAL_OBJS.find((o) => o.type === p && o.level === 1)!;
        const mine = draw({ ...base, skin: T.theme });
        expect(mine, p).not.toEqual(draw({ ...base }));
        for (const other of Object.keys(TYPES[p].skins!).filter((k) => k !== T.theme)) expect(mine, `${p} vs ${other}`).not.toEqual(draw({ ...base, skin: other }));
      }
    });
    it('makes the companion react with her taste when the wallpaper is bought', () => {
      const style = Object.fromEntries(STYLE_TAGS.map((t) => [t, 0])) as Record<string, number>;
      for (const t of T.tags) style[t] = 1;
      const norm = computeTasteNorm(CATALOG as never, style as never);
      const item = catalogById(T.paper.id)!;
      expect(tasteOf({ id: item.id, name: item.name, tags: item.tags }, style as never, norm)).toBeGreaterThan(0);
      const logs: string[] = [], emitted: unknown[] = [];
      const g = {
        world: { objs: [] }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: { styledSet: [] }, style, tasteNorm: norm,
        log: (m: string) => logs.push(m), art: { burst: () => {}, applyWallpaper: () => {} }, hasAttic: () => false, storage: [],
        s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: (e: unknown) => emitted.push(e), refreshDrawer: () => {}, dezDeliveries: () => false, spendOn: () => true,
      } as unknown as Game;
      createShop(g).handleBuy!(item);
      expect(logs.some((l) => new RegExp(`^Maya (likes|loves) the ${item.name}`).test(l))).toBe(true);
      expect(emitted).toContainEqual({ type: 'room.styled', liked: true });
    });
    it('buying the set puts it all on in one payment and moves nothing', () => {
      const objs = INITIAL_OBJS.map((o) => ({ ...o }));
      const paid: number[] = [], applied: string[] = [];
      const g = {
        world: { objs }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: { styledSet: [] }, style: {}, tasteNorm: { key: '', mean: 0, sd: 1 },
        log: () => {}, art: { burst: () => {}, objectPlaced: () => {}, applyWallpaper: (_l: number, p: string) => applied.push(p), applyFloor: (_l: number, f: string) => applied.push(f) }, hasAttic: () => false, storage: [],
        s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => false, spendOn: (_: string, n: number) => { paid.push(n); return true; }, peopleOnFloor: () => [], relearnLayout: () => {},
      } as unknown as Game;
      const before = objs.filter((o) => o.level === 1).map((o) => [o.id, o.x, o.y, o.rot]);
      createShop(g).handleBuy!(catalogById(`set-${T.theme}`)!);
      expect(paid).toEqual([setQuote(catalogById(`set-${T.theme}`)!, new Set()).cost]);
      for (const id of ['fridge', 'counter', 'dining', 'sofa', 'lamp1', 'plant1']) expect(objs.find((o) => o.id === id)!.skin, id).toBe(T.theme);
      expect(applied).toEqual([T.paper.pattern, T.floor.floor]);
      expect(objs.filter((o) => o.level === 1).map((o) => [o.id, o.x, o.y, o.rot])).toEqual(before);
    });
  });
}
