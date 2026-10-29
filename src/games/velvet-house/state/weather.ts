/**
 * The weather: rain on some days, more in some seasons, and snow instead of rain in winter. The state lives in the flags,
 * so it saves with the house. Rain waters the garden (see crops.ts) and the art draws it from the same state.
 */
import type { RNG } from './rng';

/** The chance that a day has rain, by season (spring, summer, autumn, winter). */
export const SEASON_RAIN_CHANCE = [0.3, 0.15, 0.22, 0.32];
export const RAIN_MIN_MIN = 120;
export const RAIN_MAX_MIN = 360;

export interface WeatherState {
  /** The game day rolled for last, so each day is rolled once. */
  day: number;
  /** Game minute (since day 0) that rain starts and stops, or the same number for no rain. */
  rainAt: number;
  rainUntil: number;
  /** Whether it was raining at the last tick, so starts and stops are said once. */
  on: boolean;
  /** Whether the rain falls as snow (winter, or forced on by the demo's weather button). */
  snow?: boolean;
}

/** The demo's weather button: `auto` follows the seasons; the others force the weather until changed. */
export type WeatherOverride = 'auto' | 'rain' | 'snow' | 'clear';
export const WEATHER_OVERRIDES: WeatherOverride[] = ['auto', 'rain', 'snow', 'clear'];

export const NO_WEATHER: WeatherState = { day: -1, rainAt: 0, rainUntil: 0, on: false };

export function seasonOf(day: number): number {
  return Math.floor((day - 1) / 7) % 4;
}

export function weatherOf(flags: Record<string, unknown>): WeatherState {
  return { ...NO_WEATHER, ...((flags.weather ?? {}) as Partial<WeatherState>) };
}

export function isRaining(w: WeatherState, absMin: number): boolean {
  return absMin >= w.rainAt && absMin < w.rainUntil;
}

/**
 * Moves the weather on. Rolls once a day for rain; says when rain or snow starts and when it stops. Returns whether it
 * is raining now.
 */
export function weatherTick(flags: Record<string, unknown>, day: number, minutes: number, rng: RNG, log: (msg: string) => void): boolean {
  const w = weatherOf(flags);
  const absMin = day * 1440 + minutes;
  if (w.day !== day) {
    w.day = day;
    if (rng.next() < SEASON_RAIN_CHANCE[seasonOf(day)]) {
      w.rainAt = absMin + rng.next() * 600;
      w.rainUntil = w.rainAt + RAIN_MIN_MIN + rng.next() * (RAIN_MAX_MIN - RAIN_MIN_MIN);
    } else {
      w.rainAt = 0; w.rainUntil = 0;
    }
  }
  const override = (flags.weatherOverride ?? 'auto') as WeatherOverride;
  if (override === 'clear') { w.rainAt = 0; w.rainUntil = 0; }
  else if (override === 'rain' || override === 'snow') { w.rainAt = absMin - 1; w.rainUntil = absMin + 1e9; }
  const snowing = override === 'snow' || (override === 'auto' && seasonOf(day) === 3);
  w.snow = snowing;
  const now = isRaining(w, absMin);
  if (now && !w.on) log(snowing ? 'It starts to snow.' : 'It starts to rain.');
  if (!now && w.on) log(snowing ? 'The snow stops.' : 'The rain stops.');
  w.on = now;
  flags.weather = w;
  return now;
}
