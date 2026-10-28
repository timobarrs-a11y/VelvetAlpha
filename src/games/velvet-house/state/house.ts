import type { StairDef } from './pathfinding';
import { SCENES, FLOOR_ORDER, levelOfKind } from './scenes';

export type WallSide = 'B' | 'F' | 'L' | 'R';

export interface RoomDef {
  n: string;
  r: [number, number, number, number];
}

export interface InteriorWall {
  x?: number;
  y?: number;
  a: number;
  b: number;
}

export interface WallFeat {
  p: WallSide;
  u: [number, number];
  z: [number, number];
  k: string;
}

export interface LevelDef {
  rooms: RoomDef[];
  walls: InteriorWall[];
  feats: WallFeat[];
  rug?: [number, number, number, number];
  anchor: [number, number];
  yard?: boolean;
}

export const WX = 10;
export const WY = 8;
export const TW = 32;
export const TH = 16;
export const ZH = 34;
export const WH = 2.6;

// Names, floor-bar order and the attic's level come from the scene list (state/scenes.ts).
export const LEVEL_NAMES: readonly string[] = SCENES.map((s) => s.name);
export const ATTIC = levelOfKind('attic');
export { FLOOR_ORDER };

export const LEVELS: LevelDef[] = [
  {
    rooms: [
      { n: 'Gym', r: [0, 0, 5.1, 4.6] },
      { n: 'Utility', r: [0, 4.6, 5.1, 8] },
      { n: 'Rec room', r: [5.1, 0, 10, 8] },
    ],
    walls: [
      { x: 5.1, a: 0, b: 3.0 },
      { x: 5.1, a: 4.4, b: 8 },
      { y: 4.6, a: 0, b: 3.4 },
    ],
    feats: [
      { p: 'B', u: [1.0, 2.0], z: [2.0, 2.4], k: 'highwin' },
      { p: 'B', u: [6.4, 7.4], z: [2.0, 2.4], k: 'highwin' },
      { p: 'B', u: [3.0, 3.7], z: [1.2, 1.95], k: 'poster' },
      { p: 'B', u: [6.0, 8.0], z: [0.8, 1.9], k: 'screen' },
    ],
    anchor: [8.0, 4.0],
  },
  {
    rooms: [
      { n: 'Kitchen', r: [0, 0, 4.7, 4.1] },
      { n: 'Entry', r: [0, 4.1, 4.7, 8] },
      { n: 'Living room', r: [4.7, 0, 10, 8] },
    ],
    // The entry is open to the kitchen on its left and to the living room at the foot of the stairs: no wall behind the
    // staircase or beside its bottom step, so there is room to walk round it.
    walls: [
      { y: 4.1, a: 2.8, b: 4.7 },
      { x: 4.7, a: 0, b: 1.2 },
      { x: 4.7, a: 2.4, b: 5.4 },
    ],
    feats: [
      { p: 'B', u: [0.6, 1.6], z: [1.25, 2.2], k: 'window' },
      { p: 'B', u: [4.95, 5.75], z: [1.25, 2.2], k: 'window' },
      { p: 'L', u: [4.6, 5.5], z: [0, 2.05], k: 'door' },
      { p: 'B', u: [8.5, 8.66], z: [0.98, 1.24], k: 'switch' },
      { p: 'B', u: [6.1, 7.5], z: [0.82, 1.68], k: 'tv' },
      { p: 'L', u: [1.2, 2.9], z: [1.15, 2.05], k: 'art' },
      { p: 'F', u: [5.4, 6.4], z: [1.0, 2.0], k: 'window' },
      { p: 'F', u: [7.6, 8.6], z: [1.0, 2.0], k: 'window' },
      { p: 'R', u: [1.8, 2.8], z: [1.0, 2.0], k: 'window' },
      { p: 'R', u: [5.6, 6.6], z: [1.0, 2.0], k: 'window' },
      { p: 'L', u: [3.2, 4.0], z: [0, 2.05], k: 'door' },
    ],
    rug: [5.3, 1.0, 8.6, 2.9],
    anchor: [0.6, 5.05],
  },
  {
    rooms: [
      { n: 'Bedroom', r: [0, 0, 5.8, 3.7] },
      { n: 'Bathroom', r: [5.8, 0, 10, 3.7] },
      { n: 'Hall office', r: [0, 3.7, 10, 8] },
    ],
    walls: [
      { y: 3.7, a: 0, b: 2.8 },
      { y: 3.7, a: 3.8, b: 7.2 },
      { y: 3.7, a: 8.2, b: 10 },
      { x: 5.8, a: 0, b: 3.7 },
    ],
    feats: [
      { p: 'B', u: [1.0, 2.2], z: [1.25, 2.2], k: 'window' },
      { p: 'B', u: [8.5, 10], z: [0.14, 2.3], k: 'tiles' },
      { p: 'B', u: [6.9, 7.7], z: [1.1, 1.75], k: 'mirror' },
      { p: 'L', u: [5.2, 6.6], z: [1.2, 1.95], k: 'hallart' },
      { p: 'F', u: [4.4, 5.6], z: [1.0, 2.0], k: 'window' },
      { p: 'F', u: [6.6, 7.6], z: [1.0, 2.0], k: 'window' },
      { p: 'R', u: [1.2, 2.2], z: [1.0, 2.0], k: 'window' },
      { p: 'R', u: [5.0, 6.2], z: [1.0, 2.0], k: 'window' },
    ],
    rug: [0.6, 0.0, 0, 0],
    anchor: [3.8, 4.2],
  },
  {
    rooms: [{ n: 'Backyard', r: [0, 0, 10, 8] }],
    walls: [],
    yard: true,
    feats: [
      { p: 'L', u: [3.2, 4.0], z: [0, 2.05], k: 'door' },
      { p: 'L', u: [0.8, 2.0], z: [1.1, 2.0], k: 'extwin' },
      { p: 'L', u: [5.2, 6.4], z: [1.1, 2.0], k: 'extwin' },
    ],
    rug: [0, 0, 0, 0],
    anchor: [1.2, 3.6],
  },
  {
    rooms: [{ n: 'Attic', r: [0, 0, 10, 8] }],
    walls: [],
    feats: [
      { p: 'B', u: [1.2, 2.4], z: [1.25, 2.2], k: 'window' },
      { p: 'B', u: [7.4, 8.6], z: [1.25, 2.2], k: 'window' },
      { p: 'R', u: [3.0, 4.2], z: [1.0, 2.0], k: 'window' },
    ],
    rug: [0, 0, 0, 0],
    anchor: [5.0, 4.0],
  },
];

export const STAIRS: StairDef[] = [
  { id: 'S01', lower: 0, upper: 1, lowerNode: [9.5, 3.7], bottom: [9.5, 3.25], top: [9.5, 1.25], upperNode: [9.5, 0.75] },
  { id: 'S12', lower: 1, upper: 2, lowerNode: [3.7, 7.5], bottom: [3.25, 7.5], top: [1.25, 7.5], upperNode: [0.75, 7.5] },
  { id: 'D13', lower: 1, upper: 3, lowerNode: [0.7, 3.6], upperNode: [0.75, 3.6], door: true },
  // Only exists once the attic has been built (see ATTIC_STAIR_OBJS).
  { id: 'S24', lower: 2, upper: ATTIC, lowerNode: [7.0, 7.5], bottom: [6.55, 7.5], top: [4.55, 7.5], upperNode: [4.05, 7.5] },
];

export const DOOR: [number, number] = [0.6, 5.05];

export interface WallLightDef {
  level: number;
  p: WallSide;
  u: [number, number];
  z: number;
  k: string;
  room: string;
  r: number;
  need?: string;
  col?: string;
  amb?: boolean;
  night?: boolean;
  onlyIn?: string;
  /** The look of a sconce (art/wallLamps.js): classic, swing, cylinder, globe, candle, lantern, deco or cage. */
  style?: string;
}

export const WALL_LIGHTS: WallLightDef[] = [
  { level: 0, p: 'L', u: [1.3, 3.7], z: 2.12, k: 'strip', room: 'Gym', r: 190 },
  { level: 0, p: 'L', u: [6.95, 7.15], z: 2.05, k: 'bulb', room: 'Utility', r: 125 },
  { level: 0, p: 'B', u: [5.55, 5.75], z: 1.8, k: 'sconce', style: 'cage', room: 'Rec room', r: 140 },
  { level: 0, p: 'B', u: [8.3, 8.5], z: 1.8, k: 'sconce', style: 'cage', room: 'Rec room', r: 120 },
  { level: 1, p: 'B', u: [1.75, 3.25], z: 1.5, k: 'under', room: 'Kitchen', r: 120 },
  { level: 1, p: 'L', u: [6.2, 6.4], z: 1.75, k: 'sconce', style: 'classic', room: 'Entry', r: 130 },
  { level: 1, p: 'L', u: [7.4, 7.6], z: 1.75, k: 'sconce', style: 'candle', room: 'Dining room', r: 120, onlyIn: 'craftsman' },
  { level: 1, p: 'B', u: [7.85, 8.05], z: 1.85, k: 'sconce', style: 'swing', room: 'Living room', r: 140 },
  { level: 1, p: 'B', u: [9.35, 9.55], z: 1.85, k: 'sconce', style: 'deco', room: 'Living room', r: 130 },
  { level: 2, p: 'B', u: [2.5, 2.7], z: 1.8, k: 'sconce', style: 'globe', room: 'Bedroom', r: 130 },
  { level: 2, p: 'B', u: [0.3, 2.9], z: 2.3, k: 'string', room: 'Bedroom', r: 130, need: 'stringlights', col: '255,160,190', amb: true },
  { level: 2, p: 'B', u: [6.9, 7.7], z: 1.86, k: 'bar', room: 'Bathroom', r: 110 },
  { level: 2, p: 'L', u: [4.5, 4.7], z: 1.8, k: 'sconce', style: 'cylinder', room: 'Hall office', r: 130, night: true },
  { level: 3, p: 'L', u: [4.3, 4.5], z: 2.05, k: 'sconce', style: 'lantern', room: 'Backyard', r: 170, night: true, amb: true },
];

export const PRIVATE_ROOMS = new Set([
  'Bedroom', 'Bathroom', 'Gym', 'Utility',
  'Primary bedroom', 'Guest room', 'Home gym',
]);

export const ROOM_ALIASES: Record<string, string> = {
  Bedroom: 'Primary bedroom',
  'Rec room': 'Theater',
  Entry: 'Dining room',
  'Hall office': 'Office',
  Gym: 'Home gym',
};

export function roomName(level: number, x: number, y: number): string {
  const cx = Math.min(WX - 0.01, Math.max(0.01, x));
  const cy = Math.min(WY - 0.01, Math.max(0.01, y));
  const r = LEVELS[level].rooms.find(
    (rm) => cx >= rm.r[0] && cx <= rm.r[2] && cy >= rm.r[1] && cy <= rm.r[3],
  );
  return r ? r.n : LEVEL_NAMES[level];
}

export function roomFor(name: string, houseStyle?: string): string {
  return houseStyle === 'craftsman' && ROOM_ALIASES[name] ? ROOM_ALIASES[name] : name;
}
