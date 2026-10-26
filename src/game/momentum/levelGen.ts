// Level generation for Momentum. Seeded so daily climbs, career levels and ghost replays
// are identical for every player and every attempt.

/** Landscape world width; portrait play uses a narrower world. */
export const LANDSCAPE_WIDTH = 800;
export const PORTRAIT_WIDTH = 480;

export type PlatformType = 'normal' | 'crumbling' | 'spring' | 'conveyor' | 'phase';

export interface Platform {
  id: number;
  y: number;
  width: number;
  startX: number;
  x: number;
  moveRange: number;
  speed: number;
  direction: number;
  color: string;
  glow: string;
  isFar: boolean;
  isCheckpoint: boolean;
  touched: boolean;
  minX: number;
  maxX: number;
  type: PlatformType;
  crumbleTimer: number;
  crumbled: boolean;
  springBounce: number;
  /** conveyor: push direction; phase: cycle offset in frames */
  param: number;
}

export interface Orb {
  x: number;
  y: number;
  collected: boolean;
}

export interface LevelPalette {
  platforms: string[];
  glows: string[];
  checkpoint: string;
  checkpointGlow: string;
}

export type Rng = () => number;

/** mulberry32: small, fast, deterministic. */
export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seedFromString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const PHASE_CYCLE_FRAMES = 180; // 3s
export const PHASE_SOLID_FRAMES = 120; // solid for 2s of every 3s

export const isPhaseSolid = (platform: Platform, frame: number): boolean =>
  platform.type !== 'phase' || (frame + platform.param) % PHASE_CYCLE_FRAMES < PHASE_SOLID_FRAMES;

const pickType = (rng: Rng, level: number, index: number): PlatformType => {
  if (index <= 5) return 'normal';
  const roll = rng();
  if (roll < 0.12 + level * 0.01) return 'crumbling';
  if (roll < 0.20 + level * 0.015) return 'spring';
  if (level >= 2 && roll < 0.27 + level * 0.015) return 'conveyor';
  if (level >= 3 && roll < 0.33 + level * 0.015) return 'phase';
  return 'normal';
};

interface ChunkState {
  width: number;
  y: number;
  nextId: number;
  index: number;
}

/**
 * Appends `count` main-path platforms (plus optional fast "far" platforms and boost orbs)
 * above state.y. Used for fixed-length levels and for endless mode.
 */
export const generateChunk = (
  state: ChunkState,
  count: number,
  level: number,
  palette: LevelPalette,
  rng: Rng,
  checkpointEvery = 20,
): { platforms: Platform[]; orbs: Orb[] } => {
  const platforms: Platform[] = [];
  const orbs: Orb[] = [];

  for (let n = 0; n < count; n++) {
    const i = state.index++;
    const isFirst = i === 0;
    const isCheckpoint = i > 0 && i % checkpointEvery === 0;

    const gap = isFirst ? 0 : isCheckpoint ? 65 : 60 + rng() * 40;
    state.y -= gap;

    const width = Math.max(60, isFirst ? 150 : isCheckpoint ? 180 : 90 + rng() * Math.max(0, 40 - level));
    const W = state.width;
    const startX = isFirst ? (W - 150) / 2 : isCheckpoint ? W / 2 - 90 : 50 + rng() * Math.max(0, W - 200 - width);
    const moveRange = isFirst ? 100 : isCheckpoint ? 60 : 100 + rng() * 100;
    const speed = isFirst ? 0.3 : isCheckpoint ? 0.35 : 0.4 + rng() * (0.3 + level * 0.05);
    const colorIndex = state.nextId % palette.platforms.length;
    const type = isFirst || isCheckpoint ? 'normal' : pickType(rng, level, i);
    const direction = rng() > 0.5 ? 1 : -1;

    platforms.push({
      id: state.nextId++,
      y: state.y,
      width,
      startX,
      x: startX,
      moveRange,
      speed: Math.min(speed, 1.5),
      direction,
      color: isCheckpoint ? palette.checkpoint : palette.platforms[colorIndex],
      glow: isCheckpoint ? palette.checkpointGlow : palette.glows[colorIndex],
      isFar: false,
      isCheckpoint,
      touched: false,
      minX: Math.max(0, startX - moveRange / 2),
      maxX: Math.min(W - width, startX + moveRange / 2),
      type,
      crumbleTimer: 0,
      crumbled: false,
      springBounce: 0,
      param: type === 'conveyor' ? (rng() > 0.5 ? 1 : -1) : type === 'phase' ? Math.floor(rng() * PHASE_CYCLE_FRAMES) : 0,
    });

    if (!isFirst && !isCheckpoint && i > 3 && rng() < 0.4) {
      const farY = state.y - (80 + rng() * (70 + level * 5));
      const farWidth = 60 + rng() * 40;
      const farStartX = 40 + rng() * (W - 120 - farWidth);
      const farRange = 140 + rng() * 160;
      const farSpeed = (0.8 + level * 0.15) + rng() * (0.8 + level * 0.2);
      const farColor = state.nextId % palette.platforms.length;

      platforms.push({
        id: state.nextId++,
        y: farY,
        width: farWidth,
        startX: farStartX,
        x: farStartX,
        moveRange: farRange,
        speed: Math.min(farSpeed, 2.8),
        direction: rng() > 0.5 ? 1 : -1,
        color: palette.platforms[farColor],
        glow: palette.glows[farColor],
        isFar: true,
        isCheckpoint: false,
        touched: false,
        minX: Math.max(0, farStartX - farRange / 2),
        maxX: Math.min(W - farWidth, farStartX + farRange / 2),
        type: 'normal',
        crumbleTimer: 0,
        crumbled: false,
        springBounce: 0,
        param: 0,
      });

      // Risky reward: an orb out at the edge of the fast platform's sweep
      if (rng() < 0.35) {
        orbs.push({ x: rng() < 0.5 ? 30 + rng() * 60 : W - 90 + rng() * 60, y: farY - 40 - rng() * 40, collected: false });
      }
    }
  }

  return { platforms, orbs };
};

export const generateLevel = (level: number, palette: LevelPalette, rng: Rng, width = LANDSCAPE_WIDTH) => {
  const state: ChunkState = { width, y: 520, nextId: 0, index: 0 };
  const { platforms, orbs } = generateChunk(state, 60 + level * 10, level, palette, rng);
  platforms.sort((a, b) => b.y - a.y);
  return { platforms, orbs, goalY: state.y - 50 };
};

export const createEndlessState = (width = LANDSCAPE_WIDTH): ChunkState => ({ width, y: 520, nextId: 0, index: 0 });

/** Endless difficulty ramps with height climbed. */
export const endlessDifficulty = (heightClimbed: number) => Math.min(10, 1 + Math.floor(heightClimbed / 2500));

/** Lava rises faster the longer you survive (px per 60Hz step). */
export const lavaSpeed = (seconds: number) => Math.min(3.2, 0.6 + seconds * 0.025);
