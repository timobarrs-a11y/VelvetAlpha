/**
 * Save system: the one place that turns the game's state into a save, and back.
 *
 * Everything the game owns right now is written from live state. Everything it
 * doesn't model yet (career, pets, dirt, skills, mood and anything a newer or
 * older version added) is carried over from the save the game was loaded from,
 * so a save never loses data just because this version doesn't use it.
 */
import { migrateSave, CURRENT_VERSION, CONTENT_VERSION } from './saveMigration';
import type { SaveDataV3 } from './types';
import type { ObjectInstance } from './objects';
import type { AgentLook } from './agents';
import type { CharacterNeeds } from './types';

export interface SaveContext {
  /** How many saves this game has made, for choosing the newer of two copies. */
  rev: number;
  day: number;
  minutes: number;
  money: number;
  earnedToday: number;
  spentToday: number;
  power: boolean;
  fridge: { basic: number; fresh: number };
  dishes: number;
  laundryPile: number;
  bill: { amount: number; dueAbsMin: number; overdue: boolean } | null;
  nextBillAt: number | null;
  objs: ObjectInstance[];
  storage: ObjectInstance[];
  owned: string[];
  closet: unknown[];
  bond: number;
  flags: Record<string, unknown>;
  simName: string;
  partnerName: string;
  look: AgentLook;
  mayaLook: AgentLook;
  needs: { jordan: CharacterNeeds; maya: CharacterNeeds };
  memories: string[];
  coreMem: string[];
  pastMem: string[];
  townName: string;
  turns: { role: string; content: string }[];
  rngSeed: number;
  lifeGoal: string | null;
  settleDone: boolean;
  freeWill: boolean;
  style: Record<string, number>;
  companion: Record<string, unknown> | null;
  wallMode: string;
  /** From the art: house looks, per-room looks, wall decor and the yard. */
  looks: {
    LOOKS: unknown[];
    ROOMLOOK: unknown[];
    WALLOBJS: unknown[];
    yard: { t: number[][]; rainAt: number; rainUntil: number; rainCheck: number };
  };
}

const DEFAULT_SKILLS = { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 };
const DEFAULT_MOOD = { happy: 50, sad: 0, angry: 0, tired: 0, playful: 30, affectionate: 40 };

const lookOut = (l: AgentLook, gender: 'male' | 'female') => ({
  skin: l.skin, hair: '', hairColor: l.hair, top: l.top, topStyle: l.topStyle, bottom: l.bottom, bottomStyle: l.bottomStyle, bottomAccent: l.bottomAccent, accent: l.accent, topGarment: l.topGarment, bottomGarment: l.bottomGarment,
  eyeColor: '', facialHair: '', glasses: '', gender,
});

/**
 * @param prev the save the game was loaded from (already migrated), or null for a new game
 */
export function snapshot(ctx: SaveContext, prev: Record<string, unknown> | null = null): SaveDataV3 {
  const p = prev ?? {};
  const kept = <T>(key: string, fallback: T): T => (p[key] === undefined || p[key] === null ? fallback : p[key] as T);
  const person = (key: 'jordan' | 'maya', needs: CharacterNeeds) => {
    const old = kept<Record<string, unknown>>(key, {});
    return {
      ...old, needs,
      skills: old.skills ?? DEFAULT_SKILLS, mood: old.mood ?? DEFAULT_MOOD,
      workedDay: old.workedDay ?? false, friendsDay: old.friendsDay ?? false,
    };
  };
  return {
    ...p,
    v: CURRENT_VERSION,
    rev: ctx.rev,
    contentVersion: CONTENT_VERSION,
    setupDone: true,
    partnerName: ctx.partnerName,
    lifeGoal: ctx.lifeGoal,
    settleDone: ctx.settleDone,
    flags: ctx.flags,
    wallMode: ctx.wallMode,
    laundryPile: ctx.laundryPile,
    savedAt: Date.now(),
    minutes: ctx.minutes,
    day: ctx.day,
    money: ctx.money,
    earnedToday: ctx.earnedToday,
    spentToday: ctx.spentToday,
    power: ctx.power,
    fridge: ctx.fridge,
    bill: ctx.bill,
    nextBillAt: ctx.nextBillAt,
    owned: ctx.owned,
    closet: ctx.closet,
    bond: ctx.bond,
    memories: ctx.memories,
    coreMem: ctx.coreMem,
    pastMem: ctx.pastMem,
    townName: ctx.townName,
    simName: ctx.simName,
    rngSeed: ctx.rngSeed,
    freeWill: ctx.freeWill,
    autonomy: 'on',
    mayaCap: kept('mayaCap', 500),
    mayaSpent: kept('mayaSpent', { day: ctx.day, amt: 0 }),
    style: ctx.style,
    TASTE: ctx.style,
    companion: ctx.companion ?? {},
    dishes: ctx.dishes,
    turns: ctx.turns,
    storage: ctx.storage.map(o => ({ ...o })),
    // From the art: the house's looks, wall decor and yard.
    LOOKS: ctx.looks.LOOKS,
    ROOMLOOK: ctx.looks.ROOMLOOK,
    WALLOBJS: ctx.looks.WALLOBJS,
    yard: ctx.looks.yard,
    objs: ctx.objs.map(o => ({
      id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot,
      col: o.col ?? null, pot: o.pot, pet: o.pet, grow: o.grow, wet: o.wet, art: o.art,
    })),
    look: lookOut(ctx.look, 'male'),
    mayaLook: lookOut(ctx.mayaLook, 'female'),
    jordan: person('jordan', ctx.needs.jordan),
    maya: person('maya', ctx.needs.maya),
    player: { name: ctx.simName, look: {} },
    partner: { name: ctx.partnerName, look: {} },
    // Not modelled by the game yet: carried over from the loaded save, never reset.
    career: kept('career', { level: 0, perf: 0 }),
    mcareer: kept('mcareer', { level: 0, perf: 0 }),
    pboxes: kept('pboxes', false),
    pets: kept('pets', []),
    dirt: kept('dirt', []),
    changes: kept('changes', []),
    CHANGES: kept('CHANGES', []),
    petFood: kept('petFood', 6),
    petSeq: kept('petSeq', 0),
    dirtId: kept('dirtId', 0),
    changeSeq: kept('changeSeq', 0),
    projectAt: kept('projectAt', null),
    support: kept('support', 0),
    together: kept('together', 0),
    ext: kept('ext', {}),
  } as unknown as SaveDataV3;
}

export function saveGame(key: string, ctx: SaveContext, prev: Record<string, unknown> | null = null): void {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot(ctx, prev)));
  } catch {
    // storage full or unavailable: non-fatal
  }
}

export function loadSave(key: string): SaveDataV3 | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export { migrateSave, CURRENT_VERSION };
