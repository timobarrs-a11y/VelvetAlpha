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
  /** Lowering into a seat or getting up: which way, how far through (0 standing, 1 seated) and the seat's height; the body is moved between the stand spot and the seat. */
  posture?: { dir: 'sit' | 'stand'; k: number; zSeat: number };
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
  /** The weather from the game's state: rain or snow falls while `rainAt <= time < rainUntil` (game minutes). */
  weather?: { on: boolean; rainAt: number; rainUntil: number; snow?: boolean; level?: 'light' | 'medium' | 'heavy' };
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
  arrange?: { movable: string[]; held: string | null; selected: string | null; valid: boolean; hover: string | null; wall?: string | null; wallValid?: boolean } | null;
  /** The wall lamps (they can be moved), and which is selected or held while arranging. */
  wallLamps?: WallLamp[];
  lampUi?: { id: string | null; held: boolean; valid: boolean } | null;
  /** A conversation: the point (in view coordinates) and reach that stay sharp while the rest of the frame softens. */
  focus?: { x: number; y: number; r: number } | null;
  /** The room the shop's paint, wallpaper and floors go on, outlined on its floor. */
  roomHint?: string | null;
}

export interface HouseArt {
  render(frame: HouseFrame): void;
  /** The wall lamp under a screen point, by id, or null. */
  hitWallLamp(level: number, sx: number, sy: number): string | null;
  /** Where a screen point lands on the visible walls: which wall, how far along it and how high; null off the walls. */
  wallPointAt(level: number, sx: number, sy: number): { p: 'B' | 'L'; u: number; z: number } | null;
  /** Furniture was just set down: it lands with a bounce and a puff of dust. */
  objectPlaced(id: string): void;
  /** A fruit tree was shaken: it shudders, and `fell` pieces of ripe fruit drop from it. */
  shakeTree(id: string, fell: number): void;
  /** Whether someone is in the office's meeting room (the sign over its door lights up). */
  setMeeting(on: boolean): void;
  /** Hangs a bought wall piece (a WTYPES key, e.g. 'print') on a back wall of the level; false if the type is unknown. */
  hangWallObj(level: number, type: string, col?: string, id?: string): boolean;
  /** Wall pieces in Arrange: those on a level (`shown` when the view's walls carry them), and every one in the house. */
  wallObjsOn(level: number): Array<{ id: string; type: string; name: string; level: number; p: string; u: number; z: number; col?: string; shown: boolean }>;
  wallObjsAll(): Array<{ id: string; type: string; name: string; level: number; col?: string }>;
  /** The wall piece under a view point on the walls the view shows, if any. */
  hitWallObj(level: number, sx: number, sy: number): string | null;
  /** The kind of wall feature under a view point among `kinds` (the whiteboard, the meeting door), or null. */
  hitFeature(level: number, sx: number, sy: number, kinds: string[]): string | null;
  /** The view point at a wall piece's centre. */
  wallObjView(id: string): [number, number] | null;
  /** Slides a wall piece so its centre follows a view point (less the grab offset), kept on its wall. */
  moveWallObj(id: string, sx: number, sy: number, grab?: [number, number]): boolean;
  /** Whether a wall piece sits clear of the others and of windows and doors. */
  wallObjClear(id: string): boolean;
  /** Takes a wall piece down into storage; returns its name. */
  takeDownWallObj(id: string): string | null;
  storedWallObjs(): Array<{ id: string; type: string; name: string; col?: string }>;
  /** Hangs a stored wall piece on a level's back wall again. */
  rehangWallObj(id: string, level: number): boolean;
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
  /** Paint, wallpaper and floor go on one room of the floor, or on the whole of it (no room), which resets its rooms. */
  applyPaint(level: number, color: string, room?: string | null): void;
  applyWallpaper(level: number, pattern: string, room?: string | null): void;
  /** Makes pictures (photos by url, or gradients by colour stops) available as wallpaper ids. */
  registerPictures(list: Array<{ id: string; base: string; url?: string; stops?: Array<[number, string]> }>): void;
  /** The paint, wallpaper and floor of each level, for saving. */
  exportLooks(): { LOOKS: Array<{ paint: string; paper: string | null; floor: string }>; ROOMLOOK: Array<Record<string, unknown>>; WALLOBJS: unknown[]; yard: { t: number[][]; rainAt: number; rainUntil: number; rainCheck: number } };
  getLooks(): Array<{ paint: string; paper: string | null; floor: string }>;
  /** The drawing recipe for a wallpaper or floor id, for shop thumbnails. */
  lookInfo(kind: 'paper' | 'floor', key: string): { pat?: string; kind?: string; base?: string; ink?: string; ink2?: string; a?: string; b?: string; line?: string; url?: string; stops?: Array<[number, string]> } | null;
  applyFloor(level: number, floor: string, room?: string | null): void;
  /** A room's paint, wallpaper and floor (the floor's own where the room has none of its own); no room: the floor's. */
  roomLook(level: number, room?: string | null): { paint: string; paper: string | null; floor: string };
  /** Drapes on the windows of a floor, by style; an empty style takes them down. */
  applyDrapes(level: number, style: string): void;
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
  /** A piece that talks (the Overseer): its lines, one after another in a bubble over it. */
  objectSay(id: string, lines: string[]): void;
  /** Room service: a breakfast cart rolls along these points (world x, y) on a floor, waits, and rolls back. */
  roomService(level: number, pts: [number, number][]): void;
  roomServiceBusy(): boolean;
  /** The Victorian candelabra: light or snuff its candles one after another. */
  candles(id: string, on: boolean): void;
  candlesOn(id: string): boolean;
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
