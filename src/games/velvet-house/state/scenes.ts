/**
 * The places the player can look at. A floor of the house is one kind of scene; the backyard is another, and a
 * workplace or a classroom will be more. Everything that used to ask "is this level 3?" asks the scene instead.
 *
 * `level` is the scene's number everywhere else in the game (objects, people and saves carry it), so each scene's
 * index in SCENES is its level. Add new scenes at the end.
 */
export type SceneKind = 'interior' | 'attic' | 'yard';

export interface SceneDef {
  /** Stable name for scripts and saves. */
  id: string;
  level: number;
  name: string;
  kind: SceneKind;
  /** Where it sits in the floor bar, from the bottom up. */
  slot: number;
  /** Open to the weather: sky, rain, grass. */
  outdoor: boolean;
  /** Walls, wallpaper and floors can be changed here. */
  paintable: boolean;
  /** The shop item that builds it; a scene without one is always there. */
  builtBy?: string;
}

export const SCENES: SceneDef[] = [
  { id: 'basement', level: 0, name: 'Basement', kind: 'interior', slot: 0, outdoor: false, paintable: true },
  { id: 'main', level: 1, name: 'Main floor', kind: 'interior', slot: 1, outdoor: false, paintable: true },
  { id: 'upstairs', level: 2, name: 'Upstairs', kind: 'interior', slot: 2, outdoor: false, paintable: true },
  { id: 'yard', level: 3, name: 'Backyard', kind: 'yard', slot: 4, outdoor: true, paintable: false },
  { id: 'attic', level: 4, name: 'Attic', kind: 'attic', slot: 3, outdoor: false, paintable: true, builtBy: 'upgrade-attic' },
];

export const LEVEL_COUNT = SCENES.length;

export function sceneOf(level: number): SceneDef {
  return SCENES[level] ?? SCENES[1];
}

export const isOutdoor = (level: number): boolean => sceneOf(level).outdoor;
export const isPaintable = (level: number): boolean => sceneOf(level).paintable;

/** Levels in floor-bar order, bottom to top. */
export const FLOOR_ORDER: number[] = [...SCENES].sort((a, b) => a.slot - b.slot).map((s) => s.level);

/** The level of the first scene of a kind (the attic, say). */
export function levelOfKind(kind: SceneKind): number {
  return SCENES.find((s) => s.kind === kind)!.level;
}
