import { describe, it, expect } from 'vitest';
import {
  SETTLE, LIFE, nextSettleGoal, settleComplete, checkLifeGoal, lifeGoalProgress,
} from '../state/goals';
import type { GoalContext, GameFlags } from '../state/goals';
import type { CareerState } from '../state/career';

function flags(over: Partial<GameFlags> = {}): GameFlags {
  return {
    arranged: false, stocked: false, styled: false, talked: false,
    danced: false, watched: false, dinners: 0, harvests: 0, mowed: false,
    tvVideo: false, furniture: 0, spotless: 0, styledSet: [], settleSeen: [],
    lifeStep: 0, ...over,
  };
}

function ctx(over: Partial<GoalContext> = {}): GoalContext {
  return {
    flags: flags(),
    career: { level: 0, perf: 0 } as CareerState,
    bond: 58,
    hasSofaOnLevel1: false,
    hasPackedBoxes: true,
    lawnLabel: 'Lush',
    lawnWeeds: 0,
    ...over,
  };
}

describe('goals — SETTLE array', () => {
  it('has 6 settle goals', () => {
    expect(SETTLE.length).toBe(6);
  });

  it('includes unpack as optional last goal', () => {
    expect(SETTLE[5].id).toBe('unpack');
  });
});

describe('goals — nextSettleGoal', () => {
  it('returns first goal when none seen', () => {
    expect(nextSettleGoal(ctx()).id).toBe('couch');
  });

  it('skips seen goals', () => {
    const c = ctx({ flags: flags({ settleSeen: ['couch', 'arrange', 'food'] }) });
    expect(nextSettleGoal(c).id).toBe('room');
  });

  it('returns unpack when only unpack remains', () => {
    const c = ctx({ flags: flags({ settleSeen: ['couch', 'arrange', 'food', 'room', 'talk'] }) });
    const g = nextSettleGoal(c);
    expect(g).not.toBeNull();
    expect(g!.id).toBe('unpack');
  });

  it('returns null when all goals seen including unpack', () => {
    const c = ctx({ flags: flags({ settleSeen: ['couch', 'arrange', 'food', 'room', 'talk', 'unpack'] }) });
    expect(nextSettleGoal(c)).toBeNull();
  });
});

describe('goals — settleComplete', () => {
  it('false when goals remain', () => {
    expect(settleComplete(ctx())).toBe(false);
  });

  it('true when all non-unpack goals seen', () => {
    const c = ctx({ flags: flags({ settleSeen: ['couch', 'arrange', 'food', 'room', 'talk'] }) });
    expect(settleComplete(c)).toBe(true);
  });

  it('true even if unpack not seen', () => {
    const c = ctx({ flags: flags({ settleSeen: ['couch', 'arrange', 'food', 'room', 'talk'] }), hasPackedBoxes: true });
    expect(settleComplete(c)).toBe(true);
  });
});

describe('goals — checkLifeGoal career', () => {
  it('returns null when current step not done', () => {
    expect(checkLifeGoal('career', ctx())).toBeNull();
  });

  it('completes first step when career >= 1', () => {
    const c = ctx({ career: { level: 1, perf: 0 }, flags: flags({ lifeStep: 0 }) });
    const r = checkLifeGoal('career', c);
    expect(r).not.toBeNull();
    expect(r!.completed).toBe(true);
    expect(r!.reward).toBe(75);
    expect(r!.finished).toBe(false);
  });

  it('finishes path at last step', () => {
    const c = ctx({ career: { level: 4, perf: 0 }, flags: flags({ lifeStep: 3 }) });
    const r = checkLifeGoal('career', c);
    expect(r).not.toBeNull();
    expect(r!.finished).toBe(true);
    expect(r!.reward).toBe(400);
  });
});

describe('goals — checkLifeGoal romance', () => {
  it('returns null when dance not done', () => {
    expect(checkLifeGoal('romance', ctx())).toBeNull();
  });

  it('completes dance step', () => {
    const c = ctx({ flags: flags({ danced: true }) });
    const r = checkLifeGoal('romance', c);
    expect(r).not.toBeNull();
    expect(r!.reward).toBe(40);
  });

  it('completes in-love step at bond 80', () => {
    const c = ctx({ bond: 80, flags: flags({ danced: true, watched: true, dinners: 3, lifeStep: 3 }) });
    const r = checkLifeGoal('romance', c);
    expect(r).not.toBeNull();
    expect(r!.finished).toBe(true);
    expect(r!.reward).toBe(150);
  });
});

describe('goals — checkLifeGoal homebody', () => {
  it('completes unpack step when no boxes', () => {
    const c = ctx({ hasPackedBoxes: false });
    const r = checkLifeGoal('homebody', c);
    expect(r).not.toBeNull();
    expect(r!.reward).toBe(50);
  });

  it('completes furniture step at 5 pieces', () => {
    const c = ctx({ flags: flags({ lifeStep: 3, furniture: 5 }) });
    const r = checkLifeGoal('homebody', c);
    expect(r).not.toBeNull();
    expect(r!.finished).toBe(true);
  });
});

describe('goals — checkLifeGoal green', () => {
  it('completes mow step', () => {
    const c = ctx({ flags: flags({ mowed: true }) });
    const r = checkLifeGoal('green', c);
    expect(r).not.toBeNull();
    expect(r!.reward).toBe(30);
  });

  it('completes lush step with zero weeds', () => {
    const c = ctx({ flags: flags({ mowed: true, harvests: 1, lifeStep: 2 }), lawnLabel: 'Lush', lawnWeeds: 0 });
    const r = checkLifeGoal('green', c);
    expect(r).not.toBeNull();
    expect(r!.reward).toBe(80);
  });

  it('does not complete lush step with weeds', () => {
    const c = ctx({ flags: flags({ mowed: true, harvests: 1, lifeStep: 2 }), lawnLabel: 'Lush', lawnWeeds: 3 });
    expect(checkLifeGoal('green', c)).toBeNull();
  });
});

describe('goals — lifeGoalProgress', () => {
  it('returns 0/4 at start', () => {
    expect(lifeGoalProgress('career', 0)).toEqual({ current: 0, total: 4 });
  });

  it('returns 2/4 at step 2', () => {
    expect(lifeGoalProgress('career', 2)).toEqual({ current: 2, total: 4 });
  });

  it('clamps to total', () => {
    expect(lifeGoalProgress('career', 99)).toEqual({ current: 4, total: 4 });
  });

  it('returns 0/0 for unknown goal', () => {
    expect(lifeGoalProgress('unknown', 0)).toEqual({ current: 0, total: 0 });
  });
});
