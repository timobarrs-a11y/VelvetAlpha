import { describe, it, expect, beforeEach } from 'vitest';
import { stashCoachDraft, takeCoachDraft } from '../coachDraft';

beforeEach(() => sessionStorage.clear());

describe('coach draft', () => {
  it('hands the waiting message to the coach it was for, once', () => {
    stashCoachDraft('c1', 'Help me with the trademark');
    expect(takeCoachDraft('c1')).toBe('Help me with the trademark');
    expect(takeCoachDraft('c1')).toBeNull();
  });

  it('keeps it for the right coach: another coach gets nothing and does not use it up', () => {
    stashCoachDraft('c1', 'hello');
    expect(takeCoachDraft('c2')).toBeNull();
    expect(takeCoachDraft('c1')).toBe('hello');
  });

  it('lets it go stale', () => {
    stashCoachDraft('c1', 'old', 1_000);
    expect(takeCoachDraft('c1', 1_000 + 11 * 60 * 1000)).toBeNull();
  });
});
