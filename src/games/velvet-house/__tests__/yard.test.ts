import { describe, it, expect } from 'vitest';
import {
  YARD_W, YARD_D, SEASON_GROW, SEASON_DRY, SEASON_RAIN_CHANCE,
  WEED_THRESHOLD, LEAF_THRESHOLD,
  isPatio, tileAt, initYard, lawnStats, raining, rollRain,
  yardTick, mowPath, mowTile, rakeTargetTiles, weedTargetTiles, grassColor,
} from '../state/yard';
import { RNG } from '../state/rng';
import type { YardTile, YardState, SprinklerPos, GardenPlot } from '../state/yard';

function makeRng(seed = 42): RNG {
  return new RNG(seed);
}

function makeYard(): YardState {
  return initYard(makeRng(42));
}

describe('yard — constants', () => {
  it('grid is 10x8', () => {
    expect(YARD_W).toBe(10);
    expect(YARD_D).toBe(8);
  });

  it('season grow rates match', () => {
    expect(SEASON_GROW).toEqual([1.3, 1.15, 0.6, 0]);
  });

  it('season dry rates match', () => {
    expect(SEASON_DRY).toEqual([1, 1.5, 0.8, 0.3]);
  });

  it('rain chances match', () => {
    expect(SEASON_RAIN_CHANCE).toEqual([0.3, 0.15, 0.22, 0.32]);
  });
});

describe('yard — isPatio', () => {
  it('identifies patio tiles correctly', () => {
    expect(isPatio(0, 2)).toBe(true);
    expect(isPatio(2, 4)).toBe(true);
    expect(isPatio(1, 3)).toBe(true);
    expect(isPatio(3, 2)).toBe(false);
    expect(isPatio(0, 1)).toBe(false);
    expect(isPatio(0, 5)).toBe(false);
  });
});

describe('yard — tileAt', () => {
  it('returns tile at position', () => {
    const yard = makeYard();
    const t = tileAt(yard.tiles, 3.5, 2.5);
    expect(t).not.toBeNull();
    expect(t!.i).toBe(3);
    expect(t!.j).toBe(2);
  });

  it('clamps out of bounds', () => {
    const yard = makeYard();
    const t = tileAt(yard.tiles, -1, 100);
    expect(t).not.toBeNull();
    expect(t!.i).toBe(0);
    expect(t!.j).toBe(7);
  });
});

describe('yard — initYard', () => {
  it('creates 80 tiles with valid initial values', () => {
    const yard = makeYard();
    expect(yard.tiles.length).toBe(80);
    for (const t of yard.tiles) {
      expect(t.len).toBeGreaterThanOrEqual(0.3);
      expect(t.len).toBeLessThanOrEqual(0.45);
      expect(t.water).toBeGreaterThanOrEqual(0.6);
      expect(t.water).toBeLessThanOrEqual(0.8);
      expect(t.weed).toBe(0);
      expect(t.burn).toBe(0);
      expect(t.leaves).toBe(0);
      expect(t.snow).toBe(0);
      expect(t.mowedAt).toBe(-9999);
    }
  });
});

describe('yard — lawnStats', () => {
  it('returns Lush for well-watered short grass', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.len = 0.3; t.water = 0.7; t.weed = 0; t.leaves = 0; t.snow = 0; });
    const s = lawnStats(yard.tiles, 1);
    expect(s.label).toBe('Lush');
  });

  it('returns Overgrown for long grass', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.len = 0.8; t.water = 0.7; t.weed = 0; t.leaves = 0; t.snow = 0; });
    const s = lawnStats(yard.tiles, 1);
    expect(s.label).toBe('Overgrown');
  });

  it('returns Weedy for many weeds', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.len = 0.3; t.water = 0.7; t.weed = 0.5; t.leaves = 0; t.snow = 0; });
    const s = lawnStats(yard.tiles, 1);
    expect(s.weeds).toBeGreaterThan(0);
    expect(s.label).toBe('Weedy');
  });

  it('returns Dry for low water', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.len = 0.3; t.water = 0.1; t.weed = 0; t.leaves = 0; t.snow = 0; });
    const s = lawnStats(yard.tiles, 1);
    expect(s.label).toBe('Dry');
  });

  it('returns Under snow for high snow', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.snow = 0.6; });
    const s = lawnStats(yard.tiles, 3);
    expect(s.label).toBe('Under snow');
  });

  it('returns Dormant in winter with no snow', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.snow = 0; });
    const s = lawnStats(yard.tiles, 3);
    expect(s.label).toBe('Dormant');
  });

  it('returns Covered in leaves in fall', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.leaves = 0.5; t.snow = 0; });
    const s = lawnStats(yard.tiles, 2);
    expect(s.label).toBe('Covered in leaves');
  });

  it('excludes patio tiles from stats', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => {
      if (isPatio(t.i, t.j)) t.len = 1;
      else t.len = 0.3;
    });
    const s = lawnStats(yard.tiles, 1);
    expect(s.len).toBeLessThan(0.35);
  });
});

describe('yard — raining', () => {
  it('returns true when within rain window', () => {
    const yard: YardState = { tiles: [], rainAt: 100, rainUntil: 200, rainCheck: 0, rainLogged: false };
    expect(raining(yard, 150)).toBe(true);
  });

  it('returns false outside rain window', () => {
    const yard: YardState = { tiles: [], rainAt: 100, rainUntil: 200, rainCheck: 0, rainLogged: false };
    expect(raining(yard, 50)).toBe(false);
    expect(raining(yard, 250)).toBe(false);
  });
});

describe('yard — rollRain', () => {
  it('sets rain parameters when random hits', () => {
    const yard: YardState = { tiles: [], rainAt: 0, rainUntil: 0, rainCheck: -1, rainLogged: false };
    const rng = makeRng(1);
    rollRain(yard, rng, 0, 1000);
    if (yard.rainAt > 0) {
      expect(yard.rainAt).toBeGreaterThan(1000);
      expect(yard.rainUntil).toBeGreaterThan(yard.rainAt);
      expect(yard.rainLogged).toBe(false);
    }
  });

  it('sets rainCheck to current day', () => {
    const yard: YardState = { tiles: [], rainAt: 0, rainUntil: 0, rainCheck: -1, rainLogged: false };
    rollRain(yard, makeRng(1), 0, 2880);
    expect(yard.rainCheck).toBe(2);
  });
});

describe('yard — yardTick', () => {
  it('grows grass in spring', () => {
    const yard = makeYard();
    const tile = yard.tiles.find(t => !isPatio(t.i, t.j))!;
    const before = tile.len;
    yardTick(yard, 1440, 100, 0, makeRng(5), null, [], []);
    expect(tile.len).toBeGreaterThan(before);
  });

  it('does not grow grass in winter', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.len = 0.3; });
    yardTick(yard, 1440, 100, 3, makeRng(5), null, [], []);
    const tile = yard.tiles.find(t => !isPatio(t.i, t.j))!;
    expect(tile.len).toBeCloseTo(0.3, 5);
  });

  it('waters tiles with active sprinkler', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.water = 0.1; });
    const sp: SprinklerPos[] = [{ x: 5, y: 4, runUntil: 200 }];
    yardTick(yard, 60, 100, 1, makeRng(5), null, sp, []);
    const nearTile = tileAt(yard.tiles, 5, 4);
    expect(nearTile!.water).toBeGreaterThan(0.1);
  });

  it('grows garden plots when wet', () => {
    const yard = makeYard();
    const g: GardenPlot[] = [{ x: 5, y: 4, wet: 1, grow: 0 }];
    yardTick(yard, 1440, 100, 1, makeRng(5), null, [], g);
    expect(g[0].grow).toBeGreaterThan(0);
  });

  it('does not grow garden in winter', () => {
    const yard = makeYard();
    const g: GardenPlot[] = [{ x: 5, y: 4, wet: 1, grow: 0 }];
    yardTick(yard, 1440, 100, 3, makeRng(5), null, [], g);
    expect(g[0].grow).toBe(0);
  });

  it('accumulates leaves in fall near tree', () => {
    const yard = makeYard();
    yard.tiles.forEach(t => { t.leaves = 0; });
    yardTick(yard, 1440, 100, 2, makeRng(5), [8, 1], [], []);
    const nearTree = yard.tiles.find(t => t.i === 8 && t.j === 1);
    expect(nearTree!.leaves).toBeGreaterThan(0);
  });
});

describe('yard — mowPath', () => {
  it('generates boustrophedon path excluding patio', () => {
    const path = mowPath(() => true);
    expect(path.length).toBeGreaterThan(0);
    for (const [x, y] of path) {
      const i = Math.floor(x), j = Math.floor(y);
      expect(isPatio(i, j)).toBe(false);
    }
  });

  it('returns empty when all tiles blocked', () => {
    const path = mowPath(() => false);
    expect(path.length).toBe(0);
  });
});

describe('yard — mowTile', () => {
  it('sets grass short and records time', () => {
    const t: YardTile = { i: 5, j: 3, len: 0.8, water: 0.6, weed: 0.5, seed: 0.5, burn: 0, mowedAt: -9999, leaves: 0, snow: 0 };
    mowTile(t, 500);
    expect(t.len).toBe(0.06);
    expect(t.mowedAt).toBe(500);
    expect(t.weed).toBeLessThanOrEqual(0.3);
  });
});

describe('yard — rakeTargetTiles', () => {
  it('returns leafiest tile nearest to character', () => {
    const yard = makeYard();
    yard.tiles[0].leaves = 0.6;
    yard.tiles[40].leaves = 0.7;
    const t = rakeTargetTiles(yard.tiles, 5, 4);
    expect(t).not.toBeNull();
    expect(t!.leaves).toBeGreaterThan(LEAF_THRESHOLD);
  });

  it('returns null when no leafy tiles', () => {
    const yard = makeYard();
    expect(rakeTargetTiles(yard.tiles, 5, 4)).toBeNull();
  });
});

describe('yard — weedTargetTiles', () => {
  it('returns weedy tile nearest to character', () => {
    const yard = makeYard();
    yard.tiles[0].weed = 0.5;
    yard.tiles[40].weed = 0.6;
    const t = weedTargetTiles(yard.tiles, 5, 4, 3);
    expect(t).not.toBeNull();
    expect(t!.weed).toBeGreaterThan(WEED_THRESHOLD);
  });

  it('returns null when no weedy tiles', () => {
    const yard = makeYard();
    expect(weedTargetTiles(yard.tiles, 5, 4, 3)).toBeNull();
  });
});

describe('yard — grassColor', () => {
  it('returns rgb string', () => {
    const t: YardTile = { i: 0, j: 0, len: 0.3, water: 0.7, weed: 0, seed: 0.5, burn: 0, mowedAt: -9999, leaves: 0, snow: 0 };
    const c = grassColor(t, 1, 100);
    expect(c).toMatch(/^rgb\(\d+,\d+,\d+\)$/);
  });

  it('produces less red with more water (greener overall)', () => {
    const dry: YardTile = { i: 0, j: 0, len: 0.3, water: 0.1, weed: 0, seed: 0.5, burn: 0, mowedAt: -9999, leaves: 0, snow: 0 };
    const wet: YardTile = { i: 0, j: 0, len: 0.3, water: 1.0, weed: 0, seed: 0.5, burn: 0, mowedAt: -9999, leaves: 0, snow: 0 };
    const dc = grassColor(dry, 1, 100);
    const wc = grassColor(wet, 1, 100);
    const dRed = parseInt(dc.split(',')[0].replace('rgb(', ''));
    const wRed = parseInt(wc.split(',')[0].replace('rgb(', ''));
    expect(wRed).toBeLessThan(dRed);
  });
});
