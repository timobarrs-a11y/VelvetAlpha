import { describe, it, expect } from 'vitest';
import {
  MESS_AFTER, MAX_DIRT_PER_LEVEL, DIRT_GROWTH_RATE, DIRT_TICK_INTERVAL,
  SCRUB_THRESHOLD, DEEP_CLEAN_WINDOW, DEEP_CLEAN_LEVELS,
  messOf, messLabel, addDirt, dirtNear, growDirt, scrubProgress, deepCleaned,
  dirtSeed,
} from '../state/dirt';
import { RNG } from '../state/rng';
import type { DirtSpot, ScrubLogEntry } from '../state/dirt';

const idCounter = { id: 0 };

function makeRng(seed = 42): RNG {
  return new RNG(seed);
}

describe('dirt — constants', () => {
  it('MESS_AFTER has 8 activity mappings', () => {
    expect(Object.keys(MESS_AFTER).length).toBe(8);
    expect(MESS_AFTER.eat).toEqual(['crumbs', 0.45]);
    expect(MESS_AFTER.dance).toEqual(['scuff', 0.25]);
  });

  it('limits and thresholds match original', () => {
    expect(MAX_DIRT_PER_LEVEL).toBe(18);
    expect(DIRT_GROWTH_RATE).toBe(75);
    expect(DIRT_TICK_INTERVAL).toBe(15);
    expect(SCRUB_THRESHOLD).toBe(0.12);
    expect(DEEP_CLEAN_WINDOW).toBe(300);
    expect(DEEP_CLEAN_LEVELS).toBe(3);
  });
});

describe('dirt — messOf', () => {
  it('sums dirt alpha clamped at 1.4', () => {
    const dirt: DirtSpot[] = [
      { id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.5, max: 1, claim: null },
      { id: 2, level: 1, kind: 'floor', type: 'dust', a: 1.4, max: 1.4, claim: null },
      { id: 3, level: 0, kind: 'floor', type: 'mud', a: 0.3, max: 1, claim: null },
    ];
    expect(messOf(dirt)).toBe(0.5 + 1.4 + 0.3);
    expect(messOf(dirt, 1)).toBe(0.5 + 1.4);
    expect(messOf(dirt, 0)).toBe(0.3);
  });
});

describe('dirt — messLabel', () => {
  it('returns correct labels', () => {
    expect(messLabel(0)).toBe('Spotless');
    expect(messLabel(1.4)).toBe('Spotless');
    expect(messLabel(3)).toBe('Lived-in');
    expect(messLabel(8)).toBe('Messy');
    expect(messLabel(15)).toBe('Filthy');
  });
});

describe('dirt — addDirt', () => {
  it('creates floor dirt', () => {
    const dirt: DirtSpot[] = [];
    const ctr = { id: 0 };
    const d = addDirt(dirt, ctr, 1, 'floor', 'mud', 5, 3);
    expect(d).not.toBeNull();
    expect(d!.level).toBe(1);
    expect(d!.kind).toBe('floor');
    expect(d!.x).toBe(5);
    expect(d!.y).toBe(3);
    expect(d!.a).toBe(0);
    expect(dirt.length).toBe(1);
  });

  it('creates wall dirt with p, u, z', () => {
    const dirt: DirtSpot[] = [];
    const ctr = { id: 0 };
    const d = addDirt(dirt, ctr, 1, 'wall', 'grease', 2, 5, 1.1);
    expect(d).not.toBeNull();
    expect(d!.kind).toBe('wall');
    expect(d!.p).toBe('2');
    expect(d!.u).toBe(5);
    expect(d!.z).toBe(1.1);
  });

  it('returns null and boosts max when level is full', () => {
    const dirt: DirtSpot[] = [];
    const ctr = { id: 0 };
    for (let i = 0; i < MAX_DIRT_PER_LEVEL; i++) {
      addDirt(dirt, ctr, 0, 'floor', 'dust', i * 0.5, i * 0.3);
    }
    const before = dirt[0].max;
    const d = addDirt(dirt, ctr, 0, 'floor', 'mud', 1, 1);
    expect(d).toBeNull();
    expect(dirt[0].max).toBeGreaterThanOrEqual(before);
  });
});

describe('dirt — dirtNear', () => {
  it('returns null for level 3 (outdoor)', () => {
    const dirt: DirtSpot[] = [];
    const ctr = { id: 0 };
    const rng = makeRng();
    expect(dirtNear(dirt, ctr, rng, 3, 'mud', 1, 1, () => true)).toBeNull();
  });

  it('places dirt at a free position', () => {
    const dirt: DirtSpot[] = [];
    const ctr = { id: 0 };
    const rng = makeRng(100);
    const d = dirtNear(dirt, ctr, rng, 1, 'mud', 5, 5, () => true);
    expect(d).not.toBeNull();
    expect(d!.type).toBe('mud');
    expect(d!.kind).toBe('floor');
  });

  it('returns null when no free spot found', () => {
    const dirt: DirtSpot[] = [];
    const ctr = { id: 0 };
    const rng = makeRng();
    const d = dirtNear(dirt, ctr, rng, 1, 'mud', 5, 5, () => false);
    expect(d).toBeNull();
  });
});

describe('dirt — growDirt', () => {
  it('grows unclaimed dirt up to max', () => {
    const dirt: DirtSpot[] = [
      { id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.1, max: 1, claim: null },
    ];
    growDirt(dirt, 15);
    expect(dirt[0].a).toBeCloseTo(0.1 + 15 / 75, 5);
  });

  it('does not grow claimed dirt', () => {
    const claim = {};
    const dirt: DirtSpot[] = [
      { id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.1, max: 1, claim },
    ];
    growDirt(dirt, 15);
    expect(dirt[0].a).toBe(0.1);
  });

  it('clamps at max', () => {
    const dirt: DirtSpot[] = [
      { id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.9, max: 1, claim: null },
    ];
    growDirt(dirt, 100);
    expect(dirt[0].a).toBe(1);
  });
});

describe('dirt — scrubProgress', () => {
  it('decays dirt linearly', () => {
    expect(scrubProgress({ id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.8, max: 1, claim: null }, 0, 10)).toBe(0.8);
    expect(scrubProgress({ id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.8, max: 1, claim: null }, 5, 10)).toBeCloseTo(0.4, 5);
    expect(scrubProgress({ id: 1, level: 1, kind: 'floor', type: 'mud', a: 0.8, max: 1, claim: null }, 10, 10)).toBe(0);
  });
});

describe('dirt — deepCleaned', () => {
  it('returns true when jordan scrubbed 3 levels within window', () => {
    const jordan = {};
    const log: ScrubLogEntry[] = [
      { who: jordan, at: 100, level: 0 },
      { who: jordan, at: 200, level: 1 },
      { who: jordan, at: 300, level: 2 },
    ];
    expect(deepCleaned(log, jordan, 350)).toBe(true);
  });

  it('returns false when fewer than 3 levels', () => {
    const jordan = {};
    const log: ScrubLogEntry[] = [
      { who: jordan, at: 100, level: 0 },
      { who: jordan, at: 200, level: 1 },
    ];
    expect(deepCleaned(log, jordan, 250)).toBe(false);
  });

  it('returns false when entries are outside window', () => {
    const jordan = {};
    const log: ScrubLogEntry[] = [
      { who: jordan, at: 100, level: 0 },
      { who: jordan, at: 200, level: 1 },
      { who: jordan, at: 300, level: 2 },
    ];
    expect(deepCleaned(log, jordan, 500)).toBe(false);
  });
});

describe('dirt — dirtSeed', () => {
  it('produces deterministic sequence', () => {
    const r1 = dirtSeed(42);
    const r2 = dirtSeed(42);
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });

  it('produces values in [0, 1)', () => {
    const r = dirtSeed(99);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
