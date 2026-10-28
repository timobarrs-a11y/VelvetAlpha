import type { HouseholdState } from './household';
import type { LifeState } from './life';

/**
 * The house's vital signs: the moving numbers the player's actions push around, shown together in the HUD and read by
 * the companion. Food is how much there is to eat; fitness grows with the treadmill and the weights and fades without
 * them; tidy is the dishes and the laundry; bills are what is due and whether it is late. Everything here is a pure
 * function of the household, the life state and the flags, so it is the same in the HUD, the story and the chat.
 */
export const FOOD_FULL = 10;
/** Grazing between meals: one serving every eight game hours, so the fridge empties even if nobody cooks. */
export const SNACK_EVERY_MIN = 8 * 60;
const FITNESS_PER_WORKOUT_MIN = 0.15;
const FITNESS_FADE_PER_HOUR = 0.3;

export interface Vitals {
  food: number;
  fitness: number;
  tidy: number;
  bills: { label: string; overdue: boolean; dueIn: number | null; amount: number };
  bond: number;
}

export const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

export function foodLevel(h: HouseholdState): number {
  return clamp(((h.fridge.basic + h.fridge.fresh) / FOOD_FULL) * 100);
}

export function tidyLevel(h: HouseholdState): number {
  return clamp(100 - h.dishes * 8 - h.laundryPile * 5);
}

/** What is owed next, and whether it is already late. */
export function billsStatus(life: LifeState, day: number): Vitals['bills'] {
  // Paid bills leave the list; what is here is owed, and `overdue` is set by the finance tick with its fee.
  const open = life.bills;
  if (!open.length) return { label: 'Paid up', overdue: false, dueIn: null, amount: 0 };
  const next = [...open].sort((a, b) => a.dueDay - b.dueDay)[0];
  const dueIn = next.dueDay - day;
  const overdue = open.some((b) => b.overdue);
  return { label: overdue ? 'Overdue' : dueIn <= 0 ? 'Due today' : dueIn === 1 ? 'Due tomorrow' : `Due in ${dueIn} days`, overdue, dueIn, amount: open.reduce((n, b) => n + b.amount + (b.overdue ? b.fee : 0), 0) };
}

/** Fitness lives in the flags (saved with everything else). */
export function fitnessOf(flags: Record<string, unknown>): number {
  return typeof flags.fitness === 'number' ? flags.fitness : 20;
}

/** Working out raises it; time lowers it. `gameMin` is how many game minutes passed. */
export function tickFitness(flags: Record<string, unknown>, gameMin: number, workingOut: boolean): number {
  const now = fitnessOf(flags);
  const next = clamp(now + (workingOut ? FITNESS_PER_WORKOUT_MIN * gameMin : 0) - (FITNESS_FADE_PER_HOUR * gameMin) / 60);
  flags.fitness = next;
  return next;
}

/** The household grazes: a serving now and then, whoever is home. Returns true when a serving went. */
export function snackTick(h: HouseholdState, flags: Record<string, unknown>, gameMin: number): boolean {
  const clock = (typeof flags.snackClock === 'number' ? flags.snackClock : 0) + gameMin;
  if (clock < SNACK_EVERY_MIN) { flags.snackClock = clock; return false; }
  flags.snackClock = clock - SNACK_EVERY_MIN;
  if (h.fridge.fresh > 0) h.fridge.fresh--; else if (h.fridge.basic > 0) h.fridge.basic--; else return false;
  return true;
}

/** Groceries go into the fridge. */
export function addFood(h: HouseholdState, servings: number, fresh: boolean): void {
  if (fresh) h.fridge.fresh += servings; else h.fridge.basic += servings;
}

export function vitals(h: HouseholdState, life: LifeState, flags: Record<string, unknown>, day: number, bond: number): Vitals {
  return { food: foodLevel(h), fitness: fitnessOf(flags), tidy: tidyLevel(h), bills: billsStatus(life, day), bond: clamp(bond) };
}
