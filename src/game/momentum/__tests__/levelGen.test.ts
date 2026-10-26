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

describe('designed sections', () => {
  const mainPath = (platforms: ReturnType<typeof generateLevel>['platforms']) =>
    platforms.filter(p => !p.isFar).sort((a, b) => b.y - a.y);

  it('every main-path jump is reachable in one bounce', () => {
    for (const width of [800, 480]) {
      for (let level = 1; level <= 10; level++) {
        for (let seed = 1; seed <= 20; seed++) {
          const path = mainPath(generateLevel(level, palette, createRng(seed), width).platforms);
          for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1];
            const next = path[i];
            const gap = prev.y - next.y;
            expect(gap).toBeLessThanOrEqual(prev.type === 'spring' ? 160 : 110);
            // Horizontal reach: closest edges (allowing for each platform's sweep) within ~1 bounce of travel
            const prevMin = prev.minX, prevMax = prev.maxX + prev.width;
            const nextMin = next.minX, nextMax = next.maxX + next.width;
            const edgeGap = Math.max(0, nextMin - prevMax, prevMin - nextMax);
            expect(edgeGap).toBeLessThan(260);
          }
        }
      }
    }
  });

  it('uses a mix of sections and rests after hard ones', () => {
    const labels = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      generateLevel(6, palette, createRng(seed)).platforms.forEach(p => p.sectionLabel && labels.add(p.sectionLabel));
    }
    expect(labels.size).toBeGreaterThanOrEqual(4);
    expect(labels.has('PHASE GAUNTLET')).toBe(true);
    const early = generateLevel(1, palette, createRng(1)).platforms;
    expect(early.some(p => p.sectionLabel === 'PHASE GAUNTLET' || p.sectionLabel === 'CONVEYOR RUN')).toBe(false);
  });
});
