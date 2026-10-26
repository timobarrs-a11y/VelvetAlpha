import { RNG } from './rng';
import { PATTERN_KINDS, type Fabric, type Pattern } from './garment';

/**
 * What a pattern or a cloth texture looks like, as a short list of drawing steps on a square tile of side 1 that
 * repeats without a seam. No canvas here: art/fabric.js plays the steps onto one, and the tests read them directly.
 * The same recipe always gives the same steps.
 */
export type TileOp =
  | { k: 'rect'; x: number; y: number; w: number; h: number; c: string; a?: number }
  | { k: 'circle'; x: number; y: number; r: number; c: string; a?: number }
  | { k: 'ring'; x: number; y: number; r: number; lw: number; c: string; a?: number }
  | { k: 'poly'; pts: [number, number][]; c: string; a?: number }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; lw: number; c: string; a?: number };

const TAU = Math.PI * 2;

/** Draws a shape at its place and at the eight places around the tile, so one that crosses an edge still tiles. */
function wrapped(ops: TileOp[], make: (dx: number, dy: number) => TileOp): void {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ops.push(make(dx, dy));
}

export function patternOps(p: Pick<Pattern, 'kind' | 'colors' | 'density' | 'seed'>): TileOp[] {
  const rng = new RNG(p.seed);
  const [c0, c1 = c0, c2 = c1] = p.colors;
  const d = p.density ?? 0.5;
  const ops: TileOp[] = [];
  switch (p.kind) {
    case 'stripes': {
      const w = 0.2 + d * 0.3;
      ops.push({ k: 'rect', x: 0, y: 0, w: 1, h: w, c: c0 });
      if (p.colors.length > 1) ops.push({ k: 'rect', x: 0, y: 0.5, w: 1, h: w * 0.5, c: c1 });
      break;
    }
    case 'pinstripe':
      ops.push({ k: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 1, lw: 0.035, c: c0 });
      if (p.colors.length > 1) ops.push({ k: 'line', x1: 0, y1: 0, x2: 0, y2: 1, lw: 0.02, c: c1, a: 0.7 });
      break;
    case 'plaid': {
      const w = 0.16 + d * 0.12;
      ops.push({ k: 'rect', x: 0, y: 0.1, w: 1, h: w, c: c0, a: 0.55 }, { k: 'rect', x: 0.1, y: 0, w: w, h: 1, c: c0, a: 0.55 });
      ops.push({ k: 'rect', x: 0, y: 0.55, w: 1, h: 0.07, c: c1, a: 0.85 }, { k: 'rect', x: 0.55, y: 0, w: 0.07, h: 1, c: c1, a: 0.85 });
      ops.push({ k: 'line', x1: 0, y1: 0.9, x2: 1, y2: 0.9, lw: 0.025, c: c2, a: 0.8 }, { k: 'line', x1: 0.9, y1: 0, x2: 0.9, y2: 1, lw: 0.025, c: c2, a: 0.8 });
      break;
    }
    case 'gingham':
      ops.push({ k: 'rect', x: 0, y: 0, w: 1, h: 0.5, c: c0, a: 0.5 }, { k: 'rect', x: 0, y: 0, w: 0.5, h: 1, c: c0, a: 0.5 });
      break;
    case 'polka': {
      const r = 0.1 + d * 0.1;
      wrapped(ops, (dx, dy) => ({ k: 'circle', x: 0.25 + dx, y: 0.25 + dy, r, c: c0 }));
      wrapped(ops, (dx, dy) => ({ k: 'circle', x: 0.75 + dx, y: 0.75 + dy, r, c: p.colors.length > 1 ? c1 : c0 }));
      break;
    }
    case 'floral': {
      const flowers: [number, number][] = [[0.28 + rng.range(-0.04, 0.04), 0.27], [0.74, 0.72 + rng.range(-0.04, 0.04)]];
      const r = 0.07 + d * 0.04;
      for (const [fx, fy] of flowers) {
        wrapped(ops, (dx, dy) => ({ k: 'circle', x: fx + dx + 0.045, y: fy + dy + 0.07, r: r * 0.7, c: '#4f7a4a', a: 0.9 }));
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          wrapped(ops, (dx, dy) => ({ k: 'circle', x: fx + dx + Math.cos(a) * r * 1.1, y: fy + dy + Math.sin(a) * r * 1.1, r, c: c0 }));
        }
        wrapped(ops, (dx, dy) => ({ k: 'circle', x: fx + dx, y: fy + dy, r: r * 0.7, c: c1 }));
      }
      break;
    }
    case 'camo': {
      const cols = [c0, c1, c2];
      for (let i = 0; i < 9; i++) {
        const x = rng.next(), y = rng.next(), r = 0.1 + rng.next() * 0.1, c = cols[i % cols.length];
        wrapped(ops, (dx, dy) => ({ k: 'poly', pts: Array.from({ length: 7 }, (_, j) => { const a = (j / 7) * TAU, rr = r * (0.7 + ((i * 7 + j * 13) % 10) / 20); return [x + dx + Math.cos(a) * rr * 1.4, y + dy + Math.sin(a) * rr] as [number, number]; }), c }));
      }
      break;
    }
    case 'tie-dye': {
      const cols = [c0, c1, c2, c1];
      for (let i = cols.length - 1; i >= 0; i--) {
        wrapped(ops, (dx, dy) => ({ k: 'circle', x: 0.5 + dx, y: 0.5 + dy, r: 0.12 + i * 0.12, c: cols[i], a: 0.9 }));
      }
      break;
    }
    case 'checker':
      ops.push({ k: 'rect', x: 0, y: 0, w: 0.5, h: 0.5, c: c0 }, { k: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5, c: c0 });
      break;
    case 'argyle':
      ops.push({ k: 'poly', pts: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], c: c0 });
      ops.push({ k: 'poly', pts: [[0.5, 0.2], [0.8, 0.5], [0.5, 0.8], [0.2, 0.5]], c: c1 });
      ops.push({ k: 'line', x1: 0, y1: 0, x2: 1, y2: 1, lw: 0.02, c: c2, a: 0.8 }, { k: 'line', x1: 0, y1: 1, x2: 1, y2: 0, lw: 0.02, c: c2, a: 0.8 });
      break;
    case 'leopard': {
      for (let i = 0; i < 3; i++) {
        const x = rng.next(), y = rng.next(), r = 0.07 + rng.next() * 0.04;
        wrapped(ops, (dx, dy) => ({ k: 'circle', x: x + dx, y: y + dy, r: r * 1.3, c: c1, a: 0.85 }));
        wrapped(ops, (dx, dy) => ({ k: 'ring', x: x + dx, y: y + dy, r, lw: r * 0.55, c: c0 }));
      }
      break;
    }
    case 'zebra':
      for (let i = 0; i < 3; i++) {
        const o = i / 3;
        wrapped(ops, (dx, dy) => ({ k: 'poly', pts: [[o + dx, 0 + dy], [o + 0.12 + dx, 0 + dy], [o + 0.04 + dx, 0.5 + dy], [o + 0.16 + dx, 1 + dy], [o + 0.04 + dx, 1 + dy], [o - 0.08 + dx, 0.5 + dy]], c: c0 }));
      }
      break;
    case 'color-block':
      ops.push({ k: 'rect', x: 0, y: 0, w: 1, h: 0.5, c: c0 }, { k: 'rect', x: 0, y: 0.5, w: 0.5, h: 0.5, c: c1 }, { k: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5, c: c2 });
      break;
    case 'graphic': {
      const pts: [number, number][] = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 0.17 : 0.4; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]; });
      ops.push({ k: 'poly', pts, c: c0 }, { k: 'circle', x: 0.5, y: 0.5, r: 0.09, c: c1 });
      break;
    }
  }
  return ops;
}

/** Faint marks that make a cloth look like itself: the weave of knit, the ridges of corduroy, the twill of denim. */
export function textureOps(fabric: Fabric, wash = 0.5): TileOp[] {
  const ops: TileOp[] = [];
  const dark = '#000000', light = '#ffffff';
  switch (fabric) {
    case 'knit':
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = i / 4, y = j / 4;
        ops.push({ k: 'line', x1: x, y1: y, x2: x + 0.125, y2: y + 0.2, lw: 0.05, c: dark, a: 0.16 }, { k: 'line', x1: x + 0.25, y1: y, x2: x + 0.125, y2: y + 0.2, lw: 0.05, c: dark, a: 0.16 });
        ops.push({ k: 'line', x1: x + 0.02, y1: y + 0.02, x2: x + 0.125, y2: y + 0.17, lw: 0.02, c: light, a: 0.14 });
      }
      break;
    case 'corduroy':
      for (let i = 0; i < 5; i++) { ops.push({ k: 'line', x1: i / 5 + 0.04, y1: 0, x2: i / 5 + 0.04, y2: 1, lw: 0.05, c: dark, a: 0.2 }, { k: 'line', x1: i / 5 + 0.1, y1: 0, x2: i / 5 + 0.1, y2: 1, lw: 0.03, c: light, a: 0.1 }); }
      break;
    case 'flannel':
      for (let i = 0; i < 8; i++) ops.push({ k: 'line', x1: i / 8, y1: 0, x2: i / 8 + 0.05, y2: 1, lw: 0.025, c: light, a: 0.1 }, { k: 'line', x1: 0, y1: i / 8, x2: 1, y2: i / 8 + 0.04, lw: 0.025, c: dark, a: 0.08 });
      break;
    case 'denim': {
      for (let i = 0; i < 8; i++) ops.push({ k: 'line', x1: i / 8 - 0.1, y1: 0, x2: i / 8 + 0.1, y2: 1, lw: 0.04, c: light, a: 0.05 + wash * 0.12 });
      break;
    }
    case 'linen':
      for (let i = 0; i < 6; i++) ops.push({ k: 'line', x1: 0, y1: (i * 0.17) % 1, x2: 0.4 + (i % 3) * 0.1, y2: (i * 0.17) % 1, lw: 0.02, c: dark, a: 0.12 }, { k: 'line', x1: (i * 0.23) % 1, y1: 0, x2: (i * 0.23) % 1, y2: 0.3 + (i % 2) * 0.2, lw: 0.02, c: light, a: 0.12 });
      break;
    case 'fleece':
      for (let i = 0; i < 12; i++) ops.push({ k: 'circle', x: (i * 0.37) % 1, y: (i * 0.61) % 1, r: 0.04, c: light, a: 0.12 });
      break;
    case 'puffer':
      ops.push({ k: 'line', x1: 0, y1: 0.02, x2: 1, y2: 0.02, lw: 0.05, c: dark, a: 0.3 }, { k: 'line', x1: 0, y1: 0.08, x2: 1, y2: 0.08, lw: 0.04, c: light, a: 0.16 });
      break;
    default:
      break;
  }
  return ops;
}

export { PATTERN_KINDS };
