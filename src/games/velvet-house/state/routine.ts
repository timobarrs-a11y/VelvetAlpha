/**
 * Jordan's day, run on his own unless the player changes it: up at 6:00,
 * ready by 8:00, at work until 5:00, a free evening, bed at midnight.
 * Weekends have no work. These are pure rules; main.ts carries them out.
 */
import { weekday, inWindow } from './time';
import type { LifeState, Routine } from './life';

export interface Job {
  id: string;
  title: string;
  place: string;
  /** Dollars an hour. */
  wage: number;
  start: number;
  end: number;
  /** Hours paid a day (an unpaid lunch). */
  paidHours: number;
}

/** The free job: steady pay, no promotions. The five paid jobs are in jobs.md. */
export const CORNER_MARKET: Job = {
  id: 'corner_market', title: 'Stock clerk', place: 'Corner Market', wage: 20, start: 8, end: 17, paidHours: 8,
};

export function isWorkday(day: number): boolean {
  return weekday(day) < 5;
}

export function wakeHour(r: Routine, day: number): number {
  return isWorkday(day) ? r.wake : r.weekendWake;
}

/** Starts a new day's record at midnight. */
export function rollDay(life: LifeState, day: number): void {
  if (life.today.day !== day) life.today = { day, woke: false, left: false, returned: false, calledIn: false };
}

export type RoutineStep = 'wake' | 'leave' | 'return' | null;

/**
 * What the routine says should happen now, if anything. `asleep` and `away`
 * are Jordan's state; each step happens once a day.
 */
export function routineStep(life: LifeState, day: number, hourF: number, s: { asleep: boolean; away: boolean }, job: Job = CORNER_MARKET): RoutineStep {
  const t = life.today;
  const work = isWorkday(day) && !t.calledIn;
  if (s.away) return hourF >= job.end && !t.returned ? 'return' : null;
  if (work && !t.left && hourF >= job.start && hourF < job.end) return 'leave';
  if (!t.woke && s.asleep && hourF >= wakeHour(life.routine, day) && hourF < 12) return 'wake';
  return null;
}

/** The morning routine before work, in order. */
export function morningActs(r: Routine, hasFood: boolean): string[] {
  return ['mirror', ...(r.shower ? ['shower'] : []), ...(hasFood ? ['cook', 'eat'] : [])];
}

/** The hour his own sleep starts: bedtime, as an hour of the day (24 is midnight, so 0). */
export function nightStart(r: Routine): number {
  return r.bed >= 24 ? r.bed - 24 : r.bed;
}

/** Is it his night (bed until wake-up)? */
export function isNight(r: Routine, day: number, hourF: number): boolean {
  return inWindow(hourF, nightStart(r), wakeHour(r, day));
}

/** Pay for a day's work. */
export function dayPay(job: Job = CORNER_MARKET): number {
  return job.wage * job.paidHours;
}

/** Ranges the Routine page allows. */
export const ROUTINE_LIMITS = {
  wake: [5, 7.5],
  weekendWake: [6, 10],
  bed: [21, 26],
} as const;

export function clampRoutine(r: Routine): Routine {
  const c = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v * 2) / 2));
  return { ...r, wake: c(r.wake, ROUTINE_LIMITS.wake), weekendWake: c(r.weekendWake, ROUTINE_LIMITS.weekendWake), bed: c(r.bed, ROUTINE_LIMITS.bed) };
}

/** "6:00", "7:30", "12:00 AM" for the Routine page. */
export function hourLabel(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}
