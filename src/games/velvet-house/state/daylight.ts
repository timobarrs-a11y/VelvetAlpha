/**
 * Day and night, in one place. The art draws the dark from it, the weather dims the day with its cloud, and the garden grows and dries by it,
 * so a crop that is growing at noon is slow at midnight, rain cuts the light and waters instead, and a long summer evening is longer.
 *
 * `hour` is 0..24 game hours, `season` 0..3 (spring, summer, autumn, winter), as everywhere else in the game.
 */

/** How dark the deepest night is (0 none, 1 black). The art's night lighting is built on this. */
export const NIGHT_DARK = 0.42;

/** Sunrise, full light, dusk and night start, by season: long summer evenings, short winter days. */
function edges(season: number): { dawn: number; light: number; dusk: number; night: number } {
  const eve = [0, 1, -1, -2.5][season] ?? 0, morn = [0, -0.5, 0.4, 0.8][season] ?? 0;
  return { dawn: 5.5 + morn, light: 7.5 + morn, dusk: 18 + eve, night: 21 + eve };
}

/** How dark it is from the sun alone: 0 in daylight, up to NIGHT_DARK at night, easing through dawn and dusk. */
export function darknessAt(hour: number, season: number): number {
  const { dawn, light, dusk, night } = edges(season);
  if (hour >= night || hour < dawn) return NIGHT_DARK;
  if (hour >= dusk) return ((hour - dusk) / (night - dusk)) * NIGHT_DARK;
  if (hour < light) return ((light - hour) / (light - dawn)) * NIGHT_DARK;
  return 0;
}

/** The sun's strength alone: 1 in full daylight, 0 at night. */
export const sunAt = (hour: number, season: number): number => 1 - darknessAt(hour, season) / NIGHT_DARK;

/** How much of the sun gets through the sky: rain clouds take more than half, snow clouds a little less. */
export function skyFactor(raining: boolean, snowing: boolean): number {
  return !raining ? 1 : snowing ? 0.55 : 0.4;
}

/** The light that reaches the ground, 0..1: the sun, cut by cloud. */
export const lightAt = (hour: number, season: number, raining = false, snowing = false): number => sunAt(hour, season) * skyFactor(raining, snowing);

/** How fast a plant grows at this light, as a multiple of its midday rate: a little in the dark, full in a clear noon. */
export const growthAt = (light: number): number => 0.2 + 0.8 * light;

/** How fast soil dries at this sun (evaporation), as a multiple of its midday rate: half at night, full at noon. */
export const dryingAt = (sun: number): number => 0.5 + 0.5 * sun;

/** The average growth multiplier over a whole clear day in a season, so a time-to-ripe estimate is honest about the nights. */
export function dayAverageGrowth(season: number): number {
  let sum = 0;
  for (let m = 0; m < 1440; m += 20) sum += growthAt(sunAt(m / 60, season));
  return sum / 72;
}
