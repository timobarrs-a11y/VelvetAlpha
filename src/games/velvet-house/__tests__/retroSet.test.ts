import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { TYPES, INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { CATALOG, catalogById } from '../state/catalog';
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
