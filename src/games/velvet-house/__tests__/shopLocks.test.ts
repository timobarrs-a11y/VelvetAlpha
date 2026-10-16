import { describe, it, expect } from 'vitest';
import { lockOf, checkNewlyUnlocked } from '../state/shopLocks';
import type { LockMap, LockContext } from '../state/shopLocks';
import type { CareerState } from '../state/career';

const LOCKS: LockMap = {
  'gift-flowers': [{ day: 3 }],
  'gift-earrings': [{ career: 1 }],
  'paint-plum': [{ bond: 72, hint: "Her favorite. Get closer" }],
  stringlights: [{ bond: 65, hint: 'Get closer' }],
  chefstove: [{ skill: 3, hint: 'Reach cooking skill 3' }],
  projector: [{ flag: 'tvVideo', hint: 'Watch TV first' }, { career: 1 }],
  'home-2br': [{ career: 2 }],
};

function ctx(over: Partial<LockContext> = {}): LockContext {
  return {
    day: 1,
    career: { level: 0, perf: 0 } as CareerState,
    bond: 58,
    cookingSkill: 1,
    flags: {},
    owned: new Set<string>(),
    ...over,
  };
}

describe('shopLocks — lockOf day locks', () => {
  it('locks item when day requirement not met', () => {
    const r = lockOf('gift-flowers', LOCKS, ctx({ day: 1 }));
    expect(r).not.toBeNull();
    expect(r!.hidden).toBe(false);
    expect(r!.hint).toContain('3 days');
  });

  it('unlocks item when day requirement met', () => {
    const r = lockOf('gift-flowers', LOCKS, ctx({ day: 5 }));
    expect(r).toBeNull();
  });
});

describe('shopLocks — lockOf career locks', () => {
  it('locks when career level too low', () => {
    const r = lockOf('gift-earrings', LOCKS, ctx());
    expect(r).not.toBeNull();
    expect(r!.hidden).toBe(false);
  });

  it('unlocks when career level met', () => {
    const r = lockOf('gift-earrings', LOCKS, ctx({ career: { level: 1, perf: 0 } }));
    expect(r).toBeNull();
  });
});

describe('shopLocks — lockOf bond locks (hidden)', () => {
  it('locks and hides when bond too low', () => {
    const r = lockOf('paint-plum', LOCKS, ctx({ bond: 50 }));
    expect(r).not.toBeNull();
    expect(r!.hidden).toBe(true);
    expect(r!.hint).toContain('favorite');
  });

  it('unlocks when bond met', () => {
    const r = lockOf('paint-plum', LOCKS, ctx({ bond: 75 }));
    expect(r).toBeNull();
  });
});

describe('shopLocks — lockOf skill locks', () => {
  it('locks when skill too low', () => {
    const r = lockOf('chefstove', LOCKS, ctx({ cookingSkill: 1 }));
    expect(r).not.toBeNull();
    expect(r!.hidden).toBe(false);
  });

  it('unlocks when skill met', () => {
    const r = lockOf('chefstove', LOCKS, ctx({ cookingSkill: 3 }));
    expect(r).toBeNull();
  });
});

describe('shopLocks — lockOf flag locks', () => {
  it('locks when flag not set', () => {
    const r = lockOf('projector', LOCKS, ctx());
    expect(r).not.toBeNull();
    expect(r!.hidden).toBe(true);
  });

  it('still locks via career when flag set but career too low', () => {
    const r = lockOf('projector', LOCKS, ctx({ flags: { tvVideo: true } }));
    expect(r).not.toBeNull();
    expect(r!.hidden).toBe(false);
  });

  it('unlocks when all conditions met', () => {
    const r = lockOf('projector', LOCKS, ctx({ flags: { tvVideo: true }, career: { level: 1, perf: 0 } }));
    expect(r).toBeNull();
  });
});

describe('shopLocks — owned items always unlocked', () => {
  it('returns null for owned item', () => {
    const r = lockOf('gift-flowers', LOCKS, ctx({ day: 1, owned: new Set(['gift-flowers']) }));
    expect(r).toBeNull();
  });
});

describe('shopLocks — no lock entry', () => {
  it('returns null for item with no lock', () => {
    expect(lockOf('paint-sand', LOCKS, ctx())).toBeNull();
  });
});

describe('shopLocks — checkNewlyUnlocked', () => {
  it('returns ids that are now unlocked', () => {
    const ids = ['gift-flowers', 'gift-earrings', 'paint-sand'];
    const c = ctx({ day: 5, career: { level: 1, perf: 0 } });
    const seen: string[] = [];
    expect(checkNewlyUnlocked(ids, LOCKS, c, seen)).toEqual(['gift-flowers', 'gift-earrings']);
  });

  it('excludes already-seen items', () => {
    const ids = ['gift-flowers', 'gift-earrings'];
    const c = ctx({ day: 5, career: { level: 1, perf: 0 } });
    expect(checkNewlyUnlocked(ids, LOCKS, c, ['gift-flowers'])).toEqual(['gift-earrings']);
  });

  it('excludes still-locked items', () => {
    const ids = ['gift-flowers', 'home-2br'];
    const c = ctx({ day: 5, career: { level: 0 } });
    expect(checkNewlyUnlocked(ids, LOCKS, c, [])).toEqual(['gift-flowers']);
  });

  it('excludes owned items', () => {
    const ids = ['gift-flowers'];
    const c = ctx({ day: 5, owned: new Set(['gift-flowers']) });
    expect(checkNewlyUnlocked(ids, LOCKS, c, [])).toEqual([]);
  });
});
