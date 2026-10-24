// 3-Point Shootout: the rules and the shot mechanic, with no drawing or sound,
// so they can be tested. Distances are in metres, times in seconds.
//
// Format follows the NBA 3-point contest: five racks around the arc (four
// balls worth 1 and a money ball worth 2; one rack is all money balls), two
// deep "Starry" balls worth 3, and a clock. Shooting is timing-based like a
// 2K jumper: hold to rise into the jump, release at the top. Release inside
// the green window and it's a make; the further off, the worse it goes.

export type Outcome = 'swish' | 'make' | 'rim-in' | 'rim-out' | 'brick' | 'airball';

export interface Ball { kind: 'regular' | 'money' | 'starry'; points: number }

export interface Spot {
  id: string;
  label: string;
  /** Angle from straight-on, degrees: -90 left corner, 0 top of the key, 90 right corner. */
  angle: number;
  /** Distance to the rim. */
  dist: number;
  balls: Ball[];
}

export interface Level {
  id: number;
  name: string;
  /** Total width of the green (perfect) window, seconds. */
  green: number;
  /** How long a full jump takes, hold to peak. Shorter is quicker to read. */
  rise: number;
  /** Score needed to unlock the next level. */
  unlockAt: number;
  clock: number;
}

export const LEVELS: Level[] = [
  { id: 0, name: 'Rookie', green: 0.11, rise: 0.78, unlockAt: 14, clock: 75 },
  { id: 1, name: 'Starter', green: 0.085, rise: 0.72, unlockAt: 18, clock: 72 },
  { id: 2, name: 'Pro', green: 0.065, rise: 0.66, unlockAt: 22, clock: 70 },
  { id: 3, name: 'All-Star', green: 0.048, rise: 0.6, unlockAt: 26, clock: 70 },
  { id: 4, name: 'Legend', green: 0.034, rise: 0.55, unlockAt: Infinity, clock: 68 },
];

export const RIM_HEIGHT = 3.05;
export const THREE_TOP = 7.24;
export const THREE_CORNER = 6.7;

const regular = (): Ball => ({ kind: 'regular', points: 1 });
const money = (): Ball => ({ kind: 'money', points: 2 });

/** Five racks (one all money balls, wherever you choose) and two Starry spots, in shooting order. */
export function buildCourse(moneyRack = 4): Spot[] {
  const racks: Array<[string, string, number, number]> = [
    ['lc', 'Left corner', -90, THREE_CORNER],
    ['lw', 'Left wing', -45, THREE_TOP],
    ['top', 'Top of the key', 0, THREE_TOP],
    ['rw', 'Right wing', 45, THREE_TOP],
    ['rc', 'Right corner', 90, THREE_CORNER],
  ];
  const spots: Spot[] = [];
  racks.forEach(([id, label, angle, dist], i) => {
    const balls = i === moneyRack ? [money(), money(), money(), money(), money()] : [regular(), regular(), regular(), regular(), money()];
    spots.push({ id, label, angle, dist, balls });
    // The Starry balls sit deep, between the wings and the top.
    if (i === 1) spots.push({ id: 'sl', label: 'Starry range', angle: -22, dist: 8.5, balls: [{ kind: 'starry', points: 3 }] });
    if (i === 2) spots.push({ id: 'sr', label: 'Starry range', angle: 22, dist: 8.5, balls: [{ kind: 'starry', points: 3 }] });
  });
  return spots;
}

export const MAX_SCORE = (course: Spot[]) => course.reduce((n, s) => n + s.balls.reduce((m, b) => m + b.points, 0), 0);

/**
 * The window for one shot. Money and Starry balls are a touch harder, longer
 * shots shrink it a little, and so does getting tired late in a rack.
 */
export function shotWindow(level: Level, spot: Spot, ball: Ball, ballIndex: number): { green: number; rise: number } {
  let g = level.green;
  if (ball.kind === 'money') g *= 0.85;
  if (ball.kind === 'starry') g *= 0.7;
  g *= 1 - Math.max(0, spot.dist - THREE_CORNER) * 0.06;
  g *= 1 - ballIndex * 0.03;
  // Corner and deep shots release a hair later (longer motion).
  const rise = level.rise + (spot.dist > 8 ? 0.06 : 0) + (Math.abs(spot.angle) === 90 ? -0.02 : 0);
  return { green: g, rise };
}

/**
 * Each run gets its own release point, so the timing can't be memorised
 * across games: some runs want an early release (on the way up), some the top
 * of the jump, some a late one (holding at the peak). Returned as a fraction
 * of the jump: the green centre sits at rise * (1 + shift).
 */
export type ReleaseStyle = 'early' | 'set' | 'late';
export function pickRelease(rand: () => number = Math.random): { style: ReleaseStyle; shift: number } {
  const r = rand(), j = rand();
  // Subtle on purpose: slightly early, the top, or slightly late.
  if (r < 1 / 3) return { style: 'early', shift: -0.14 + j * 0.06 };
  if (r < 2 / 3) return { style: 'set', shift: -0.03 + j * 0.06 };
  return { style: 'late', shift: 0.08 + j * 0.06 };
}

export type Grade = 'perfect' | 'good' | 'early' | 'late' | 'very-early' | 'very-late';

/**
 * Judge a release. `held` is how long the button was held; the peak of the
 * jump (and the centre of the green) is at `rise`. Returns the timing error
 * in seconds (negative = early) and a grade.
 */
export function judge(held: number, rise: number, green: number): { error: number; grade: Grade } {
  const error = held - rise;
  const a = Math.abs(error);
  if (a <= green / 2) return { error, grade: 'perfect' };
  if (a <= green * 1.6) return { error, grade: 'good' };
  if (a <= green * 3.5) return { error, grade: error < 0 ? 'early' : 'late' };
  return { error, grade: error < 0 ? 'very-early' : 'very-late' };
}

/**
 * What happens to the ball. The make zone runs from slightly early to
 * slightly late: perfect releases (dead centre) go in clean, good ones always
 * go in too (sometimes off the rim); outside that they mostly rattle out, and
 * way off is a brick or an airball. `rand` is injectable for tests.
 */
export function resolveShot(grade: Grade, rand: () => number = Math.random): Outcome {
  const r = rand();
  switch (grade) {
    case 'perfect': return r < 0.7 ? 'swish' : 'make';
    case 'good': return r < 0.25 ? 'swish' : r < 0.7 ? 'make' : 'rim-in';
    case 'early':
    case 'late': return r < 0.22 ? 'rim-in' : r < 0.75 ? 'rim-out' : 'brick';
    case 'very-early': return r < 0.6 ? 'airball' : 'brick';
    case 'very-late': return r < 0.7 ? 'brick' : 'rim-out';
  }
}

export const isMake = (o: Outcome) => o === 'swish' || o === 'make' || o === 'rim-in';

// ---- Scoring -----------------------------------------------------------------

/**
 * How shots score. Classic is the real contest's 1/2/3. Contest adds +1 for
 * every perfect release. Score Attack is in big round numbers: 100 a point,
 * half again for a perfect, and back-to-back perfects build a multiplier.
 */
export type ScoringMode = 'classic' | 'contest' | 'attack';

/** Score Attack multiplier for a run of perfect releases (1 = this is the first). */
export function perfectMultiplier(chain: number): number {
  return Math.min(2, 1 + Math.max(0, chain - 1) * 0.1);
}

export function shotPoints(mode: ScoringMode, ball: Ball, made: boolean, perfect: boolean, chain: number): number {
  if (!made) return 0;
  if (mode === 'classic') return ball.points;
  if (mode === 'contest') return ball.points + (perfect ? 1 : 0);
  const base = ball.points * 100 * (perfect ? 1.5 : 1) * (perfect ? perfectMultiplier(chain) : 1);
  return Math.round(base / 10) * 10;
}

/** Streak bonus: three in a row puts you "on fire", which widens your window a little. */
export function fireBoost(streak: number): number {
  return streak >= 3 ? 1.25 : 1;
}

/** Stars for a run: 1 at the unlock score, 2 at 80% of max, 3 at a near-perfect round. */
export function starsFor(score: number, level: Level, max: number): number {
  if (score >= max * 0.92) return 3;
  if (score >= max * 0.7) return 2;
  if (score >= Math.min(level.unlockAt, max * 0.5)) return 1;
  return 0;
}

/** Where a spot is on the floor: x across the court, y out from the rim (metres). */
export function spotPosition(spot: Spot): [number, number] {
  const a = (spot.angle * Math.PI) / 180;
  return [Math.sin(a) * spot.dist, Math.cos(a) * spot.dist];
}
