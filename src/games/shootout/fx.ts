import type { Ball, Spot } from './engine';

// The make-effects chain. Only perfect releases light anything up; a run of
// them grows the show, sets the ball on fire, and a perfect run ends with the
// rim catching fire and exploding. Starry balls are the bonus: missing one (or
// not hitting it perfectly) never breaks the run. Pure, so it's tested.

export interface FxRun {
  /** Perfect releases in a row (Starry balls don't break it). */
  chain: number;
  /** Every non-Starry ball so far was a perfect release. */
  perfectRun: boolean;
  /** Every non-Starry ball so far went in. */
  allMade: boolean;
  /** Non-Starry balls shot so far, and in the whole run. */
  taken: number;
  total: number;
}

export type Finale = 'none' | 'perfect' | 'made';

export interface ShotFx {
  /** How big the fireworks are, 0 (none: not a perfect release) to 1 (a perfect run's last ball). */
  level: number;
  /** The ball burns on its way to the rim. */
  fireball: boolean;
  /** The rim is on fire once this ball gets there (a perfect run into the last rack). */
  rimFire: boolean;
  /** This ball ends the run: the rim explodes. */
  finale: Finale;
}

export const NO_FX: ShotFx = { level: 0, fireball: false, rimFire: false, finale: 'none' };

/** How many perfects in a row set the ball on fire: about a quarter of the run. */
export const fireAt = (total: number): number => Math.max(3, Math.round(total * 0.25));

/** The rim catches fire for the last rack (five balls) of a run that's still perfect. */
const RIM_FIRE_LEFT = 5;

export function startFx(course: Spot[]): FxRun {
  const total = course.reduce((n, s) => n + s.balls.filter(b => b.kind !== 'starry').length, 0);
  return { chain: 0, perfectRun: true, allMade: true, taken: 0, total };
}

/** The run after one shot, decided at release. */
export function stepFx(run: FxRun, kind: Ball['kind'], made: boolean, perfect: boolean): FxRun {
  const starry = kind === 'starry';
  return {
    chain: perfect ? run.chain + 1 : starry ? run.chain : 0,
    perfectRun: run.perfectRun && (perfect || starry),
    allMade: run.allMade && (made || starry),
    taken: run.taken + (starry ? 0 : 1),
    total: run.total,
  };
}

/** What this shot shows when it gets to the rim. `last`: no more balls in this run. */
export function shotFx(run: FxRun, made: boolean, perfect: boolean, last: boolean): ShotFx {
  const finale: Finale = !last ? 'none' : run.perfectRun && run.taken === run.total ? 'perfect' : run.allMade && run.taken === run.total ? 'made' : 'none';
  const rimFire = run.perfectRun && run.taken > 0 && run.total - run.taken <= RIM_FIRE_LEFT && finale === 'none';
  if (!(made && perfect)) return { ...NO_FX, rimFire, finale };
  const level = Math.min(1, Math.max(1, run.chain) / Math.max(1, run.total));
  return { level, fireball: run.chain >= fireAt(run.total), rimFire, finale };
}
