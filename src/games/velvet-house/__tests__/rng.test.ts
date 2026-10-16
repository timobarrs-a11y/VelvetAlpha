import { describe, it, expect } from 'vitest';
import { RNG, setGlobalRNG, rand } from '../state/rng';

describe('RNG', () => {
  it('produces deterministic values for the same seed', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    const aVals = Array.from({ length: 10 }, () => a.next());
    const bVals = Array.from({ length: 10 }, () => b.next());
    expect(aVals).toEqual(bVals);
  });

  it('produces different values for different seeds', () => {
    const a = new RNG(1);
    const b = new RNG(2);
    const aVals = Array.from({ length: 10 }, () => a.next());
    const bVals = Array.from({ length: 10 }, () => b.next());
    expect(aVals).not.toEqual(bVals);
  });

  it('returns values in [0, 1)', () => {
    const rng = new RNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range returns values within [min, max)', () => {
    const rng = new RNG(999);
    for (let i = 0; i < 500; i++) {
      const v = rng.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('int returns values within [min, max]', () => {
    const rng = new RNG(7);
    for (let i = 0; i < 500; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });

  it('pick returns an element from the array', () => {
    const rng = new RNG(50);
    const arr = ['a', 'b', 'c', 'd'];
    const picked = rng.pick(arr);
    expect(arr).toContain(picked);
  });

  it('shuffle preserves elements', () => {
    const rng = new RNG(33);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.sort()).toEqual(arr);
  });

  it('chance with 0 always returns false, with 1 always true', () => {
    const rng = new RNG(100);
    for (let i = 0; i < 100; i++) expect(rng.chance(0)).toBe(false);
    for (let i = 0; i < 100; i++) expect(rng.chance(1)).toBe(true);
  });

  it('reseed resets the sequence', () => {
    const rng = new RNG(10);
    const first = Array.from({ length: 5 }, () => rng.next());
    rng.reseed(10);
    const second = Array.from({ length: 5 }, () => rng.next());
    expect(first).toEqual(second);
  });

  it('global RNG is injectable', () => {
    const seeded = new RNG(42);
    setGlobalRNG(seeded);
    const v1 = rand();
    seeded.reseed(42);
    const v2 = rand();
    expect(v1).toBe(v2);
  });
});
