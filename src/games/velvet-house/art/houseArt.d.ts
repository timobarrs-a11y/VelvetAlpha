import type { ObjectInstance } from '../state/objects';
import type { GpuLights } from '../engine/gpuLights';
import type { GBuffer } from '../engine/gbuffer';
import type { DeferredLights } from '../engine/deferredLights';
import type { QualityTier } from '../engine/qualityTier';

export type WallMode = 'cut' | 'up' | 'down';

export interface PersonFrame {
  level: number;
  x: number;
  y: number;
  z: number;
  face: [number, number];
  pose: string;
  walking: boolean;
  sit: boolean;
  hidden: boolean;
  seed: number;
  /** The activity in progress (e.g. 'piano'), for clips beyond the shared pose. */
  act?: string | null;
  /** Game minutes into that activity, so clips can move through steps. */
  actMin?: number;
  /** How they feel, from their needs: happy, playful, neutral, tired, annoyed, sad. */
  expr?: string;
  /** A spot they're looking at (world x, y), e.g. the person they're talking to. */
  lookAt?: [number, number] | null;
  look: { skin: string; hair: string; top: string; topStyle?: string; bottom: string; longHair: boolean };
}

export interface HouseFrame {
  level: number;
  rot: number;
  minutes: number;
  day: number;
  t: number;
  dt: number;
  objs: ObjectInstance[];
  wallMode: WallMode;
  chars?: PersonFrame[];
}

export interface HouseArt {
  render(frame: HouseFrame): void;
  /** Furniture was just set down: it lands with a bounce and a puff of dust. */
  objectPlaced(id: string): void;
  /** Restores paint, wallpaper, floors, wall decor, yard and household details from an original save. */
  applySave(save: unknown): void;
  /** Sets the paint color for a floor level. */
  applyPaint(level: number, color: string): void;
  /** Sets the wallpaper pattern for a floor level. */
  applyWallpaper(level: number, pattern: string): void;
  /** Sets the floor type for a floor level. */
  applyFloor(level: number, floor: string): void;
  toggleObjectLight(id: string): boolean;
  toggleLightAt(level: number, sx: number, sy: number): boolean | null;
  /** Sets whether the partner's mouth animates (talking). */
  setTalking(v: boolean): void;
  /** Sets the partner's mood, 0-1, for facial expression. */
  setMood(v: number): void;
  TYPES: Record<string, unknown>;
  WTYPES: Record<string, unknown>;
}

export interface HouseArtOptions {
  /** Returns the GPU light layer to use this frame, or null to draw lights on the 2D canvas. */
  gpuLights?: () => GpuLights | null;
  /** Data canvas that records height, facing and material while the art draws. */
  gbuffer?: () => GBuffer | null;
  /** Full GPU lighting (sun, lamps, shadows, shafts); used on the basement when available. */
  deferredLights?: () => DeferredLights | null;
  quality?: () => QualityTier;
}

export function createHouseArt(ctx: CanvasRenderingContext2D, opts?: HouseArtOptions): HouseArt;
