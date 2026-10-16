import type { ObjectInstance } from '../state/objects';
import type { GpuLights } from '../engine/gpuLights';

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
  look: { skin: string; hair: string; top: string; bottom: string; longHair: boolean };
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
  /** Restores paint, wallpaper, floors, wall decor, yard and household details from an original save. */
  applySave(save: unknown): void;
  /** Sets the paint color for a floor level. */
  applyPaint(level: number, color: string): void;
  /** Sets the wallpaper pattern for a floor level. */
  applyWallpaper(level: number, pattern: string): void;
  /** Sets the floor type for a floor level. */
  applyFloor(level: number, floor: string): void;
  toggleObjectLight(id: string): boolean;
  TYPES: Record<string, unknown>;
  WTYPES: Record<string, unknown>;
}

export interface HouseArtOptions {
  /** Returns the GPU light layer to use this frame, or null to draw lights on the 2D canvas. */
  gpuLights?: () => GpuLights | null;
}

export function createHouseArt(ctx: CanvasRenderingContext2D, opts?: HouseArtOptions): HouseArt;
