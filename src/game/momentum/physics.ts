// Pure tuning + physics helpers for Momentum. All values are per fixed 60Hz step.

export const PLAYER_WIDTH = 22;
export const PLAYER_HEIGHT = 22;
export const PLATFORM_HEIGHT = 14;

export const STEP_MS = 1000 / 60;
export const MAX_FRAME_MS = 100; // clamp long frames (tab switch) to avoid spiral of death

export const BASE_BOUNCE = 13;
export const LEVEL_BOUNCE_BONUS = 0.3;
export const SPRING_MULTIPLIER = 1.6;

// Momentum chain: consecutive climbing landings add upward velocity.
export const CHAIN_STEP = 0.9;
export const MAX_CHAIN = 6;
export const CHAIN_WINDOW_FRAMES = 90; // must land again within 1.5s to keep the chain

// Boost
/** Boosts are banked from boost ledges and orbs, and stack up to this many. */
export const MAX_BOOST_CHARGES = 9;
export const START_BOOST_CHARGES = 2;
export const BOOST_FLOOR_VY = -15; // a boost always gets you rising at least this fast
export const BOOST_KICK_VY = 3; // extra kick when already rising faster than the floor
export const MAX_RISE_VY = -24;
export const BOOST_BUFFER_FRAMES = 9; // ~150ms: early presses are remembered
export const BOOST_COOLDOWN_FRAMES = 8; // ~130ms: short enough to chain boosts back to back
export const PERFECT_WINDOW_FRAMES = 5; // ~80ms after landing
export const PERFECT_MULTIPLIER = 1.35;
export const BOOST_HORIZONTAL = 2.5;

export const bounceVelocity = (level: number, chain: number, isSpring: boolean): number => {
  const clampedChain = Math.max(0, Math.min(MAX_CHAIN, chain));
  const base = -(BASE_BOUNCE + level * LEVEL_BOUNCE_BONUS + clampedChain * CHAIN_STEP);
  const vy = isSpring ? base * SPRING_MULTIPLIER : base;
  return Math.max(MAX_RISE_VY * (isSpring ? 1.25 : 1), vy);
};

export const perfectBounceVelocity = (level: number, chain: number, isSpring: boolean): number =>
  Math.max(MAX_RISE_VY * 1.25, bounceVelocity(level, chain, isSpring) * PERFECT_MULTIPLIER);

// Sets (rather than adds) upward speed so every boost feels the same regardless of fall speed.
export const boostVelocity = (vy: number): number =>
  Math.max(MAX_RISE_VY, Math.min(vy - BOOST_KICK_VY, BOOST_FLOOR_VY));

/**
 * Next chain value after a landing. Climbing to a higher platform quickly grows the chain,
 * bouncing at the same height holds it, falling to a lower platform or stalling resets it.
 */
export const nextChain = (
  chain: number,
  landingY: number,
  prevLandingY: number | null,
  framesSinceLanding: number,
): number => {
  if (prevLandingY === null || framesSinceLanding > CHAIN_WINDOW_FRAMES) return 0;
  if (landingY < prevLandingY - 5) return Math.min(MAX_CHAIN, chain + 1);
  if (landingY > prevLandingY + 5) return 0;
  return chain;
};

// Combo: grows with every new platform while you keep climbing, breaks when you fall or stall.
export const MAX_COMBO_FOR_MULTIPLIER = 20;
export const comboMultiplier = (combo: number): number => 1 + Math.min(combo, MAX_COMBO_FOR_MULTIPLIER) * 0.1;

/** True when a landing loses the climb: lower than the previous landing, or too long since it. */
export const climbBroken = (landingY: number, prevLandingY: number | null, framesSinceLanding: number): boolean =>
  prevLandingY !== null && (landingY > prevLandingY + 5 || framesSinceLanding > CHAIN_WINDOW_FRAMES);

// Overdrive: a perfect bounce at max momentum. Free boosts, double score and a landing assist.
export const OVERDRIVE_FRAMES = 300; // 5s
export const OVERDRIVE_EXTEND_FRAMES = 60; // each perfect during Overdrive adds 1s
export const OVERDRIVE_MAX_FRAMES = 600;
export const OVERDRIVE_SCORE_MULTIPLIER = 2;
const MAGNET_RANGE_X = 140;
const MAGNET_STRENGTH = 0.06;

/** While falling in Overdrive, gently pull the ball toward the platform it is heading for. */
export const magnetVx = (vx: number, ballCenterX: number, targetCenterX: number): number => {
  const dx = targetCenterX - ballCenterX;
  if (Math.abs(dx) > MAGNET_RANGE_X) return vx;
  return vx + dx * MAGNET_STRENGTH * (1 - Math.abs(dx) / MAGNET_RANGE_X);
};

// Time attack: Free Play starts with time to reach the first checkpoint, and each checkpoint
// adds time for the next stretch. The required climb rate rises gently with difficulty.
export const timeBudget = (height: number, difficulty: number): number =>
  Math.round(height / (130 + difficulty * 6) + 3);
