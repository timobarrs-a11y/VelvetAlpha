import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { INITIAL_OBJS, TYPES, kindOf, modelsOf, footprint, type ObjectInstance } from '../state/objects';
import { CATALOG } from '../state/catalog';
import { swapModel, modelFits, fridgeUnder, checkPlacement } from '../state/arrange';
import { skinTarget, looksFor, parseLook, swapsInPlace } from '../state/skins';
import { createShop } from '../systems/shop';
import type { Game } from '../kernel/game';

// Models: other shapes of a piece (the chest freezer is the fridge's second). Each has its own size and spots and its
// own looks; the household, the shop and the story treat it as the piece it stands in for.

const house = () => INITIAL_OBJS.map((o) => ({ ...o }));
const fridgeOf = (objs: ObjectInstance[]) => objs.find((o) => o.id === 'fridge')!;
const entry = (id: string) => CATALOG.find((c) => c.id === id)!;

describe('a model of a piece', () => {
  it('is that kind of piece, and the kind lists its own type first', () => {
    expect(kindOf('chestfreezer')).toBe('fridge');
    expect(kindOf('fridge')).toBe('fridge');
    expect(kindOf('sofa')).toBe('sofa');
    expect(modelsOf('fridge')).toEqual(['fridge', 'chestfreezer']);
    expect(swapsInPlace('chestfreezer')).toBe(true);
    expect(kindOf('mediaconsole')).toBe('tvunit');
    expect(modelsOf('tvunit')).toEqual(['tvunit', 'mediaconsole']);
    expect(swapsInPlace('counter')).toBe(false);
  });

  it('has every spot its kind has, so the household finds it for the same things', () => {
    for (const [type, def] of Object.entries(TYPES)) {
      if (!def.kind) continue;
      const tags = (t: string) => new Set(Object.values(TYPES[t].spots ?? {}).map((s) => s.tag));
      for (const tag of tags(def.kind)) expect(tags(type).has(tag), `${type} has no ${tag} spot`).toBe(true);
      expect(!!def.fixed, `${type} is fixed like its kind`).toBe(!!TYPES[def.kind].fixed);
    }
  });

  it('is a different shape from its kind, or it would only be a look', () => {
    for (const [type, def] of Object.entries(TYPES)) {
      if (!def.kind) continue;
      const k = TYPES[def.kind];
      expect([def.W, def.D, def.h], type).not.toEqual([k.W, k.D, k.h]);
    }
  });

  it('the V2 models are sold in their own shape and in one reskin, each reskin a theme of its own or a pack\'s', () => {
    for (const type of ['chestfreezer', 'mediaconsole']) {
      expect(CATALOG.some((c) => c.id === `model-${type}` && c.type === type && !c.skin), type).toBe(true);
      const skins = Object.entries(TYPES[type].skins ?? {});
      expect(skins, type).toHaveLength(1);
      for (const [id, s] of skins) {
        expect(CATALOG.some((c) => c.type === type && c.skin === id), id).toBe(true);
        const others = Object.entries(TYPES).filter(([t]) => t !== type).flatMap(([, d]) => Object.values(d.skins ?? {}).map((x) => x.theme));
        // The credenza shares Mid-Century with the Mid-Century bedroom pack: the same style, so the same theme.
        if (!CATALOG.some((c) => c.id === `set-${s.theme}`)) expect(others, s.theme).not.toContain(s.theme);
      }
    }
  });
});

describe('swapping a model in place', () => {
  it('the chest freezer takes the fridge\'s place: same id, back against the same wall, and the way to it stays open', () => {
    const objs = house(), f = fridgeOf(objs), was = { x: f.x, y: f.y };
    expect(swapModel(objs, f, 'chestfreezer')).toBe(true);
    expect(f).toMatchObject({ id: 'fridge', type: 'chestfreezer', y: was.y, rot: 0 });
    expect(Math.abs(f.x - was.x)).toBeLessThanOrEqual(1.5);
    expect(checkPlacement(objs, f).ok).toBe(true);
    expect(objs.filter((o) => kindOf(o.type) === 'fridge' && o.level === 1)).toHaveLength(1);
    expect(swapModel(objs, f, 'fridge')).toBe(true);
    expect(f.type).toBe('fridge');
  });

  it('keeps the back edge for every turn of the piece', () => {
    for (const rot of [1, 2, 3]) {
      const f: ObjectInstance = { id: 'f', type: 'fridge', level: 1, x: 6, y: 4, rot };
      const [w, d] = footprint(f), back = rot === 1 ? f.x + w : rot === 2 ? f.y + d : f.x;
      expect(swapModel([f], f, 'chestfreezer'), `rot ${rot}`).toBe(true);
      const [w2, d2] = footprint(f);
      expect(rot === 1 ? f.x + w2 : rot === 2 ? f.y + d2 : f.x, `rot ${rot}`).toBeCloseTo(back);
    }
  });

  it('says no and changes nothing when the new size has nowhere to go, or the type is not a model of it', () => {
    const objs = house(), f = fridgeOf(objs);
    // Boxes either side of the fridge: the wider freezer cannot fit beside the counter or slide along the wall.
    objs.push({ id: 'b1', type: 'boxes', level: 1, x: f.x + 0.95, y: 0.12, rot: 0 });
    const was = { ...f };
    expect(modelFits(objs, f, 'chestfreezer')).toBe(false);
    expect(swapModel(objs, f, 'chestfreezer')).toBe(false);
    expect(f).toEqual(was);
    expect(swapModel(objs, f, 'sofa')).toBe(false);
    expect(f).toEqual(was);
  });

  it('groceries set on the chest freezer go into it, as on the fridge', () => {
    const objs = house(), f = fridgeOf(objs);
    swapModel(objs, f, 'chestfreezer');
    const food: ObjectInstance = { id: 'food', type: 'food', level: 1, x: f.x + 0.3, y: f.y + 0.2, rot: 0 };
    expect(fridgeUnder(objs, food)?.id).toBe('fridge');
  });
});

describe('buying a model', () => {
  function shopWith(money: number, objs = house()) {
    const logs: string[] = [];
    const spent: number[] = [];
    const g = {
      world: { objs }, partnerName: 'Maya', house: {}, view: { level: 1 }, owned: new Set<string>(), closet: [], flags: {}, style: {}, tasteNorm: {},
      log: (m: string) => logs.push(m), art: { burst: () => {}, objectPlaced: () => {} }, hasAttic: () => false, storage: [],
      s: { bond: 50 }, cameraBeat: () => {}, scriptEmit: () => {}, refreshDrawer: () => {}, dezDeliveries: () => true, orderDelivery: () => { throw new Error('a model is not delivered as a new piece'); },
      spendOn: (_: string, n: number) => { if (n > money) return false; money -= n; spent.push(n); return true; },
      peopleOnFloor: () => [], relearnLayout: () => {},
    } as unknown as Game;
    return { objs, logs, spent, owned: (g as unknown as { owned: Set<string> }).owned, buy: createShop(g).handleBuy! };
  }

  it('puts the chest freezer where the fridge was, in its look, and adds no second fridge', () => {
    const { objs, spent, owned, buy } = shopWith(2000);
    buy(entry('look-chestfreezer-camp'));
    const f = fridgeOf(objs);
    expect(f).toMatchObject({ type: 'chestfreezer', skin: 'camp', col: '#2F5D43' });
    expect(objs.filter((o) => kindOf(o.type) === 'fridge')).toHaveLength(1);
    expect(spent).toEqual([entry('look-chestfreezer-camp').price]);
    expect(owned.has('look-chestfreezer-camp')).toBe(true);
    // The stock chest freezer replaces a looked one in place too, and a fridge look brings the tall fridge back.
    buy(entry('model-chestfreezer'));
    expect(fridgeOf(objs)).toMatchObject({ type: 'chestfreezer' });
    expect(fridgeOf(objs).skin).toBeUndefined();
    buy(entry('look-fridge-retro'));
    expect(fridgeOf(objs)).toMatchObject({ type: 'fridge', skin: 'retro' });
  });

  it('when it will not fit, says so and takes no money', () => {
    const objs = house(), f = fridgeOf(objs);
    objs.push({ id: 'b1', type: 'boxes', level: 1, x: f.x + 0.95, y: 0.12, rot: 0 });
    const { logs, spent, buy } = shopWith(2000, objs);
    buy(entry('model-chestfreezer'));
    expect(spent).toEqual([]);
    expect(fridgeOf(objs).type).toBe('fridge');
    expect(logs.some((l) => /won't fit/.test(l))).toBe(true);
  });
});

describe('switching models from Arrange', () => {
  it('offers the other model once the player has it, and its id names the model', () => {
    const f = { type: 'fridge' } as ObjectInstance;
    expect(looksFor(f, new Set())).toEqual([]);
    expect(looksFor(f, new Set(['look-chestfreezer-camp'])).map((l) => l.id)).toEqual(['', 'chestfreezer:', 'chestfreezer:camp']);
    // On the chest freezer, the tall fridge is always there to go back to: the house came with it.
    const c = { type: 'chestfreezer', skin: 'camp' } as ObjectInstance;
    expect(looksFor(c, new Set(['look-chestfreezer-camp'])).map((l) => [l.id, l.active])).toEqual([['', false], ['camp', true], ['fridge:', false]]);
    expect(parseLook(f, 'chestfreezer:camp')).toEqual({ type: 'chestfreezer', skin: 'camp' });
    expect(parseLook(f, 'retro')).toEqual({ type: 'fridge', skin: 'retro' });
  });

  it('a look of one model targets whichever model stands there', () => {
    const objs = house();
    swapModel(objs, fridgeOf(objs), 'chestfreezer');
    expect(skinTarget(objs, entry('look-fridge-modern'))!.id).toBe('fridge');
  });
});

describe('the media console', () => {
  it('takes the TV unit\'s place under the screen, and tapping it still switches the TV', () => {
    const objs = house(), tv = objs.find((o) => o.id === 'tvunit')!;
    expect(swapModel(objs, tv, 'mediaconsole')).toBe(true);
    expect(tv).toMatchObject({ type: 'mediaconsole', y: 0.12 });
    expect(checkPlacement(objs, tv).ok).toBe(true);
  });
});

describe('drawing the V2 models', () => {
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

  it('draws every look, at every turn, before and after a tap, and says what the tap did', () => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const art = createHouseArt(ctx);
    for (const [type, said] of [['chestfreezer', /lid/], ['mediaconsole', /TV/]] as const) {
      for (const skin of [undefined, ...Object.keys(TYPES[type].skins ?? {})]) {
        for (const rot of [0, 1, 2, 3]) {
          const o: ObjectInstance = { id: `${type}-${skin}-${rot}`, type, level: 1, x: 3, y: 1, rot, ...(skin ? { skin } : {}) };
          // The console switches the TV standing on it.
          const tv: ObjectInstance = { id: `tv-${type}-${skin}-${rot}`, type: 'tvflat', level: 1, x: 3.4, y: 1.1, rot, on: o.id, z: 0.5 };
          const frame = { level: 1, rot: 0, minutes: 600, day: 1, t: 1, dt: 0.016, objs: [o, tv], wallMode: 'up' as const, chars: [] };
          expect(() => art.render(frame)).not.toThrow();
          expect(art.poke(o, '')).toMatch(said);
          expect(() => art.render(frame)).not.toThrow();
        }
      }
    }
  });
});
