import type { CareerState } from './career';

export interface LockCondition {
  day?: number;
  career?: number;
  bond?: number;
  skill?: number;
  flag?: string;
  hint?: string;
}

export type LockMap = Record<string, LockCondition[]>;

export interface LockResult {
  hint: string;
  hidden: boolean;
}

export interface LockContext {
  day: number;
  career: CareerState;
  bond: number;
  cookingSkill: number;
  flags: Record<string, unknown>;
  owned: Set<string>;
}

export function lockOf(itemId: string, locks: LockMap, ctx: LockContext): LockResult | null {
  const ls = locks[itemId];
  if (!ls || ctx.owned.has(itemId)) return null;
  for (const l of ls) {
    if (l.day !== undefined && ctx.day < l.day) {
      return { hint: l.hint || `Opens once you've lived here ${l.day} days`, hidden: false };
    }
    if (l.career !== undefined && ctx.career.level < l.career) {
      return { hint: l.hint || `Reach the right career level`, hidden: false };
    }
    if (l.bond !== undefined && ctx.bond < l.bond) {
      return { hint: l.hint || 'Get closer to your partner', hidden: true };
    }
    if (l.skill !== undefined && ctx.cookingSkill < l.skill) {
      return { hint: l.hint || `Reach cooking skill ${l.skill}`, hidden: false };
    }
    if (l.flag && !ctx.flags[l.flag]) {
      return { hint: l.hint || '???', hidden: true };
    }
  }
  return null;
}

export function checkNewlyUnlocked(
  itemIds: string[],
  locks: LockMap,
  ctx: LockContext,
  alreadySeen: string[],
): string[] {
  const newly: string[] = [];
  for (const id of itemIds) {
    if (!locks[id] || ctx.owned.has(id) || alreadySeen.includes(id)) continue;
    if (lockOf(id, locks, ctx)) continue;
    newly.push(id);
  }
  return newly;
}
