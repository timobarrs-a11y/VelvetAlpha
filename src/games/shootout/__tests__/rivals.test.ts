import { describe, it, expect } from 'vitest';
import { buildCourse, LEVELS, MAX_SCORE } from '../engine';
import { cut, pickField, ROSTER, scoreAt, seeded, simulateRival, tiebreakCourse, TIEBREAK_CLOCK } from '../rivals';

const avg = (level: number, n = 300) => {
  const rand = seeded(42);
  let s = 0;
  for (let i = 0; i < n; i++) for (const r of ROSTER) s += simulateRival(r, LEVELS[level], buildCourse(2), LEVELS[level].clock, rand).score;
  return s / (n * ROSTER.length);
};

describe('shootout rivals', () => {
  it('replays the same run from the same seed', () => {
    const a = simulateRival(ROSTER[0], LEVELS[2], buildCourse(4), 70, seeded(9));
    const b = simulateRival(ROSTER[0], LEVELS[2], buildCourse(4), 70, seeded(9));
    expect(a).toEqual(b);
  });

  it('keeps scores legal: running totals add up and never pass the max', () => {
    const course = buildCourse(1);
    const run = simulateRival(ROSTER[1], LEVELS[4], course, 68, seeded(3));
    let s = 0;
    for (const sh of run.shots) { s += sh.points; expect(sh.score).toBe(s); expect(sh.t).toBeLessThanOrEqual(68); }
    expect(run.score).toBe(s);
    // Contest scoring: at most one bonus point per ball on top of the max.
    expect(run.score).toBeLessThanOrEqual(MAX_SCORE(course) + course.flatMap(s => s.balls).length);
  });

  it('gets tougher level by level', () => {
    const scores = [0, 1, 2, 3, 4].map(l => avg(l, 60));
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    expect(scores[0]).toBeGreaterThan(12); expect(scores[0]).toBeLessThan(22);
    expect(scores[4]).toBeGreaterThan(34); expect(scores[4]).toBeLessThan(50);
  });

  it('stops shooting when the clock runs out', () => {
    const run = simulateRival(ROSTER[2], LEVELS[0], tiebreakCourse(4), 8, seeded(1));
    expect(run.shots.length).toBeLessThan(6);
    expect(run.shots.every(s => s.t <= 8)).toBe(true);
  });

  it('has a 30-second tiebreaker of one rack and a Starry ball', () => {
    const c = tiebreakCourse(2);
    expect(c.flatMap(s => s.balls)).toHaveLength(6);
    expect(TIEBREAK_CLOCK).toBe(30);
  });

  it('reports the score at a moment in the run for the pace ticker', () => {
    const run = simulateRival(ROSTER[0], LEVELS[1], buildCourse(4), 72, seeded(5));
    expect(scoreAt(run, 0)).toBe(0);
    expect(scoreAt(run, 1000)).toBe(run.score);
  });

  it('picks five different rivals', () => {
    const f = pickField(seeded(8));
    expect(new Set(f.map(r => r.id)).size).toBe(5);
  });

  it('sends the top three through and flags ties on the cut line', () => {
    const row = (id: string, score: number) => ({ id, score });
    expect(cut([row('a', 20), row('b', 18), row('c', 15), row('d', 12)], 3).through.map(r => r.id)).toEqual(['a', 'b', 'c']);
    const t = cut([row('a', 20), row('b', 15), row('c', 15), row('d', 12)], 2);
    expect(t.through.map(r => r.id)).toEqual(['a']);
    expect(t.tied.map(r => r.id).sort()).toEqual(['b', 'c']);
  });
});
