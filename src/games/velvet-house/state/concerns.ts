/**
 * Concerns: the house talking back through the companion. A concern is a rule about the house (no food, a bill
 * overdue, the dishes, the laundry) with a grace period, an escalation after a day ignored, and for food and bills a
 * hard pass after another day, where she stops talking until it is put right. The simulation owns all of it: the
 * companion's chat only receives the state and speaks. A concern clears when the house changes, never because of
 * what the player said.
 */
export type ConcernKind = 'food' | 'bills' | 'dishes' | 'laundry';
export const CONCERN_KINDS: ConcernKind[] = ['food', 'bills', 'dishes', 'laundry'];
/** 0 nothing · 1 she has noticed · 2 it has gone on a day · 3 the hard pass (food and bills only). */
export type ConcernLevel = 0 | 1 | 2 | 3;
export type Mood = 'content' | 'unsettled' | 'worried' | 'upset';

export interface ConcernItem {
  /** When the rule first came true (absolute game minutes), or null while it is not. */
  since: number | null;
  level: ConcernLevel;
  /** The day she last brought it up, so she nags once a day per step. */
  nagDay: number;
}
export type ConcernsState = Record<ConcernKind, ConcernItem>;

export interface Signals {
  servings: number;
  /** Anyone in the house with hunger below the starving line. */
  starving: boolean;
  overdue: boolean;
  dishes: number;
  laundry: number;
}

const DAY = 24 * 60;
/** Grace before she says anything, and the thresholds. */
const RULES: Record<ConcernKind, { grace: number; hardPass: boolean; holds: (s: Signals) => boolean }> = {
  food: { grace: 2 * 60, hardPass: true, holds: (s) => s.servings <= 0 },
  bills: { grace: 0, hardPass: true, holds: (s) => s.overdue },
  dishes: { grace: 60, hardPass: false, holds: (s) => s.dishes >= 6 },
  laundry: { grace: 60, hardPass: false, holds: (s) => s.laundry >= 8 },
};

export const NEW_CONCERNS = (): ConcernsState => ({
  food: { since: null, level: 0, nagDay: -1 },
  bills: { since: null, level: 0, nagDay: -1 },
  dishes: { since: null, level: 0, nagDay: -1 },
  laundry: { since: null, level: 0, nagDay: -1 },
});

export function parseConcerns(raw: unknown): ConcernsState {
  const out = NEW_CONCERNS();
  if (!raw || typeof raw !== 'object') return out;
  for (const k of CONCERN_KINDS) {
    const r = (raw as Record<string, Partial<ConcernItem>>)[k];
    if (!r) continue;
    out[k] = { since: typeof r.since === 'number' ? r.since : null, level: ([0, 1, 2, 3] as const).includes(r.level as 0) ? (r.level as ConcernLevel) : 0, nagDay: typeof r.nagDay === 'number' ? r.nagDay : -1 };
  }
  return out;
}

export interface ConcernEvents {
  /** She brings it up: once per day per step, and at once when a step is reached. */
  raised: Array<{ kind: ConcernKind; level: ConcernLevel }>;
  cleared: ConcernKind[];
}

/**
 * One evaluation. `absMin` is absolute game minutes, `day` the game day. While `active` is false (the tutorial is
 * still teaching the systems), nothing is tracked.
 */
export function evaluateConcerns(state: ConcernsState, s: Signals, absMin: number, day: number, active: boolean): ConcernEvents {
  const out: ConcernEvents = { raised: [], cleared: [] };
  for (const kind of CONCERN_KINDS) {
    const item = state[kind];
    const rule = RULES[kind];
    const holds = active && rule.holds(s);
    if (!holds) {
      if (item.level > 0) out.cleared.push(kind);
      item.since = null; item.level = 0; item.nagDay = -1;
      continue;
    }
    if (item.since === null) item.since = absMin;
    const forMin = absMin - item.since;
    // Starving skips the grace: hunger is not a thing to wait on.
    const noticed = forMin >= rule.grace || (kind === 'food' && s.starving);
    let level: ConcernLevel = !noticed ? 0 : forMin >= 2 * DAY && rule.hardPass ? 3 : forMin >= DAY ? 2 : 1;
    if (!rule.hardPass && level > 2) level = 2;
    const stepped = level > item.level;
    item.level = level;
    if (level > 0 && (stepped || item.nagDay !== day) && (stepped || level < 3)) {
      // A new step is said at once; a step that goes on is brought up again once a day, except the hard pass, which
      // is a closed door rather than a line.
      if (stepped || item.nagDay !== day) { item.nagDay = day; out.raised.push({ kind, level }); }
    }
  }
  return out;
}

export function moodOf(state: ConcernsState): Mood {
  const worst = Math.max(...CONCERN_KINDS.map((k) => state[k].level)) as ConcernLevel;
  return worst >= 3 ? 'upset' : worst === 2 ? 'worried' : worst === 1 ? 'unsettled' : 'content';
}

/** The concern she has closed the door over, if any. */
export function hardPassOf(state: ConcernsState): ConcernKind | null {
  return CONCERN_KINDS.find((k) => state[k].level >= 3) ?? null;
}

/** The concern most on her mind, for the chat's context. */
export function worstConcern(state: ConcernsState, absMin: number): { kind: ConcernKind; level: ConcernLevel; hours: number } | null {
  let best: { kind: ConcernKind; level: ConcernLevel; hours: number } | null = null;
  for (const k of CONCERN_KINDS) {
    const it = state[k];
    if (it.level === 0) continue;
    const hours = it.since === null ? 0 : Math.floor((absMin - it.since) / 60);
    if (!best || it.level > best.level || (it.level === best.level && hours > best.hours)) best = { kind: k, level: it.level, hours };
  }
  return best;
}

/** Bond falls a point per game hour while something has gone on a day or more (never below 10), and recovers a point
 *  per game hour when nothing is wrong (never above 100). Returns the new bond. */
export function bondDrift(bond: number, state: ConcernsState, gameMin: number): number {
  const worst = Math.max(...CONCERN_KINDS.map((k) => state[k].level));
  if (worst >= 2) return Math.max(10, bond - gameMin / 60);
  if (worst === 0) return Math.min(100, bond + gameMin / 60);
  return bond;
}
