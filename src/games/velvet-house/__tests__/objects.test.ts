import { describe, it, expect } from 'vitest';
import {
  TYPES,
  INITIAL_OBJS,
  footprint,
  isFixed,
  isRug,
  isWall,
  isOutdoor,
  isStoreItem,
  typeOf,
  storeItems,
  blocksOf,
  allSpots,
} from '../state/objects';

describe('object TYPES catalog', () => {
  it('has at least 80 types', () => {
    expect(Object.keys(TYPES).length).toBeGreaterThanOrEqual(80);
  });

  it('every type has W, D, h', () => {
    for (const [k, t] of Object.entries(TYPES)) {
      expect(t.W, `${k} needs W`).toBeGreaterThan(0);
      expect(t.D, `${k} needs D`).toBeGreaterThan(0);
      expect(t.h, `${k} needs h`).toBeGreaterThanOrEqual(0);
    }
  });

  it('sofa has 2 seat spots', () => {
    const s = TYPES.sofa.spots!;
    expect(Object.keys(s)).toHaveLength(2);
    expect(s.s1.tag).toBe('seat');
    expect(s.s2.tag).toBe('seat');
  });

  it('bed has bedA and bedB spots', () => {
    const s = TYPES.bed.spots!;
    expect(s.a.tag).toBe('bedA');
    expect(s.b.tag).toBe('bedB');
  });

  it('counter has 4 spots', () => {
    const s = TYPES.counter.spots!;
    expect(Object.keys(s)).toHaveLength(4);
    expect(s.sink.tag).toBe('sink');
    expect(s.stove.tag).toBe('stove');
    expect(s.coffee.tag).toBe('coffee');
    expect(s.window.tag).toBe('window');
  });

  it('dining has a light', () => {
    expect(TYPES.dining.light?.r).toBe(130);
  });

  it('fireplace light has warm color', () => {
    expect(TYPES.fireplace.light?.col).toBe('255,150,70');
  });

  it('rugrect has rug=true and empty blocks', () => {
    expect(isRug('rugrect')).toBe(true);
    expect(TYPES.rugrect.blocks).toEqual([]);
  });

  it('fixed types are fixed', () => {
    expect(isFixed('counter')).toBe(true);
    expect(isFixed('fridge')).toBe(true);
    expect(isFixed('sofa')).toBe(false);
  });

  it('wall types are wall', () => {
    expect(isWall('console')).toBe(true);
    expect(isWall('wardrobe')).toBe(true);
    expect(isWall('sofa')).toBe(false);
  });

  it('outdoor types', () => {
    expect(isOutdoor('hammock')).toBe(true);
    expect(isOutdoor('grill')).toBe(true);
    expect(isOutdoor('sofa')).toBe(false);
  });

  it('store items include armchair', () => {
    expect(isStoreItem('armchair')).toBe(true);
    expect(isStoreItem('counter')).toBe(false);
  });

  it('armchair has cols array', () => {
    expect(TYPES.armchair.cols?.length).toBeGreaterThan(3);
  });
});

describe('helpers', () => {
  it('footprint respects rotation', () => {
    const o = { id: 'x', type: 'sofa', level: 1, x: 0, y: 0, rot: 0 };
    expect(footprint(o)).toEqual([2.4, 1.0]);
    o.rot = 1;
    expect(footprint(o)).toEqual([1.0, 2.4]);
  });

  it('blocksOf returns default for type without blocks', () => {
    expect(blocksOf('sofa')).toEqual([[0, 0, 2.4, 1.0]]);
  });

  it('blocksOf returns custom blocks', () => {
    expect(blocksOf('gym')).toEqual([[1.1, 0.1, 1.45, 0.9]]);
  });

  it('blocksOf returns empty for rugs', () => {
    expect(blocksOf('rugrect')).toEqual([]);
  });

  it('typeOf returns definition', () => {
    expect(typeOf('sofa')?.name).toBe('Couch');
  });

  it('storeItems returns store types', () => {
    const items = storeItems();
    expect(items).toContain('armchair');
    expect(items).toContain('lamp');
    expect(items).not.toContain('counter');
  });

  it('allSpots returns spots', () => {
    const s = allSpots('bed');
    expect(s?.a.tag).toBe('bedA');
  });
});

describe('INITIAL_OBJS', () => {
  it('has ~31 initial objects', () => {
    expect(INITIAL_OBJS.length).toBeGreaterThanOrEqual(28);
    expect(INITIAL_OBJS.length).toBeLessThanOrEqual(35);
  });

  it('every object references a valid type', () => {
    for (const o of INITIAL_OBJS) {
      expect(TYPES[o.type], `obj ${o.id} has unknown type ${o.type}`).toBeDefined();
    }
  });

  it('garden starts with grow and wet', () => {
    const g = INITIAL_OBJS.find((o) => o.type === 'garden');
    expect(g?.grow).toBe(0.35);
    expect(g?.wet).toBe(0.6);
  });

  it('sofa is on level 1 with rot 2', () => {
    const s = INITIAL_OBJS.find((o) => o.type === 'sofa');
    expect(s?.level).toBe(1);
    expect(s?.rot).toBe(2);
  });
});
