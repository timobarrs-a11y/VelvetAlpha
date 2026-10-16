/**
 * Save system — snapshot/load for the modular game.
 * Produces v2 saves, loads both v1 and v2 via migrateSave().
 */
import { migrateSave, CURRENT_VERSION } from './saveMigration';
import type { SaveDataV2 } from './types';
import type { ObjectInstance } from './objects';
import type { AgentLook } from './agents';

export interface SaveContext {
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
  owned: string[];
  bond: number;
  flags: Record<string, unknown>;
  simName: string;
  partnerName: string;
  look: AgentLook;
  mayaLook: AgentLook;
  memories: string[];
  coreMem: string[];
  pastMem: string[];
  townName: string;
  turns: { role: string; content: string }[];
  rngSeed: number;
  career: { level: number; perf: number };
  mcareer: { level: number; perf: number };
  lifeGoal: string | null;
  settleDone: boolean;
  freeWill: boolean;
  autonomy: string;
  mayaCap: number;
  mayaSpent: { day: number; amt: number };
  style: Record<string, number>;
  companion: Record<string, unknown> | null;
  changes: { id: string; at: number; text: string; undone: boolean; seen: boolean }[];
  pets: unknown[];
  dirt: unknown[];
  wallMode: string;
}

export function snapshot(ctx: SaveContext): SaveDataV2 {
  return {
    v: CURRENT_VERSION,
    setupDone: true,
    partnerName: ctx.partnerName,
    lifeGoal: ctx.lifeGoal,
    settleDone: ctx.settleDone,
    flags: ctx.flags as never,
    career: ctx.career as never,
    mcareer: ctx.mcareer as never,
    pboxes: false,
    wallMode: ctx.wallMode,
    yard: { t: [], rainAt: 0, rainUntil: 0, rainCheck: 0 },
    laundryPile: ctx.laundryPile,
    savedAt: Date.now(),
    minutes: ctx.minutes,
    day: ctx.day,
    money: ctx.money,
    earnedToday: ctx.earnedToday,
    spentToday: ctx.spentToday,
    power: ctx.power,
    fridge: ctx.fridge,
    bill: ctx.bill as never,
    nextBillAt: ctx.nextBillAt,
    owned: ctx.owned,
    LOOKS: [
      { skin: ctx.look.skin, hair: '', hairColor: ctx.look.hair, top: ctx.look.top, eyeColor: '', facialHair: '', glasses: '', gender: 'male' },
      { skin: ctx.mayaLook.skin, hair: '', hairColor: ctx.mayaLook.hair, top: ctx.mayaLook.top, eyeColor: '', facialHair: '', glasses: '', gender: 'female' },
    ],
    ROOMLOOK: [{}, {}, {}, {}],
    WALLOBJS: [],
    bond: ctx.bond,
    support: 0,
    together: 0,
    memories: ctx.memories,
    coreMem: ctx.coreMem,
    pastMem: ctx.pastMem,
    townName: ctx.townName,
    dishes: ctx.dishes,
    petFood: 6,
    petSeq: 0,
    dirtId: 0,
    changeSeq: 0,
    simName: ctx.simName,
    autonomy: ctx.autonomy as never,
    mayaCap: ctx.mayaCap,
    mayaSpent: ctx.mayaSpent as never,
    TASTE: ctx.style as never,
    style: ctx.style as never,
    look: { skin: ctx.look.skin, hair: '', hairColor: ctx.look.hair, top: ctx.look.top, eyeColor: '', facialHair: '', glasses: '', gender: 'male' },
    companion: (ctx.companion ?? {}) as never,
    mayaLook: { skin: ctx.mayaLook.skin, hair: '', hairColor: ctx.mayaLook.hair, top: ctx.mayaLook.top, eyeColor: '', facialHair: '', glasses: '', gender: 'female' },
    CHANGES: ctx.changes as never,
    projectAt: null,
    objs: ctx.objs.map(o => ({
      id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot,
      col: o.col ?? null, pot: o.pot, pet: o.pet, grow: o.grow, wet: o.wet, art: o.art,
    })) as never,
    pets: ctx.pets as never,
    dirt: ctx.dirt as never,
    jordan: { needs: { energy: 80, food: 70, hygiene: 75, fun: 60, comfort: 70, social: 65 }, skills: { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 }, mood: { happy: 50, sad: 0, angry: 0, tired: 0, playful: 30, affectionate: 40 }, workedDay: false, friendsDay: false } as never,
    maya: { needs: { energy: 80, food: 70, hygiene: 75, fun: 60, comfort: 70, social: 65 }, skills: { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 }, mood: { happy: 50, sad: 0, angry: 0, tired: 0, playful: 30, affectionate: 40 }, workedDay: false, friendsDay: false } as never,
    turns: ctx.turns as never,
    rngSeed: ctx.rngSeed,
    ext: {},
    player: {
      name: ctx.simName,
      look: { skin: ctx.look.skin, hair: '', hairColor: ctx.look.hair, top: ctx.look.top, eyeColor: '', facialHair: '', glasses: '', gender: 'male' },
    },
    partner: {
      name: ctx.partnerName,
      look: { skin: ctx.mayaLook.skin, hair: '', hairColor: ctx.mayaLook.hair, top: ctx.mayaLook.top, eyeColor: '', facialHair: '', glasses: '', gender: 'female' },
    },
  } as unknown as SaveDataV2;
}

export function saveGame(key: string, ctx: SaveContext): void {
  try {
    localStorage.setItem(key, JSON.stringify(snapshot(ctx)));
  } catch {
    // storage full or unavailable — non-fatal
  }
}

export function loadSave(key: string): SaveDataV2 | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return migrateSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export { migrateSave, CURRENT_VERSION };
