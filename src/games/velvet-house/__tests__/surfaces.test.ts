import { describe, it, expect } from 'vitest';
import { checkPlacement, surfaceRect, surfaceUnder, putOn, takeOff, carryOnTop, rotateAboutCentre, centreAt } from '../state/arrange';
import { TYPES, type ObjectInstance } from '../state/objects';

const table = (): ObjectInstance => ({ id: 't', type: 'coffeetable', level: 1, x: 5, y: 5, rot: 0 });
const small = (id = 'c', type = 'candles'): ObjectInstance => ({ id, type, level: 1, x: 5.2, y: 5.1, rot: 0 });

describe('small pieces on surfaces', () => {
  it('only small pieces are put on a surface, and only over one', () => {
    const t = table(), c = small();
    expect(surfaceUnder([t, c], c, 5.6, 5.3)).toBe(t);
    expect(surfaceUnder([t, c], c, 8, 2)).toBeNull();
    const sofa: ObjectInstance = { id: 's', type: 'sofa', level: 1, x: 5.2, y: 5.1, rot: 0 };
    expect(surfaceUnder([t, sofa], sofa, 5.6, 5.3)).toBeNull();
  });

  it('sits at the height of the top, inside the flat part', () => {
    const t = table(), c = small();
    c.x = 9; c.y = 9; // pointer way off: it is pulled back onto the table
    putOn(c, t);
    expect(c.on).toBe('t');
    expect(c.z).toBe(TYPES.coffeetable.surface!.z);
    const a = surfaceRect(t)!;
    expect(c.x).toBeGreaterThanOrEqual(a[0]);
    expect(c.x + TYPES.candles.W).toBeLessThanOrEqual(a[2] + 1e-6);
    expect(checkPlacement([t, c], c).ok).toBe(true);
  });

  it('two pieces cannot be on the same spot, and one cannot hang off the edge', () => {
    const t = table(), a = small('a'), b = small('b', 'bookstack');
    putOn(a, t); putOn(b, t);
    b.x = a.x; b.y = a.y;
    expect(checkPlacement([t, a, b], b).ok).toBe(false);
    b.x = 5.0; // off the left edge
    b.y = 5.1;
    expect(checkPlacement([t, a, b], b).ok).toBe(false);
  });

  it('a piece on a table is no obstacle on the floor', () => {
    const t = table(), c = small();
    putOn(c, t);
    const chair: ObjectInstance = { id: 'ch', type: 'armchair', level: 1, x: 5.3, y: 5.1, rot: 0 };
    // The chair is held over the candles' floor spot: only the table is in its way.
    expect(checkPlacement([t, c, chair], chair).reason ?? '').not.toMatch(/candles/i);
  });

  it('goes with the table when it moves and turns', () => {
    const t = table(), c = small();
    putOn(c, t);
    const rel = [c.x - t.x, c.y - t.y];
    const from = { x: t.x, y: t.y, rot: t.rot };
    centreAt(t, 7 + TYPES.coffeetable.W / 2, 3 + TYPES.coffeetable.D / 2);
    carryOnTop([t, c], t, from);
    expect(c.on).toBe('t');
    expect(Math.abs(c.x - t.x - rel[0])).toBeLessThan(0.3);
    expect(Math.abs(c.y - t.y - rel[1])).toBeLessThan(0.3);
    const turned = { x: t.x, y: t.y, rot: t.rot };
    rotateAboutCentre(t);
    carryOnTop([t, c], t, turned);
    expect(c.rot).toBe(1);
    expect(checkPlacement([t, c], c).ok).toBe(true);
  });

  it('comes off the table', () => {
    const t = table(), c = small();
    putOn(c, t);
    takeOff(c);
    expect(c.on).toBeUndefined();
    expect(c.z).toBeUndefined();
  });
});
