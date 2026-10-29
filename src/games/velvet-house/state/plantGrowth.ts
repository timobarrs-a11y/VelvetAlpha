/**
 * How a plant grows through its stages. Progress is tending time in game minutes, so it moves while the player is
 * playing and only then (see fair-urgency.md, rules 6 and 8). A plant that is neglected grows slowly; it never dies.
 */

export interface GrowthStage {
  name: 'seed' | 'small' | 'mid' | 'final';
  /** Progress (0..1) at which this stage starts. */
  from: number;
  /** How big the drawing is at this stage, as a fraction of the full plant. */
  scale: number;
}

export const GROWTH_STAGES: GrowthStage[] = [
  { name: 'seed', from: 0, scale: 0.12 },
  { name: 'small', from: 0.25, scale: 0.35 },
  { name: 'mid', from: 0.6, scale: 0.7 },
  { name: 'final', from: 1, scale: 1 },
];

/** Tending minutes that take a plant from seed to final form. */
export const MINUTES_TO_FULL = 6 * 60;

/** Progress 0..1 from the minutes tended so far. */
export function growthProgress(tendedMin: number): number {
  return Math.max(0, Math.min(1, tendedMin / MINUTES_TO_FULL));
}

/** The stage a plant is in at a given progress. */
export function stageAt(progress: number): GrowthStage {
  let stage = GROWTH_STAGES[0];
  for (const s of GROWTH_STAGES) if (progress >= s.from) stage = s;
  return stage;
}

/** Minutes still to tend before the next stage, or null once it is final. */
export function minutesToNextStage(tendedMin: number): number | null {
  const p = growthProgress(tendedMin);
  const next = GROWTH_STAGES.find((s) => s.from > p);
  return next ? Math.ceil((next.from - p) * MINUTES_TO_FULL) : null;
}
