// Touch control helpers for Momentum: screen zones, relative steering and saved preferences.

export type TouchZone = 'steer' | 'boost';
export type SteerSensitivity = 'low' | 'medium' | 'high';

export interface TouchSettings {
  leftHanded: boolean;
  sensitivity: SteerSensitivity;
}

export const BOOST_ZONE_FRACTION = 0.35;
export const SENSITIVITY_MULTIPLIER: Record<SteerSensitivity, number> = { low: 1.2, medium: 1.8, high: 2.6 };
const STEER_GAIN = 0.35; // canvas px of offset -> px/step of desired velocity
const STEER_SMOOTHING = 0.45; // fraction of the gap to the desired velocity closed each step
const STEER_DEADZONE = 3;

const SETTINGS_KEY = 'momentum_touch_settings';
const TUTORIAL_KEY = 'momentum_touch_tutorial_seen';
export const DEFAULT_TOUCH_SETTINGS: TouchSettings = { leftHanded: false, sensitivity: 'medium' };

/** Right-handed: left 65% of the screen steers, right 35% boosts. Mirrored for left-handed. */
export const zoneForX = (fractionX: number, leftHanded: boolean): TouchZone => {
  const f = leftHanded ? 1 - fractionX : fractionX;
  return f >= 1 - BOOST_ZONE_FRACTION ? 'boost' : 'steer';
};

/** Relative steering: the ball follows the thumb's drag from where the touch started. */
export const steerTarget = (startBallCenter: number, dragCanvasPx: number, sensitivity: SteerSensitivity): number =>
  startBallCenter + dragCanvasPx * SENSITIVITY_MULTIPLIER[sensitivity];

/** Eases horizontal velocity toward the steering target instead of snapping. */
export const steerVelocity = (currentVx: number, targetX: number, ballCenter: number, maxSpeed: number): number => {
  const delta = targetX - ballCenter;
  const desired = Math.abs(delta) < STEER_DEADZONE ? 0 : Math.max(-maxSpeed, Math.min(maxSpeed, delta * STEER_GAIN));
  return currentVx + (desired - currentVx) * STEER_SMOOTHING;
};

export const haptic = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // unsupported
  }
};

export const isCoarsePointer = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

export const loadTouchSettings = (): TouchSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_TOUCH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // storage unavailable
  }
  return DEFAULT_TOUCH_SETTINGS;
};

export const saveTouchSettings = (settings: TouchSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable
  }
};

export const hasSeenTutorial = (): boolean => {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return true;
  }
};

export const markTutorialSeen = () => {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // storage unavailable
  }
};
