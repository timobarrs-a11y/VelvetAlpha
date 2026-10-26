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

describe('combo and career timing', () => {
  it('combo multiplier grows and caps', async () => {
    const { comboMultiplier } = await import('../physics');
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(100)).toBe(comboMultiplier(20));
  });

  it('climb breaks on falling or stalling, not on climbing', async () => {
    const { climbBroken, CHAIN_WINDOW_FRAMES } = await import('../physics');
    expect(climbBroken(400, 480, 30)).toBe(false);
    expect(climbBroken(480, 480, 30)).toBe(false);
    expect(climbBroken(560, 480, 30)).toBe(true);
    expect(climbBroken(400, 480, CHAIN_WINDOW_FRAMES + 1)).toBe(true);
    expect(climbBroken(400, null, 9999)).toBe(false);
  });

  it('career time limits scale with level length and keep tiers ordered', async () => {
    const { careerLevels } = await import('../config');
    for (const l of careerLevels) {
      expect(l.threeStarTime).toBeLessThan(l.twoStarTime);
      expect(l.twoStarTime).toBeLessThan(l.timeLimit);
    }
    expect(careerLevels[9].timeLimit).toBeGreaterThan(careerLevels[0].timeLimit);
  });
});

describe('overdrive and music', () => {
  it('magnet pulls toward a nearby platform and ignores far ones', async () => {
    const { magnetVx } = await import('../physics');
    expect(magnetVx(0, 100, 160)).toBeGreaterThan(0);
    expect(magnetVx(0, 200, 140)).toBeLessThan(0);
    expect(magnetVx(1, 100, 500)).toBe(1);
  });

  it('music intensity follows momentum and peaks in overdrive', async () => {
    const { musicIntensity } = await import('../music');
    expect(musicIntensity(0, false)).toBe(0);
    expect(musicIntensity(2, false)).toBe(1);
    expect(musicIntensity(4, false)).toBe(2);
    expect(musicIntensity(6, false)).toBe(3);
    expect(musicIntensity(0, true)).toBe(4);
  });
});
