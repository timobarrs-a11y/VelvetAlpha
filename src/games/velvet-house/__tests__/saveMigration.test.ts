import { describe, it, expect } from 'vitest';
import { migrateSave, migrateV2toV3, repairFromV1, CURRENT_VERSION } from '../state/saveMigration';
import type { SaveDataV1 } from '../state/types';

function makeV1Save(overrides: Partial<SaveDataV1> = {}): SaveDataV1 {
  return {
    v: 1,
    basementV: 2,
    houseV: 3,
    setupDone: true,
    partnerName: 'Maya',
    lifeGoal: 'career',
    settleDone: true,
    flags: {
      arranged: false, stocked: false, styled: false, talked: false,
      danced: false, watched: false, dinners: 0, harvests: 0,
      mowed: false, tvVideo: false, furniture: 0, spotless: 0,
      styledSet: [], settleSeen: [], lifeStep: 0, unlockedSeen: [],
      story: [], events: [], firstPay: false, billPaid: false,
    },
    career: { level: 0, perf: 0 },
    mcareer: { level: 0, perf: 0 },
    pboxes: true,
    wallMode: 'cut',
    yard: { t: [], rainAt: 0, rainUntil: 0, rainCheck: -1 },
    laundryPile: 0,
    savedAt: 1700000000000,
    minutes: 480,
    day: 1,
    money: 500,
    earnedToday: 0,
    spentToday: 0,
    power: true,
    fridge: {},
    bill: 100,
    nextBillAt: 1440,
    owned: ['couch', 'tv'],
    LOOKS: [],
    ROOMLOOK: [],
    WALLOBJS: [],
    bond: 50,
    support: 50,
    together: 50,
    memories: [],
    coreMem: [],
    pastMem: [],
    townName: 'Pinebrook',
    dishes: 0,
    petFood: 0,
    petSeq: 0,
    dirtId: 0,
    changeSeq: 0,
    simName: 'Jordan',
    autonomy: 'free',
    mayaCap: 80,
    mayaSpent: { day: 0, amt: 0 },
    TASTE: { natural: 0, vintage: 0, minimal: 0, modern: 0, cozy: 0, soft: 0, playful: 0, bold: 0, luxe: 0, industrial: 0, warm: 0, cool: 0 },
    style: { natural: 0, vintage: 0, minimal: 0, modern: 0, cozy: 0, soft: 0, playful: 0, bold: 0, luxe: 0, industrial: 0, warm: 0, cool: 0 },
    look: { skin: '#E8C8A8', hair: 'short', hairColor: '#3A2A1A', top: '#4A5DA8', eyeColor: '#4A6A8A', facialHair: 'none', glasses: 'none', gender: 'male' },
    companion: { source: 'game', preset: 'warm', pronoun: 'she', gender: 'female', bio: '', memories: [] },
    mayaLook: { skin: '#E8C8A8', hair: 'long', hairColor: '#5A3A2A', top: '#D97A9B', eyeColor: '#5A6A8A', facialHair: 'none', glasses: 'none', gender: 'female' },
    CHANGES: [],
    projectAt: null,
    objs: [],
    pets: [],
    dirt: [],
    jordan: { needs: { hunger: 50, energy: 50, fun: 50, social: 50, hygiene: 50, bladder: 50 }, skills: { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 }, mood: { happy: 5, sad: 0, angry: 0, tired: 0, playful: 0, affectionate: 5 }, workedDay: false, friendsDay: false },
    maya: { needs: { hunger: 50, energy: 50, fun: 50, social: 50, hygiene: 50, bladder: 50 }, skills: { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 }, mood: { happy: 5, sad: 0, angry: 0, tired: 0, playful: 0, affectionate: 5 }, workedDay: false, friendsDay: false },
    turns: [],
    ...overrides,
  };
}

describe('saveMigration', () => {
  it('migrates a valid v1 save up to the current version', () => {
    const v1 = makeV1Save();
    const result = migrateSave(v1);
    expect(result).not.toBeNull();
    expect(result!.v).toBe(3);
    expect(result!.rngSeed).toBe(v1.savedAt >>> 0);
    // v1 fields preserved
    expect(result!.money).toBe(500);
    expect(result!.simName).toBe('Jordan');
    expect(result!.partnerName).toBe('Maya');
  });

  it('preserves all v1 data through migration', () => {
    const v1 = makeV1Save({ money: 999, day: 5, bond: 75, townName: 'Oakville' });
    const result = migrateSave(v1);
    expect(result!.money).toBe(999);
    expect(result!.day).toBe(5);
    expect(result!.bond).toBe(75);
    expect(result!.townName).toBe('Oakville');
  });

  it('returns null for invalid input', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave(undefined)).toBeNull();
    expect(migrateSave('string')).toBeNull();
    expect(migrateSave({})).toBeNull();
    expect(migrateSave({ v: 0 })).toBeNull();
    expect(migrateSave({ v: 99 })).toBeNull();
  });

  it('passes through current-version saves unchanged', () => {
    const v1 = makeV1Save();
    const v2 = migrateSave(v1)!;
    const result = migrateSave(v2);
    expect(result).not.toBeNull();
    expect(result!.v).toBe(3);
    expect(result!.rngSeed).toBe(v2.rngSeed);
  });

  it('CURRENT_VERSION is 3', () => {
    expect(CURRENT_VERSION).toBe(3);
  });
});

describe('v3 and repair', () => {
  const house = (paint: string) => ({ paint, paper: null, floor: 'wood' });

  it('migrates v2 to v3 and keeps real looks', () => {
    const v2 = { ...migrateSave(makeV1Save())!, v: 2, ext: {}, LOOKS: [house('#111'), house('#222'), house('#333'), house('#444'), house('#555')] } as never;
    const v3 = migrateV2toV3(v2);
    expect(v3.v).toBe(3);
    expect(v3.rev).toBe(0);
    expect((v3 as unknown as { LOOKS: unknown[] }).LOOKS).toHaveLength(5);
    expect(v3.ext.looksLost).toBeUndefined();
  });

  it('flags looks lost to the old save bug (empty, or character looks in the slot)', () => {
    const empty = migrateV2toV3({ ...migrateSave(makeV1Save())!, v: 2, LOOKS: [] } as never);
    expect(empty.ext.looksLost).toBe(true);
    const chars = migrateV2toV3({ ...migrateSave(makeV1Save())!, v: 2, LOOKS: [{ skin: '#c68e6a', gender: 'male' }, { skin: '#fff' }] } as never);
    expect(chars.ext.looksLost).toBe(true);
    expect((chars as unknown as { LOOKS: unknown[] }).LOOKS).toEqual([]);
  });

  it('restores lost looks, pets and career from the cloud v1 copy, without touching real data', () => {
    const lost = migrateV2toV3({ ...migrateSave(makeV1Save())!, v: 2, LOOKS: [], pets: [], career: { level: 0, perf: 0 } } as never);
    const cloud = { LOOKS: [house('#A'), house('#B'), house('#C'), house('#D')], ROOMLOOK: [{}, {}, {}, {}], pets: [{ id: 'p1' }], career: { level: 2, perf: 3 }, mcareer: { level: 1, perf: 0 } };
    const fixed = repairFromV1(lost, cloud) as unknown as Record<string, unknown>;
    expect((fixed.LOOKS as { paint: string }[])[0].paint).toBe('#A');
    expect(fixed.pets).toEqual([{ id: 'p1' }]);
    expect(fixed.career).toEqual({ level: 2, perf: 3 });
    expect((fixed.ext as Record<string, unknown>).looksLost).toBeUndefined();

    // A save that already has data keeps it.
    const mine = migrateV2toV3({ ...migrateSave(makeV1Save())!, v: 2, LOOKS: [], pets: [{ id: 'mine' }], career: { level: 3, perf: 1 } } as never);
    const kept = repairFromV1(mine, cloud) as unknown as Record<string, unknown>;
    expect(kept.pets).toEqual([{ id: 'mine' }]);
    expect(kept.career).toEqual({ level: 3, perf: 1 });
  });

  it('leaves saves from a newer game alone', () => {
    expect(migrateSave({ v: 4 })).toBeNull();
  });
});
