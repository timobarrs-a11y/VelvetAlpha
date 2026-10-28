import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { INITIAL_OBJS, TYPES, STARTER_TV_IDS, isMount, isScreen, type ObjectInstance } from '../state/objects';
import { LEVELS } from '../state/house';
import { CATALOG } from '../state/catalog';
import { checkPlacement, relocate, backToWall, setOnStand, canStore } from '../state/arrange';
import { buildWorld, createAgent, startChain } from '../state/agents';
import { snapshot, type SaveContext } from '../state/save';
import { SAVE_KEY, loadWorld } from '../kernel/config';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// The TV is a piece now, not part of the living room wall: it can be moved, put away or swapped for another, and TVs
// stand on TV units, consoles, desks, dressers and the entertainment center. Watching needs a TV on that floor.

const fresh = () => INITIAL_OBJS.map((o) => ({ ...o }));
const TVS = ['walltv', 'tvflat', 'tvdesk', 'tvtube'];

describe('the TVs', () => {
  it('the house starts with its TV on the living room wall as a piece, and the wall itself has none', () => {
    const tv = fresh().find((o) => o.id === 'walltv')!;
    expect(tv).toMatchObject({ type: 'walltv', level: 1, rot: 0 });
    expect(LEVELS[1].feats.some((f) => f.k === 'tv')).toBe(false);
    expect(STARTER_TV_IDS).toEqual(['walltv']);
  });

  it('every TV is sold, can be put away, and is one kind of screen; only the wall one hangs', () => {
    for (const t of TVS) {
      expect(isScreen(t), t).toBe(true);
      expect(CATALOG.some((c) => c.type === t), t).toBe(true);
      expect(canStore({ id: t, type: t, level: 1, x: 0, y: 0, rot: 0 }), t).toBe(true);
      expect(isMount(t), t).toBe(t === 'walltv');
      expect(!!TYPES[t].small, t).toBe(t !== 'walltv');
    }
    expect(CATALOG.some((c) => c.type === 'entcenter')).toBe(true);
  });

  it('the wall TV hangs with its back to a wall, over whatever stands below it', () => {
    const objs = fresh(), tv = objs.find((o) => o.id === 'walltv')!;
    expect(checkPlacement(objs, tv).ok).toBe(true); // over the TV unit
    expect(backToWall(tv)).toBe(true);
    tv.y = 2;
    expect(checkPlacement(objs, tv)).toMatchObject({ ok: false, reason: expect.stringMatching(/wall/) });
    // Against a wall inside the house: the kitchen's, facing the living room.
    const kw = LEVELS[1].walls.find((w) => w.x === 4.7 && w.b > 3)!;
    Object.assign(tv, { rot: 3, x: kw.x + 0.08, y: kw.a + 0.3 });
    expect(backToWall(tv)).toBe(true);
    // It never blocks anyone's way or another piece.
    const sofa = objs.find((o) => o.id === 'sofa')!;
    Object.assign(tv, { rot: 0, x: 6.1, y: 0.08 });
    expect(checkPlacement(objs, sofa).ok).toBe(true);
  });

  it('a wall TV with nowhere chosen hangs itself on the nearest free wall, on any floor', () => {
    const objs = fresh();
    for (const level of [0, 2]) {
      const tv: ObjectInstance = { id: `tv${level}`, type: 'walltv', level, x: 5, y: 5, rot: 0 };
      objs.push(tv);
      expect(relocate(objs, tv, level), `level ${level}`).toBe(true);
      expect(backToWall(tv)).toBe(true);
      expect(checkPlacement(objs, tv).ok).toBe(true);
    }
  });

  it('a TV stands on the TV unit first, then a dresser or a desk; it does not stand on what has no room', () => {
    const objs = fresh();
    const flat: ObjectInstance = { id: 'f', type: 'tvflat', level: 1, x: 0, y: 0, rot: 0 };
    objs.push(flat);
    expect(setOnStand(objs, flat, 1)).toBe(true);
    expect(flat).toMatchObject({ on: 'tvunit', z: TYPES.tvunit.surface!.z });
    expect(checkPlacement(objs, flat).ok).toBe(true);
    const small: ObjectInstance = { id: 'd', type: 'tvdesk', level: 2, x: 0, y: 0, rot: 0 };
    objs.push(small);
    expect(setOnStand(objs, small, 2)).toBe(true);
    expect(['dresser', 'desk']).toContain(small.on);
    // A second flat screen does not fit beside the first on the TV unit, and the main floor has no other top for it.
    const again: ObjectInstance = { id: 'f2', type: 'tvflat', level: 1, x: 0, y: 0, rot: 0 };
    objs.push(again);
    expect(setOnStand(objs, again, 1)).toBe(false);
    expect(again.on).toBeUndefined();
  });

  it('the entertainment center holds a TV in its niche', () => {
    const objs = fresh();
    const ec: ObjectInstance = { id: 'ec', type: 'entcenter', level: 0, x: 5.6, y: 0.1, rot: 0 };
    objs.push(ec);
    expect(checkPlacement(objs, ec).ok).toBe(true);
    const tube: ObjectInstance = { id: 't', type: 'tvtube', level: 0, x: 0, y: 0, rot: 0 };
    objs.push(tube);
    expect(setOnStand(objs, tube, 0)).toBe(true);
    expect(tube.on).toBe('ec');
  });
});

describe('watching TV', () => {
  const look = {} as never;
  const watch = (objs: ObjectInstance[], level = 1) => {
    const ch = createAgent('jordan', 'Sam', undefined, look);
    Object.assign(ch, { level, x: 5, y: 5 });
    const ok = startChain(buildWorld(objs), ch, 'tv', null, () => 0.5);
    return { ok, slot: ch.task?.slot };
  };

  it('happens from a seat on a floor with a TV', () => {
    const r = watch(fresh());
    expect(r.ok).toBe(true);
    expect(r.slot?.level).toBe(1);
  });

  it('does not happen with no TV in the house, and follows the TV to another floor', () => {
    const none = fresh().filter((o) => !TYPES[o.type].screen);
    expect(watch(none).ok).toBe(false);
    const up = none.concat([{ id: 'tv2', type: 'tvdesk', level: 2, x: 3.5, y: 0.2, rot: 0, on: 'dresser', z: 0.85 }]);
    // Upstairs has no seat yet: a bench there makes it possible.
    expect(watch(up).ok).toBe(false);
    up.push({ id: 'bench2', type: 'bench', level: 2, x: 3.0, y: 2.5, rot: 0 });
    const r = watch(up);
    expect(r.ok).toBe(true);
    expect(r.slot?.level).toBe(2);
  });
});

describe('buying a TV', () => {
  it('puts it on the TV unit, and says so', () => {
    const objs = fresh(), logs: string[] = [];
    const g = {
      world: { objs }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: {}, style: {}, tasteNorm: {},
      log: (m: string) => logs.push(m), art: { burst: () => {}, objectPlaced: () => {} }, hasAttic: () => false, storage: [],
      s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => false,
      spendOn: () => true, peopleOnFloor: () => [], relearnLayout: () => {},
    } as unknown as Game;
    createShop(g).handleBuy!(CATALOG.find((c) => c.id === 'tvflat')!);
    expect(objs.find((o) => o.type === 'tvflat')).toMatchObject({ on: 'tvunit' });
    expect(logs.some((l) => /on the tv unit/i.test(l))).toBe(true);
  });
});

describe('a house saved while the TV was part of the wall', () => {
  const ctx = (objs: ObjectInstance[], storage: ObjectInstance[] = [], flags: Record<string, unknown> = {}): SaveContext => ({
    rev: 1, day: 3, minutes: 600, money: 700, earnedToday: 0, spentToday: 0, power: true,
    fridge: { basic: 2, fresh: 1 }, dishes: 1, laundryPile: 2, bill: null, nextBillAt: null,
    objs, storage, owned: [], closet: [], bond: 61, flags,
    simName: 'Sam', partnerName: 'Maya', look: {} as never, mayaLook: {} as never, needs: { jordan: {} as never, maya: {} as never },
    memories: [], coreMem: [], pastMem: [], townName: 'Honeysuckle Hollow', turns: [], rngSeed: 7,
    lifeGoal: null, settleDone: false, freeWill: true, style: {}, companion: null, wallMode: 'cut',
    looks: { LOOKS: [], ROOMLOOK: [], WALLOBJS: [], yard: { t: [], rainAt: 0, rainUntil: 0, rainCheck: 0 } },
  });
  const withoutTv = () => fresh().filter((o) => o.id !== 'walltv');
  const store = (c: SaveContext) => localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(c)));
  beforeEach(() => localStorage.clear());

  it('gets it on the wall where it was, once', () => {
    store(ctx(withoutTv(), [], { rugObjects: true }));
    const tvs = loadWorld().objs.filter((o) => o.id === 'walltv');
    expect(tvs).toHaveLength(1);
    expect(tvs[0]).toMatchObject({ level: 1, x: 6.1, y: 0.08 });
  });

  it('not when the player has taken it down, or once the game has given it', () => {
    store(ctx(withoutTv(), [{ ...INITIAL_OBJS.find((o) => o.id === 'walltv')! }], { rugObjects: true }));
    expect(loadWorld().objs.some((o) => o.id === 'walltv')).toBe(false);
    store(ctx(withoutTv(), [], { rugObjects: true, tvObject: true }));
    expect(loadWorld().objs.some((o) => o.id === 'walltv')).toBe(false);
  });
});

describe('drawing and tapping the TVs', () => {
  beforeAll(() => {
    const gradient = { addColorStop: () => {} };
    const stubCtx = () => new Proxy({} as Record<string | symbol, unknown>, {
      get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440, clientWidth: 640, clientHeight: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return () => gradient; },
      set(t, k, v) { t[k] = v; return true; },
    });
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas'
      ? ({ width: 640, height: 440, getContext: () => stubCtx() } as unknown as HTMLCanvasElement)
      : realCreate(tag))) as typeof document.createElement);
  });

  it('every TV and the entertainment center draw at every turn, on and off', () => {
    const art = createHouseArt(document.createElement('canvas').getContext('2d')!);
    for (const type of [...TVS, 'entcenter']) {
      for (const rot of [0, 1, 2, 3]) {
        const o: ObjectInstance = { id: `${type}-${rot}`, type, level: 1, x: 3, y: 1, rot };
        const frame = { level: 1, rot: 0, minutes: 600, day: 1, t: 1, dt: 0.016, objs: [o], wallMode: 'up' as const, chars: [] };
        expect(() => art.render(frame)).not.toThrow();
        if (type !== 'entcenter') expect(art.poke(o, '')).toBe('The TV flickers on.');
        expect(() => art.render(frame)).not.toThrow();
      }
    }
  });

  it('tapping the TV unit switches the TV on the wall above it, and a stand with no TV does nothing', () => {
    const art = createHouseArt(document.createElement('canvas').getContext('2d')!);
    const objs = fresh();
    art.render({ level: 1, rot: 0, minutes: 600, day: 1, t: 1, dt: 0.016, objs, wallMode: 'up', chars: [] });
    const unit = objs.find((o) => o.id === 'tvunit')!;
    expect(art.poke(unit, '')).toBe('The TV flickers on.');
    expect(art.poke(objs.find((o) => o.id === 'walltv')!, '')).toBe('TV off.');
    const bare = objs.filter((o) => o.id !== 'walltv');
    art.render({ level: 1, rot: 0, minutes: 600, day: 1, t: 1, dt: 0.016, objs: bare, wallMode: 'up', chars: [] });
    expect(art.poke(unit, '')).toBeNull();
  });
});
