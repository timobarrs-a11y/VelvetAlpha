import { describe, it, expect } from 'vitest';
import {
  PATTERNS, matchesSeq, checkPatterns, NOTICE_TTL,
} from '../state/patterns';
import type { PatternCheckContext, PatternEvent, PatternCheckInput } from '../state/patterns';

function ctx(over: Partial<PatternCheckContext> = {}): PatternCheckContext {
  return {
    hour: 10, dishes: 0, servings: 5, hasDelivery: false, hasParcel: false,
    power: true, foodNeed: 50, energyNeed: 50, lawnLen: 0.3, lawnWeeds: 0,
    messLevel: 0, deepCleaned: false, petHungry: false, petName: 'Biscuit',
    simName: 'Jordan',
    ...over,
  };
}

function events(acts: [string, number][]): PatternEvent[] {
  return acts.map(([act, at]) => ({ act, at }));
}

function input(over: Partial<PatternCheckInput> = {}): PatternCheckInput {
  return {
    ctx: ctx(),
    events: [],
    now: 500,
    firedToday: {},
    day: 5,
    rng: () => 0,
    ...over,
  };
}

describe('patterns — PATTERNS array', () => {
  it('has 15 patterns', () => {
    expect(PATTERNS.length).toBe(15);
  });

  it('includes both seq-based and check-based patterns', () => {
    expect(PATTERNS.some(p => p.seq)).toBe(true);
    expect(PATTERNS.some(p => p.check)).toBe(true);
  });

  it('all patterns have chance > 0 and <= 1', () => {
    PATTERNS.forEach(p => {
      expect(p.chance).toBeGreaterThan(0);
      expect(p.chance).toBeLessThanOrEqual(1);
    });
  });

  it('powerOut has chance 1', () => {
    const p = PATTERNS.find(p => p.id === 'powerOut')!;
    expect(p.chance).toBe(1);
  });
});

describe('patterns — matchesSeq', () => {
  it('matches simple sequence in order', () => {
    const ev = events([['shower', 100], ['cook', 200]]);
    expect(matchesSeq(['shower', 'cook'], 240, ev, 250)).toBe(true);
  });

  it('does not match when sequence incomplete', () => {
    const ev = events([['shower', 100]]);
    expect(matchesSeq(['shower', 'cook'], 240, ev, 250)).toBe(false);
  });

  it('matches out of order (reverse scan finds them)', () => {
    const ev = events([['shower', 100], ['walk', 150], ['cook', 200]]);
    expect(matchesSeq(['shower', 'cook'], 240, ev, 250)).toBe(true);
  });

  it('does not match when events outside window', () => {
    const ev = events([['shower', 100], ['cook', 400]]);
    expect(matchesSeq(['shower', 'cook'], 240, ev, 450)).toBe(false);
  });

  it('handles three-item sequence', () => {
    const ev = events([['tv', 100], ['tv', 200], ['tv', 300]]);
    expect(matchesSeq(['tv', 'tv', 'tv'], 480, ev, 350)).toBe(true);
  });

  it('does not match partial three-item sequence', () => {
    const ev = events([['tv', 100], ['tv', 200]]);
    expect(matchesSeq(['tv', 'tv', 'tv'], 480, ev, 250)).toBe(false);
  });

  it('handles empty events', () => {
    expect(matchesSeq(['shower'], 240, [], 100)).toBe(false);
  });
});

describe('patterns — checkPatterns check-based', () => {
  it('detects dishes pile', () => {
    const r = checkPatterns(input({ ctx: ctx({ dishes: 4 }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('dishesPile');
    expect(r!.topic).toContain('dishes');
  });

  it('detects empty fridge', () => {
    const r = checkPatterns(input({ ctx: ctx({ servings: 0, hasDelivery: false, hasParcel: false }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('emptyFridge');
  });

  it('detects power out', () => {
    const r = checkPatterns(input({ ctx: ctx({ power: false }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('powerOut');
  });

  it('detects starving', () => {
    const r = checkPatterns(input({ ctx: ctx({ foodNeed: 10 }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('starving');
  });

  it('detects worn out', () => {
    const r = checkPatterns(input({ ctx: ctx({ energyNeed: 10 }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('wornOut');
  });

  it('detects overgrown lawn', () => {
    const r = checkPatterns(input({ ctx: ctx({ lawnLen: 0.85 }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('lawn');
    expect(r!.topic).toContain('overgrown');
  });

  it('detects weedy lawn', () => {
    const r = checkPatterns(input({ ctx: ctx({ lawnWeeds: 10 }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('lawn');
    expect(r!.topic).toContain('dandelions');
  });

  it('detects filthy house', () => {
    const r = checkPatterns(input({ ctx: ctx({ messLevel: 14 }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('filthy');
  });

  it('detects deep clean', () => {
    const r = checkPatterns(input({ ctx: ctx({ deepCleaned: true }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('deepClean');
  });

  it('detects hungry pet', () => {
    const r = checkPatterns(input({ ctx: ctx({ petHungry: true, petName: 'Mochi' }) }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('petHungry');
    expect(r!.topic).toContain('Mochi');
  });
});

describe('patterns — checkPatterns seq-based', () => {
  it('detects freshStart sequence in morning', () => {
    const ev = events([['shower', 100], ['cook', 200]]);
    const r = checkPatterns(input({ ctx: ctx({ hour: 8 }), events: ev, now: 250 }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('freshStart');
  });

  it('does not detect freshStart in afternoon', () => {
    const ev = events([['shower', 100], ['cook', 200]]);
    const r = checkPatterns(input({ ctx: ctx({ hour: 14 }), events: ev, now: 250 }));
    expect(r === null || r!.pattern.id !== 'freshStart').toBe(true);
  });

  it('detects couchPotato with 3 TV events', () => {
    const ev = events([['tv', 100], ['tv', 200], ['tv', 300]]);
    const r = checkPatterns(input({ events: ev, now: 350 }));
    expect(r).not.toBeNull();
    expect(r!.pattern.id).toBe('couchPotato');
  });
});

describe('patterns — checkPatterns guards', () => {
  it('skips already-fired patterns', () => {
    const r = checkPatterns(input({
      ctx: ctx({ power: false }),
      firedToday: { powerOut: 5 },
      day: 5,
    }));
    expect(r).toBeNull();
  });

  it('does not skip patterns fired on a different day', () => {
    const r = checkPatterns(input({
      ctx: ctx({ power: false }),
      firedToday: { powerOut: 4 },
      day: 5,
    }));
    expect(r).not.toBeNull();
  });

  it('respects chance (rng > chance = no hit)', () => {
    const r = checkPatterns(input({
      ctx: ctx({ dishes: 4 }),
      rng: () => 0.95,
    }));
    expect(r).toBeNull();
  });

  it('respects chance (rng <= chance = hit)', () => {
    const r = checkPatterns(input({
      ctx: ctx({ dishes: 4 }),
      rng: () => 0.5,
    }));
    expect(r).not.toBeNull();
  });

  it('returns null when no patterns match', () => {
    expect(checkPatterns(input())).toBeNull();
  });
});

describe('patterns — notice state', () => {
  it('creates notice with correct TTL', () => {
    const r = checkPatterns(input({ ctx: ctx({ power: false }), now: 1000 }));
    expect(r!.notice.until).toBe(1000 + NOTICE_TTL);
  });

  it('notice topic matches pattern topic', () => {
    const r = checkPatterns(input({ ctx: ctx({ power: false }) }));
    expect(r!.notice.topic).toBe(r!.topic);
  });
});
