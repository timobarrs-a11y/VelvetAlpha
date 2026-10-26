// Ghost replays: the ball's path sampled every GHOST_SAMPLE_STEPS physics steps.
// Seeded levels are identical every attempt, so a recorded path can be raced later.

export const GHOST_SAMPLE_STEPS = 2;
const KEY_PREFIX = 'momentum_ghost_';

export interface GhostRun {
  time: number;
  /** flat [x0, y0, x1, y1, ...] rounded to whole pixels */
  path: number[];
  name?: string;
}

export const ghostPositionAt = (ghost: GhostRun, step: number): { x: number; y: number } | null => {
  const i = Math.floor(step / GHOST_SAMPLE_STEPS) * 2;
  if (i + 1 >= ghost.path.length) return null;
  return { x: ghost.path[i], y: ghost.path[i + 1] };
};

export const loadLocalGhost = (key: string): GhostRun | null => {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    return raw ? (JSON.parse(raw) as GhostRun) : null;
  } catch {
    return null;
  }
};

/** Saves the run if it beats the stored best. Returns true when it is a new best. */
export const saveLocalGhostIfBest = (key: string, run: GhostRun): boolean => {
  const best = loadLocalGhost(key);
  if (best && best.time <= run.time) return false;
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(run));
  } catch {
    // storage unavailable or full
  }
  return true;
};
