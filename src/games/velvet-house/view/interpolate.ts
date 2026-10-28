/**
 * Smooth motion between simulation steps. The simulation steps at a fixed 60 Hz while the screen draws at whatever
 * rate it has (60, 90, 120, 144), so a frame can land with no new step or with two. Drawn straight from the latest
 * step, a walker moves in lumps. These blend the previous step toward the latest by `alpha`, the share of a step
 * that has passed, so every frame sits where the walker really is.
 */

interface Moving {
  id?: string;
  level: number;
  x: number;
  y: number;
  z: number;
  face: [number, number] | number[];
  stair?: { s: number } & Record<string, unknown>;
}

/** Farther than this in one step is a jump (a door, a teleport to a seat), not a walk: show it as it is. */
const JUMP = 0.6;

const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

/** The frame `cur` pulled back toward `prev` by (1 - alpha); `cur` itself when there is nothing steady to blend. */
export function blendMoving<T extends Moving>(prev: T | undefined, cur: T, alpha: number): T {
  if (!prev || alpha >= 1 || prev.level !== cur.level || (prev.id !== undefined && prev.id !== cur.id)) return cur;
  if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > JUMP) return cur;
  const out: T = { ...cur, x: mix(prev.x, cur.x, alpha), y: mix(prev.y, cur.y, alpha), z: mix(prev.z, cur.z, alpha) };
  // The facing is blended as a direction and kept a unit length; a half-turn (opposite directions) just snaps.
  const fx = mix(prev.face[0], cur.face[0], alpha), fy = mix(prev.face[1], cur.face[1], alpha), fl = Math.hypot(fx, fy);
  if (fl > 0.2) out.face = [fx / fl, fy / fl];
  if (prev.stair && cur.stair) out.stair = { ...cur.stair, s: mix(prev.stair.s, cur.stair.s, alpha) };
  return out;
}

/** Blend a list of frames with the same list one step earlier (matched by position, and by id where there is one). */
export function blendFrames<T extends Moving>(prev: readonly T[], cur: readonly T[], alpha: number): T[] {
  return cur.map((c, i) => blendMoving(prev[i], c, alpha));
}
