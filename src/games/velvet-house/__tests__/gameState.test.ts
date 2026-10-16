import { describe, it, expect } from 'vitest';
import { createInitialState } from '../state/gameState';

describe('gameState', () => {
  it('creates with default values', () => {
    const jordan = { level: 2, x: 0, y: 0, z: 0, look: {}, needs: {}, skills: {}, pose: 'stand', front: true, flip: 1, route: [], task: null, queue: [], idle: 1 } as any;
    const maya = { ...jordan } as any;
    const s = createInitialState(12345, jordan, maya);
    expect(s.rngSeed).toBe(12345);
    expect(s.day).toBe(0);
    expect(s.minutes).toBe(360);
    expect(s.money).toBe(250);
    expect(s.power).toBe(true);
    expect(s.bond).toBe(50);
    expect(s.fridge.fresh).toBe(4);
    expect(s.fridge.basic).toBe(8);
    expect(s.freeWill).toBe(true);
  });

  it('starts with empty arrays for mutable collections', () => {
    const s = createInitialState(1, {} as any, {} as any);
    expect(s.objs).toEqual([]);
    expect(s.dirt).toEqual([]);
    expect(s.pets).toEqual([]);
    expect(s.memories).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it('bill starts null, nextBillAt is day 3', () => {
    const s = createInitialState(1, {} as any, {} as any);
    expect(s.bill).toBeNull();
    expect(s.nextBillAt).toBe(3 * 1440 + 9 * 60);
  });
});
