import { WX, WY, TW, TH, ZH, type WallSide } from '../state/house';

export const VIEW_W = 640;
export const VIEW_H = 440;

export type Rot = 0 | 1 | 2 | 3;
export type Pt3 = [number, number, number];

// Back planes are drawn behind the scene, front planes are cut away; indexed by view rotation.
export const BACK: [WallSide, WallSide][] = [['L', 'B'], ['B', 'R'], ['R', 'F'], ['F', 'L']];
export const FRONT: [WallSide, WallSide][] = [['F', 'R'], ['L', 'F'], ['B', 'L'], ['R', 'B']];

export function wallPoint(plane: WallSide, u: number, z: number): Pt3 {
  if (plane === 'L') return [0, u, z];
  if (plane === 'B') return [u, 0, z];
  if (plane === 'R') return [WX, u, z];
  return [u, WY, z];
}

export function planeLen(plane: WallSide): number {
  return plane === 'L' || plane === 'R' ? WY : WX;
}

/** Isometric camera that turns the house in 90° steps; the viewer always sits at +vx +vy. */
export class Projection {
  rot: Rot = 0;
  ox = 0;
  oy = 0;

  constructor(rot: number = 0) {
    this.setRotation(rot);
  }

  setRotation(rot: number): void {
    this.rot = (((rot % 4) + 4) % 4) as Rot;
    const vw = this.viewW();
    const vd = this.viewD();
    this.ox = 320 - (vw / 2 - vd / 2) * TW;
    this.oy = 272 - (vw / 2 + vd / 2) * TH;
  }

  viewW(): number {
    return this.rot % 2 ? WY : WX;
  }

  viewD(): number {
    return this.rot % 2 ? WX : WY;
  }

  V(x: number, y: number): [number, number] {
    switch (this.rot) {
      case 0: return [x, y];
      case 1: return [y, WX - x];
      case 2: return [WX - x, WY - y];
      default: return [WY - y, x];
    }
  }

  Vi(a: number, b: number): [number, number] {
    switch (this.rot) {
      case 0: return [a, b];
      case 1: return [WX - b, a];
      case 2: return [WX - a, WY - b];
      default: return [b, WY - a];
    }
  }

  isoV(a: number, b: number, z = 0): [number, number] {
    return [this.ox + (a - b) * TW, this.oy + (a + b) * TH - z * ZH];
  }

  iso(x: number, y: number, z = 0): [number, number] {
    const [a, b] = this.V(x, y);
    return this.isoV(a, b, z);
  }

  unIso(sx: number, sy: number): [number, number] {
    const a = (sx - this.ox) / TW;
    const b = (sy - this.oy) / TH;
    return this.Vi((a + b) / 2, (b - a) / 2);
  }

  /** Rotates a world rect into view space and returns its bounds. */
  vrect(x1: number, y1: number, x2: number, y2: number): [number, number, number, number] {
    const [a1, b1] = this.V(x1, y1);
    const [a2, b2] = this.V(x2, y2);
    return [Math.min(a1, a2), Math.min(b1, b2), Math.max(a1, a2), Math.max(b1, b2)];
  }

  /** Depth key: larger is nearer the viewer. */
  depth(x: number, y: number): number {
    const [a, b] = this.V(x, y);
    return a + b;
  }
}

export interface DepthItem {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: number;
  draw: () => void;
}

/** Topological painter's sort: anything entirely behind another footprint draws first. */
export function depthSort<T extends DepthItem>(items: T[], proj: Projection): T[] {
  const n = items.length;
  const visited = new Uint8Array(n);
  const out: T[] = [];
  const rects = items.map((it) => proj.vrect(it.x1, it.y1, it.x2, it.y2));
  const before = (a: number, b: number): boolean => {
    const A = rects[a];
    const B = rects[b];
    const ab = A[2] <= B[0] + 1e-3 || A[3] <= B[1] + 1e-3;
    const ba = B[2] <= A[0] + 1e-3 || B[3] <= A[1] + 1e-3;
    if (ab && !ba) return true;
    if (ba && !ab) return false;
    return items[a].key < items[b].key;
  };
  const idx = [...Array(n).keys()].sort((a, b) => items[a].key - items[b].key);
  const visit = (i: number): void => {
    if (visited[i]) return;
    visited[i] = 1;
    for (const j of idx) if (j !== i && !visited[j] && before(j, i)) visit(j);
    out.push(items[i]);
  };
  idx.forEach(visit);
  return out;
}
