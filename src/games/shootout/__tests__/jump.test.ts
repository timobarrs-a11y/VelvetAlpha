import { describe, expect, it } from 'vitest';
import { JUMP, jumpAfter, jumpAt, jumpSettles, takeoffAt } from '../jump';

describe('jump shot motion', () => {
  const rise = 0.6;

  it('flies under real gravity: a longer rise loads longer, the flight stays the same', () => {
    const air = Math.sqrt((2 * (JUMP.height + JUMP.dip)) / JUMP.g);
    // Every level's rise, Legend (0.55s) to Rookie (0.78s).
    expect(0.78 - takeoffAt(0.78)).toBeCloseTo(air, 6);
    expect(0.55 - takeoffAt(0.55)).toBeCloseTo(air, 6);
    expect(takeoffAt(0.78)).toBeGreaterThan(takeoffAt(0.55));
    // Too short for real gravity: the dip keeps its minimum and the flight speeds up.
    expect(takeoffAt(0.3)).toBe(JUMP.minDip);
    expect(jumpAt(0.3, 0.3).y).toBeCloseTo(JUMP.height, 6);
  });

  it('dips first, then leaves the floor', () => {
    const td = takeoffAt(rise);
    expect(jumpAt(td / 2, rise).y).toBeLessThan(0);
    expect(jumpAt(td, rise).y).toBeCloseTo(-JUMP.dip, 6);
    expect(jumpAt(td + 0.05, rise).vy).toBeGreaterThan(2);
  });

  it('reaches the top exactly at `rise`, where it hangs', () => {
    const top = jumpAt(rise, rise);
    expect(top.y).toBeCloseTo(JUMP.height, 6);
    expect(Math.abs(top.vy)).toBeLessThan(1e-9);
    // Holding on past the top: you're coming down.
    expect(jumpAt(rise * 1.3, rise).y).toBeLessThan(JUMP.height);
  });

  it('rises fast and slows near the top (no linear lift)', () => {
    const td = takeoffAt(rise), span = rise - td;
    const firstHalf = jumpAt(td + span / 2, rise).y - jumpAt(td, rise).y;
    const secondHalf = jumpAt(rise, rise).y - jumpAt(td + span / 2, rise).y;
    expect(firstHalf).toBeGreaterThan(secondHalf * 2.5);
  });

  it('lands in time for the next catch (0.65s after release)', () => {
    for (const r of [0.55, 0.78]) expect(jumpSettles(jumpAt(r, r), r)).toBeLessThan(0.65);
  });

  it('carries on from the release without a jump, lands, gives at the knees and settles', () => {
    const from = jumpAt(rise * 0.95, rise);
    expect(jumpAfter(from, rise, 0)).toBeCloseTo(from.y, 6);
    expect(Math.abs(jumpAfter(from, rise, 1 / 60) - from.y)).toBeLessThan(0.05);
    const settle = jumpSettles(from, rise);
    const landing = settle - JUMP.landTime;
    expect(jumpAfter(from, rise, landing + JUMP.landTime / 2)).toBeCloseTo(-JUMP.land, 6);
    expect(jumpAfter(from, rise, settle + 0.01)).toBe(0);
  });

  it('straightens up if you let go mid-dip', () => {
    const from = jumpAt(rise * 0.1, rise);
    expect(jumpAfter(from, rise, 0.25)).toBe(0);
  });
});
