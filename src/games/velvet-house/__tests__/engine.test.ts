import { describe, it, expect } from 'vitest';
import { Projection, depthSort, wallPoint, planeLen, BACK, FRONT } from '../engine/projection';
import { advanceClock } from '../engine/loop';
import { shade, rgb } from '../engine/painter';

describe('Projection', () => {
  it('matches the original origin for the default view', () => {
    const p = new Projection(0);
    expect(p.ox).toBe(288);
    expect(p.oy).toBe(128);
  });

  it('round-trips world to screen to world in every rotation', () => {
    for (let r = 0; r < 4; r++) {
      const p = new Projection(r);
      for (const [x, y] of [[0, 0], [3.2, 5.5], [10, 8], [7.1, 0.4]]) {
        const [sx, sy] = p.iso(x, y, 0);
        const [bx, by] = p.unIso(sx, sy);
        expect(bx).toBeCloseTo(x, 6);
        expect(by).toBeCloseTo(y, 6);
      }
    }
  });

  it('wraps rotation into 0..3', () => {
    expect(new Projection(5).rot).toBe(1);
    expect(new Projection(-1).rot).toBe(3);
  });

  it('swaps view width and depth on quarter turns', () => {
    expect([new Projection(0).viewW(), new Projection(0).viewD()]).toEqual([10, 8]);
    expect([new Projection(1).viewW(), new Projection(1).viewD()]).toEqual([8, 10]);
  });

  it('back and front planes never overlap', () => {
    for (let r = 0; r < 4; r++) {
      expect(BACK[r].filter((s) => FRONT[r].includes(s))).toEqual([]);
    }
  });
});

describe('walls', () => {
  it('places points on the right plane', () => {
    expect(wallPoint('L', 2, 1)).toEqual([0, 2, 1]);
    expect(wallPoint('B', 2, 1)).toEqual([2, 0, 1]);
    expect(wallPoint('R', 2, 1)).toEqual([10, 2, 1]);
    expect(wallPoint('F', 2, 1)).toEqual([2, 8, 1]);
    expect(planeLen('L')).toBe(8);
    expect(planeLen('B')).toBe(10);
  });
});

describe('depthSort', () => {
  const item = (name: string, x1: number, y1: number, x2: number, y2: number, p: Projection) => ({
    name, x1, y1, x2, y2, key: p.depth((x1 + x2) / 2, (y1 + y2) / 2), draw: () => {},
  });

  it('draws far objects before near ones', () => {
    const p = new Projection(0);
    const near = item('near', 6, 6, 7, 7, p);
    const far = item('far', 1, 1, 2, 2, p);
    expect(depthSort([near, far], p).map((i) => i.name)).toEqual(['far', 'near']);
  });

  it('flips order when the house is turned around', () => {
    const p = new Projection(2);
    const a = item('a', 6, 6, 7, 7, p);
    const b = item('b', 1, 1, 2, 2, p);
    expect(depthSort([a, b], p).map((i) => i.name)).toEqual(['a', 'b']);
  });
});

describe('advanceClock', () => {
  it('advances one game minute per second at normal speed', () => {
    expect(advanceClock(1, 600, 1, 1)).toEqual({ day: 1, minutes: 601 });
  });

  it('rolls into the next day at midnight', () => {
    const r = advanceClock(3, 1439, 2, 1);
    expect(r.day).toBe(4);
    expect(r.minutes).toBeCloseTo(1, 6);
  });
});

describe('colors', () => {
  it('parses and shades hex colors', () => {
    expect(rgb('#FF8000')).toEqual([255, 128, 0]);
    expect(shade('#000000', 1)).toBe('rgb(255,255,255)');
    expect(shade('#FFFFFF', -1)).toBe('rgb(0,0,0)');
  });
});
