import { describe, it, expect } from 'vitest';
import {
  bounceVelocity,
  boostVelocity,
  nextChain,
  perfectBounceVelocity,
  BOOST_FLOOR_VY,
  MAX_CHAIN,
  MAX_RISE_VY,
  CHAIN_WINDOW_FRAMES,
} from '../physics';

describe('momentum physics', () => {
  it('bounce grows with chain and caps', () => {
    expect(bounceVelocity(1, 3, false)).toBeLessThan(bounceVelocity(1, 0, false));
    expect(bounceVelocity(1, 99, false)).toBe(bounceVelocity(1, MAX_CHAIN, false));
    expect(bounceVelocity(1, MAX_CHAIN, false)).toBeGreaterThanOrEqual(MAX_RISE_VY);
  });

  it('boost is consistent regardless of fall speed', () => {
    expect(boostVelocity(18)).toBe(BOOST_FLOOR_VY);
    expect(boostVelocity(0)).toBe(BOOST_FLOOR_VY);
  });

  it('boost still helps when already rising fast, up to the cap', () => {
    expect(boostVelocity(-14)).toBe(-17);
    expect(boostVelocity(-23)).toBe(MAX_RISE_VY);
  });

  it('perfect bounce beats a normal bounce', () => {
    expect(perfectBounceVelocity(1, 0, false)).toBeLessThan(bounceVelocity(1, 0, false));
  });

  it('chain climbs, holds, and resets', () => {
    expect(nextChain(2, 400, 480, 40)).toBe(3);
    expect(nextChain(2, 480, 480, 40)).toBe(2);
    expect(nextChain(2, 560, 480, 40)).toBe(0);
    expect(nextChain(2, 400, 480, CHAIN_WINDOW_FRAMES + 1)).toBe(0);
    expect(nextChain(0, 400, null, 0)).toBe(0);
  });
});
