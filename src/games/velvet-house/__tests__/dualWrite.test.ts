import { describe, it, expect, vi } from 'vitest';

// Mock the supabase client so the test runs without env vars.
vi.mock('../../../shared/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }) }),
      upsert: () => ({ error: null }),
      insert: () => ({ error: null }),
      delete: () => ({ in: () => ({ error: null }) }),
      range: () => ({ data: [], error: null }),
      order: () => ({ limit: () => ({ maybeSingle: () => ({ data: null, error: null }) }) }),
    }),
  },
}));

import { compareSaveProgress, toV1Compatible } from '../../../services/velvetHouseDatabase';

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

describe('toV1Compatible', () => {
  it('sets v: 1 on the output', () => {
    const result = toV1Compatible({ v: 2, day: 3, minutes: 600 });
    expect(result.v).toBe(1);
  });

  it('strips v2-only keys', () => {
    const result = toV1Compatible({
      v: 2, day: 3, minutes: 600,
      rngSeed: 12345, ext: { foo: 'bar' },
      player: { name: 'Sam', look: {} },
      partner: { name: 'Maya', look: {} },
    });
    expect(result.rngSeed).toBeUndefined();
    expect(result.ext).toBeUndefined();
    expect(result.player).toBeUndefined();
    expect(result.partner).toBeUndefined();
  });

  it('merges needs, skills and mood into jordan/maya instead of replacing', () => {
    const result = toV1Compatible({
      v: 2, day: 5, minutes: 300,
      jordan: { workedDay: true, friendsDay: false },
      maya: { workedDay: false, friendsDay: true },
      player: {
        name: 'Sam',
        look: { skin: '#F2EEE8', hairColor: '#3A2A1A' },
        needs: { energy: 80, hunger: 60 },
        skills: { cooking: 3, fitness: 5 },
        mood: { happy: 0.8, sad: 0.1 },
      },
      partner: {
        name: 'Maya',
        look: { skin: '#E8D5C5', hairColor: '#6B4A2A' },
        needs: { energy: 70, hunger: 50 },
        skills: { cooking: 4, fitness: 2 },
        mood: { happy: 0.6, sad: 0.2 },
      },
    });

    // jordan keeps existing fields AND gets needs/skills/mood merged in
    expect(result.jordan).toEqual({
      workedDay: true,
      friendsDay: false,
      needs: { energy: 80, hunger: 60 },
      skills: { cooking: 3, fitness: 5 },
      mood: { happy: 0.8, sad: 0.1 },
    });

    // maya keeps existing fields AND gets needs/skills/mood merged in
    expect(result.maya).toEqual({
      workedDay: false,
      friendsDay: true,
      needs: { energy: 70, hunger: 50 },
      skills: { cooking: 4, fitness: 2 },
      mood: { happy: 0.6, sad: 0.2 },
    });
  });

  it('maps player/partner names and looks to v1 flat fields', () => {
    const result = toV1Compatible({
      v: 2, day: 1, minutes: 480,
      player: { name: 'Alex', look: { skin: '#C68E6A', hairColor: '#2B1D16' } },
      partner: { name: 'Riley', look: { skin: '#8D5A3B', hairColor: '#1E1412' } },
    });
    expect(result.simName).toBe('Alex');
    expect(result.look).toEqual({ skin: '#C68E6A', hairColor: '#2B1D16' });
    expect(result.partnerName).toBe('Riley');
    expect(result.mayaLook).toEqual({ skin: '#8D5A3B', hairColor: '#1E1412' });
  });

  it('preserves all v1-known fields from a real fixture migration', () => {
    // Simulate migrating a real v1 fixture to v2 then converting back
    const v1Fixture = {
      v: 1,
      day: 7,
      minutes: 600,
      simName: 'Sam',
      partnerName: 'Maya',
      look: { skin: '#F2EEE8', hairColor: '#3A2A1A' },
      mayaLook: { skin: '#E8D5C5', hairColor: '#6B4A2A' },
      jordan: { needs: { energy: 80, hunger: 60, fun: 50, social: 70, hygiene: 40, bladder: 90 },
                skills: { cooking: 3, fitness: 5 }, mood: { happy: 0.8 }, workedDay: true, friendsDay: false },
      maya: { needs: { energy: 70, hunger: 50, fun: 60, social: 80, hygiene: 55, bladder: 85 },
              skills: { cooking: 4, fitness: 2 }, mood: { happy: 0.6 }, workedDay: false, friendsDay: true },
      money: 500,
      objs: [{ id: 'sofa1', type: 'sofa', x: 5, y: 3 }],
    };

    // Migrate v1 → v2 (as saveMigration does)
    const v2 = {
      ...v1Fixture,
      v: 2,
      player: { name: v1Fixture.simName, look: v1Fixture.look,
                needs: v1Fixture.jordan.needs, skills: v1Fixture.jordan.skills, mood: v1Fixture.jordan.mood },
      partner: { name: v1Fixture.partnerName, look: v1Fixture.mayaLook,
                 needs: v1Fixture.maya.needs, skills: v1Fixture.maya.skills, mood: v1Fixture.maya.mood },
      rngSeed: 12345,
      ext: {},
    };

    // Convert back to v1
    const back = toV1Compatible(v2);

    // Legacy loader required fields
    expect(back.v).toBe(1);
    expect(back.day).toBe(7);
    expect(back.minutes).toBe(600);
    expect(back.simName).toBe('Sam');
    expect(back.partnerName).toBe('Maya');
    expect(back.money).toBe(500);
    expect(back.objs).toEqual(v1Fixture.objs);
    expect(back.jordan).toBeDefined();
    expect((back.jordan as Record<string, unknown>).needs).toEqual(v1Fixture.jordan.needs);
    expect((back.jordan as Record<string, unknown>).skills).toEqual(v1Fixture.jordan.skills);
    expect((back.jordan as Record<string, unknown>).mood).toEqual(v1Fixture.jordan.mood);
    expect((back.jordan as Record<string, unknown>).workedDay).toBe(true);
    expect(back.maya).toBeDefined();
    expect((back.maya as Record<string, unknown>).needs).toEqual(v1Fixture.maya.needs);
    expect((back.maya as Record<string, unknown>).skills).toEqual(v1Fixture.maya.skills);
    expect((back.maya as Record<string, unknown>).mood).toEqual(v1Fixture.maya.mood);
    expect((back.maya as Record<string, unknown>).friendsDay).toBe(true);
  });
});
