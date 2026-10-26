import type { RNG } from './rng';
import { isOutdoor } from './scenes';

export type DirtKind = 'floor' | 'wall';
export type DirtType =
  | 'mud' | 'paws' | 'crumbs' | 'spill' | 'water' | 'sweat' | 'scuff'
  | 'fur' | 'dust' | 'puddle' | 'grease' | 'hand' | 'scuffw' | 'smudge';

export interface DirtSpot {
  id: number;
  level: number;
  kind: DirtKind;
  type: DirtType;
  a: number;
  max: number;
  claim: unknown | null;
  x?: number;
  y?: number;
  p?: string;
  u?: number;
  z?: number;
  stand?: number[];
  col?: string;
}

export interface ScrubLogEntry {
  who: unknown;
  at: number;
  level: number;
}

export const MESS_AFTER: Record<string, [DirtType, number]> = {
  eat: ['crumbs', 0.45],
  eatOut: ['crumbs', 0.4],
  sip: ['spill', 0.18],
  workout: ['sweat', 0.4],
  lift: ['sweat', 0.3],
  shower: ['water', 0.45],
  dance: ['scuff', 0.25],
  danceTogether: ['scuff', 0.2],
};

export const MAX_DIRT_PER_LEVEL = 18;
export const DIRT_GROWTH_RATE = 75;
export const DIRT_TICK_INTERVAL = 15;
export const SCRUB_THRESHOLD = 0.12;
export const DEEP_CLEAN_WINDOW = 300;
export const DEEP_CLEAN_LEVELS = 3;

export function messOf(dirt: DirtSpot[], level?: number): number {
  return dirt.reduce(
    (sum, d) => sum + (level === undefined || d.level === level ? Math.min(1.4, d.a) : 0),
    0
  );
}

export function messLabel(m: number): string {
  if (m < 1.5) return 'Spotless';
  if (m < 6) return 'Lived-in';
  if (m < 12) return 'Messy';
  return 'Filthy';
}

export function addDirt(
  dirt: DirtSpot[],
  idCounter: { id: number },
  level: number,
  kind: DirtKind,
  type: DirtType,
  a: number,
  b: number,
  z?: number,
  stand?: number[]
): DirtSpot | null {
  const here = dirt.filter(d => d.level === level);
  if (here.length >= MAX_DIRT_PER_LEVEL) {
    const d = here[Math.floor(Math.random() * here.length)];
    d.max = Math.min(1.4, d.max + 0.2);
    return null;
  }
  const d: DirtSpot = {
    id: ++idCounter.id,
    level,
    kind,
    type,
    a: 0,
    max: 1,
    claim: null,
  };
  if (kind === 'floor') {
    d.x = a;
    d.y = b;
  } else {
    d.p = String(a);
    d.u = b;
    d.z = z;
    if (stand) d.stand = stand;
  }
  dirt.push(d);
  return d;
}

export function dirtNear(
  dirt: DirtSpot[],
  idCounter: { id: number },
  rng: RNG,
  level: number,
  type: DirtType,
  cx: number,
  cy: number,
  isFreeAt: (lv: number, x: number, y: number) => boolean,
  r = 0.5
): DirtSpot | null {
  if (isOutdoor(level)) return null;
  for (let k = 0; k < 8; k++) {
    const x = cx + (rng.next() - 0.5) * 2 * r;
    const y = cy + (rng.next() - 0.5) * 2 * r;
    if (isFreeAt(level, x, y)) {
      return addDirt(dirt, idCounter, level, 'floor', type, x, y);
    }
  }
  return null;
}

export function growDirt(dirt: DirtSpot[], gm: number): void {
  for (const d of dirt) {
    if (!d.claim && d.a < d.max) {
      d.a = Math.min(d.max, d.a + gm / DIRT_GROWTH_RATE);
    }
  }
}

export function scrubProgress(d: DirtSpot, time: number, dur: number): number {
  if (d.a <= 0) return 0;
  return Math.max(0, d.a * (1 - time / dur));
}

export function deepCleaned(scrubLog: ScrubLogEntry[], jordanRef: unknown, absMin: number): boolean {
  const r = scrubLog.filter(e => e.who === jordanRef && absMin - e.at < DEEP_CLEAN_WINDOW);
  return new Set(r.map(e => e.level)).size >= DEEP_CLEAN_LEVELS;
}

export function dirtSeed(n: number): () => number {
  let v = (n * 7919) % 233280;
  return () => {
    v = (v * 9301 + 49297) % 233280;
    return v / 233280;
  };
}
