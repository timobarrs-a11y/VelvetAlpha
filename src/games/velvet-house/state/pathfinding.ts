export type Grid = boolean[][];

export interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface StairDef {
  id: string;
  lower: number;
  upper: number;
  lowerNode: [number, number];
  upperNode: [number, number];
  door?: boolean;
}

export interface LevelAnchor {
  anchor: [number, number];
}

export interface RouteCharacter {
  level: number;
  x: number;
  y: number;
}

export interface RouteTarget {
  level: number;
  x: number;
  y: number;
}

export interface WalkLeg {
  type: 'walk';
  level: number;
  pts: [number, number][];
}

export interface StairLeg {
  type: 'stair';
  st: StairDef;
  up: boolean;
  t: number;
}

export type RouteLeg = WalkLeg | StairLeg;

export const RES = 0.5;
export const NX = 20;
export const NY = 16;
export const PAD = 0.18;

const DIRS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const cellKey = (i: number, j: number): number => i * NY + j;

export function cellOf(x: number, y: number): [number, number] {
  return [
    Math.max(0, Math.min(NX - 1, Math.floor(x / RES))),
    Math.max(0, Math.min(NY - 1, Math.floor(y / RES))),
  ];
}

export function buildGrid(
  blocks: Block[],
  worldW: number,
  worldH: number,
): Grid {
  const g: Grid = [];
  for (let i = 0; i < NX; i++) {
    g[i] = [];
    for (let j = 0; j < NY; j++) {
      const cx = (i + 0.5) * RES;
      const cy = (j + 0.5) * RES;
      g[i][j] =
        cx > 0.3 &&
        cy > 0.3 &&
        cx < worldW - 0.2 &&
        cy < worldH - 0.2 &&
        !blocks.some(
          (b) =>
            cx > b.x0 - PAD &&
            cx < b.x1 + PAD &&
            cy > b.y0 - PAD &&
            cy < b.y1 + PAD,
        );
    }
  }
  return g;
}

export function isFreeAt(
  grid: Grid,
  x: number,
  y: number,
  worldW: number,
  worldH: number,
): boolean {
  if (x < 0.3 || y < 0.3 || x > worldW - 0.2 || y > worldH - 0.2) return false;
  const [i, j] = cellOf(x, y);
  return grid[i][j];
}

export function nearestFree(grid: Grid, cell: [number, number]): [number, number] | null {
  const [i, j] = cell;
  if (grid[i][j]) return [i, j];
  let best: [number, number] | null = null;
  let bd = 1e9;
  for (let a = 0; a < NX; a++) {
    for (let b = 0; b < NY; b++) {
      if (!grid[a][b]) continue;
      const d = (a - i) ** 2 + (b - j) ** 2;
      if (d < bd) {
        bd = d;
        best = [a, b];
      }
    }
  }
  return best;
}

export function findPath(
  grid: Grid,
  sx: number,
  sy: number,
  gx: number,
  gy: number,
): [number, number][] {
  const s = nearestFree(grid, cellOf(sx, sy));
  const g = nearestFree(grid, cellOf(gx, gy));
  if (!s || !g) return [[gx, gy]];

  const hf = (a: [number, number]): number => {
    const dx = Math.abs(a[0] - g[0]);
    const dy = Math.abs(a[1] - g[1]);
    return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
  };

  const gS = new Map<number, number>([[cellKey(...s), 0]]);
  const fS = new Map<number, number>([[cellKey(...s), hf(s)]]);
  const came = new Map<number, [number, number]>();
  const closed = new Set<number>();
  const open: [number, number][] = [s];

  while (open.length) {
    open.sort((a, b) => fS.get(cellKey(...a))! - fS.get(cellKey(...b))!);
    const cur = open.shift()!;
    const ck = cellKey(...cur);
    if (cur[0] === g[0] && cur[1] === g[1]) {
      const pts: [number, number][] = [];
      let c: [number, number] | undefined = cur;
      while (c) {
        pts.unshift([(c[0] + 0.5) * RES, (c[1] + 0.5) * RES]);
        c = came.get(cellKey(...c));
      }
      pts.shift();
      pts.push([gx, gy]);
      return pts.filter((p, i, arr) => {
        if (i === 0 || i === arr.length - 1) return true;
        const a = arr[i - 1];
        const b = arr[i + 1];
        return (
          Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) >
          1e-6
        );
      });
    }
    closed.add(ck);
    for (const [di, dj] of DIRS) {
      const ni = cur[0] + di;
      const nj = cur[1] + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NY || !grid[ni][nj]) continue;
      if (di && dj && (!grid[cur[0] + di][cur[1]] || !grid[cur[0]][cur[1] + dj]))
        continue;
      const nk = cellKey(ni, nj);
      if (closed.has(nk)) continue;
      const cost = gS.get(ck)! + (di && dj ? 1.4142 : 1);
      if (cost < (gS.has(nk) ? gS.get(nk)! : 1e9)) {
        came.set(nk, cur);
        gS.set(nk, cost);
        fS.set(nk, cost + hf([ni, nj]));
        if (!open.some((o) => o[0] === ni && o[1] === nj)) open.push([ni, nj]);
      }
    }
  }
  return [[gx, gy]];
}

export function reachableSet(grid: Grid, anchor: [number, number]): Set<number> {
  const start = nearestFree(grid, cellOf(anchor[0], anchor[1]));
  if (!start) return new Set();
  const seen = new Set<number>([cellKey(...start)]);
  const q: [number, number][] = [start];
  while (q.length) {
    const [i, j] = q.shift()!;
    for (const [di, dj] of DIRS.slice(0, 4)) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NY || !grid[ni][nj]) continue;
      const k = cellKey(ni, nj);
      if (!seen.has(k)) {
        seen.add(k);
        q.push([ni, nj]);
      }
    }
  }
  return seen;
}

export function randomFree(
  grid: Grid,
  rng: () => number,
  anchor: [number, number],
): [number, number] {
  for (let k = 0; k < 200; k++) {
    const i = Math.floor(rng() * NX);
    const j = Math.floor(rng() * NY);
    if (grid[i][j]) return [(i + 0.5) * RES, (j + 0.5) * RES];
  }
  return anchor;
}

export function levelPath(
  stairs: StairDef[],
  from: number,
  to: number,
): { from: number; st: StairDef }[] {
  if (from === to) return [];
  const prev: Record<number, { from: number; st: StairDef } | null> = { [from]: null };
  const q: number[] = [from];
  while (q.length) {
    const l = q.shift()!;
    if (l === to) break;
    for (const st of stairs) {
      const n = st.lower === l ? st.upper : st.upper === l ? st.lower : null;
      if (n !== null && !(n in prev)) {
        prev[n] = { from: l, st };
        q.push(n);
      }
    }
  }
  const path: { from: number; st: StairDef }[] = [];
  let c: number = to;
  while (prev[c]) {
    path.unshift(prev[c]!);
    c = prev[c]!.from;
  }
  return path;
}

export function planRoute(
  ch: RouteCharacter,
  goalLevel: number,
  gx: number,
  gy: number,
  gridFor: (level: number) => Grid,
  stairs: StairDef[],
  _worldW: number,
  _worldH: number,
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  let lv = ch.level;
  let x = ch.x;
  let y = ch.y;
  for (const { from, st } of levelPath(stairs, lv, goalLevel)) {
    const up = st.lower === from;
    const node = up ? st.lowerNode : st.upperNode;
    legs.push({ type: 'walk', level: lv, pts: findPath(gridFor(lv), x, y, node[0], node[1]) });
    legs.push({ type: 'stair', st, up, t: 0 });
    lv = up ? st.upper : st.lower;
    [x, y] = up ? st.upperNode : st.lowerNode;
  }
  legs.push({ type: 'walk', level: lv, pts: findPath(gridFor(lv), x, y, gx, gy) });
  return legs;
}

export function spotNear(
  target: RouteTarget,
  from: RouteCharacter,
  gridFor: (level: number) => Grid,
  worldW: number,
  worldH: number,
): [number, number] {
  const lv = target.level;
  const tiers: [number, number][][] = [
    [[0.75, -0.75], [-0.75, 0.75], [1.0, -0.5], [-0.5, 1.0]],
    [[0.9, 0], [0, 0.9], [-0.9, 0], [0, -0.9], [1.3, 0], [0, 1.3]],
  ];
  for (const offs of tiers) {
    let best: [number, number] | null = null;
    let bd = 1e9;
    for (const [ox, oy] of offs) {
      const x = target.x + ox;
      const y = target.y + oy;
      if (!isFreeAt(gridFor(lv), x, y, worldW, worldH)) continue;
      const d = Math.hypot(x - from.x, y - from.y) + (from.level === lv ? 0 : 5);
      if (d < bd) {
        bd = d;
        best = [x, y];
      }
    }
    if (best) return best;
  }
  const c = nearestFree(gridFor(lv), cellOf(target.x, target.y));
  if (!c) return [target.x, target.y];
  return [(c[0] + 0.5) * RES, (c[1] + 0.5) * RES];
}
