import { describe, it, expect, beforeEach } from 'vitest';
import { INITIAL_OBJS, TYPES, STARTER_RUG_IDS, type ObjectInstance } from '../state/objects';
import { LEVELS } from '../state/house';
import { checkPlacement, isMovable, otherFloors, canStore, relocate } from '../state/arrange';
import { snapshot, type SaveContext } from '../state/save';
import { SAVE_KEY, loadWorld } from '../kernel/config';

const fresh = () => INITIAL_OBJS.map((o) => ({ ...o }));

describe('the house\'s own rugs', () => {
  it('are pieces now, where and as big as the ones that used to be painted on the floor', () => {
    const objs = fresh();
    const live = objs.find((o) => o.id === 'rug1')!, bed = objs.find((o) => o.id === 'rug2')!;
    const [x1, y1, x2, y2] = LEVELS[1].rug;
    expect([live.x, live.y, live.x + TYPES[live.type].W, live.y + TYPES[live.type].D]).toEqual([x1, y1, x2, y2]);
    expect([live.level, bed.level, bed.x, bed.y, TYPES[bed.type].W, TYPES[bed.type].D]).toEqual([1, 2, 2.6, 0.9, 2.0, 2.1]);
    expect(TYPES.rugwide.rug).toBe(true);
    expect(TYPES.rugsquare.rug).toBe(true);
  });

  it('can be moved, turned, recoloured, put away and carried to any floor', () => {
    const objs = fresh();
    const rug = objs.find((o) => o.id === 'rug1')!;
    expect(isMovable(rug)).toBe(true);
    expect(canStore(rug)).toBe(true);
    expect(otherFloors(rug)).toEqual([0, 2, 3, 4]);
    expect(TYPES.rugwide.cols!.length).toBeGreaterThan(1);
    expect(relocate(objs, rug, 3)).toBe(true);
    expect(rug.level).toBe(3);
  });

  it('lie under everything: a couch, the dining table and a bed can all stand on one, and it is never the rug that stops them', () => {
    const objs = fresh();
    const why = (o: ObjectInstance) => { const r = checkPlacement(objs, o) as { ok: boolean; reason?: string }; return r.ok ? '' : r.reason ?? ''; };
    const rug = objs.find((o) => o.id === 'rug1')!, rug2 = objs.find((o) => o.id === 'rug2')!;
    // an empty spot of rug is a fine place for a piece
    const lamp = objs.find((o) => o.id === 'lamp1')!;
    lamp.x = rug.x + 1.5; lamp.y = rug.y + 0.6;
    expect(why(lamp)).toBe('');
    for (const id of ['sofa', 'dining']) {
      const o = objs.find((x) => x.id === id)!;
      o.x = rug.x + 0.6; o.y = rug.y + 0.2;
      expect(why(o), id).not.toMatch(/rug/i);
    }
    const bed = objs.find((o) => o.id === 'bed')!;
    bed.x = rug2.x; bed.y = rug2.y;
    expect(why(bed)).not.toMatch(/rug/i);
  });
});

describe('a house saved before the rugs were pieces', () => {
  const ctx = (objs: ObjectInstance[], storage: ObjectInstance[] = [], flags: Record<string, unknown> = {}): SaveContext => ({
    rev: 1, day: 3, minutes: 600, money: 700, earnedToday: 0, spentToday: 0, power: true,
    fridge: { basic: 2, fresh: 1 }, dishes: 1, laundryPile: 2, bill: null, nextBillAt: null,
    objs, storage, owned: [], closet: [], bond: 61, flags,
    simName: 'Sam', partnerName: 'Maya', look: {} as never, mayaLook: {} as never, needs: { jordan: {} as never, maya: {} as never },
    memories: [], coreMem: [], pastMem: [], townName: 'Honeysuckle Hollow', turns: [], rngSeed: 7,
    lifeGoal: null, settleDone: false, freeWill: true, style: {}, companion: null, wallMode: 'cut',
    looks: { LOOKS: [], ROOMLOOK: [], WALLOBJS: [], yard: { t: [], rainAt: 0, rainUntil: 0, rainCheck: 0 } },
  });
  const withoutRugs = () => fresh().filter((o) => !STARTER_RUG_IDS.includes(o.id));
  const store = (c: SaveContext) => localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(c)));
  beforeEach(() => localStorage.clear());

  it('is given both rugs, once', () => {
    store(ctx(withoutRugs()));
    const ids = loadWorld().objs.map((o) => o.id);
    for (const id of STARTER_RUG_IDS) expect(ids.filter((x) => x === id)).toHaveLength(1);
  });

  it('is not given one it already has, or one the player put away', () => {
    store(ctx(withoutRugs().concat([{ ...INITIAL_OBJS.find((o) => o.id === 'rug1')!, x: 1, y: 5 }]), [{ ...INITIAL_OBJS.find((o) => o.id === 'rug2')! }]));
    const objs = loadWorld().objs;
    expect(objs.filter((o) => o.id === 'rug1')).toHaveLength(1);
    expect(objs.find((o) => o.id === 'rug1')).toMatchObject({ x: 1, y: 5 });
    expect(objs.some((o) => o.id === 'rug2')).toBe(false);
  });

  it('is not given them again once it has been (the flag the game sets)', () => {
    store(ctx(withoutRugs(), [], { rugObjects: true }));
    expect(loadWorld().objs.some((o) => STARTER_RUG_IDS.includes(o.id))).toBe(false);
  });

  it('a new game starts with them', () => {
    expect(loadWorld().objs.filter((o) => STARTER_RUG_IDS.includes(o.id))).toHaveLength(2);
  });
});
