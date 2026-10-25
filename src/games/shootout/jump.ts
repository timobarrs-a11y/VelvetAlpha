// The jump shot's body motion: dip, explosive takeoff, hang at the top, fall
// and landing. Visual only (your eyes in first person, the athlete from the
// broadcast camera): the timing rules never read it. The top of the jump
// comes exactly at `rise` seconds into the hold, as the meter has always had it.

export const JUMP = {
  /** How far the knees bend before takeoff, metres. */
  dip: 0.17,
  /** Height of the jump at its top, metres. */
  height: 0.55,
  /** Real gravity, so the flight is snappy, not floaty. */
  g: 9.8,
  /** The shortest dip before takeoff, seconds. */
  minDip: 0.12,
  /** How far the knees give on landing, metres, and how long that takes. */
  land: 0.1,
  landTime: 0.3,
};

export interface JumpState {
  /** Height above standing, metres (negative while the knees are bent). */
  y: number;
  /** Vertical speed, metres a second. */
  vy: number;
}

/** Seconds from takeoff to the top under real gravity. */
const AIR = Math.sqrt((2 * (JUMP.height + JUMP.dip)) / JUMP.g);

/**
 * When the feet leave the floor, seconds into the hold. The flight to the top
 * takes the same time under real gravity at every level, so a longer rise means
 * a longer load in the knees first; the top always lands exactly at `rise`.
 */
export const takeoffAt = (rise: number): number => Math.max(JUMP.minDip, rise - AIR);

/** Gravity for this rise: real, unless the rise is too short to fit the dip and the flight. */
const gravity = (rise: number): number => {
  const t = rise - takeoffAt(rise);
  return (2 * (JUMP.height + JUMP.dip)) / (t * t);
};

/** Where you are `held` seconds into the hold. */
export function jumpAt(held: number, rise: number): JumpState {
  const td = takeoffAt(rise);
  if (held < td) {
    const k = held / td;
    return { y: -JUMP.dip * k * k * (3 - 2 * k), vy: (-JUMP.dip * 6 * k * (1 - k)) / td };
  }
  const g = gravity(rise), v0 = g * (rise - td), s = held - td;
  return { y: -JUMP.dip + v0 * s - 0.5 * g * s * s, vy: v0 - g * s };
}

/**
 * After the release: the rest of the flight from where you let go, then the
 * landing (knees give and come back). `t` is seconds since release; settles to 0.
 */
export function jumpAfter(from: JumpState, rise: number, t: number): number {
  const g = gravity(rise);
  // Let go while still dipping: just straighten up.
  if (from.y <= 0) return t >= 0.2 ? 0 : from.y * (1 - t / 0.2);
  const down = (from.vy + Math.sqrt(from.vy * from.vy + 2 * g * from.y)) / g;
  if (t < down) return from.y + from.vy * t - 0.5 * g * t * t;
  const k = (t - down) / JUMP.landTime;
  return k >= 1 ? 0 : -JUMP.land * Math.sin(k * Math.PI);
}

/** Seconds from release until you've landed and stood back up. */
export function jumpSettles(from: JumpState, rise: number): number {
  if (from.y <= 0) return 0.2;
  const g = gravity(rise);
  return (from.vy + Math.sqrt(from.vy * from.vy + 2 * g * from.y)) / g + JUMP.landTime;
}
