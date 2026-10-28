import { TYPES, blocksOf, isRug, isFixed, footprint, colsOf, kindOf, type ObjectInstance } from './objects';
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
  if (held.on) return checkOnSurface(objs, held);
  const [fw, fd] = footprint(held);
  if (held.x < 0.08 || held.y < 0.08 || held.x + fw > WX - 0.05 || held.y + fd > WY - 0.05) {
    return { ok: false, reason: 'That would poke through the wall.' };
  }
  const mine = rectsOf(held);
  // Rugs lie under everything; everything else needs its own floor space.
  if (!isRug(held.type)) {
    for (const o of objs) {
      if (o === held || o.on || o.level !== held.level || isRug(o.type) || !TYPES[o.type]) continue;
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

// ---- small pieces on surfaces ------------------------------------------------------------------------------------------

/** Where the flat top of a piece is, in the house (a rectangle), if it has one. */
export function surfaceRect(host: ObjectInstance): Rect | null {
  const t = TYPES[host.type];
  if (!t?.surface) return null;
  const [x0, y0, x1, y1] = t.surface.rect;
  const xf = (lx: number, ly: number): [number, number] => {
    switch (host.rot) {
      case 1: return [host.x + (t.D - ly), host.y + lx];
      case 2: return [host.x + (t.W - lx), host.y + (t.D - ly)];
      case 3: return [host.x + ly, host.y + (t.W - lx)];
      default: return [host.x + lx, host.y + ly];
    }
  };
  const a = xf(x0, y0), b = xf(x1, y1);
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

const footRect = (o: ObjectInstance): Rect => { const [w, d] = footprint(o); return [o.x, o.y, o.x + w, o.y + d]; };

/** Is the small piece sitting fully on its surface, with nothing else in the way? */
function checkOnSurface(objs: ObjectInstance[], held: ObjectInstance): PlacementCheck {
  const host = objs.find((o) => o.id === held.on);
  const area = host && host.level === held.level ? surfaceRect(host) : null;
  if (!host || !area) return { ok: false, reason: 'There is nothing to put it on.' };
  const r = footRect(held), eps = 0.001;
  if (r[0] < area[0] - eps || r[1] < area[1] - eps || r[2] > area[2] + eps || r[3] > area[3] + eps) {
    return { ok: false, reason: `It doesn't fit on the ${(TYPES[host.type].name ?? 'surface').toLowerCase()}.` };
  }
  for (const o of objs) {
    if (o === held || o.on !== held.on) continue;
    if (overlaps(r, footRect(o), 0.01)) return { ok: false, reason: `There's no room left on the ${(TYPES[host.type].name ?? 'surface').toLowerCase()}.` };
  }
  return { ok: true };
}

/** The surface under a small piece's centre, if any (the highest, when they stack up in the picture). */
export function surfaceUnder(objs: ObjectInstance[], held: ObjectInstance, cx: number, cy: number): ObjectInstance | null {
  if (!TYPES[held.type]?.small) return null;
  let best: ObjectInstance | null = null;
  for (const o of objs) {
    if (o === held || o.on || o.level !== held.level) continue;
    const a = surfaceRect(o);
    if (a && cx >= a[0] && cx <= a[2] && cy >= a[1] && cy <= a[3] && (!best || TYPES[o.type].surface!.z > TYPES[best.type].surface!.z)) best = o;
  }
  return best;
}

/** Sit a small piece on a surface: its base is the height of the top, and it stays inside the flat part. */
export function putOn(held: ObjectInstance, host: ObjectInstance): void {
  const a = surfaceRect(host)!, [w, d] = footprint(held);
  held.on = host.id;
  held.z = TYPES[host.type].surface!.z;
  held.x = Math.max(a[0], Math.min(a[2] - w, held.x));
  held.y = Math.max(a[1], Math.min(a[3] - d, held.y));
}

export function takeOff(held: ObjectInstance): void {
  delete held.on;
  delete held.z;
}

export interface Pose { x: number; y: number; rot: number }

/**
 * Whatever is on a piece moves, turns and changes floor with it. `from` is where the piece was; the piece itself is
 * already where it is now.
 */
export function carryOnTop(objs: ObjectInstance[], host: ObjectInstance, from: Pose): void {
  const kids = objs.filter((o) => o.on === host.id);
  if (!kids.length) return;
  const t = TYPES[host.type];
  const [w0, d0] = from.rot % 2 ? [t.D, t.W] : [t.W, t.D], [w1, d1] = footprint(host);
  const c0: [number, number] = [from.x + w0 / 2, from.y + d0 / 2], c1: [number, number] = [host.x + w1 / 2, host.y + d1 / 2];
  const turns = (host.rot - from.rot + 4) % 4;
  for (const k of kids) {
    const [kw, kd] = footprint(k);
    let rel: [number, number] = [k.x + kw / 2 - c0[0], k.y + kd / 2 - c0[1]];
    for (let i = 0; i < turns; i++) rel = [-rel[1], rel[0]];
    k.level = host.level;
    k.rot = (k.rot + turns) % 4;
    centreAt(k, c1[0] + rel[0], c1[1] + rel[1]);
    putOn(k, host);
  }
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
  const cols = colsOf(o);
  if (!cols || cols.length < 2) return null;
  const i = cols.indexOf(o.col ?? cols[0]);
  return cols[(i + 1) % cols.length];
}

/**
 * Make `o` another model of its kind, where it stands: its back stays against the same wall and it slides along that wall
 * to the nearest place the new size fits (left edge kept, right edge kept, centred, then a step at a time either way).
 * False, with `o` as it was, when nothing near fits.
 */
export function swapModel(objs: ObjectInstance[], o: ObjectInstance, type: string, people: Array<{ level: number; x: number; y: number }> = []): boolean {
  if (!TYPES[type] || kindOf(type) !== kindOf(o.type)) return false;
  const was = { type: o.type, x: o.x, y: o.y };
  const [ow, od] = footprint(o);
  o.type = type;
  const [nw, nd] = footprint(o);
  // Which edge is the back: rot 0 keeps its low y, 1 its high x, 2 its high y, 3 its low x.
  const bx = o.rot === 1 ? was.x + ow - nw : was.x, by = o.rot === 2 ? was.y + od - nd : was.y;
  const alongX = o.rot % 2 === 0, span = alongX ? ow - nw : od - nd;
  const steps = [0, span, span / 2];
  for (let k = 1; k <= 6; k++) steps.push(-0.25 * k, span + 0.25 * k);
  for (const d of steps) {
    o.x = alongX ? bx + d : bx;
    o.y = alongX ? by : by + d;
    if (checkPlacement(objs, o, people).ok) return true;
  }
  Object.assign(o, was);
  return false;
}

/** Whether `o` could become that model where it stands (see `swapModel`), without changing it. */
export function modelFits(objs: ObjectInstance[], o: ObjectInstance, type: string, people: Array<{ level: number; x: number; y: number }> = []): boolean {
  const was = { type: o.type, x: o.x, y: o.y };
  const ok = swapModel(objs, o, type, people);
  Object.assign(o, was);
  return ok;
}

const CARRY_LEVELS = [0, 1, 2, 3, 4];

/**
 * The floors a piece can be carried to, other than the one it's on. Any piece
 * can go to any floor, the backyard included (the carrying isn't shown, so
 * nothing is "too heavy" and nothing "belongs" somewhere: the treadmill can live
 * in the bedroom or on the lawn). Only the stairs stay put.
 */
export function otherFloors(o: ObjectInstance): number[] {
  // Nothing is fixed: the bed goes upstairs, the gym to the basement, the kitchen sink wherever they like, the treadmill onto
  // the lawn. Only the stairs and floor openings stay put.
  if (!isMovable(o) || !CARRY_LEVELS.includes(o.level)) return [];
  return CARRY_LEVELS.filter(lv => lv !== o.level);
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

/** Anything that isn't built into the house can be put away in storage (a toilet or a counter can move, not vanish). */
export function canStore(o: ObjectInstance): boolean {
  return isMovable(o) && !isFixed(o.type);
}

/** The fridge this piece of food is being set down on, if it overlaps one on its floor. */
export function fridgeUnder(objs: ObjectInstance[], food: ObjectInstance): ObjectInstance | null {
  if (food.type !== 'food') return null;
  const [fw, fd] = footprint(food);
  const cx = food.x + fw / 2, cy = food.y + fd / 2;
  for (const o of objs) {
    if (kindOf(o.type) !== 'fridge' || o.level !== food.level) continue;
    const [w, d] = footprint(o);
    if (cx >= o.x - 0.3 && cx <= o.x + w + 0.3 && cy >= o.y - 0.3 && cy <= o.y + d + 0.3) return o;
  }
  return null;
}
