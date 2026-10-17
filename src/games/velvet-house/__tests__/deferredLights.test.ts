import { describe, it, expect } from 'vitest';
import { ZMAX, NORMAL, encodeHeight, planeNormal, heightPlane, alphaOf } from '../engine/gbuffer';
import { sunLight, gradeTint, packDeferredLights, packWindows, MAX_DEFERRED_LIGHTS, type DeferredLight } from '../engine/deferredLights';

const light = (o: Partial<DeferredLight> = {}): DeferredLight => ({ a: 1, b: 1, z: 2, range: 5, s: 1, sx: 0, sy: 0, glow: 100, vis: true, ...o });

describe('gbuffer encoding', () => {
  it('packs height into 0..255 and clamps', () => {
    expect(encodeHeight(0)).toBe(0);
    expect(encodeHeight(ZMAX)).toBe(255);
    expect(encodeHeight(-1)).toBe(0);
    expect(encodeHeight(99)).toBe(255);
  });

  it('classifies surface facing from polygon points', () => {
    expect(planeNormal([[0, 0, 0], [1, 0, 0], [1, 1, 0]])).toBe(NORMAL.up);
    expect(planeNormal([[2, 0, 0], [2, 1, 0], [2, 1, 1]])).toBe(NORMAL.faceA);
    expect(planeNormal([[0, 3, 0], [1, 3, 0], [1, 3, 1]])).toBe(NORMAL.faceB);
    expect(planeNormal([[0, 0, 0], [1, 1, 1], [2, 2, 2]])).toBeNull();
  });

  it('recovers height across a tilted surface from its screen positions', () => {
    const hp = heightPlane([[0, 100], [10, 100], [10, 66]], [0, 0, 1]);
    expect(hp?.kind).toBe('ramp');
    if (hp?.kind !== 'ramp') return;
    const zAt = (x: number, y: number) => {
      const [fx, fy] = hp.from, [tx, ty] = hp.to, dx = tx - fx, dy = ty - fy;
      return (((x - fx) * dx + (y - fy) * dy) / (dx * dx + dy * dy)) * ZMAX;
    };
    expect(zAt(5, 100)).toBeCloseTo(0, 5);
    expect(zAt(5, 66)).toBeCloseTo(1, 5);
    expect(zAt(5, 83)).toBeCloseTo(0.5, 5);
  });

  it('treats flat surfaces as a single height', () => {
    expect(heightPlane([[0, 0], [10, 5], [0, 10]], [0.8, 0.8, 0.8])).toEqual({ kind: 'solid', z: 0.8 });
  });

  it('ignores translucent fills', () => {
    expect(alphaOf('#fff')).toBe(1);
    expect(alphaOf('rgba(0,0,0,.22)')).toBeCloseTo(0.22);
    expect(alphaOf('hsla(10,50%,50%,0.6)')).toBeCloseTo(0.6);
    expect(alphaOf('rgb(1,2,3)')).toBe(1);
    expect(alphaOf({})).toBe(0);
  });
});

describe('deferred lighting helpers', () => {
  it('sun is high at noon, low at dawn, and dimmed by rain', () => {
    const noon = sunLight(12.5, 0, 0, 1), dawn = sunLight(6.5, 0, 0, 1), wet = sunLight(12.5, 0, 1, 1);
    expect(noon.dir[2]).toBeGreaterThan(dawn.dir[2]);
    expect(Math.hypot(...noon.dir)).toBeCloseTo(1, 5);
    expect(noon.dir[1]).toBeLessThan(0);
    expect(wet.col[0]).toBeLessThan(noon.col[0]);
    expect(dawn.col[2]).toBeLessThan(noon.col[2]);
  });

  it('switches to a dim blue moon at night', () => {
    const moon = sunLight(1, 0, 0, 0);
    expect(moon.col[2]).toBeGreaterThan(moon.col[0]);
    expect(Math.max(...moon.col)).toBeLessThan(0.5);
  });

  it('grade tint never brightens and warms the evening', () => {
    for (const h of [0, 6, 8, 12, 18, 21, 23.9]) expect(Math.max(...gradeTint(h, 0))).toBeCloseTo(1, 5);
    const eve = gradeTint(18, 0);
    expect(eve[2]).toBeLessThan(eve[0]);
  });

  it('packs strongest lights first and caps the count', () => {
    const p = packDeferredLights([light({ s: 0.2 }), light({ s: 1, col: '255,150,70' })]);
    expect(p.count).toBe(2);
    expect(p.col[3]).toBe(1);
    expect(p.col[0]).toBeCloseTo(1);
    expect(packDeferredLights(Array.from({ length: 40 }, () => light())).count).toBe(MAX_DEFERRED_LIGHTS);
  });

  it('orders window ranges', () => {
    const w = packWindows([{ axis: 1, u0: 2, u1: 1, z0: 2, z1: 2.4 }]);
    expect(w.count).toBe(1);
    expect(Array.from(w.w.slice(0, 3))).toEqual([1, 1, 2]);
  });
});
