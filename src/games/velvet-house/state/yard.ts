import type { RNG } from './rng';
import { isOutdoor } from './scenes';

export interface YardTile {
  i: number;
  j: number;
  len: number;
  water: number;
  weed: number;
  seed: number;
  burn: number;
  mowedAt: number;
  leaves: number;
  snow: number;
  claim?: unknown;
  x?: number;
  y?: number;
}

export interface YardState {
  tiles: YardTile[];
  rainAt: number;
  rainUntil: number;
  rainCheck: number;
  rainLogged: boolean;
}

export interface LawnStats {
  len: number;
  water: number;
  weeds: number;
  leafy: number;
  snow: number;
  label: string;
}

export interface SprinklerPos {
  x: number;
  y: number;
  runUntil: number;
}

export interface GardenPlot {
  x: number;
  y: number;
  wet: number;
  grow: number;
  ripeLogged?: boolean;
}

export const YARD_W = 10;
export const YARD_D = 8;
export const SEASON_GROW = [1.3, 1.15, 0.6, 0];
export const SEASON_DRY = [1, 1.5, 0.8, 0.3];
export const SEASON_RAIN_CHANCE = [0.3, 0.15, 0.22, 0.32];
export const RAIN_MIN_DURATION = 120;
export const RAIN_MAX_DURATION = 360;
export const WEED_THRESHOLD = 0.35;
export const LEAF_THRESHOLD = 0.4;
export const PATIO_I_MAX = 2;
export const PATIO_J_MIN = 2;
export const PATIO_J_MAX = 4;

export function isPatio(i: number, j: number): boolean {
  return i <= PATIO_I_MAX && j >= PATIO_J_MIN && j <= PATIO_J_MAX;
}

export function tileAt(tiles: YardTile[], x: number, y: number): YardTile | null {
  const i = Math.min(YARD_W - 1, Math.max(0, Math.floor(x)));
  const j = Math.min(YARD_D - 1, Math.max(0, Math.floor(y)));
  return tiles[i * YARD_D + j] || null;
}

export function initYard(rng: RNG): YardState {
  const tiles: YardTile[] = [];
  for (let i = 0; i < YARD_W; i++) {
    for (let j = 0; j < YARD_D; j++) {
      tiles.push({
        i, j,
        len: 0.3 + rng.next() * 0.15,
        water: 0.6 + rng.next() * 0.2,
        weed: 0,
        seed: rng.next(),
        burn: 0,
        mowedAt: -9999,
        leaves: 0,
        snow: 0,
      });
    }
  }
  return { tiles, rainAt: 0, rainUntil: 0, rainCheck: -1, rainLogged: false };
}

export function lawnStats(tiles: YardTile[], seasonIdx: number): LawnStats {
  const ts = tiles.filter(t => !isPatio(t.i, t.j));
  const leafy = ts.filter(t => t.leaves > LEAF_THRESHOLD).length;
  const snow = ts.reduce((a, t) => a + t.snow, 0) / ts.length;
  const len = ts.reduce((a, t) => a + t.len, 0) / ts.length;
  const water = ts.reduce((a, t) => a + t.water, 0) / ts.length;
  const weeds = ts.filter(t => t.weed > WEED_THRESHOLD).length;
  const label = snow > 0.4 ? 'Under snow'
    : seasonIdx === 3 ? 'Dormant'
    : leafy >= 10 ? 'Covered in leaves'
    : weeds >= 7 ? 'Weedy'
    : len > 0.72 ? 'Overgrown'
    : len > 0.5 ? 'Shaggy'
    : water < 0.25 ? 'Dry'
    : 'Lush';
  return { len, water, weeds, leafy, snow, label };
}

export function raining(yard: YardState, absMin: number): boolean {
  return absMin >= yard.rainAt && absMin < yard.rainUntil;
}

export function rollRain(yard: YardState, rng: RNG, seasonIdx: number, absMin: number): void {
  yard.rainCheck = Math.floor(absMin / 1440);
  if (rng.next() < SEASON_RAIN_CHANCE[seasonIdx]) {
    yard.rainAt = absMin + rng.next() * 600;
    yard.rainUntil = yard.rainAt + RAIN_MIN_DURATION + rng.next() * RAIN_MAX_DURATION;
    yard.rainLogged = false;
  }
}

export function yardTick(
  yard: YardState,
  gm: number,
  absMin: number,
  seasonIdx: number,
  rng: RNG,
  treePos: [number, number] | null,
  sprinklers: SprinklerPos[],
  gardens: GardenPlot[]
): boolean {
  const d = gm / 1440;
  const dayNo = Math.floor(absMin / 1440);
  const grow = SEASON_GROW[seasonIdx];
  const dry = SEASON_DRY[seasonIdx];

  if (yard.rainCheck !== dayNo) {
    rollRain(yard, rng, seasonIdx, absMin);
  }
  const rain = raining(yard, absMin);
  const rainedStarted = rain && !yard.rainLogged;
  if (rainedStarted) yard.rainLogged = true;

  const [tx0, ty0] = treePos || [8, 1];

  yard.tiles.forEach(t => {
    if (isPatio(t.i, t.j)) return;
    t.water = Math.max(0, t.water - d * 0.45 * dry);
    if (rain && seasonIdx !== 3) t.water = Math.min(1, t.water + gm / 60 * 0.5);
    if (rain && seasonIdx === 3) t.snow = Math.min(1, t.snow + gm / 60 * 0.45);
    else if (seasonIdx !== 3) t.snow = Math.max(0, t.snow - d * 2);

    if (seasonIdx === 2) {
      const dd = Math.hypot(t.i + 0.5 - tx0, t.j + 0.5 - ty0);
      t.leaves = Math.min(1, t.leaves + d * (0.12 + Math.max(0, 1 - dd / 5) * 0.9) * (0.5 + t.seed));
    } else if (seasonIdx === 0 && t.leaves) {
      t.leaves = Math.max(0, t.leaves - d * 0.5);
    }

    if (t.leaves > 0.75) t.burn = Math.min(1, t.burn + d * 0.2);

    for (const sp of sprinklers) {
      if (Math.hypot(t.i + 0.5 - sp.x, t.j + 0.5 - sp.y) < 3.2 && absMin < sp.runUntil) {
        t.water = Math.min(1, t.water + gm / 60 * 0.9);
      }
    }

    t.len = Math.min(1, t.len + d * 0.3 * (0.4 + t.water) * grow);
    if (grow > 0 && (t.len > 0.55 || t.water < 0.25) && t.seed > 0.45) {
      t.weed = Math.min(1, t.weed + d * 0.5 * t.seed);
    }
    t.burn = Math.max(0, t.burn - d * 0.3);
  });

  gardens.forEach(g => {
    g.wet = Math.max(0, g.wet - d * 0.6);
    if (rain || sprinklers.some(s => Math.hypot(s.x - g.x, s.y - g.y) < 3.4 && absMin < s.runUntil)) {
      g.wet = 1;
    }
    if (g.wet > 0.2 && seasonIdx !== 3) {
      g.grow = Math.min(1, g.grow + d * 0.35 * (seasonIdx === 2 ? 1.2 : 1));
    }
  });

  return rainedStarted;
}

export function mowPath(isFreeAt: (lv: number, x: number, y: number) => boolean): [number, number][] {
  const pts: [number, number][] = [];
  for (let j = 0; j < YARD_D; j++) {
    const row: [number, number][] = [];
    for (let i = 0; i < YARD_W; i++) {
      if (isPatio(i, j)) continue;
      const x = i + 0.5, y = j + 0.5;
      if (isFreeAt(3, x, y)) row.push([x, y]);
    }
    if (j % 2) row.reverse();
    pts.push(...row);
  }
  return pts;
}

export function mowTile(tile: YardTile, absMin: number): void {
  tile.len = 0.06;
  tile.mowedAt = absMin;
  tile.weed = Math.min(tile.weed, 0.3);
}

export function rakeTargetTiles(tiles: YardTile[], cx: number, cy: number): YardTile | null {
  const cands = tiles.filter(t => t.leaves > LEAF_THRESHOLD && !t.claim && !isPatio(t.i, t.j));
  if (!cands.length) return null;
  cands.sort((a, b) =>
    Math.hypot(a.i + 0.5 - cx, a.j + 0.5 - cy) -
    Math.hypot(b.i + 0.5 - cx, b.j + 0.5 - cy)
  );
  const t = cands[0];
  t.x = t.i + 0.5;
  t.y = t.j + 0.5;
  return t;
}

export function weedTargetTiles(tiles: YardTile[], cx: number, cy: number, level: number): YardTile | null {
  const cands = tiles.filter(t => t.weed > WEED_THRESHOLD && !t.claim && !isPatio(t.i, t.j));
  if (!cands.length) return null;
  cands.sort((a, b) =>
    Math.hypot(a.i + 0.5 - cx, a.j + 0.5 - cy) + (isOutdoor(level) ? 0 : 5) -
    Math.hypot(b.i + 0.5 - cx, b.j + 0.5 - cy)
  );
  const t = cands[0];
  t.x = t.i + 0.5;
  t.y = t.j + 0.5;
  return t;
}

export function grassColor(t: YardTile, seasonIdx: number, absMin: number): string {
  const w = Math.min(1, t.water * 1.4);
  const dry = [194, 176, 96];
  const wet = [94, 158, 69];
  let c = dry.map((v, k) => v + (wet[k] - v) * w);
  if (t.burn > 0.05) c = c.map((v, k) => v + ([180, 154, 76][k] - v) * Math.min(1, t.burn));
  if (seasonIdx === 3) c = c.map((v, k) => v + ([167, 159, 120][k] - v) * 0.7);
  else if (seasonIdx === 2) c = c.map((v, k) => v + ([150, 150, 80][k] - v) * 0.2);
  const dark = 1 - t.len * 0.16 + (absMin - t.mowedAt < 2160 ? (t.j % 2 ? 0.06 : -0.05) : 0);
  return `rgb(${c.map(v => Math.round(Math.min(255, v * dark))).join(',')})`;
}
