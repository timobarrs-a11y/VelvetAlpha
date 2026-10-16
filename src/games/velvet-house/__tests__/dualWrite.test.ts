import { describe, it, expect } from 'vitest';
import { compareSaveProgress } from '../../../services/velvetHouseDatabase';

describe('compareSaveProgress', () => {
  it('returns positive when first save has a higher day', () => {
    const a = { day: 3, minutes: 100 };
    const b = { day: 1, minutes: 500 };
    expect(compareSaveProgress(a, b)).toBeGreaterThan(0);
  });

  it('returns negative when first save has a lower day', () => {
    const a = { day: 1, minutes: 500 };
    const b = { day: 3, minutes: 100 };
    expect(compareSaveProgress(a, b)).toBeLessThan(0);
  });

  it('falls back to minutes when days are equal', () => {
    const a = { day: 2, minutes: 600 };
    const b = { day: 2, minutes: 300 };
    expect(compareSaveProgress(a, b)).toBeGreaterThan(0);
  });

  it('returns 0 when both day and minutes are equal', () => {
    const a = { day: 2, minutes: 600 };
    const b = { day: 2, minutes: 600 };
    expect(compareSaveProgress(a, b)).toBe(0);
  });

  it('treats missing day as 0', () => {
    const a = { minutes: 100 };
    const b = { day: 1, minutes: 100 };
    expect(compareSaveProgress(a, b)).toBeLessThan(0);
  });

  it('treats missing minutes as 0', () => {
    const a = { day: 1 };
    const b = { day: 1, minutes: 100 };
    expect(compareSaveProgress(a, b)).toBeLessThan(0);
  });
});

describe('dual-write load logic', () => {
  // Simulates the loadVelvetHouseSave comparison: pick whichever save is more advanced
  function pickMoreAdvanced(
    v1: Record<string, unknown> | null,
    v2: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (v1 && v2) {
      return compareSaveProgress(v1, v2) >= 0 ? v1 : v2;
    }
    return v2 ?? v1;
  }

  it('prefers v2 when v2 is more advanced', () => {
    const v1 = { day: 1, minutes: 480, v: 1 };
    const v2 = { day: 3, minutes: 600, v: 2 };
    expect(pickMoreAdvanced(v1, v2)).toBe(v2);
  });

  it('prefers v1 when v1 is more advanced (rollback scenario)', () => {
    const v1 = { day: 5, minutes: 900, v: 1 };
    const v2 = { day: 2, minutes: 480, v: 2 };
    // After rolling back to the legacy game, v1 progressed further than the stale v2
    expect(pickMoreAdvanced(v1, v2)).toBe(v1);
  });

  it('prefers v1 on tie (v1 is the rollback-safe baseline)', () => {
    const v1 = { day: 3, minutes: 600, v: 1 };
    const v2 = { day: 3, minutes: 600, v: 2 };
    expect(pickMoreAdvanced(v1, v2)).toBe(v1);
  });

  it('returns v2 when only v2 exists', () => {
    const v2 = { day: 2, minutes: 300, v: 2 };
    expect(pickMoreAdvanced(null, v2)).toBe(v2);
  });

  it('returns v1 when only v1 exists', () => {
    const v1 = { day: 2, minutes: 300, v: 1 };
    expect(pickMoreAdvanced(v1, null)).toBe(v1);
  });

  it('returns null when neither exists', () => {
    expect(pickMoreAdvanced(null, null)).toBeNull();
  });
});
