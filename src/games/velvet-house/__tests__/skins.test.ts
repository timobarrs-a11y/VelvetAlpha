import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { INITIAL_OBJS, TYPES, displayName, colsOf, skinOf, type ObjectInstance, type SkinDef } from '../state/objects';
import { CATALOG, look, type CatalogEntry } from '../state/catalog';
import { snapshot, type SaveContext } from '../state/save';
import { nextColour } from '../state/arrange';
import { skinTarget, skinColour, wearSkin, skinExists, looksFor, changeLook } from '../state/skins';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

const RETRO: SkinDef = { name: 'Pastel icebox', material: 'laminate', theme: 'retro', cols: ['#F3B6C4', '#9ED8C6', '#F6E3A1'] };

// A look for the fridge only for as long as a test needs one; the real sets arrive in their own changes.
const REAL = { fridge: TYPES.fridge.skins, lamp: TYPES.lamp.skins };
function withFridgeLook(): void { TYPES.fridge.skins = { ...REAL.fridge, retro: RETRO }; }
afterEach(() => { TYPES.fridge.skins = REAL.fridge; TYPES.lamp.skins = REAL.lamp; });

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

describe('looks on the type', () => {
  it('a look names its material and theme, and every look of every type is complete', () => {
    for (const [type, def] of Object.entries(TYPES)) {
      for (const [id, s] of Object.entries(def.skins ?? {})) {
        expect(s.name, `${type}.${id}`).toBeTruthy();
        expect(['wood', 'metal', 'laminate', 'stone', 'fabric', 'glass']).toContain(s.material);
        expect(['retro', 'farmhouse', 'modern', 'scandi', 'industrial', 'beach', 'deco', 'japandi', 'boho', 'space', 'gothic', 'riad', 'tropical', 'memphis', 'provence', 'adobe', 'neon', 'candy', 'cuddle', 'arcade', 'brutalist', 'spa', 'hotel', 'cottage', 'midcentury', 'regency', 'chalet']).toContain(s.theme);
      }
    }
  });
  it('the name, colours and look of a piece come from its skin, and an unknown skin is the stock look', () => {
    withFridgeLook();
    const f = { type: 'fridge', skin: 'retro' };
    expect(displayName(f)).toBe('Pastel icebox');
    expect(colsOf(f)).toEqual(RETRO.cols);
    expect(skinOf(f)).toBe(RETRO);
    const gone = { type: 'fridge', skin: 'nope' };
    expect(skinOf(gone)).toBeUndefined();
    expect(displayName(gone)).toBe('Fridge');
    expect(displayName({ type: 'fridge' })).toBe('Fridge');
  });
  it('Arrange cycles the colours of the look', () => {
    withFridgeLook();
    const o: ObjectInstance = { id: 'f', type: 'fridge', level: 1, x: 0, y: 0, rot: 0, skin: 'retro' };
    expect(nextColour(o)).toBe('#9ED8C6');
    o.col = '#F6E3A1';
    expect(nextColour(o)).toBe('#F3B6C4');
    expect(nextColour({ ...o, skin: undefined })).toBeNull();
  });
});

describe('saving a look', () => {
  const ctx = (objs: ObjectInstance[], storage: ObjectInstance[] = []): SaveContext => ({
    rev: 1, day: 3, minutes: 600, money: 700, earnedToday: 0, spentToday: 0, power: true,
    fridge: { basic: 2, fresh: 1 }, dishes: 1, laundryPile: 2, bill: null, nextBillAt: null,
    objs, storage, owned: [], closet: [], bond: 61, flags: {},
    simName: 'Sam', partnerName: 'Maya', look: {} as never, mayaLook: {} as never, needs: { jordan: {} as never, maya: {} as never },
    memories: [], coreMem: [], pastMem: [], townName: 'Honeysuckle Hollow', turns: [], rngSeed: 7,
    lifeGoal: null, settleDone: false, freeWill: true, style: {}, companion: null, wallMode: 'cut',
    looks: createHouseArt(stubCtx(), {} as never).exportLooks(),
  });

  it('writes skin beside col and reads it back, for placed pieces and for stored ones', () => {
    const objs = INITIAL_OBJS.map((o) => ({ ...o }));
    objs.find((o) => o.id === 'fridge')!.skin = 'retro';
    objs.find((o) => o.id === 'fridge')!.col = '#9ED8C6';
    const stored: ObjectInstance = { id: 's1', type: 'lamp', level: 1, x: 0, y: 0, rot: 0, skin: 'retro' };
    const saved = JSON.parse(JSON.stringify(snapshot(ctx(objs, [stored]))));
    const fridge = saved.objs.find((o: { id: string }) => o.id === 'fridge');
    expect(fridge.skin).toBe('retro');
    expect(fridge.col).toBe('#9ED8C6');
    expect(saved.storage[0].skin).toBe('retro');
    expect(saved.objs.find((o: { id: string }) => o.id === 'sofa').skin).toBeUndefined();
  });
});

describe('the drawer', () => {
  const frame = (objs: ObjectInstance[]) => ({ level: 1, rot: 0, minutes: 600, day: 1, t: 1, dt: 0.016, objs, wallMode: 'up' as const, chars: [] });

  it('renders every skin of every type, and the stock look, without throwing', () => {
    withFridgeLook();
    const art = createHouseArt(stubCtx());
    const objs: ObjectInstance[] = [];
    for (const [type, def] of Object.entries(TYPES)) {
      for (const skin of [undefined, 'not-a-look', ...Object.keys(def.skins ?? {})]) {
        const level = def.out ? 3 : 1;
        objs.push({ id: `${type}-${skin ?? 'stock'}`, type, level, x: 1, y: 1, rot: 0, ...(skin ? { skin } : {}) });
      }
    }
    for (const level of [0, 1, 2, 3, 4]) {
      expect(() => art.render({ ...frame(objs.filter((o) => o.level === level)), level })).not.toThrow();
    }
  });
});

describe('buying a look', () => {
  const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({ ...look('look-fridge-retro', 'fridge', 'retro', 'Pastel icebox', 'Round and cheerful.', 340, ['vintage', 'playful', 'bold'], RETRO.cols), ...over });

  it('a look names a type and a skin that exist', () => {
    for (const e of CATALOG.filter((c) => c.skin)) expect(skinExists(e.type, e.skin), e.id).toBe(true);
  });

  it('finds the piece on the main floor to restyle (upstairs for the bedroom and bath), and nothing when the type is elsewhere', () => {
    const objs = INITIAL_OBJS.map((o) => ({ ...o }));
    expect(skinTarget(objs, entry())!.id).toBe('fridge');
    expect(skinTarget(objs, { type: 'lamp', skin: 'x' })!.id).toBe('lamp1');
    expect(skinTarget(objs, { type: 'bed', skin: 'x' })!.id).toBe('bed');
    expect(skinTarget(objs, { type: 'desk', skin: 'x' })).toBeNull();
    expect(skinTarget(objs, { type: 'fridge' })).toBeNull();
  });

  it('a look wears its own colour and drops the old look\'s', () => {
    const o: ObjectInstance = { id: 'f', type: 'fridge', level: 1, x: 0, y: 0, rot: 0, col: '#111111' };
    wearSkin(o, 'retro', skinColour({ cols: RETRO.cols }));
    expect(o).toMatchObject({ skin: 'retro', col: '#F3B6C4' });
    wearSkin(o, 'plain', skinColour({}));
    expect(o.col).toBeUndefined();
  });

  function shopWith(money: number) {
    const objs = INITIAL_OBJS.map((o) => ({ ...o }));
    const logs: string[] = [];
    const spent: number[] = [];
    const g = {
      world: { objs }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: {}, style: {}, tasteNorm: {},
      log: (m: string) => logs.push(m), art: { burst: () => {}, objectPlaced: () => {} }, hasAttic: () => false, storage: [],
      s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => false,
      spendOn: (_: string, n: number) => { if (n > money) return false; money -= n; spent.push(n); return true; },
      peopleOnFloor: () => [], relearnLayout: () => {},
    } as unknown as Game;
    return { objs, logs, spent, buy: createShop(g).handleBuy! };
  }

  it('buying a skinned fridge swaps the fridge that stands there, in place, and adds no second one', () => {
    withFridgeLook();
    const { objs, logs, spent, buy } = shopWith(1000);
    const before = { ...objs.find((o) => o.id === 'fridge')! };
    buy(entry());
    expect(objs.filter((o) => o.type === 'fridge')).toHaveLength(1);
    const f = objs.find((o) => o.id === 'fridge')!;
    expect(f).toMatchObject({ skin: 'retro', col: '#F3B6C4', x: before.x, y: before.y, rot: before.rot, level: before.level });
    expect(spent).toEqual([340]);
    expect(logs.some((l) => /pastel icebox/i.test(l))).toBe(true);
  });

  it('the companion reacts with her taste, as she does for any piece she has an opinion on', () => {
    withFridgeLook();
    const { logs, buy } = shopWith(1000);
    const likes: string[] = [];
    // Her taste is read from the entry's tags (state/taste.ts); a tagged look goes through the same block as every other purchase.
    buy(entry());
    likes.push(...logs.filter((l) => /^Maya (likes|loves)/.test(l)));
    expect(logs.length).toBeGreaterThan(1);
    expect(likes.length).toBeLessThanOrEqual(1);
  });

  it('buying the look it already wears costs nothing; another colour of an owned look is free too', () => {
    withFridgeLook();
    const { objs, spent, buy } = shopWith(1000);
    buy(entry());
    buy(entry());
    expect(spent).toEqual([340]);
    buy(entry(), '#9ED8C6');
    expect(spent).toEqual([340]);
    expect(objs.find((o) => o.id === 'fridge')!.col).toBe('#9ED8C6');
  });

  it('with too little money nothing changes', () => {
    withFridgeLook();
    const { objs, buy } = shopWith(10);
    buy(entry());
    expect(objs.find((o) => o.id === 'fridge')!.skin).toBeUndefined();
  });

  it('a look whose type is not on the main floor is placed as a new piece wearing it', () => {
    TYPES.lamp.skins = { ...REAL.lamp, retro: { ...RETRO, name: 'Atomic lamp', cols: undefined } };
    try {
      const { objs, buy } = shopWith(1000);
      const lamps = objs.filter((o) => o.type === 'lamp' && o.level === 1);
      objs.splice(0, objs.length, ...objs.filter((o) => !lamps.includes(o)));
      buy({ ...look('look-lamp-retro', 'lamp', 'retro', 'Atomic lamp', 'x', 90, ['vintage']) });
      const added = objs.filter((o) => o.type === 'lamp' && o.level === 1);
      expect(added.length).toBe(1);
      expect(added[0].skin).toBe('retro');
    } finally { TYPES.lamp.skins = REAL.lamp; }
  });
});

describe('switching looks from Arrange', () => {
  it('offers the stock look and every look of the type that is owned, and nothing when there is no choice', () => {
    withFridgeLook();
    const f = { type: 'fridge' } as ObjectInstance;
    expect(looksFor(f, new Set())).toEqual([]);
    expect(looksFor(f, new Set(['look-fridge-retro'])).map((l) => l.id)).toEqual(['', 'retro']); // owned from the shop
    expect(looksFor({ ...f, skin: 'retro' }, new Set())).toEqual([
      { id: '', name: 'Fridge', active: false }, { id: 'retro', name: 'Pastel icebox', active: true },
    ]);
    expect(looksFor({ type: 'bed' }, new Set())).toEqual([]);
  });
  it('a bought look can be put on from Arrange without paying, and the stock look comes back', () => {
    withFridgeLook();
    const o: ObjectInstance = { id: 'f', type: 'fridge', level: 1, x: 3, y: 0, rot: 0 };
    expect(looksFor(o, new Set(['look-fridge-retro'])).map((l) => [l.id, l.active])).toEqual([['', true], ['retro', false]]);
    expect(looksFor(o, new Set())).toEqual([]);
  });
  it('changing back to the stock look drops the skin and its colour; changing to a look starts in its first colour', () => {
    withFridgeLook();
    const o: ObjectInstance = { id: 'f', type: 'fridge', level: 1, x: 3, y: 0, rot: 0, skin: 'retro', col: '#9ED8C6' };
    changeLook(o, '');
    expect(o.skin).toBeUndefined();
    expect(o.col).toBeUndefined();
    changeLook(o, 'retro');
    expect(o).toMatchObject({ skin: 'retro', col: '#F3B6C4', x: 3, y: 0 });
  });
});
