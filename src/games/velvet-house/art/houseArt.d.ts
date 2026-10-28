import type { ObjectInstance } from '../state/objects';
import type { WallLamp } from '../state/wallLamps';
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
  /** The furniture spot they're using ('objectId:spot'), so the object can react. */
  slot?: string | null;
  /** How they feel, from their needs: happy, playful, neutral, tired, annoyed, sad. */
  expr?: string;
  /** A spot they're looking at (world x, y), e.g. the person they're talking to. */
  lookAt?: [number, number] | null;
  /** A visitor (not one of the two who live here): shown with a name tag. */
  npc?: boolean;
  name?: string;
  /** What they carry in their arms: 'pbox', 'groceries', 'parcel', 'paint'. */
  carrying?: string;
  /** On a flight of stairs: how far along it (0 at the bottom end of the flight going up), and where the flight runs. */
  stair?: { s: number; up: boolean; bx: number; by: number; tx: number; ty: number; low: number; high: number };
  /** A line said in passing; `at` is the animation time it was said. */
  bubble?: { text: string; at: number };
  look: { skin: string; hair: string; top: string; topStyle?: string; bottom: string; longHair: boolean; accent?: string; topGarment?: import('../state/garment').Garment; bottomGarment?: import('../state/garment').Garment; heads?: import('../state/headSprites').HeadImages; body?: import('../state/bodySprites').BodyImages };
}

/** A cat or a dog, as the art draws it. */
export interface PetFrame {
  id: string;
  kind: 'cat' | 'dog';
  coat: { c: string; d: string };
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  face: [number, number];
  pose: string;
  seed: number;
  alpha: number;
  hidden: boolean;
  /** Seconds of hearts still floating over them. */
  hearts: number;
  /** What they are begging for, shown in a thought bubble. */
  want: 'feed' | 'play' | 'love' | null;
  /** Sitting by the door wanting out. */
  door: boolean;
  bowl: string | null;
  litter: string | null;
  bowlFood: number;
  litterUses: number;
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
  pets?: PetFrame[];
  /** The household's state, so the art always draws the real power, dishes, laundry, fridge and purchases. */
  house?: { power: boolean; dishes: number; laundryPile: number; fridge: { basic: number; fresh: number }; parcel?: { kind: string } | null; owned?: Set<string> };
  /** Arrange mode: what can move, what's carried, whether it fits, what's under the pointer. */
  arrange?: { movable: string[]; held: string | null; selected: string | null; valid: boolean; hover: string | null } | null;
  /** The wall lamps (they can be moved), and which is selected or held while arranging. */
  wallLamps?: WallLamp[];
  lampUi?: { id: string | null; held: boolean; valid: boolean } | null;
  /** A conversation: the point (in view coordinates) and reach that stay sharp while the rest of the frame softens. */
  focus?: { x: number; y: number; r: number } | null;
}

export interface HouseArt {
  render(frame: HouseFrame): void;
  /** The wall lamp under a screen point, by id, or null. */
  hitWallLamp(level: number, sx: number, sy: number): string | null;
  /** Where a screen point lands on the visible walls: which wall, how far along it and how high; null off the walls. */
  wallPointAt(level: number, sx: number, sy: number): { p: 'B' | 'L'; u: number; z: number } | null;
  /** Furniture was just set down: it lands with a bounce and a puff of dust. */
  objectPlaced(id: string): void;
  /** Pulsing outlines on the pieces a script wants tapped (by object id). */
  spotlight(ids: string[]): void;
  /** A ghost of where a piece should go: its type, spot, turn and whose colour. Null clears it. */
  setGhost(g: { type: string; level: number; x: number; y: number; rot?: number; color?: 'partner' | 'player' } | null): void;
  /** A few sparkles near a spot on a floor (a room just finished, say). */
  burst(level: number, x: number, y: number, z?: number): void;
  /** A piece springs out of its box. */
  reveal(id: string): void;
  /** A piece is dropped off from above (a delivery). */
  drop(id: string): void;
  /** A cartoon cloud over a spot: a moving box is opened. */
  poof(level: number, x: number, y: number): void;
  /** Pull the room toward evening (0 to 0.42) without moving the clock; 0 puts it back. */
  setDim(amount: number): void;
  /** Where a world point lands in view coordinates (follows the current rotation). */
  project(x: number, y: number, z?: number): [number, number];
  /** The world point (x, y on the floor) under a view coordinate; the opposite of project, following the rotation. */
  unproject(sx: number, sy: number): [number, number];
  /** The piece of furniture at a view point on a floor, front-most, optionally only among `ids`. */
  hitObject(level: number, sx: number, sy: number, ids?: string[]): ObjectInstance | null;
  /** Restores paint, wallpaper, floors, wall decor, yard and household details from an original save. */
  applySave(save: unknown): void;
  /** Sets the paint color for a floor level. */
  applyPaint(level: number, color: string): void;
  /** Sets the wallpaper pattern for a floor level. */
  applyWallpaper(level: number, pattern: string): void;
  /** Makes pictures (photos by url, or gradients by colour stops) available as wallpaper ids. */
  registerPictures(list: Array<{ id: string; base: string; url?: string; stops?: Array<[number, string]> }>): void;
  /** The paint, wallpaper and floor of each level, for saving. */
  exportLooks(): { LOOKS: Array<{ paint: string; paper: string | null; floor: string }>; ROOMLOOK: Array<Record<string, unknown>>; WALLOBJS: unknown[]; yard: { t: number[][]; rainAt: number; rainUntil: number; rainCheck: number } };
  getLooks(): Array<{ paint: string; paper: string | null; floor: string }>;
  /** The drawing recipe for a wallpaper or floor id, for shop thumbnails. */
  lookInfo(kind: 'paper' | 'floor', key: string): { pat?: string; kind?: string; base?: string; ink?: string; ink2?: string; a?: string; b?: string; line?: string; url?: string; stops?: Array<[number, string]> } | null;
  /** Sets the floor type for a floor level. */
  applyFloor(level: number, floor: string): void;
  toggleObjectLight(id: string): boolean;
  /** Whether a lamp or other lit object is switched on. */
  objectLightOn(id: string): boolean;
  setObjectLight(id: string, on: boolean): void;
  toggleLightAt(level: number, sx: number, sy: number): boolean | null;
  /** The id of the piece whose light `toggleLightAt` just switched (null for a wall light). */
  lastToggledLight(): string | null;
  // Tap an object to bring it to life (or flip its switch); what happened, or null.
  poke(o: { id: string; type: string }, part?: string): string | null;
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
