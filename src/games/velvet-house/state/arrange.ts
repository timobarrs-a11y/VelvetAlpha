import { TYPES, blocksOf, isRug, isFixed, footprint, type ObjectInstance } from './objects';
import { LEVELS, STAIRS, WX, WY } from './house';
import { buildWorld } from './agents';
import { cellOf, reachableSet, NY } from './pathfinding';

// Arrange mode's rules: where a piece of furniture may go. Pure, so it can
// be tested; main.ts moves the piece and asks before placing it.
//
// A spot is fine when the piece stays inside the room, doesn't overlap other
// furniture or cross a wall, and everything people use on that floor (the
// washer's front, the fridge, the stairs) can still be walked to. That last
// rule is what lets the household find the washer wherever you put it.

// Stairs and the openings above them are part of the house, not furniture.
const STRUCTURAL = new Set(['flightX', 'flightY', 'holeX', 'holeY']);

export function isMovable(o: ObjectInstance): boolean {
  return !!TYPES[o.type] && !STRUCTURAL.has(o.type);
}

type Rect = [number, number, number, number];

// The object's blocking rectangles, in world units.
function rectsOf(o: ObjectInstance): Rect[] {
  const t = TYPES[o.type];
  const xf = (lx: number, ly: number): [number, number] => {
    switch (o.rot) {
      case 1: return [o.x + (t.D - ly), o.y + lx];
      case 2: return [o.x + (t.W - lx), o.y + (t.D - ly)];
      case 3: return [o.x + ly, o.y + (t.W - lx)];
      default: return [o.x + lx, o.y + ly];
    }
  };
  return blocksOf(o.type).map(([x0, y0, x1, y1]) => {
    const a = xf(x0, y0), b = xf(x1, y1);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] as Rect;
  });
}

const overlaps = (a: Rect, b: Rect, gap = 0.02) => a[0] < b[2] - gap && a[2] > b[0] + gap && a[1] < b[3] - gap && a[3] > b[1] + gap;

export interface PlacementCheck {
  ok: boolean;
  // Why not, in words for the player.
  reason?: string;
}

/**
 * Can `held` (already moved to its new x, y, rot) stay there?
 * `people` are where the characters are now, so a move never traps anyone.
 */
export function checkPlacement(objs: ObjectInstance[], held: ObjectInstance, people: Array<{ level: number; x: number; y: number }> = []): PlacementCheck {
  const [fw, fd] = footprint(held);
  if (held.x < 0.08 || held.y < 0.08 || held.x + fw > WX - 0.05 || held.y + fd > WY - 0.05) {
    return { ok: false, reason: 'That would poke through the wall.' };
  }
  const mine = rectsOf(held);
  // Rugs lie under everything; everything else needs its own floor space.
  if (!isRug(held.type)) {
    for (const o of objs) {
      if (o === held || o.level !== held.level || isRug(o.type) || !TYPES[o.type]) continue;
      const other = TYPES[o.type].wall && TYPES[held.type].wall ? rectsOf(o) : TYPES[o.type].wall ? [] : rectsOf(o);
      if (mine.some(m => other.some(r => overlaps(m, r)))) return { ok: false, reason: `It bumps into the ${(TYPES[o.type].name ?? 'furniture').toLowerCase()}.` };
    }
    for (const w of LEVELS[held.level].walls) {
      const wall: Rect = w.x !== undefined ? [w.x - 0.06, w.a, w.x + 0.06, w.b] : [w.a, w.y! - 0.06, w.b, w.y! + 0.06];
      if (mine.some(m => overlaps(m, wall, 0))) return { ok: false, reason: 'It would go through a wall.' };
    }
  }

  // Everyone must still be able to get everywhere they need on this floor.
  const world = buildWorld(objs);
  const grid = world.grids[held.level];
  const anchor = LEVELS[held.level].anchor;
  const reach = reachableSet(grid, anchor);
  const reachable = (x: number, y: number) => {
    const [i, j] = cellOf(x, y);
    return !!grid[i]?.[j] && reach.has(i * NY + j);
  };
  for (const s of world.slots) {
    if (s.level !== held.level) continue;
    if (!reachable(s.stand[0], s.stand[1])) {
      const owner = objs.find(o => s.id.startsWith(o.id + ':'));
      const what = (owner ? TYPES[owner.type].name ?? 'furniture' : 'furniture').toLowerCase();
      return { ok: false, reason: owner === held ? `Nobody could get to the ${what} there.` : `That blocks the way to the ${what}.` };
    }
  }
  for (const st of STAIRS) {
    // The attic's stairs only exist once it's been built.
    if (st.id === 'S24' && !objs.some(o => o.id === 'stair24')) continue;
    for (const [lv, node] of [[st.lower, st.lowerNode], [st.upper, st.upperNode]] as const) {
      if (lv === held.level && !reachable(node[0], node[1])) return { ok: false, reason: 'That blocks the stairs.' };
    }
  }
  for (const p of people) {
    if (p.level !== held.level || reachable(p.x, p.y)) continue;
    // Someone who could not get around even without this piece (standing somewhere odd, mid-activity) is not trapped
    // by it, and must not make every spot in the house impossible.
    const without = buildWorld(objs.filter((o) => o !== held));
    const reachWithout = reachableSet(without.grids[held.level], anchor);
    const [i, j] = cellOf(p.x, p.y);
    const wasFree = !!without.grids[held.level][i]?.[j] && reachWithout.has(i * NY + j);
    if (wasFree) return { ok: false, reason: 'Someone would be trapped behind it.' };
  }
  return { ok: true };
}

// Move a held piece so its centre sits under the pointer, snapped to a
// quarter tile.
export function centreAt(o: ObjectInstance, wx: number, wy: number): void {
  const [fw, fd] = footprint(o);
  o.x = Math.round((wx - fw / 2) * 4) / 4;
  o.y = Math.round((wy - fd / 2) * 4) / 4;
}

// Turn a held piece a quarter, about its own centre.
export function rotateAboutCentre(o: ObjectInstance): void {
  const [fw, fd] = footprint(o);
  const cx = o.x + fw / 2, cy = o.y + fd / 2;
  o.rot = (o.rot + 1) % 4;
  centreAt(o, cx, cy);
}

// The next colour the piece comes in, if it comes in several.
export function nextColour(o: ObjectInstance): string | null {
  const cols = TYPES[o.type]?.cols;
  if (!cols || cols.length < 2) return null;
  const i = cols.indexOf(o.col ?? cols[0]);
  return cols[(i + 1) % cols.length];
}

// Pieces too big (or too bolted down) to carry up and down the stairs.
const HEAVY = new Set(['bed', 'dining', 'gym', 'tread', 'shelves', 'piano', 'aquarium', 'wardrobe', 'gclock']);
const INDOOR_LEVELS = [0, 1, 2, 4];

/**
 * The floors a piece can be carried to, other than the one it's on. Anything
 * you could reasonably lift (chairs, lamps, plants, a couch) can go between
 * the basement, main floor and upstairs; big furniture, appliances and
 * everything in the backyard stay on their own floor.
 */
export function otherFloors(o: ObjectInstance): number[] {
  if (!isMovable(o) || isFixed(o.type) || HEAVY.has(o.type) || TYPES[o.type].out) return [];
  if (!INDOOR_LEVELS.includes(o.level)) return [];
  return INDOOR_LEVELS.filter(lv => lv !== o.level);
}

export function canChangeFloor(o: ObjectInstance): boolean {
  return otherFloors(o).length > 0;
}

/**
 * Carry `o` to `level`, setting it down on the free spot nearest the middle
 * of that floor (or nearest `near`). True when it found room: `o` is then
 * already on its new floor, at its new spot. False when the floor is too full,
 * and `o` is exactly as it was.
 */
export function relocate(
  objs: ObjectInstance[], o: ObjectInstance, level: number,
  people: Array<{ level: number; x: number; y: number }> = [],
  near: [number, number] = [WX / 2, WY / 2],
): boolean {
  const orig = { level: o.level, x: o.x, y: o.y, rot: o.rot };
  const spots: Array<[number, number]> = [];
  for (let x = 0; x <= WX; x += 0.5) for (let y = 0; y <= WY; y += 0.5) spots.push([x, y]);
  spots.sort((a, b) => Math.hypot(a[0] - near[0], a[1] - near[1]) - Math.hypot(b[0] - near[0], b[1] - near[1]));
  o.level = level;
  for (const turns of [0, 1]) {
    o.rot = (orig.rot + turns) % 4;
    for (const [cx, cy] of spots) {
      centreAt(o, cx, cy);
      if (checkPlacement(objs, o, people).ok) return true;
    }
  }
  Object.assign(o, orig);
  return false;
}

/** Anything that isn't built into the house can be put away in storage. */
export function canStore(o: ObjectInstance): boolean {
  return isMovable(o) && !isFixed(o.type);
}
