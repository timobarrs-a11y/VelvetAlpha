import { describe, it, expect } from 'vitest';
import {
  buildGrid,
  cellOf,
  isFreeAt,
  nearestFree,
  findPath,
  reachableSet,
  randomFree,
  levelPath,
  planRoute,
  spotNear,
  RES,
  NX,
  NY,
  type StairDef,
} from '../state/pathfinding';

const WX = 10, WY = 8;

function emptyGrid(): boolean[][] {
  return buildGrid([], WX, WY);
}

function blockedGrid(block: { x0: number; y0: number; x1: number; y1: number }): boolean[][] {
  return buildGrid([block], WX, WY);
}

const STAIRS: StairDef[] = [
  { id: 'S01', lower: 0, upper: 1, lowerNode: [9.5, 3.7], upperNode: [9.5, 0.75] },
  { id: 'S12', lower: 1, upper: 2, lowerNode: [3.7, 7.5], upperNode: [0.75, 7.5] },
];

describe('pathfinding', () => {
  describe('cellOf', () => {
    it('converts world coords to grid cells', () => {
      expect(cellOf(0, 0)).toEqual([0, 0]);
      expect(cellOf(RES, RES)).toEqual([1, 1]);
      expect(cellOf(5, 4)).toEqual([10, 8]);
    });
    it('clamps to grid bounds', () => {
      expect(cellOf(100, 100)).toEqual([NX - 1, NY - 1]);
      expect(cellOf(-5, -5)).toEqual([0, 0]);
    });
  });

  describe('buildGrid', () => {
    it('marks interior cells as free with no blocks', () => {
      const g = emptyGrid();
      const [i, j] = cellOf(5, 4);
      expect(g[i][j]).toBe(true);
    });
    it('marks edge cells as blocked', () => {
      const g = emptyGrid();
      const [i, j] = cellOf(0.1, 0.1);
      expect(g[i][j]).toBe(false);
    });
    it('blocks cells overlapping a block rect', () => {
      const g = blockedGrid({ x0: 3, y0: 3, x1: 5, y1: 5 });
      const [i, j] = cellOf(4, 4);
      expect(g[i][j]).toBe(false);
    });
    it('leaves cells outside block rect free', () => {
      const g = blockedGrid({ x0: 3, y0: 3, x1: 5, y1: 5 });
      const [i, j] = cellOf(8, 7);
      expect(g[i][j]).toBe(true);
    });
  });

  describe('isFreeAt', () => {
    it('returns false near edges', () => {
      const g = emptyGrid();
      expect(isFreeAt(g, 0.1, 0.1, WX, WY)).toBe(false);
    });
    it('returns true for interior free cell', () => {
      const g = emptyGrid();
      expect(isFreeAt(g, 5, 4, WX, WY)).toBe(true);
    });
    it('returns false for blocked cell', () => {
      const g = blockedGrid({ x0: 3, y0: 3, x1: 5, y1: 5 });
      expect(isFreeAt(g, 4, 4, WX, WY)).toBe(false);
    });
  });

  describe('nearestFree', () => {
    it('returns same cell if already free', () => {
      const g = emptyGrid();
      const [i, j] = cellOf(5, 4);
      expect(nearestFree(g, [i, j])).toEqual([i, j]);
    });
    it('finds closest free cell when blocked', () => {
      const g = blockedGrid({ x0: 3, y0: 3, x1: 5, y1: 5 });
      const [i, j] = cellOf(4, 4);
      const result = nearestFree(g, [i, j]);
      expect(result).not.toBeNull();
      const [ni, nj] = result!;
      expect(g[ni][nj]).toBe(true);
    });
  });

  describe('findPath', () => {
    it('finds a path between two free points', () => {
      const g = emptyGrid();
      const path = findPath(g, 1, 1, 8, 7);
      expect(path.length).toBeGreaterThan(0);
      const [lx, ly] = path[path.length - 1];
      expect(lx).toBe(8);
      expect(ly).toBe(7);
    });
    it('returns destination directly when no path exists', () => {
      const g = blockedGrid({ x0: 0, y0: 0, x1: 10, y1: 8 });
      const path = findPath(g, 5, 4, 8, 7);
      expect(path).toEqual([[8, 7]]);
    });
    it('simplifies collinear waypoints', () => {
      const g = emptyGrid();
      const path = findPath(g, 1, 1, 9, 1);
      for (let i = 1; i < path.length - 1; i++) {
        const a = path[i - 1];
        const b = path[i + 1];
        const p = path[i];
        const cross = Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]));
        expect(cross).toBeGreaterThan(1e-6);
      }
    });
    it('navigates around an obstacle', () => {
      const g = blockedGrid({ x0: 3, y0: 0, x1: 4, y1: 6 });
      const path = findPath(g, 1, 3, 7, 3);
      expect(path.length).toBeGreaterThan(2);
      const [fx, fy] = path[path.length - 1];
      expect(fx).toBe(7);
      expect(fy).toBe(3);
    });
  });

  describe('reachableSet', () => {
    it('returns all cells when grid is open', () => {
      const g = emptyGrid();
      const reach = reachableSet(g, [5, 4]);
      expect(reach.size).toBeGreaterThan(100);
    });
    it('returns empty set when anchor is fully blocked', () => {
      const g = blockedGrid({ x0: 0, y0: 0, x1: 10, y1: 8 });
      const reach = reachableSet(g, [5, 4]);
      expect(reach.size).toBe(0);
    });
  });

  describe('randomFree', () => {
    it('returns a free cell', () => {
      const g = emptyGrid();
      const rng = () => 0.5;
      const [x, y] = randomFree(g, rng, [5, 4]);
      const [i, j] = cellOf(x, y);
      expect(g[i][j]).toBe(true);
    });
    it('falls back to anchor when no free cell found', () => {
      const g = blockedGrid({ x0: 0, y0: 0, x1: 10, y1: 8 });
      const rng = () => 0.5;
      const [x, y] = randomFree(g, rng, [5, 4]);
      expect(x).toBe(5);
      expect(y).toBe(4);
    });
  });

  describe('levelPath', () => {
    it('returns empty array when already at destination', () => {
      expect(levelPath(STAIRS, 1, 1)).toEqual([]);
    });
    it('finds direct stair path 0->1', () => {
      const path = levelPath(STAIRS, 0, 1);
      expect(path).toHaveLength(1);
      expect(path[0].st.id).toBe('S01');
    });
    it('finds multi-step path 0->2', () => {
      const path = levelPath(STAIRS, 0, 2);
      expect(path).toHaveLength(2);
      expect(path[0].st.id).toBe('S01');
      expect(path[1].st.id).toBe('S12');
    });
    it('returns empty path when no route exists', () => {
      expect(levelPath(STAIRS, 0, 5)).toEqual([]);
    });
  });

  describe('planRoute', () => {
    it('plans a single walk leg on same level', () => {
      const grids = [emptyGrid(), emptyGrid(), emptyGrid(), emptyGrid()];
      const gridFor = (lv: number) => grids[lv];
      const legs = planRoute({ level: 1, x: 1, y: 1 }, 1, 8, 7, gridFor, STAIRS, WX, WY);
      expect(legs).toHaveLength(1);
      expect(legs[0].type).toBe('walk');
    });
    it('plans walk + stair + walk for cross-level route', () => {
      const grids = [emptyGrid(), emptyGrid(), emptyGrid(), emptyGrid()];
      const gridFor = (lv: number) => grids[lv];
      const legs = planRoute({ level: 0, x: 8, y: 3 }, 1, 5, 5, gridFor, STAIRS, WX, WY);
      expect(legs.length).toBeGreaterThanOrEqual(3);
      expect(legs[0].type).toBe('walk');
      expect(legs[1].type).toBe('stair');
      expect(legs[2].type).toBe('walk');
    });
  });

  describe('spotNear', () => {
    it('returns a free spot near the target', () => {
      const grids = [emptyGrid(), emptyGrid(), emptyGrid(), emptyGrid()];
      const gridFor = (lv: number) => grids[lv];
      const [x, y] = spotNear({ level: 1, x: 5, y: 4 }, { level: 1, x: 1, y: 1 }, gridFor, WX, WY);
      expect(isFreeAt(gridFor(1), x, y, WX, WY)).toBe(true);
    });
    it('falls back to nearestFree cell when no tier offset works', () => {
      const grids = [blockedGrid({ x0: 0, y0: 0, x1: 10, y1: 8 }), emptyGrid(), emptyGrid(), emptyGrid()];
      const gridFor = (lv: number) => grids[lv];
      const [x, y] = spotNear({ level: 0, x: 5, y: 4 }, { level: 0, x: 1, y: 1 }, gridFor, WX, WY);
      expect(x).toBe(5);
      expect(y).toBe(4);
    });
  });
});
