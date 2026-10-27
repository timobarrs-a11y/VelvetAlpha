import { describe, it, expect } from 'vitest';
import { patternOps, textureOps } from '../state/fabricTile';
import { GENERATED_KINDS as PATTERN_KINDS, FABRICS } from '../state/garment';

const COLORS = ['#d24a7a', '#f6e3c3', '#3be3d0'];

describe('pattern tiles', () => {
  for (const kind of PATTERN_KINDS) {
    it(`${kind}: draws something, the same way every time, near the tile`, () => {
      const a = patternOps({ kind, colors: COLORS, density: 0.5, seed: 7 });
      expect(a.length).toBeGreaterThan(0);
      expect(patternOps({ kind, colors: COLORS, density: 0.5, seed: 7 })).toEqual(a);
      for (const op of a) {
        const xs = op.k === 'poly' ? op.pts.map((p) => p[0]) : op.k === 'line' ? [op.x1, op.x2] : [op.x];
        xs.forEach((x) => { expect(x).toBeGreaterThan(-1.5); expect(x).toBeLessThan(2.5); });
        if (op.a !== undefined) { expect(op.a).toBeGreaterThan(0); expect(op.a).toBeLessThanOrEqual(1); }
      }
    });
  }

  it('changes the scattered motifs with the seed', () => {
    for (const kind of ['camo', 'leopard', 'floral'] as const) {
      expect(patternOps({ kind, colors: COLORS, seed: 1 })).not.toEqual(patternOps({ kind, colors: COLORS, seed: 2 }));
    }
  });

  it('copes with a single colour', () => {
    for (const kind of PATTERN_KINDS) expect(() => patternOps({ kind, colors: ['#112233'], seed: 3 })).not.toThrow();
  });
});

describe('cloth textures', () => {
  it('gives every cloth but plain cotton some marks', () => {
    for (const f of FABRICS) {
      const ops = textureOps(f);
      if (f === 'cotton' || f === 'leather' || f === 'satin') expect(ops).toEqual([]);
      else expect(ops.length).toBeGreaterThan(0);
    }
  });

  it('shows denim wash in the twill', () => {
    const raw = textureOps('denim', 0) as { a: number }[];
    const light = textureOps('denim', 1) as { a: number }[];
    expect(light[0].a).toBeGreaterThan(raw[0].a);
  });
});

describe('pixel art tiles', () => {
  it('draws one square per filled cell, in its palette colour', () => {
    const ops = patternOps({ kind: 'pixel', colors: ['#ff0000'], seed: 1, pixels: { w: 8, h: 8, palette: ['#ff0000', '#00ff00'], data: '1' + '0'.repeat(62) + '2' } });
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ k: 'rect', c: '#ff0000', x: 0, y: 0 });
    expect(ops[1]).toMatchObject({ c: '#00ff00' });
    expect((ops[1] as { x: number }).x).toBeCloseTo(7 / 8);
  });
  it('draws nothing without a picture', () => {
    expect(patternOps({ kind: 'pixel', colors: ['#ff0000'], seed: 1 })).toEqual([]);
  });
});
