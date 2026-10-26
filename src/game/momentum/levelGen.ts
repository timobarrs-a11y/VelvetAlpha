// Level generation for Momentum. Seeded so daily climbs, career levels and ghost replays
// are identical for every player and every attempt.

/** Landscape world width; portrait play uses a narrower world. */
export const LANDSCAPE_WIDTH = 800;
export const PORTRAIT_WIDTH = 480;

/** charge: +1 boost the first time you land on it. drain: -1 boost the first time. */
export type PlatformType = 'normal' | 'crumbling' | 'spring' | 'conveyor' | 'phase' | 'charge' | 'drain';

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
  /** Set on the first platform of a designed section so it can be labelled */
  sectionLabel?: string;
  /** An alternative ledge beside the main path: a choice, not a requirement */
  isBranch?: boolean;
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
  if (roll < 0.12) return 'charge';
  if (level >= 2 && roll < 0.17 + level * 0.008) return 'drain';
  if (roll < 0.27 + level * 0.01) return 'crumbling';
  if (roll < 0.35 + level * 0.015) return 'spring';
  if (level >= 2 && roll < 0.42 + level * 0.015) return 'conveyor';
  if (level >= 3 && roll < 0.48 + level * 0.015) return 'phase';
  return 'normal';
};

// Levels are built from short designed sections so pacing comes in waves: a hard
// section is always followed by a rest ledge. 'scatter' is the original free-form layout.
export type SectionKind = 'scatter' | 'zigzag' | 'staircase' | 'springTower' | 'conveyorRun' | 'phaseGauntlet' | 'rest';

const SECTION_LABELS: Partial<Record<SectionKind, string>> = {
  zigzag: 'ZIGZAG',
  staircase: 'STAIRWAY',
  springTower: 'SPRING TOWER',
  conveyorRun: 'CONVEYOR RUN',
  phaseGauntlet: 'PHASE GAUNTLET',
};

const HARD_SECTIONS = new Set<SectionKind>(['springTower', 'conveyorRun', 'phaseGauntlet']);

interface SectionState {
  kind: SectionKind;
  remaining: number;
  /** position within the section */
  k: number;
  /** staircase / zigzag direction */
  dir: number;
}

interface ChunkState {
  width: number;
  y: number;
  nextId: number;
  index: number;
  section?: SectionState;
  prevWasSpring?: boolean;
  /** centre x of the previous main-path platform */
  prevCenterX?: number;
}

const pickSection = (rng: Rng, level: number, previous: SectionKind | undefined): SectionState => {
  const dir = rng() < 0.5 ? -1 : 1;
  if (previous && HARD_SECTIONS.has(previous)) return { kind: 'rest', remaining: 2, k: 0, dir };
  const options: Array<[SectionKind, number]> = [
    ['scatter', 3],
    ['zigzag', 2],
    ['staircase', 2],
    ['springTower', level >= 1 ? 1.2 : 0],
    ['conveyorRun', level >= 2 ? 1.2 : 0],
    ['phaseGauntlet', level >= 3 ? 1.2 : 0],
  ];
  const candidates = options.filter(([kind, w]) => w > 0 && kind !== previous);
  const total = candidates.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  let kind: SectionKind = 'scatter';
  for (const [k, w] of candidates) {
    roll -= w;
    if (roll <= 0) { kind = k; break; }
  }
  const lengths: Record<SectionKind, [number, number]> = {
    scatter: [5, 8], zigzag: [6, 8], staircase: [6, 8], springTower: [4, 6], conveyorRun: [4, 5], phaseGauntlet: [4, 6], rest: [2, 2],
  };
  const [lo, hi] = lengths[kind];
  return { kind, remaining: lo + Math.floor(rng() * (hi - lo + 1)), k: 0, dir };
};

interface PlatformSpec {
  gap: number;
  width: number;
  startX: number;
  moveRange: number;
  speed: number;
  type: PlatformType;
  param: number;
  allowFar: boolean;
  orbAbove?: boolean;
}

const clampX = (x: number, width: number, W: number) => Math.max(20, Math.min(W - width - 20, x));

/** Max centre-to-centre distance between consecutive main-path platforms. */
const MAX_REACH_X = 300;

/** Layout for the next main-path platform within the current section. */
const sectionSpec = (sec: SectionState, state: ChunkState, rng: Rng, level: number, index: number): PlatformSpec => {
  const W = state.width;
  const prevCx = state.prevCenterX ?? W / 2;
  const k = sec.k;
  switch (sec.kind) {
    case 'zigzag': {
      // Alternate sides of the centre, within one bounce's reach
      const width = 90;
      const cx = W / 2 + (k % 2 === 0 ? -1 : 1) * sec.dir * W * 0.3;
      const last = sec.remaining === 1;
      return { gap: 85 + rng() * 15, width, startX: clampX(cx - width / 2, width, W), moveRange: 30, speed: 0.3, type: last ? 'charge' : 'normal', param: 0, allowFar: false };
    }
    case 'staircase': {
      // Short, quick steps marching one way: ideal for building momentum
      const width = 75;
      let cx = prevCx + sec.dir * 60;
      if (cx < width || cx > W - width) { sec.dir *= -1; cx = prevCx + sec.dir * 60; }
      return { gap: 55 + rng() * 10, width, startX: clampX(cx - width / 2, width, W), moveRange: 20, speed: 0.25, type: 'normal', param: 0, allowFar: k % 3 === 2 };
    }
    case 'springTower': {
      // Springs alternate with normal ledges; the gap above a spring is big
      const width = 110;
      const isSpring = k % 2 === 0;
      const cx = 60 + rng() * (W - 120);
      return { gap: state.prevWasSpring ? 140 + rng() * 20 : 80 + rng() * 10, width, startX: clampX(cx - width / 2, width, W), moveRange: 40, speed: 0.3, type: isSpring ? 'spring' : 'normal', param: 0, allowFar: false };
    }
    case 'conveyorRun': {
      // Each conveyor pushes toward the next platform on the other side
      const width = 120;
      const side = k % 2 === 0 ? -1 : 1;
      const cx = W / 2 + side * sec.dir * W * 0.3;
      return { gap: 80 + rng() * 10, width, startX: clampX(cx - width / 2, width, W), moveRange: 20, speed: 0.2, type: 'conveyor', param: -side * sec.dir, allowFar: false };
    }
    case 'phaseGauntlet': {
      // Phase platforms whose cycles are staggered, so the safe route moves upward
      const width = 110;
      const cx = 60 + rng() * (W - 120);
      if (sec.remaining === 1) {
        // Reward for getting through: a boost ledge at the top
        return { gap: 75 + rng() * 10, width, startX: clampX(cx - width / 2, width, W), moveRange: 30, speed: 0.25, type: 'charge', param: 0, allowFar: false };
      }
      return { gap: 75 + rng() * 10, width, startX: clampX(cx - width / 2, width, W), moveRange: 30, speed: 0.25, type: 'phase', param: (PHASE_CYCLE_FRAMES - k * 40 + PHASE_CYCLE_FRAMES * 4) % PHASE_CYCLE_FRAMES, allowFar: false };
    }
    case 'rest': {
      // Wide, calm ledges with a boost orb as a breather
      const width = 140;
      return { gap: 70, width, startX: clampX(60 + rng() * (W - 120) - width / 2, width, W), moveRange: 30, speed: 0.2, type: 'normal', param: 0, allowFar: false, orbAbove: k === 1 };
    }
    default: {
      // Free-form: narrower ledges anywhere across the screen
      const width = Math.max(60, 75 + rng() * Math.max(0, 35 - level * 2));
      const type = pickType(rng, level, index);
      return {
        gap: 60 + rng() * 40,
        width,
        startX: 20 + rng() * Math.max(0, W - 40 - width),
        moveRange: 100 + rng() * 100,
        speed: 0.4 + rng() * (0.3 + level * 0.05),
        type,
        param: type === 'conveyor' ? (rng() > 0.5 ? 1 : -1) : type === 'phase' ? Math.floor(rng() * PHASE_CYCLE_FRAMES) : 0,
        allowFar: true,
      };
    }
  }
};

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

    const W = state.width;
    let spec: PlatformSpec;
    let sectionLabel: string | undefined;
    if (isFirst || isCheckpoint) {
      const width = isFirst ? 150 : 180;
      spec = { gap: isFirst ? 0 : 65, width, startX: isFirst ? (W - 150) / 2 : W / 2 - 90, moveRange: isFirst ? 100 : 60, speed: isFirst ? 0.3 : 0.35, type: 'normal', param: 0, allowFar: false };
    } else {
      // The first few platforms stay free-form so a run always starts gently
      if (i > 5 && (!state.section || state.section.remaining <= 0)) {
        state.section = pickSection(rng, level, state.section?.kind);
        sectionLabel = SECTION_LABELS[state.section.kind];
      }
      const sec = state.section && i > 5 ? state.section : { kind: 'scatter' as SectionKind, remaining: 1, k: 0, dir: 1 };
      spec = sectionSpec(sec, state, rng, level, i);
      sec.k++;
      sec.remaining--;
      // Keep every jump within one bounce of travel, including across section boundaries
      if (state.prevCenterX !== undefined) {
        const cx = spec.startX + spec.width / 2;
        const limited = Math.max(state.prevCenterX - MAX_REACH_X, Math.min(state.prevCenterX + MAX_REACH_X, cx));
        spec.startX = clampX(limited - spec.width / 2, spec.width, W);
      }
    }
    state.y -= spec.gap;
    const { width, startX, moveRange, speed, type } = spec;
    const colorIndex = state.nextId % palette.platforms.length;
    const direction = rng() > 0.5 ? 1 : -1;
    state.prevWasSpring = type === 'spring';
    state.prevCenterX = startX + width / 2;

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
      param: spec.param,
      sectionLabel,
    });

    // A second ledge at about the same height on the other side: read ahead and pick.
    // A drain on the main path always gets a clean alternative.
    const wantsBranch = !isFirst && !isCheckpoint && i > 5 && (type === 'drain' || (spec.allowFar && rng() < 0.3));
    if (wantsBranch) {
      const mainCx = startX + width / 2;
      const branchW = 80;
      const otherSide = mainCx < W / 2 ? W * 0.75 : W * 0.25;
      let branchCx = Math.max(mainCx - MAX_REACH_X, Math.min(mainCx + MAX_REACH_X, otherSide + (rng() - 0.5) * W * 0.2));
      if (type === 'drain' && Math.abs(branchCx - mainCx) <= 140) {
        // Never leave a forced drain: put the clean ledge on whichever side has room
        branchCx = mainCx - 170 >= branchW / 2 + 20 ? mainCx - 170 : mainCx + 170;
      }
      if (Math.abs(branchCx - mainCx) > 140) {
        const roll = rng();
        const branchType: PlatformType = type === 'drain' ? 'normal' : roll < 0.5 ? 'charge' : level >= 2 && roll < 0.75 ? 'drain' : 'normal';
        const bx = clampX(branchCx - branchW / 2, branchW, W);
        const bColor = state.nextId % palette.platforms.length;
        platforms.push({
          id: state.nextId++,
          y: state.y - 10 + rng() * 20,
          width: branchW,
          startX: bx,
          x: bx,
          moveRange: 40,
          speed: 0.3,
          direction: rng() > 0.5 ? 1 : -1,
          color: palette.platforms[bColor],
          glow: palette.glows[bColor],
          isFar: false,
          isCheckpoint: false,
          touched: false,
          minX: Math.max(0, bx - 20),
          maxX: Math.min(W - branchW, bx + 20),
          type: branchType,
          crumbleTimer: 0,
          crumbled: false,
          springBounce: 0,
          param: 0,
          isBranch: true,
        });
      }
    }

    if (spec.orbAbove) {
      orbs.push({ x: startX + width / 2, y: state.y - 55, collected: false });
    }

    if (!isFirst && !isCheckpoint && i > 3 && spec.allowFar && rng() < 0.4) {
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
        type: rng() < 0.5 ? 'charge' : 'normal',
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
