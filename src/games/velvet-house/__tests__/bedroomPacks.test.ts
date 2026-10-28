import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { TYPES, INITIAL_OBJS, type ObjectInstance, type Material, type Theme } from '../state/objects';
import { catalogById, setQuote } from '../state/catalog';
import { STYLE_TAGS } from '../state/taste';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// The upstairs packs: a look for every bedroom and bath piece upstairs, the room's wallpaper and floor, and one piece
// that does something. A new pack adds a line here and is held to the same rules.
interface PackSpec { theme: Theme; tags: string[]; materials: Material[]; paper: { id: string; pattern: string }; floor: { id: string; floor: string }; extra: string }
const PACKS: PackSpec[] = [
  { theme: 'brutalist', tags: ['industrial', 'minimal', 'bold'], materials: ['stone', 'metal', 'glass'], paper: { id: 'paper-formwork', pattern: 'formwork' }, floor: { id: 'floor-terrazzodark', floor: 'terrazzodark' }, extra: 'overseer' },
  { theme: 'spa', tags: ['soft', 'minimal', 'natural'], materials: ['wood', 'stone', 'glass'], paper: { id: 'paper-limewash', pattern: 'limewash' }, floor: { id: 'floor-teakdeck', floor: 'teakdeck' }, extra: 'diffuser' },
  { theme: 'hotel', tags: ['luxe', 'bold', 'vintage'], materials: ['fabric', 'wood', 'stone'], paper: { id: 'paper-pinstripe-gold', pattern: 'pinstripe-gold' }, floor: { id: 'floor-marblecheck', floor: 'marblecheck' }, extra: 'servicebell' },
  { theme: 'cottage', tags: ['cozy', 'soft', 'vintage'], materials: ['metal', 'wood', 'stone', 'fabric'], paper: { id: 'paper-ditsy-cream', pattern: 'ditsy-cream' }, floor: { id: 'floor-paintedpine', floor: 'paintedpine' }, extra: 'musicbox' },
  { theme: 'midcentury', tags: ['modern', 'warm', 'vintage'], materials: ['wood', 'stone', 'laminate'], paper: { id: 'paper-starburst-amber', pattern: 'starburst-amber' }, floor: { id: 'floor-walnutparquet', floor: 'walnutparquet' }, extra: 'hificonsole' },
  { theme: 'regency', tags: ['luxe', 'bold', 'playful'], materials: ['fabric', 'glass', 'stone'], paper: { id: 'paper-banana-leaf', pattern: 'banana-leaf' }, floor: { id: 'floor-whiteherring', floor: 'whiteherring' }, extra: 'glamtable' },
];
const PIECES = ['bed', 'nightstand', 'dresser', 'toilet', 'vanity', 'shower'];
// What the household uses on each piece: a look must leave these where they are.
const KEEPS: Record<string, string[]> = { bed: ['bedA', 'bedB', 'makebed'], nightstand: [], dresser: ['dresser'], toilet: [], vanity: ['mirror'], shower: ['shower'] };
const UPSTAIRS = 2;

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

for (const P of PACKS) {
  const ids = [...PIECES.map((p) => `look-${p}-${P.theme}`), P.paper.id, P.floor.id, P.extra];
  describe(`the ${P.theme} bedroom and bath pack`, () => {
    it('has a look for every bedroom and bath piece, a wallpaper, a floor, a piece that does something, and a bundle', () => {
      for (const id of ids) expect(catalogById(id), id).toBeDefined();
      expect(catalogById(P.paper.id)!.pattern).toBe(P.paper.pattern);
      expect(catalogById(P.floor.id)!.floor).toBe(P.floor.floor);
      expect(catalogById(`set-${P.theme}`)!.set!.items).toEqual(ids);
    });
    it('classifies each look by material and theme and points the entry at it', () => {
      for (const p of PIECES) {
        const sk = TYPES[p].skins![P.theme];
        expect(sk.theme).toBe(P.theme);
        expect(P.materials).toContain(sk.material);
        expect(sk.cols!.length).toBeGreaterThanOrEqual(3);
        const e = catalogById(`look-${p}-${P.theme}`)!;
        expect(e).toMatchObject({ skin: P.theme, name: sk.name, type: p });
        expect(e.desc).toBeTruthy();
        expect(e.cols).toEqual(sk.cols);
      }
    });
    it('uses its tags from the shared list, and the set price is the pieces less a fifth', () => {
      for (const id of ids) { const e = catalogById(id)!; expect(e.tags).toEqual(P.tags); for (const t of e.tags!) expect(STYLE_TAGS as readonly string[]).toContain(t); }
      const apart = ids.reduce((t, id) => t + catalogById(id)!.price, 0);
      expect(setQuote(catalogById(`set-${P.theme}`)!, new Set()).cost).toBe(Math.round(apart * 0.8));
    });
    it('keeps what the household uses: the spots stay on the type', () => {
      for (const p of PIECES) expect(Object.values(TYPES[p].spots ?? {}).map((s) => s.tag).sort(), p).toEqual(KEEPS[p].slice().sort());
      expect(TYPES.nightstand.light).toBeDefined();
    });
    it('draws each piece differently from the stock look and from every other pack', () => {
      const draw = (o: ObjectInstance) => {
        const log: string[] = [];
        const ctx = new Proxy({} as Record<string | symbol, unknown>, {
          get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return (...a: unknown[]) => { if (/^(fill|stroke|moveTo|lineTo|ellipse|arc)/.test(String(k))) log.push(String(k) + a.filter((x) => typeof x === 'number').map((x) => (x as number).toFixed(1))); return { addColorStop: () => {} }; }; },
          set(t, k, v) { if (k === 'fillStyle' || k === 'strokeStyle') log.push(String(k) + v); t[k] = v; return true; },
        }) as unknown as CanvasRenderingContext2D;
        const art = createHouseArt(ctx); log.length = 0;
        art.render({ level: UPSTAIRS, rot: 0, minutes: 780, day: 1, t: 1, dt: 0.016, objs: INITIAL_OBJS.filter((x) => x.level === UPSTAIRS && x.id !== o.id).map((x) => ({ ...x })).concat([o]), wallMode: 'up', chars: [] } as never);
        return log.join('|');
      };
      for (const p of PIECES) {
        const base = INITIAL_OBJS.find((o) => o.type === p && o.level === UPSTAIRS)!;
        const mine = draw({ ...base, skin: P.theme });
        expect(mine, p).not.toEqual(draw({ ...base }));
        for (const other of Object.keys(TYPES[p].skins!).filter((k) => k !== P.theme)) expect(mine, `${p} vs ${other}`).not.toEqual(draw({ ...base, skin: other }));
      }
    });
    it('buying the pack upstairs restyles the upstairs pieces in one payment, papers and floors upstairs, and moves nothing', () => {
      const objs = INITIAL_OBJS.map((o) => ({ ...o }));
      const paid: number[] = [], applied: [number, string][] = [];
      const g = {
        world: { objs }, partnerName: 'Maya', house: {}, view: { level: UPSTAIRS }, owned: new Set<string>(), closet: [], flags: { styledSet: [] }, style: {}, tasteNorm: { key: '', mean: 0, sd: 1 },
        log: () => {}, art: { burst: () => {}, objectPlaced: () => {}, applyWallpaper: (l: number, p: string) => applied.push([l, p]), applyFloor: (l: number, f: string) => applied.push([l, f]) }, hasAttic: () => false, storage: [],
        s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => false, spendOn: (_: string, n: number) => { paid.push(n); return true; }, peopleOnFloor: () => [], relearnLayout: () => {},
      } as unknown as Game;
      const before = objs.filter((o) => o.level === UPSTAIRS).map((o) => [o.id, o.x, o.y, o.rot]);
      createShop(g).handleBuy!(catalogById(`set-${P.theme}`)!);
      expect(paid).toEqual([setQuote(catalogById(`set-${P.theme}`)!, new Set()).cost]);
      for (const p of PIECES) expect(objs.find((o) => o.type === p && o.level === UPSTAIRS)!.skin, p).toBe(P.theme);
      expect(applied).toEqual([[UPSTAIRS, P.paper.pattern], [UPSTAIRS, P.floor.floor]]);
      expect(objs.filter((o) => o.level === UPSTAIRS && o.type !== P.extra).map((o) => [o.id, o.x, o.y, o.rot])).toEqual(before);
    });
  });
}
