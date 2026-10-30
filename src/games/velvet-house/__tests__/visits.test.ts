import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { isHousesRequestMessage, isHousesResultMessage, isVisitMessage, isVisitEndMessage } from '../bridge/protocol';
import { snapshot, type SaveContext } from '../state/save';
import { INITIAL_OBJS } from '../state/objects';
import { run, SAVE_KEY, loadWorld } from '../kernel/config';
import { createPersist } from '../systems/persist';
import type { Game } from '../kernel/game';

// Visiting a friend's house: the bridge messages, the house the server hands over (only the house) loading as it is,
// and nothing of a visit ever being saved.

const OWNER = '0b0e3f8a-8f1c-4d2a-9e51-2c4b7d9a1e00';

describe('the visit messages', () => {
  const base = { game: 'velvet-house', seq: 1 };
  it('asks for friends, for whether the house is open, and to open or close it, and nothing else', () => {
    expect(isHousesRequestMessage({ ...base, type: 'velvet:houses', op: 'friends' })).toBe(true);
    expect(isHousesRequestMessage({ ...base, type: 'velvet:houses', op: 'open' })).toBe(true);
    expect(isHousesRequestMessage({ ...base, type: 'velvet:houses', op: 'setOpen', open: false })).toBe(true);
    expect(isHousesRequestMessage({ ...base, type: 'velvet:houses', op: 'setOpen' })).toBe(false);
    expect(isHousesRequestMessage({ ...base, type: 'velvet:houses', op: 'friends', open: true })).toBe(false);
    expect(isHousesRequestMessage({ ...base, type: 'velvet:houses', op: 'delete' })).toBe(false);
    expect(isHousesResultMessage({ type: 'velvet:housesResult', seq: 1, ok: true, data: [] })).toBe(true);
  });
  it('goes on a visit only to an account id, and comes home', () => {
    expect(isVisitMessage({ type: 'velvet:visit', game: 'velvet-house', owner: OWNER })).toBe(true);
    expect(isVisitMessage({ type: 'velvet:visit', game: 'velvet-house', owner: '../admin' })).toBe(false);
    expect(isVisitEndMessage({ type: 'velvet:visitEnd', game: 'velvet-house' })).toBe(true);
  });
});

// The house as the server hands it over (supabase/migrations/20261111100000_velvet_house_visits.sql): these keys only.
const HOUSE_KEYS = ['v', 'rev', 'contentVersion', 'day', 'minutes', 'power', 'wallMode', 'townName', 'fridge', 'dishes', 'laundryPile', 'owned',
  'LOOKS', 'ROOMLOOK', 'WALLOBJS', 'yard', 'objs', 'pets', 'petSeq', 'simName', 'look', 'mayaLook'];
function friendsHouse(): Record<string, unknown> {
  const objs = INITIAL_OBJS.map((o) => ({ ...o }));
  objs.find((o) => o.id === 'sofa')!.x = 2.2;
  const ctx: SaveContext = {
    rev: 4, day: 12, minutes: 900, money: 700, earnedToday: 0, spentToday: 0, power: true,
    fridge: { basic: 2, fresh: 1 }, dishes: 1, laundryPile: 2, bill: null, nextBillAt: null,
    objs, storage: [], owned: ['look-sofa-retro'], closet: [], bond: 61, flags: { rugObjects: true, tvObject: true, story: { secret: 1 } },
    simName: 'Bo', partnerName: 'Juniper', look: {} as never, mayaLook: {} as never, needs: { jordan: {} as never, maya: {} as never },
    memories: [], coreMem: [], pastMem: [], townName: 'Maple Row', turns: [], rngSeed: 7,
    lifeGoal: null, settleDone: false, freeWill: true, style: {}, companion: null, wallMode: 'cut',
    looks: { LOOKS: [], ROOMLOOK: [], WALLOBJS: [], yard: { t: [], rainAt: 0, rainUntil: 0, rainCheck: 0 } } as never,
  };
  const s = JSON.parse(JSON.stringify(snapshot(ctx))) as Record<string, unknown>;
  const house: Record<string, unknown> = Object.fromEntries(HOUSE_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
  return { ...house, player: { name: 'Bo' }, partner: { name: 'Juniper' }, flags: { rugObjects: true, tvObject: true }, ownerName: 'Bo' };
}

describe('a friend\'s house in the game', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { run.visit = false; localStorage.clear(); });

  it('loads as they left it, with their names, and gains no starting rugs or TV', () => {
    run.visit = true;
    localStorage.setItem(SAVE_KEY, JSON.stringify(friendsHouse()));
    const w = loadWorld();
    expect(w.day).toBe(12);
    expect(w.objs.find((o) => o.id === 'sofa')!.x).toBe(2.2);
    expect(w.objs.filter((o) => o.id === 'walltv')).toHaveLength(1);
    expect(w.save?.ownerName).toBe('Bo');
  });

  it('is shown even when it is from an older version of the game, and never thrown away', () => {
    run.visit = true;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...friendsHouse(), contentVersion: 0 }));
    expect(loadWorld().day).toBe(12);
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it('is never saved', () => {
    run.visit = true;
    localStorage.setItem(SAVE_KEY, 'as the host left it');
    const { doSave } = createPersist({ s: { saveRev: 0 } } as unknown as Game);
    doSave!();
    expect(localStorage.getItem(SAVE_KEY)).toBe('as the host left it');
  });
});
