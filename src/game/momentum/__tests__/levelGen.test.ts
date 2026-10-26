import { describe, it, expect } from 'vitest';
import { createRng, generateLevel, generateChunk, createEndlessState, seedFromString, isPhaseSolid, lavaSpeed, endlessDifficulty } from '../levelGen';
import { ghostPositionAt } from '../ghost';

const palette = { platforms: ['#f00', '#0f0'], glows: ['#f00', '#0f0'], checkpoint: '#fff', checkpointGlow: '#fff' };

describe('momentum level generation', () => {
  it('is deterministic for the same seed', () => {
    const a = generateLevel(5, palette, createRng(seedFromString('daily-2026-10-26')));
    const b = generateLevel(5, palette, createRng(seedFromString('daily-2026-10-26')));
    expect(a.platforms.map(p => [p.x, p.y, p.type])).toEqual(b.platforms.map(p => [p.x, p.y, p.type]));
    expect(a.orbs).toEqual(b.orbs);
  });

  it('differs between seeds', () => {
    const a = generateLevel(5, palette, createRng(1));
    const b = generateLevel(5, palette, createRng(2));
    expect(a.platforms.map(p => p.x)).not.toEqual(b.platforms.map(p => p.x));
  });

  it('introduces the new platform types at higher difficulty', () => {
    const { platforms } = generateLevel(8, palette, createRng(7));
    const types = new Set(platforms.map(p => p.type));
    expect(types.has('conveyor')).toBe(true);
    expect(types.has('phase')).toBe(true);
    expect(platforms[0].type).toBe('normal');
  });

  it('endless chunks keep stacking upward with unique ids', () => {
    const state = createEndlessState();
    const rng = createRng(3);
    const first = generateChunk(state, 30, 1, palette, rng, Number.MAX_SAFE_INTEGER);
    const top = state.y;
    const second = generateChunk(state, 30, 2, palette, rng, Number.MAX_SAFE_INTEGER);
    expect(Math.max(...second.platforms.map(p => p.y))).toBeLessThan(top + 1);
    const ids = [...first.platforms, ...second.platforms].map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...first.platforms, ...second.platforms].some(p => p.isCheckpoint)).toBe(false);
  });

  it('phase platforms cycle and lava/difficulty ramp', () => {
    const { platforms } = generateLevel(8, palette, createRng(7));
    const phase = platforms.find(p => p.type === 'phase')!;
    const solid = Array.from({ length: 180 }, (_, f) => isPhaseSolid(phase, f)).filter(Boolean).length;
    expect(solid).toBe(120);
    expect(lavaSpeed(60)).toBeGreaterThan(lavaSpeed(0));
    expect(endlessDifficulty(10000)).toBeGreaterThan(endlessDifficulty(0));
  });

  it('ghost playback reads sampled positions', () => {
    const ghost = { time: 1, path: [10, 20, 30, 40] };
    expect(ghostPositionAt(ghost, 0)).toEqual({ x: 10, y: 20 });
    expect(ghostPositionAt(ghost, 2)).toEqual({ x: 30, y: 40 });
    expect(ghostPositionAt(ghost, 4)).toBeNull();
  });
});
