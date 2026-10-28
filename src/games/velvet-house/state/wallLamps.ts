import { LEVELS, WALL_LIGHTS, WX, WY, roomName, type WallSide } from './house';
import { footprint, TYPES, type ObjectInstance } from './objects';

/**
 * Wall lamps: sconces the player can hang where they like on the outer walls. The house starts with the ones in
 * `WALL_LIGHTS`; after that a lamp is a plain record (which wall, how far along, how high, which style), kept in the
 * save's flags, so moving one never touches the furniture or the floor plan.
 */

export const LAMP_STYLES = ['classic', 'swing', 'cylinder', 'globe', 'candle', 'lantern', 'deco', 'cage'] as const;
export type LampStyle = typeof LAMP_STYLES[number];

export const LAMP_NAMES: Record<LampStyle, string> = {
  classic: 'Drum shade lamp', swing: 'Brass swing-arm lamp', cylinder: 'Cylinder lamp', globe: 'Globe lamp',
  candle: 'Candle sconce', lantern: 'Lantern', deco: 'Deco fan lamp', cage: 'Cage bulb lamp',
};
export const LAMP_PRICES: Record<LampStyle, number> = { classic: 45, swing: 70, cylinder: 55, globe: 50, candle: 60, lantern: 75, deco: 90, cage: 40 };

export interface WallLamp {
  id: string;
  level: number;
  /** The wall it hangs on: B is the back wall along x, L the left wall along y. */
  p: 'B' | 'L';
  /** How far along the wall, in world units. */
  u: number;
  /** How high, in world units. */
  z: number;
  style: LampStyle;
  /** How far its light reaches. */
  r: number;
  /** A lamp the house keeps lit at night even when nobody is about, and one that lights a whole room's air (the yard). */
  night?: boolean;
  amb?: boolean;
  /** Only in one kind of house (a craftsman's dining room). */
  onlyIn?: string;
}

export const LAMP_Z = { min: 1.3, max: 2.15, step: 0.05 };
const END_MARGIN = 0.35;
/** Lamps closer than this along one wall read as a cluster. */
const LAMP_GAP = 0.5;
const HALF = 0.17;
const STRUCTURAL = new Set(['flightX', 'flightY', 'holeX', 'holeY']);

export const isLampStyle = (s: unknown): s is LampStyle => typeof s === 'string' && (LAMP_STYLES as readonly string[]).includes(s);

/** The sconces the house is built with. */
export function defaultWallLamps(): WallLamp[] {
  const out: WallLamp[] = [];
  WALL_LIGHTS.forEach((L, i) => {
    if (L.k !== 'sconce' || (L.p !== 'B' && L.p !== 'L')) return;
    out.push({ id: `wl${i}`, level: L.level, p: L.p, u: Math.round(((L.u[0] + L.u[1]) / 2) * 20) / 20, z: L.z, style: isLampStyle(L.style) ? L.style : 'classic', r: L.r, ...(L.night ? { night: true } : {}), ...(L.amb ? { amb: true } : {}), ...(L.onlyIn ? { onlyIn: L.onlyIn } : {}) });
  });
  return out;
}

/** What a save holds, made safe: unknown styles, walls and numbers are dropped or clamped. */
export function readWallLamps(raw: unknown): WallLamp[] | null {
  if (!Array.isArray(raw)) return null;
  const out: WallLamp[] = [];
  for (const q of raw as Array<Record<string, unknown>>) {
    if (!q || typeof q.id !== 'string' || (q.p !== 'B' && q.p !== 'L') || !isLampStyle(q.style)) continue;
    const level = Number(q.level), u = Number(q.u), z = Number(q.z);
    if (!LEVELS[level] || !Number.isFinite(u) || !Number.isFinite(z)) continue;
    out.push({ id: q.id, level, p: q.p, u: clampU(q.p, u), z: clampZ(z), style: q.style, r: Number.isFinite(Number(q.r)) ? Number(q.r) : 130,
      ...(q.night ? { night: true } : {}), ...(q.amb ? { amb: true } : {}), ...(typeof q.onlyIn === 'string' ? { onlyIn: q.onlyIn } : {}) });
  }
  return out;
}

export const wallLength = (p: WallSide): number => (p === 'B' ? WX : WY);
const clampU = (p: WallSide, u: number): number => Math.round(Math.min(wallLength(p) - END_MARGIN, Math.max(END_MARGIN, u)) * 20) / 20;
const clampZ = (z: number): number => Math.round(Math.min(LAMP_Z.max, Math.max(LAMP_Z.min, z)) * 20) / 20;

/** Round a wall point to the lamp grid and keep it on the wall. */
export function snapLamp(p: 'B' | 'L', u: number, z: number): { p: 'B' | 'L'; u: number; z: number } {
  return { p, u: clampU(p, u), z: clampZ(z) };
}

/** A point on the floor beside the lamp, for naming its room. */
export const lampFloorPoint = (l: Pick<WallLamp, 'p' | 'u'>): [number, number] => (l.p === 'B' ? [l.u, 0.5] : [0.5, l.u]);
export const lampRoom = (l: Pick<WallLamp, 'level' | 'p' | 'u'>): string => roomName(l.level, ...lampFloorPoint(l));

export interface LampCheck { ok: boolean; reason?: string }

/**
 * Can this lamp hang where it is? It must clear windows, doors and what hangs beside them, the other lamps, and any
 * tall piece standing against the wall right there.
 */
export function checkLamp(lamps: readonly WallLamp[], lamp: WallLamp, objs: readonly ObjectInstance[] = []): LampCheck {
  const level = LEVELS[lamp.level];
  if (!level) return { ok: false, reason: 'There is no wall there.' };
  if (lamp.u < END_MARGIN - 1e-6 || lamp.u > wallLength(lamp.p) - END_MARGIN + 1e-6) return { ok: false, reason: 'That is too near the corner.' };
  for (const f of level.feats) {
    if (f.p !== lamp.p || f.k === 'tiles') continue;
    const clear = lamp.u + HALF < f.u[0] - 0.05 || lamp.u - HALF > f.u[1] + 0.05 || lamp.z + 0.3 < f.z[0] || lamp.z - 0.3 > f.z[1];
    if (!clear) return { ok: false, reason: f.k === 'window' || f.k === 'highwin' || f.k === 'extwin' ? 'The window is in the way.' : f.k === 'door' ? 'The door is in the way.' : 'There is something on the wall there.' };
  }
  for (const o of lamps) {
    if (o.id === lamp.id || o.level !== lamp.level || o.p !== lamp.p) continue;
    if (Math.abs(o.u - lamp.u) < LAMP_GAP) return { ok: false, reason: 'Another lamp is right there.' };
  }
  for (const o of objs) {
    // A stair rises beside its wall and a lamp hangs above it; only furniture blocks.
    if (o.level !== lamp.level || o.on || !TYPES[o.type] || TYPES[o.type].rug || STRUCTURAL.has(o.type)) continue;
    const [fw, fd] = footprint(o), h = TYPES[o.type].h ?? 1;
    // Against the lamp's wall (within a pace of it) and under the lamp's spot (a piece taller than the lamp's bottom).
    const along = lamp.p === 'B' ? [o.x, o.x + fw] : [o.y, o.y + fd], near = lamp.p === 'B' ? o.y < 0.75 : o.x < 0.75;
    // Slim things (a floor lamp, a plant) stand under a lamp without touching it; a wide piece that tall is in the way.
    if (near && along[1] - along[0] >= 0.45 && along[0] < lamp.u + HALF && along[1] > lamp.u - HALF && h > lamp.z - 0.2) return { ok: false, reason: `The ${(TYPES[o.type].name ?? 'piece').toLowerCase()} is in the way.` };
  }
  return { ok: true };
}

/** A free spot for a new lamp on this floor (the walls in plan order, steps along each, at a usual height), or null. */
export function freeLampSpot(lamps: readonly WallLamp[], level: number, objs: readonly ObjectInstance[] = [], z = 1.8): { p: 'B' | 'L'; u: number; z: number } | null {
  for (const p of ['B', 'L'] as const) {
    for (let u = END_MARGIN + 0.15; u <= wallLength(p) - END_MARGIN; u += 0.25) {
      const probe: WallLamp = { id: '_probe', level, p, u: clampU(p, u), z, style: 'classic', r: 130 };
      if (checkLamp(lamps, probe, objs).ok) return { p, u: probe.u, z };
    }
  }
  return null;
}
