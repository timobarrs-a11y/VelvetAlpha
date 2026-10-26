import type { FaceShape } from '../types/avatar-v2';

export interface FaceGeometry {
  faceShape: FaceShape;
  fRx: number;
  fRy: number;
  chinW: number;
  faceTop: number;
  faceBottom: number;
  faceCenterY: number;
}

type Pt = [number, number];

// Each shape is a few widths down the right side of the head, as fractions of
// fRx (the widest point) at fractions of the head's height. The outline is a
// smooth curve through them, mirrored, so every head gets a rounded crown and
// a jaw of its own.
interface ShapeSpec {
  // [width, height] from the crown down; the chin point is added after.
  side: Array<[number, number]>;
  // Extra points so a square jaw keeps its corner instead of rounding off.
  sharp?: boolean;
}

const SHAPES: Record<FaceShape, ShapeSpec> = {
  oval:    { side: [[0.6, 0.05], [0.9, 0.2], [1.0, 0.42], [0.95, 0.62], [0.78, 0.82], [0.42, 0.96]] },
  round:   { side: [[0.68, 0.05], [0.96, 0.2], [1.0, 0.45], [0.98, 0.64], [0.84, 0.84], [0.5, 0.97]] },
  square:  { side: [[0.68, 0.04], [0.95, 0.17], [1.0, 0.42], [0.99, 0.66], [0.95, 0.8], [0.8, 0.9], [0.5, 0.98]], sharp: true },
  heart:   { side: [[0.72, 0.05], [1.0, 0.2], [1.0, 0.42], [0.9, 0.62], [0.64, 0.82], [0.28, 0.97]] },
  diamond: { side: [[0.5, 0.05], [0.8, 0.2], [1.0, 0.44], [0.9, 0.64], [0.66, 0.83], [0.3, 0.97]] },
  oblong:  { side: [[0.6, 0.04], [0.88, 0.16], [0.93, 0.4], [0.92, 0.64], [0.84, 0.84], [0.48, 0.97]] },
};

function outlinePoints(g: FaceGeometry): Pt[] {
  const spec = SHAPES[g.faceShape] ?? SHAPES.oval;
  const top = g.faceTop;
  const h = chinY(g) - top;
  const right: Pt[] = spec.side.map(([w, y]) => [50 + w * g.fRx, top + y * h]);
  const left: Pt[] = [...right].reverse().map(([x, y]) => [100 - x, y]);
  return [[50, top], ...right, [50, top + h], ...left];
}

// Closed Catmull-Rom spline as cubic beziers. Lower tension keeps corners firmer.
function smoothClosed(pts: Pt[], tension: number): string {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n];
  let d = `M${at(0)[0].toFixed(2)},${at(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + ' Z';
}

// The outline of the face, shared by the face itself and anything that has to
// follow the jaw (beards).
export function faceOutlinePath(g: FaceGeometry): string {
  const spec = SHAPES[g.faceShape] ?? SHAPES.oval;
  return smoothClosed(outlinePoints(g), spec.sharp ? 0.8 : 1);
}

// Lowest point of the chin.
export function chinY(g: FaceGeometry): number {
  switch (g.faceShape) {
    case 'oblong': return g.faceBottom + 7;
    case 'square':
    case 'heart':
    case 'diamond': return g.faceBottom + 6;
    default: return g.faceBottom;
  }
}

// Half the face's width at a given height, read off the outline, for things
// that sit against its edge (ears, sideburns, hair that frames the face).
export function faceHalfWidthAt(g: FaceGeometry, y: number): number {
  const pts = outlinePoints(g).filter(([x]) => x >= 50);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if ((y >= a[1] && y <= b[1]) || (y <= a[1] && y >= b[1])) {
      const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
      return a[0] + (b[0] - a[0]) * t - 50;
    }
  }
  return g.fRx;
}
