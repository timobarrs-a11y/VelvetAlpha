import type { CharacterNeeds } from './types';

export type NeedKey = 'energy' | 'food' | 'hygiene' | 'fun' | 'comfort' | 'social';

export const NEED_KEYS: NeedKey[] = ['energy', 'food', 'hygiene', 'fun', 'comfort', 'social'];

export const NEED_LABELS: Record<NeedKey, string> = {
  energy: 'Energy',
  food: 'Food',
  hygiene: 'Hygiene',
  fun: 'Fun',
  comfort: 'Comfort',
  social: 'Social',
};

export const DECAY: Record<NeedKey, number> = {
  energy: 4,
  food: 6,
  hygiene: 4.5,
  fun: 6,
  comfort: 3,
  social: 4,
};

export const DECAY_SLEEP: Record<NeedKey, number> = {
  energy: 0,
  food: 2,
  hygiene: 1,
  fun: 0,
  comfort: 0,
  social: 0.5,
};

export const DECAY_AWAY: Record<NeedKey, number> = {
  energy: 5,
  food: 3,
  hygiene: 3,
  fun: 4,
  comfort: 3,
  social: 1,
};

export function weight(v: number): number {
  const d = (100 - v) / 100;
  return d * d;
}

export interface ActivityDef {
  gives?: Partial<Record<NeedKey, number>>;
  rate?: Partial<Record<NeedKey, number>>;
  dur?: number;
}

export interface TickContext {
  away: boolean;
  asleep: boolean;
  fitness: number;
  starving: boolean;
  messLevel: number;
  hasBed: boolean;
  activity: ActivityDef | null;
  activityName: string | null;
  foodScale: number;
  coffeeBoost: number;
  hasBigTv: boolean;
  hasBookshelf: boolean;
  hasRecords: boolean;
}

export interface NeedWarning {
  key: NeedKey;
  message: string;
}

export const WARNING_MESSAGES: Record<NeedKey, (name: string) => string> = {
  energy: (n) => `${n} is running on empty.`,
  food: (n) => `${n} is getting hungry.`,
  hygiene: (n) => `${n} could really use a shower.`,
  fun: (n) => `${n} is bored out of their mind.`,
  comfort: (n) => `${n} is uncomfortable.`,
  social: (n) => `${n} is feeling lonely.`,
};

export function tickNeeds(
  needs: CharacterNeeds,
  ctx: TickContext,
  gameMinutes: number,
): { needs: CharacterNeeds; warnings: NeedWarning[]; clearedWarnings: NeedKey[] } {
  const decay = ctx.away
    ? DECAY_AWAY
    : ctx.asleep
      ? DECAY_SLEEP
      : DECAY;

  const fit = ctx.fitness >= 2 ? 0.9 : 1;
  const starvingMul = ctx.starving ? 2 : 1;

  const result: CharacterNeeds = { ...needs };
  const warnings: NeedWarning[] = [];
  const cleared: NeedKey[] = [];

  for (const k of NEED_KEYS) {
    let v = needs[k];

    let multiplier = 1;
    if (k === 'energy') multiplier = fit * starvingMul;
    else if (k === 'fun' && ctx.starving) multiplier = 1.5;
    else if (k === 'comfort' && !ctx.away && ctx.messLevel > 7) multiplier = 1.6;

    v -= decay[k] * multiplier * gameMinutes / 60;

    if (ctx.activity) {
      const a = ctx.activity;
      if (a.rate && a.rate[k]) {
        const bedBonus = k === 'energy' && ctx.hasBed ? 1.3 : 1;
        v += a.rate[k]! * gameMinutes * bedBonus;
      } else if (a.gives && a.gives[k]) {
        let g = a.gives[k]!;
        if (k === 'food' && ctx.foodScale) g *= ctx.foodScale;
        if (k === 'energy' && ctx.activityName === 'sip' && ctx.coffeeBoost) g *= ctx.coffeeBoost;
        if (k === 'fun' && ctx.activityName === 'tv' && ctx.hasBigTv) g *= 1.35;
        if (k === 'fun' && ctx.activityName === 'read' && ctx.hasBookshelf) g *= 1.4;
        if (k === 'fun' && ctx.activityName === 'dance' && ctx.hasRecords) g *= 1.2;
        const dur = isFinite(a.dur ?? 30) ? (a.dur ?? 30) : 30;
        v += g * gameMinutes / dur;
      }
    }

    result[k] = Math.max(0, Math.min(100, v));
  }

  return { needs: result, warnings, clearedWarnings: cleared };
}

export function checkWarnings(
  needs: CharacterNeeds,
  prevWarned: Set<NeedKey>,
  simName: string,
): { newWarnings: NeedWarning[]; toClear: NeedKey[] } {
  const newWarnings: NeedWarning[] = [];
  const toClear: NeedKey[] = [];

  for (const k of NEED_KEYS) {
    if (needs[k] < 20 && !prevWarned.has(k)) {
      newWarnings.push({ key: k, message: WARNING_MESSAGES[k](simName) });
    }
    if (needs[k] > 35 && prevWarned.has(k)) {
      toClear.push(k);
    }
  }

  return { newWarnings, toClear };
}

export function totalNeedScore(needs: CharacterNeeds): number {
  return NEED_KEYS.reduce((sum, k) => sum + needs[k], 0) / NEED_KEYS.length;
}

export function lowestNeed(needs: CharacterNeeds): { key: NeedKey; value: number } {
  let lowest: NeedKey = 'energy';
  let lowestVal = Infinity;
  for (const k of NEED_KEYS) {
    if (needs[k] < lowestVal) {
      lowestVal = needs[k];
      lowest = k;
    }
  }
  return { key: lowest, value: lowestVal };
}
