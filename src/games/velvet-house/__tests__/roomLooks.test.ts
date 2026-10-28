import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { INITIAL_OBJS } from '../state/objects';
import { CATALOG } from '../state/catalog';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// Paint, wallpaper and floors go on one room of a floor, or on the whole floor, which puts its rooms back to one look.

function stubCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440, clientWidth: 640, clientHeight: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return () => gradient; },
    set(t, k, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
beforeAll(() => {
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas'
    ? ({ width: 640, height: 440, getContext: () => stubCtx() } as unknown as HTMLCanvasElement)
    : realCreate(tag))) as typeof document.createElement);
});

describe('a look for one room', () => {
  it('wallpaper and a floor go on the kitchen only; the rest of the floor keeps its own', () => {
    const art = createHouseArt(stubCtx());
    const before = art.roomLook(1);
    art.applyWallpaper(1, 'stripe-mint', 'Kitchen');
    art.applyFloor(1, 'herring', 'Kitchen');
    expect(art.roomLook(1, 'Kitchen')).toMatchObject({ paper: 'stripe-mint', floor: 'herring', paint: before.paint });
    expect(art.roomLook(1, 'Living room')).toEqual(before);
    expect(art.roomLook(1)).toEqual(before);
  });

  it('paint goes over the wallpaper of the room it is on, and only that room', () => {
    const art = createHouseArt(stubCtx());
    art.applyWallpaper(1, 'stripe-mint');
    art.applyPaint(1, '#C9D7E8', 'Entry');
    expect(art.roomLook(1, 'Entry')).toMatchObject({ paint: '#C9D7E8', paper: null });
    expect(art.roomLook(1, 'Kitchen').paper).toBe('stripe-mint');
  });

  it('the whole floor puts every room back to one look, for what it changes only', () => {
    const art = createHouseArt(stubCtx());
    art.applyWallpaper(1, 'stripe-mint', 'Kitchen');
    art.applyFloor(1, 'herring', 'Kitchen');
    art.applyWallpaper(1, 'damask');
    expect(art.roomLook(1, 'Kitchen')).toMatchObject({ paper: 'damask', floor: 'herring' });
    art.applyFloor(1, 'maple');
    expect(art.roomLook(1, 'Kitchen').floor).toBe('maple');
    expect(art.exportLooks().ROOMLOOK[1]).toEqual({});
  });

  it('a room the floor does not have is the whole floor', () => {
    const art = createHouseArt(stubCtx());
    art.applyFloor(2, 'herring', 'Kitchen');
    expect(art.roomLook(2).floor).toBe('herring');
    expect(art.exportLooks().ROOMLOOK[2]).toEqual({});
  });

  it('is saved and comes back', () => {
    const art = createHouseArt(stubCtx());
    art.applyWallpaper(2, 'stars-night', 'Bedroom');
    const saved = JSON.parse(JSON.stringify(art.exportLooks()));
    const again = createHouseArt(stubCtx());
    again.applySave(saved);
    expect(again.roomLook(2, 'Bedroom').paper).toBe('stars-night');
    expect(again.roomLook(2, 'Bathroom').paper).toBe(art.roomLook(2, 'Bathroom').paper);
  });

  it('draws a floor with rooms of their own, with the room picked in the shop outlined', () => {
    const art = createHouseArt(stubCtx());
    art.applyWallpaper(1, 'stripe-mint', 'Kitchen');
    art.applyPaint(1, '#C9D7E8', 'Living room');
    art.applyFloor(1, 'herring', 'Entry');
    for (const rot of [0, 1, 2, 3]) {
      expect(() => art.render({ level: 1, rot, minutes: 600, day: 1, t: 1, dt: 0.016, objs: INITIAL_OBJS.map((o) => ({ ...o })), wallMode: 'up', chars: [], roomHint: 'Kitchen' })).not.toThrow();
    }
  });
});

describe('the shop', () => {
  function shop(room: string | null, owned: string[] = []) {
    const applied: Array<[string, number, string, string | null | undefined]> = [];
    const logs: string[] = [], spent: number[] = [];
    const g = {
      world: { objs: INITIAL_OBJS.map((o) => ({ ...o })) }, partnerName: 'Maya', house: {}, view: { level: 1, room }, owned: new Set(owned), closet: [], flags: { styledSet: [] }, style: {}, tasteNorm: {},
      log: (m: string) => logs.push(m), hasAttic: () => false, storage: [],
      art: {
        burst: () => {},
        applyPaint: (l: number, c: string, r?: string | null) => applied.push(['paint', l, c, r]),
        applyWallpaper: (l: number, p: string, r?: string | null) => applied.push(['paper', l, p, r]),
        applyFloor: (l: number, f: string, r?: string | null) => applied.push(['floor', l, f, r]),
      },
      s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => false,
      spendOn: (_: string, n: number) => { spent.push(n); return true; }, peopleOnFloor: () => [], relearnLayout: () => {},
    } as unknown as Game;
    return { applied, logs, spent, g, buy: createShop(g).handleBuy! };
  }
  const paper = CATALOG.find((c) => c.icon === 'paper')!;
  const floor = CATALOG.find((c) => c.icon === 'floor')!;

  it('puts wallpaper and floors on the room picked, and says where', () => {
    const { applied, logs, buy } = shop('Kitchen');
    buy(paper);
    buy(floor);
    expect(applied).toEqual([['paper', 1, paper.pattern, 'Kitchen'], ['floor', 1, floor.floor, 'Kitchen']]);
    expect(logs.some((l) => /kitchen/i.test(l))).toBe(true);
  });

  it('with no room picked, or one this floor does not have, puts them on the whole floor', () => {
    for (const room of [null, 'Bedroom']) {
      const { applied, buy } = shop(room);
      buy(paper);
      expect(applied[0][3]).toBeNull();
    }
  });

  it('wallpaper already bought goes up again anywhere for free, and she does not react to it twice', () => {
    const { spent, g, buy } = shop('Entry', [paper.id]);
    const bond = (g.s as { bond: number }).bond;
    buy(paper);
    expect(spent).toEqual([]);
    expect((g.s as { bond: number }).bond).toBe(bond);
  });
});
