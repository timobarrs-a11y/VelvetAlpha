/**
 * Time system — pure functions for the in-game clock, calendar, and seasons.
 * Extracted from the game file's time section. No canvas or DOM dependencies.
 */

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** Day 1 is a Saturday (move-in day). */
export function weekday(day: number = 1): number {
  return (5 + day - 1) % 7;
}

export function hour(minutes: number): number {
  return minutes / 60;
}

export function absMin(day: number, minutes: number): number {
  return day * 1440 + minutes;
}

export function inWindow(h: number, a: number, b: number): boolean {
  return a < b ? h >= a && h < b : h >= a || h < b;
}

export function clockText(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function hText(hourFloat: number): string {
  return clockText(Math.round(hourFloat * 60)).replace(':00', '');
}

export function whenText(abs: number): string {
  const d = Math.floor(abs / 1440);
  const m = abs % 1440;
  return `${DAYS[weekday(d)]} ${hText(m / 60)}`;
}

export function seasonIdx(day: number = 1): number {
  return Math.floor((day - 1) / 7) % 4;
}

export function season(day: number = 1): string {
  return SEASONS[seasonIdx(day)];
}

export function seasonDay(day: number = 1): number {
  return ((day - 1) % 7) + 1;
}

/**
 * Returns darkness level 0..0.42 based on time of day and season.
 * Season offsets shift dusk/dawn slightly.
 */
export function darkness(hourFloat: number, day: number = 1): number {
  const si = seasonIdx(day);
  const eve = [0, 1, -1, -2.5][si];
  const morn = [0, -0.5, 0.4, 0.8][si];
  const night0 = 21 + eve;
  const dusk0 = 18 + eve;
  const dawn0 = 5.5 + morn;
  const light0 = 7.5 + morn;

  if (hourFloat >= night0 || hourFloat < dawn0) return 0.42;
  if (hourFloat >= dusk0) return ((hourFloat - dusk0) / (night0 - dusk0)) * 0.42;
  if (hourFloat < light0) return ((light0 - hourFloat) / (light0 - dawn0)) * 0.42;
  return 0;
}

export function skyColor(hourFloat: number, isRaining: boolean, darknessVal: number, day: number = 1): string {
  const si = seasonIdx(day);
  if (isRaining && darknessVal < 0.3) return si === 3 ? '#D2D8E0' : '#9AA6B5';
  if (darknessVal > 0.3) return '#2A2F55';
  if (hourFloat >= 17.5 && hourFloat < 21) return '#F0B98E';
  if (hourFloat < 7.5) return '#E9C7B5';
  return '#BFE2F0';
}

export { LEVEL_NAMES } from './house';
