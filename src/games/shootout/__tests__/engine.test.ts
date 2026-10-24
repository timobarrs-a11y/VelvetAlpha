import { describe, it, expect } from 'vitest';
import { buildCourse, judge, LEVELS, MAX_SCORE, resolveShot, isMake, shotWindow, starsFor, spotPosition, fireBoost } from '../engine';

describe('3-point shootout rules', () => {
  it('lays out five racks and two Starry balls like the real contest (27 balls, 40 points)', () => {
    const course = buildCourse(4);
    const balls = course.flatMap(s => s.balls);
    expect(course.filter(s => s.id !== 'sl' && s.id !== 'sr')).toHaveLength(5);
    expect(balls).toHaveLength(27);
    expect(balls.filter(b => b.kind === 'starry')).toHaveLength(2);
    expect(MAX_SCORE(course)).toBe(40);
  });

  it('puts the all-money rack wherever you choose', () => {
    for (let r = 0; r < 5; r++) {
      const racks = buildCourse(r).filter(s => s.id !== 'sl' && s.id !== 'sr');
      expect(racks[r].balls.every(b => b.kind === 'money')).toBe(true);
      expect(racks.filter((_, i) => i !== r).every(s => s.balls.filter(b => b.kind === 'money').length === 1)).toBe(true);
    }
  });

  it('places corners on the short corner three and the top straight out', () => {
    const [lc, , , top] = buildCourse(4);
    const [x, y] = spotPosition(lc);
    expect(x).toBeCloseTo(-6.7, 3); expect(y).toBeCloseTo(0, 3);
    expect(spotPosition(top)[1]).toBeCloseTo(7.24, 3);
  });

  it('judges releases by how far they are from the top of the jump', () => {
    expect(judge(0.70, 0.70, 0.08).grade).toBe('perfect');
    expect(judge(0.735, 0.70, 0.08).grade).toBe('perfect');
    expect(judge(0.79, 0.70, 0.08).grade).toBe('good');
    expect(judge(0.55, 0.70, 0.08).grade).toBe('early');
    expect(judge(0.95, 0.70, 0.08).grade).toBe('late');
    expect(judge(1.05, 0.70, 0.08).grade).toBe('very-late');
    expect(judge(0.30, 0.70, 0.08).grade).toBe('very-early');
  });

  it('always makes a perfect release, and never makes a way-early one', () => {
    for (let r = 0; r < 1; r += 0.05) {
      expect(isMake(resolveShot('perfect', () => r))).toBe(true);
      expect(isMake(resolveShot('very-early', () => r))).toBe(false);
    }
  });

  it('gets harder: smaller windows each level, and for money and Starry balls', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].green).toBeLessThan(LEVELS[i - 1].green);
    const course = buildCourse(4), top = course[3];
    const reg = shotWindow(LEVELS[2], top, top.balls[0], 0).green;
    const mon = shotWindow(LEVELS[2], top, top.balls[4], 4).green;
    const star = shotWindow(LEVELS[2], course[2], course[2].balls[0], 0).green;
    expect(mon).toBeLessThan(reg);
    expect(star).toBeLessThan(reg);
  });

  it('rewards streaks with a wider window once you are on fire', () => {
    expect(fireBoost(2)).toBe(1);
    expect(fireBoost(3)).toBeGreaterThan(1);
  });

  it('gives stars for a run', () => {
    expect(starsFor(5, LEVELS[0], 40)).toBe(0);
    expect(starsFor(LEVELS[0].unlockAt, LEVELS[0], 40)).toBe(1);
    expect(starsFor(30, LEVELS[0], 40)).toBe(2);
    expect(starsFor(38, LEVELS[0], 40)).toBe(3);
  });
});
