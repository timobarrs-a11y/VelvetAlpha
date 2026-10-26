/**
 * The life-sim layer: bills and the bank, side jobs at home, and Jordan's
 * daily routine. One saved object (`life` in the save); the rules live in
 * finance.ts, sideJobs.ts and routine.ts. Design: docs/velvet-house/free-and-paid.md.
 */

export type BillKind = 'rent' | 'electric' | 'water' | 'internet';

export interface Bill {
  id: string;
  kind: BillKind;
  label: string;
  amount: number;
  /** The game day it's due by (end of that day). */
  dueDay: number;
  /** Late fee added once it's overdue. */
  fee: number;
  overdue: boolean;
  reminded: boolean;
}

export interface Txn {
  day: number;
  minutes: number;
  label: string;
  /** Positive in, negative out. */
  amount: number;
  balance: number;
}

export type SideJobId = 'website' | 'logo' | 'laptop' | 'bake' | 'tutor';

export interface Offer {
  id: string;
  job: SideJobId;
  client: string;
  /** Absolute game minute it disappears if not taken. */
  expires: number;
}

export interface TakenJob {
  id: string;
  job: SideJobId;
  client: string;
  /** Game minutes worked so far. */
  done: number;
  /** Ingredients used (baking takes them once, at the start). */
  started: boolean;
}

export interface Routine {
  /** Hour he gets up on workdays (6 = 6:00). */
  wake: number;
  /** Hour he gets up on weekends. */
  weekendWake: number;
  /** Hour he goes to bed; 24 is midnight, 25 is 1:00. */
  bed: number;
  /** Shower in the morning routine. */
  shower: boolean;
}

/** What has happened today, so each part of the routine runs once. */
export interface RoutineDay {
  day: number;
  woke: boolean;
  left: boolean;
  returned: boolean;
  /** Stays home today: no work, no pay. */
  calledIn: boolean;
}

export interface LifeState {
  bills: Bill[];
  /** Newest first. */
  ledger: Txn[];
  /** The last due day each kind of bill was issued for. */
  issued: Record<BillKind, number>;
  /** Earned at work this week, paid on Friday. */
  wagesOwed: number;
  lastPayDay: number;
  water: boolean;
  internet: boolean;
  offers: Offer[];
  taken: TakenJob[];
  /** The taken job Jordan is working on right now, if any. */
  working: string | null;
  offerDay: number;
  seq: number;
  routine: Routine;
  today: RoutineDay;
}

export const DEFAULT_ROUTINE: Routine = { wake: 6, weekendWake: 8, bed: 24, shower: true };

export function createLife(day = 1): LifeState {
  return {
    bills: [],
    ledger: [],
    issued: { rent: 0, electric: 0, water: 0, internet: 0 },
    wagesOwed: 0,
    lastPayDay: 0,
    water: true,
    internet: true,
    offers: [],
    taken: [],
    working: null,
    offerDay: 0,
    seq: 0,
    routine: { ...DEFAULT_ROUTINE },
    today: { day, woke: false, left: false, returned: false, calledIn: false },
  };
}

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const arr = <T>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T[] =>
  Array.isArray(v) ? (v.filter(x => x && typeof x === 'object' && ok(x as Record<string, unknown>)) as T[]) : [];

const BILL_KINDS: BillKind[] = ['rent', 'electric', 'water', 'internet'];
const JOB_IDS: SideJobId[] = ['website', 'logo', 'laptop', 'bake', 'tutor'];

/** A saved `life`, checked field by field; anything missing or wrong falls back to a new game's value. */
export function parseLife(raw: unknown, day: number): LifeState {
  const fresh = createLife(day);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Record<string, unknown>;
  const issued = (r.issued && typeof r.issued === 'object' ? r.issued : {}) as Record<string, unknown>;
  const routine = (r.routine && typeof r.routine === 'object' ? r.routine : {}) as Record<string, unknown>;
  const today = (r.today && typeof r.today === 'object' ? r.today : {}) as Record<string, unknown>;
  return {
    bills: arr<Bill>(r.bills, b => BILL_KINDS.includes(b.kind as BillKind) && typeof b.id === 'string' && typeof b.amount === 'number' && typeof b.dueDay === 'number'),
    ledger: arr<Txn>(r.ledger, t => typeof t.label === 'string' && typeof t.amount === 'number').slice(0, LEDGER_MAX),
    issued: Object.fromEntries(BILL_KINDS.map(k => [k, num(issued[k], 0)])) as Record<BillKind, number>,
    wagesOwed: num(r.wagesOwed, 0),
    lastPayDay: num(r.lastPayDay, 0),
    water: bool(r.water, true),
    internet: bool(r.internet, true),
    offers: arr<Offer>(r.offers, o => JOB_IDS.includes(o.job as SideJobId) && typeof o.id === 'string'),
    taken: arr<TakenJob>(r.taken, t => JOB_IDS.includes(t.job as SideJobId) && typeof t.id === 'string'),
    working: typeof r.working === 'string' ? r.working : null,
    offerDay: num(r.offerDay, 0),
    seq: num(r.seq, 0),
    routine: {
      wake: num(routine.wake, DEFAULT_ROUTINE.wake),
      weekendWake: num(routine.weekendWake, DEFAULT_ROUTINE.weekendWake),
      bed: num(routine.bed, DEFAULT_ROUTINE.bed),
      shower: bool(routine.shower, DEFAULT_ROUTINE.shower),
    },
    today: num(today.day, -1) === day
      ? { day, woke: bool(today.woke, false), left: bool(today.left, false), returned: bool(today.returned, false), calledIn: bool(today.calledIn, false) }
      : fresh.today,
  };
}

export const LEDGER_MAX = 80;

export function nextId(life: LifeState, prefix: string): string {
  life.seq += 1;
  return `${prefix}${life.seq}`;
}
