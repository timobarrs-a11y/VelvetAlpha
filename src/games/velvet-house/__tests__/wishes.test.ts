import { describe, it, expect } from 'vitest';
import {
  WISHES, shouldSetWish, createWish, wishLogMessage,
  fulfilWish, shouldExpireWish, wishExpiryMessage,
  FULFIL_BOND, FULFIL_BOND_NO_WISH,
} from '../state/wishes';
import type { WishState, SetWishInput } from '../state/wishes';

function wish(kind: 'coffee' | 'dance' | 'tv' = 'coffee', until = 1000, source: 'talk' | 'spark' = 'talk'): WishState {
  return { kind, until, source };
}

function setWishInput(over: Partial<SetWishInput> = {}): SetWishInput {
  return { kind: 'coffee', source: 'talk', currentWish: null, absMin: 500, mayaAround: true, ...over };
}

describe('wishes — WISHES defs', () => {
  it('has 3 wish kinds', () => {
    expect(Object.keys(WISHES).length).toBe(3);
  });

  it('coffee has ttl 150', () => {
    expect(WISHES.coffee.ttl).toBe(150);
  });

  it('dance has ttl 120', () => {
    expect(WISHES.dance.ttl).toBe(120);
  });

  it('each has a label and memory', () => {
    Object.values(WISHES).forEach(w => {
      expect(w.label.length).toBeGreaterThan(0);
      expect(w.memory().length).toBeGreaterThan(0);
    });
  });
});

describe('wishes — shouldSetWish', () => {
  it('true when no current wish and maya around', () => {
    expect(shouldSetWish(setWishInput())).toBe(true);
  });

  it('false when same wish already active', () => {
    expect(shouldSetWish(setWishInput({ currentWish: wish('coffee') }))).toBe(false);
  });

  it('true when different wish active', () => {
    expect(shouldSetWish(setWishInput({ kind: 'dance', currentWish: wish('coffee') }))).toBe(true);
  });

  it('false when maya not around', () => {
    expect(shouldSetWish(setWishInput({ mayaAround: false }))).toBe(false);
  });
});

describe('wishes — createWish', () => {
  it('creates wish with until = absMin + ttl', () => {
    const w = createWish(setWishInput({ kind: 'dance', absMin: 500 }));
    expect(w.kind).toBe('dance');
    expect(w.until).toBe(500 + WISHES.dance.ttl);
    expect(w.source).toBe('talk');
  });
});

describe('wishes — wishLogMessage', () => {
  it('talk source uses words template', () => {
    const msg = wishLogMessage('coffee', 'talk');
    expect(msg).toContain('coffee');
  });

  it('spark source uses specific message', () => {
    const msg = wishLogMessage('dance', 'spark');
    expect(msg).toContain('song');
  });

  it('tv spark message mentions couch', () => {
    const msg = wishLogMessage('tv', 'spark');
    expect(msg).toContain('couch');
  });
});

describe('wishes — fulfilWish', () => {
  it('matches when wish kind matches', () => {
    const r = fulfilWish('coffee', wish('coffee'));
    expect(r.matchedWish).toBe(true);
    expect(r.bondGain).toBe(FULFIL_BOND);
    expect(r.supportGain).toBe(1);
    expect(r.memory).not.toBeNull();
  });

  it('does not match when wish kind differs', () => {
    const r = fulfilWish('coffee', wish('dance'));
    expect(r.matchedWish).toBe(false);
    expect(r.bondGain).toBe(FULFIL_BOND_NO_WISH);
    expect(r.memory).toBeNull();
  });

  it('does not match when no wish', () => {
    const r = fulfilWish('coffee', null);
    expect(r.matchedWish).toBe(false);
    expect(r.bondGain).toBe(FULFIL_BOND_NO_WISH);
  });
});

describe('wishes — shouldExpireWish', () => {
  it('false when busy', () => {
    expect(shouldExpireWish({ wish: wish('coffee', 500), absMin: 600, mayaAround: true, isBusy: true })).toBe(false);
  });

  it('true when time expired', () => {
    expect(shouldExpireWish({ wish: wish('coffee', 500), absMin: 600, mayaAround: true, isBusy: false })).toBe(true);
  });

  it('true when maya not around', () => {
    expect(shouldExpireWish({ wish: wish('coffee', 1000), absMin: 600, mayaAround: false, isBusy: false })).toBe(true);
  });

  it('false when within time and maya around and not busy', () => {
    expect(shouldExpireWish({ wish: wish('coffee', 1000), absMin: 600, mayaAround: true, isBusy: false })).toBe(false);
  });
});

describe('wishes — wishExpiryMessage', () => {
  it('returns message when maya around', () => {
    expect(wishExpiryMessage('coffee', true)).toContain('her own coffee');
  });

  it('returns empty string when maya not around', () => {
    expect(wishExpiryMessage('coffee', false)).toBe('');
  });
});
