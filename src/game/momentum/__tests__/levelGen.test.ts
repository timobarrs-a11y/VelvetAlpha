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
    platforms.filter(p => !p.isFar && !p.isBranch).sort((a, b) => b.y - a.y);

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

describe('boost economy and spread', () => {
  it('every level has boost ledges to seek out; drains start at difficulty 2', () => {
    for (let level = 1; level <= 10; level++) {
      const { platforms } = generateLevel(level, palette, createRng(level * 7));
      expect(platforms.filter(p => p.type === 'charge').length).toBeGreaterThanOrEqual(5);
      const drains = platforms.filter(p => p.type === 'drain').length;
      if (level === 1) expect(drains).toBe(0);
      else expect(drains).toBeGreaterThan(0);
    }
  });

  it('a drain on the main path always has a clean ledge beside it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { platforms } = generateLevel(6, palette, createRng(seed));
      for (const d of platforms.filter(p => p.type === 'drain' && !p.isBranch && !p.isFar)) {
        const alt = platforms.find(p => p.isBranch && p.type !== 'drain' && Math.abs(p.y - d.y) <= 12);
        expect(alt).toBeDefined();
      }
    }
  });

  it('ledges use the whole width, not just the middle', () => {
    const { platforms } = generateLevel(5, palette, createRng(11));
    const centres = platforms.map(p => (p.x + p.width / 2) / 800);
    expect(centres.filter(c => c < 0.25).length).toBeGreaterThan(platforms.length * 0.12);
    expect(centres.filter(c => c > 0.75).length).toBeGreaterThan(platforms.length * 0.12);
  });

  it('time attack budgets scale with height and difficulty', async () => {
    const { timeBudget } = await import('../physics');
    expect(timeBudget(2000, 1)).toBeGreaterThan(timeBudget(1000, 1));
    expect(timeBudget(2000, 10)).toBeLessThan(timeBudget(2000, 1));
  });
});

describe('reserved colours', () => {
  it('removes near-white from theme palettes', async () => {
    const { reserveBoostWhite, isNearWhite } = await import('../themes');
    const t = reserveBoostWhite({ platforms: ['#7df9ff', '#c77dff', '#f5f5ff'], glows: ['#1', '#2', '#3'] });
    expect(t.platforms).toEqual(['#7df9ff', '#c77dff']);
    expect(t.glows).toEqual(['#1', '#2']);
    expect(isNearWhite('#ffffff')).toBe(true);
    expect(isNearWhite('#ff3b3b')).toBe(false);
    expect(reserveBoostWhite({ platforms: ['#fff'], glows: ['#fff'] }).platforms).toEqual(['#8f9bff']);
  });
});
