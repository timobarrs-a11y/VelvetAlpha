import { describe, it, expect } from 'vitest';
import {
  CAREER, promoNeed, promoProgress, workReview,
  careerTitle, careerWage, isTopLevel,
} from '../state/career';
import type { CareerState, WorkReviewInput } from '../state/career';

function state(level = 0, perf = 0): CareerState {
  return { level, perf };
}

describe('career — CAREER ladder', () => {
  it('has 5 levels', () => {
    expect(CAREER.length).toBe(5);
  });

  it('starts at Associate $20/hr', () => {
    expect(CAREER[0].t).toBe('Associate');
    expect(CAREER[0].w).toBe(20);
  });

  it('tops at Director $44/hr', () => {
    expect(CAREER[4].t).toBe('Director');
    expect(CAREER[4].w).toBe(44);
  });
});

describe('career — promoNeed', () => {
  it('scales with level', () => {
    expect(promoNeed(0)).toBe(3);
    expect(promoNeed(1)).toBe(5);
    expect(promoNeed(2)).toBe(7);
    expect(promoNeed(3)).toBe(9);
    expect(promoNeed(4)).toBe(11);
  });
});

describe('career — promoProgress', () => {
  it('is 0 at zero perf', () => {
    expect(promoProgress(state(0, 0))).toBe(0);
  });

  it('is ~33 at perf 1, level 0', () => {
    expect(promoProgress(state(0, 1))).toBe(33);
  });

  it('caps at 99', () => {
    expect(promoProgress(state(0, 100))).toBe(99);
  });
});

describe('career — workReview', () => {
  function input(workNeeds: number, opts: Partial<WorkReviewInput> = {}): WorkReviewInput {
    return { workNeeds, sentHome: false, lifeGoal: null, ...opts };
  }

  it('gives positive gain when well-rested (workNeeds > 55)', () => {
    const r = workReview(state(0, 0), input(60));
    expect(r.gain).toBe(1);
    expect(r.promoted).toBe(false);
    expect(r.bossNoticed).toBe(false);
  });

  it('gives small positive gain when adequate (workNeeds > 35)', () => {
    const r = workReview(state(0, 0), input(40));
    expect(r.gain).toBe(0.4);
  });

  it('gives negative gain when exhausted (workNeeds <= 35)', () => {
    const r = workReview(state(0, 0), input(20));
    expect(r.gain).toBe(-0.5);
    expect(r.bossNoticed).toBe(true);
  });

  it('gives -1 when sent home', () => {
    const r = workReview(state(0, 0), input(80, { sentHome: true }));
    expect(r.gain).toBe(-1);
    expect(r.bossNoticed).toBe(true);
  });

  it('applies career goal bonus (1.3x)', () => {
    const r = workReview(state(0, 0), input(60, { lifeGoal: 'career' }));
    expect(r.gain).toBeCloseTo(1.3, 5);
  });

  it('does not apply bonus for non-career goals', () => {
    const r = workReview(state(0, 0), input(60, { lifeGoal: 'romance' }));
    expect(r.gain).toBe(1);
  });

  it('promotes when perf reaches threshold', () => {
    const r = workReview(state(0, 2.5), input(60));
    expect(r.promoted).toBe(true);
    expect(r.newLevel).toBe(1);
    expect(r.newPerf).toBe(0);
    expect(r.newTitle).toBe('Senior Associate');
    expect(r.newWage).toBe(24);
  });

  it('does not promote above top level', () => {
    const r = workReview(state(4, 100), input(60));
    expect(r.promoted).toBe(false);
    expect(r.newLevel).toBe(4);
  });

  it('accumulates perf without promoting when below threshold', () => {
    const r = workReview(state(0, 0), input(40));
    expect(r.promoted).toBe(false);
    expect(r.newPerf).toBeCloseTo(0.4, 5);
  });

  it('resets perf to 0 on promotion', () => {
    const r = workReview(state(1, 4.5), input(60));
    expect(r.promoted).toBe(true);
    expect(r.newPerf).toBe(0);
    expect(r.newLevel).toBe(2);
  });
});

describe('career — helpers', () => {
  it('careerTitle returns current title', () => {
    expect(careerTitle(state(0))).toBe('Associate');
    expect(careerTitle(state(2))).toBe('Team Lead');
    expect(careerTitle(state(4))).toBe('Director');
  });

  it('careerWage returns current wage', () => {
    expect(careerWage(state(0))).toBe(20);
    expect(careerWage(state(3))).toBe(35);
  });

  it('isTopLevel true only at max', () => {
    expect(isTopLevel(state(3))).toBe(false);
    expect(isTopLevel(state(4))).toBe(true);
  });
});
