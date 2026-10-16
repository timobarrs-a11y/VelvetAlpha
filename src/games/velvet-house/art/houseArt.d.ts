import type { ObjectInstance } from '../state/objects';

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
  TYPES: Record<string, unknown>;
  WTYPES: Record<string, unknown>;
}

export function createHouseArt(ctx: CanvasRenderingContext2D): HouseArt;
