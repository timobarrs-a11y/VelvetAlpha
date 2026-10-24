// AI rivals for the contest: who they are, and their runs, simulated up front
// so a run can be watched live in 3D or skipped with the same result. Pure
// rules, no drawing or sound, so it can be tested.

import { buildCourse, isMake, resolveShot, shotWindow, type Ball, type Grade, type Level, type Outcome, type Spot } from './engine';

export type RivalStyle = 'steady' | 'streaky' | 'clutch' | 'quick';

export interface Rival {
  id: string;
  name: string;
  /** Short broadcast nickname line. */
  tag: string;
  style: RivalStyle;
  /** Jersey colours: body, trim. */
  colors: [string, string];
  number: number;
  /** Seconds from catching the ball to starting the jump. */
  gather: number;
  /** Shooting touch on top of the level's base (about -0.08 to +0.08). */
  touch: number;
}

export const ROSTER: Rival[] = [
  { id: 'ice', name: 'Mara "Ice" Okafor', tag: 'Never blinks', style: 'steady', colors: ['#1E3A8A', '#93C5FD'], number: 4, gather: 0.42, touch: 0.03 },
  { id: 'splash', name: 'Dev "Splash" Reyes', tag: 'Hot or cold, never lukewarm', style: 'streaky', colors: ['#0F766E', '#5EEAD4'], number: 11, gather: 0.36, touch: 0.02 },
  { id: 'clutch', name: 'Jules Mbeki', tag: 'Lives for the money ball', style: 'clutch', colors: ['#7C2D12', '#FDBA74'], number: 23, gather: 0.45, touch: 0 },
  { id: 'flash', name: 'Kenji "Flash" Sato', tag: 'Fastest release in the field', style: 'quick', colors: ['#581C87', '#D8B4FE'], number: 7, gather: 0.24, touch: -0.02 },
  { id: 'vee', name: 'Valentina Cruz', tag: 'Pure form, corner specialist', style: 'steady', colors: ['#B91C1C', '#FECACA'], number: 9, gather: 0.4, touch: 0.01 },
  { id: 'bo', name: 'Bo "Microwave" Lindqvist', tag: 'Heats up in a hurry', style: 'streaky', colors: ['#CA8A04', '#FEF08A'], number: 33, gather: 0.33, touch: -0.01 },
  { id: 'nia', name: 'Nia Adeyemi', tag: 'Ice water in the veins', style: 'clutch', colors: ['#065F46', '#A7F3D0'], number: 3, gather: 0.44, touch: 0.02 },
  { id: 'rook', name: 'Theo Park', tag: 'The rookie nobody scouted', style: 'quick', colors: ['#334155', '#CBD5E1'], number: 1, gather: 0.28, touch: -0.04 },
];

/** How good the field is at each level: chance a rival's release is clean. */
const BASE_TOUCH = [0.33, 0.44, 0.55, 0.66, 0.76];

export interface RivalShot {
  spotIdx: number;
  ballIdx: number;
  ball: Ball;
  grade: Grade;
  /** Release timing error in seconds (negative = early). */
  error: number;
  outcome: Outcome;
  points: number;
  /** Clock elapsed at release, seconds from the start. */
  t: number;
  /** Running score after this shot lands. */
  score: number;
}

export interface RivalRun { rival: Rival; shots: RivalShot[]; score: number; /** Elapsed time when the run ended. */ end: number }

/** Pace model shared with the 3D playback. */
export const PACE = { walk: 2.2, settle: 0.95, firstWalk: 1.6 };

/** Seeded random numbers, so a contest replays the same and tests are stable. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Simulate one rival's run through `course` with `clock` seconds. Each shot
 * takes gather + jump + settle; moving racks takes a walk. Style shapes the
 * odds: streaky shooters heat up and cool off, clutch ones rise on money and
 * Starry balls and late in the clock, quick ones trade touch for time.
 */
export function simulateRival(rival: Rival, level: Level, course: Spot[], clock: number, rand: () => number): RivalRun {
  const shots: RivalShot[] = [];
  let t = PACE.firstWalk, score = 0, streak = 0, cold = 0;
  for (let si = 0; si < course.length; si++) {
    const spot = course[si];
    if (si > 0) t += PACE.walk;
    for (let bi = 0; bi < spot.balls.length; bi++) {
      const ball = spot.balls[bi];
      const { rise, green } = shotWindow(level, spot, ball, bi);
      const release = t + rival.gather + rise;
      if (release > clock) return { rival, shots, score, end: clock };
      let p = BASE_TOUCH[level.id] + rival.touch;
      if (ball.kind === 'money') p -= 0.05;
      if (ball.kind === 'starry') p -= 0.12;
      p -= bi * 0.012;
      if (rival.style === 'streaky') p += streak >= 2 ? 0.13 : 0 - cold * 0.05;
      if (rival.style === 'clutch') p += (ball.points > 1 ? 0.1 : -0.03) + (clock - release < 15 ? 0.06 : 0);
      if (rival.style === 'steady') p += 0.02;
      if (streak >= 3) p += 0.04; // on fire: the window widens for everyone
      p = Math.max(0.05, Math.min(0.97, p));
      const r = rand();
      // Clean releases split between perfect and good; misses between near and far.
      const grade: Grade = r < p * 0.55 ? 'perfect' : r < p ? 'good'
        : r < p + (1 - p) * 0.78 ? (rand() < 0.5 ? 'early' : 'late')
        : (rand() < 0.5 ? 'very-early' : 'very-late');
      const half = green / 2;
      const mag = grade === 'perfect' ? rand() * half : grade === 'good' ? half + rand() * green * 1.1 : grade === 'early' || grade === 'late' ? green * (1.6 + rand() * 1.9) : green * (3.6 + rand() * 2);
      const sign = grade === 'early' || grade === 'very-early' ? -1 : grade === 'late' || grade === 'very-late' ? 1 : rand() < 0.5 ? -1 : 1;
      const error = sign * mag;
      const outcome = resolveShot(grade, rand);
      const made = isMake(outcome);
      const points = made ? ball.points : 0;
      score += points;
      if (made) { streak++; cold = 0; } else { streak = 0; cold++; }
      shots.push({ spotIdx: si, ballIdx: bi, ball, grade, error, outcome, points, t: release, score });
      t = release + PACE.settle;
    }
  }
  return { rival, shots, score, end: Math.min(clock, t) };
}

/** A rival's score at a given elapsed time (for the "pace" ticker). */
export function scoreAt(run: RivalRun, elapsed: number): number {
  let s = 0;
  for (const sh of run.shots) { if (sh.t + 0.9 <= elapsed) s = sh.score; else break; }
  return s;
}

// ---- The contest -----------------------------------------------------------

export interface Entrant { id: string; name: string; you?: boolean; rival?: Rival }

/** Pick the field for a contest: five rivals, mixing styles. */
export function pickField(rand: () => number, size = 5): Rival[] {
  const pool = [...ROSTER];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, size);
}

/** The tiebreaker course: one rack from the top of the key and a Starry ball, 30 seconds. */
export function tiebreakCourse(moneyRack: number): Spot[] {
  const full = buildCourse(moneyRack);
  const top = full.find(s => s.id === 'top')!;
  const starry = full.find(s => s.id === 'sr')!;
  return [top, starry];
}
export const TIEBREAK_CLOCK = 30;

/**
 * Who advances: the top `n` by score. Returns the qualifiers and anyone tied
 * across the cut line (they shoot a tiebreaker for the last places).
 */
export function cut<T extends { score: number }>(rows: T[], n: number): { through: T[]; tied: T[] } {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  if (sorted.length <= n) return { through: sorted, tied: [] };
  const line = sorted[n - 1].score;
  if (sorted[n].score !== line) return { through: sorted.slice(0, n), tied: [] };
  return { through: sorted.filter(r => r.score > line), tied: sorted.filter(r => r.score === line) };
}
