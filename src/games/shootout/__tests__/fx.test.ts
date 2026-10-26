import { describe, expect, it } from 'vitest';
import { buildCourse } from '../engine';
import { fireAt, MAX_TIER, shotFx, startFx, stepFx, type FxRun } from '../fx';

// Play a whole course: `grade(kind, i)` says how each ball goes.
function play(grade: (kind: string, i: number) => 'perfect' | 'made' | 'miss') {
  const course = buildCourse(4);
  let run: FxRun = startFx(course);
  const balls = course.flatMap(s => s.balls);
  return balls.map((b, i) => {
    const g = grade(b.kind, i), made = g !== 'miss', perfect = g === 'perfect';
    run = stepFx(run, b.kind, made, perfect);
    return { kind: b.kind, run, fx: shotFx(run, made, perfect, i === balls.length - 1) };
  });
}

describe('make effects chain', () => {
  it('counts the non-Starry balls of a full course', () => {
    expect(startFx(buildCourse(4)).total).toBe(25);
  });

  it('shows nothing for a make that was not a perfect release', () => {
    const shots = play(() => 'made');
    expect(shots.every(s => s.fx.tier === 0 && !s.fx.fireball && !s.fx.rimFire)).toBe(true);
    // ...but every ball going in still earns the gold finale.
    expect(shots[shots.length - 1].fx.finale).toBe('made');
  });

  it('steps up a tier with every perfect in a row, and resets on one that is not', () => {
    const shots = play((_, i) => (i === 3 ? 'made' : 'perfect'));
    expect(shots.slice(0, 3).map(s => s.fx.tier)).toEqual([1, 2, 3]);
    expect(shots[3].fx.tier).toBe(0);
    expect(shots[3].fx.chain).toBe(0);
    expect(shots[4].fx.tier).toBe(1);
  });

  it('tops out at the highest tier', () => {
    const shots = play(() => 'perfect');
    expect(Math.max(...shots.map(s => s.fx.tier))).toBe(MAX_TIER);
  });

  it('sets the ball on fire after about a quarter of the run in a row', () => {
    const shots = play(() => 'perfect');
    const first = shots.findIndex(s => s.fx.fireball);
    expect(shots[first].run.chain).toBe(fireAt(25));
    expect(fireAt(25)).toBe(6);
  });

  it('lights the rim for the last rack of a perfect run and explodes it on the last ball', () => {
    const shots = play(() => 'perfect');
    const lit = shots.filter(s => s.fx.rimFire);
    expect(lit.map(s => s.run.taken)).toEqual([20, 21, 22, 23, 24]);
    const last = shots[shots.length - 1];
    expect(last.fx).toMatchObject({ finale: 'perfect', rimFire: false, tier: MAX_TIER, fireball: true });
  });

  it('lets Starry balls be missed without breaking a perfect run or the chain', () => {
    const shots = play(kind => (kind === 'starry' ? 'miss' : 'perfect'));
    const starry = shots.filter(s => s.kind === 'starry');
    expect(starry.every(s => s.run.perfectRun && s.run.chain > 0)).toBe(true);
    expect(shots[shots.length - 1].fx.finale).toBe('perfect');
  });

  it('has no finale when a regular ball is missed, and the rim fire goes out', () => {
    const shots = play((_, i) => (i === 24 ? 'miss' : 'perfect'));
    expect(shots[23].fx.rimFire).toBe(true);
    expect(shots[24].fx.rimFire).toBe(false);
    expect(shots[shots.length - 1].fx.finale).toBe('none');
  });
});
