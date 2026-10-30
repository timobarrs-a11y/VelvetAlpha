import { TYPES, blocksOf, isRug, isMount, isFixed, footprint, colsOf, kindOf, type ObjectInstance } from './objects';
import { LEVELS, STAIRS, levelW, levelH } from './house';
import { buildWorld } from './agents';
import { cellOf, reachableSet, NY } from './pathfinding';
import { isOutdoor } from './scenes';

// Arrange mode's rules: where a piece of furniture may go. Pure, so it can
// be tested; main.ts moves the piece and asks before placing it.
//
// A spot is fine when the piece stays inside the room, doesn't overlap other
// furniture or cross a wall, and everything people use on that floor (the
// washer's front, the fridge, the stairs) can still be walked to. That last
// rule is what lets the household find the washer wherever you put it.

// Stairs and the openings above them are part of the house, not furniture.
const STRUCTURAL = new Set(['flightX', 'flightY', 'holeX', 'holeY', 'officeboardspot', 'officedoorspot']);

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

// How far a piece must keep from the edge of the floor: a hair off a house wall, which has a thickness, but none in the yard, where
// the edge is a fence with no thickness. Pieces there can sit flush against it and against each other.
const margin = (level: number): { lo: number; hi: number } => (isOutdoor(level) ? { lo: 0, hi: 0 } : { lo: 0.08, hi: 0.05 });

// A desk's chair tucks in under it: a single seat may overlap a desk's edge by up to half a tile (never with its middle over the desk), so a
// chair can be lined up snug against its desk instead of stopping short of it.
const DESK_TYPES = new Set(['officedesk', 'bossdesk']);
const TUCK = 0.5;
function tucksUnder(chair: ObjectInstance, desk: ObjectInstance): boolean {
  if (!DESK_TYPES.has(desk.type)) return false;
  const spots = TYPES[chair.type]?.spots;
  if (!spots || !Object.values(spots).some((s) => s.base === 'seat')) return false;
  const [cw, cd] = footprint(chair), [dw, dd] = footprint(desk);
  if (Math.max(cw, cd) > 0.95) return false;
  const cx = chair.x + cw / 2, cy = chair.y + cd / 2;
  const e = 1e-6;
  if (cx > desk.x + e && cx < desk.x + dw - e && cy > desk.y + e && cy < desk.y + dd - e) return false;
  const ox = Math.min(chair.x + cw, desk.x + dw) - Math.max(chair.x, desk.x), oy = Math.min(chair.y + cd, desk.y + dd) - Math.max(chair.y, desk.y);
  return ox <= TUCK + 1e-6 || oy <= TUCK + 1e-6;
}

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
  const m = margin(held.level), eps = 1e-6, WX = levelW(held.level), WY = levelH(held.level);
  if (held.x < m.lo - eps || held.y < m.lo - eps || held.x + fw > WX - m.hi + eps || held.y + fd > WY - m.hi + eps) {
    return { ok: false, reason: 'That would poke through the wall.' };
  }
  const mine = rectsOf(held);
  if (isMount(held.type) && !backToWall(held)) return { ok: false, reason: `The ${(TYPES[held.type].name ?? 'piece').toLowerCase()} hangs on a wall: put its back against one.` };
  // Rugs lie under everything and hung pieces over it; everything else needs its own floor space.
  if (!isRug(held.type) && !isMount(held.type)) {
    for (const o of objs) {
      if (o === held || o.on || o.level !== held.level || isRug(o.type) || isMount(o.type) || !TYPES[o.type]) continue;
      const other = TYPES[o.type].wall && TYPES[held.type].wall ? rectsOf(o) : TYPES[o.type].wall ? [] : rectsOf(o);
      if (mine.some(m => other.some(r => overlaps(m, r))) && !(tucksUnder(held, o) || tucksUnder(o, held))) return { ok: false, reason: `It bumps into the ${(TYPES[o.type].name ?? 'furniture').toLowerCase()}.` };
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

/** A hung piece's back is against a wall of its floor (the house's own, or one inside it), along its whole width. */
export function backToWall(o: ObjectInstance): boolean {
  const [w, d] = footprint(o), GAP = 0.18, SLACK = 0.05;
  // The back edge: rot 0 faces into the room from low y, 1 from high x, 2 from high y, 3 from low x.
  const along = o.rot % 2 === 0, at = o.rot === 0 ? o.y : o.rot === 1 ? o.x + w : o.rot === 2 ? o.y + d : o.x;
  const from = along ? o.x : o.y, to = along ? o.x + w : o.y + d, out = o.rot === 0 || o.rot === 3 ? -1 : 1;
  const near = (line: number) => (line - at) * out >= -0.01 && (line - at) * out <= GAP;
  // The house's own wall behind it, or one inside the house.
  if (near(o.rot === 1 ? levelW(o.level) : o.rot === 2 ? levelH(o.level) : 0)) return true;
  return LEVELS[o.level].walls.some((wl) => (along ? wl.y !== undefined : wl.x !== undefined) && near((along ? wl.y : wl.x)!) && wl.a <= from + SLACK && wl.b >= to - SLACK);
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

/**
 * Pull a piece being carried flush to what is near it, so edges meet without a hunt for the right quarter tile: the edge of the
 * floor, a wall inside the house, or another piece (touching it, or lined up with its edge). Only what is within `reach` of it
 * along the other direction counts, so a piece far along a wall does not tug. Each direction snaps on its own, to the nearest.
 */
export function snapEdges(objs: ObjectInstance[], o: ObjectInstance, reach = 0.3): void {
  if (o.on || !TYPES[o.type] || isMount(o.type) || TYPES[o.type].small) return;
  const [fw, fd] = footprint(o), m = margin(o.level);
  const xs = [m.lo, levelW(o.level) - m.hi - fw], ys = [m.lo, levelH(o.level) - m.hi - fd];
  for (const q of objs) {
    if (q === o || q.on || q.level !== o.level || !TYPES[q.type] || isRug(q.type) || isMount(q.type) || TYPES[q.type].wall) continue;
    const [qw, qd] = footprint(q);
    if (o.y < q.y + qd + reach && o.y + fd > q.y - reach) xs.push(q.x + qw, q.x - fw, q.x, q.x + qw - fw);
    if (o.x < q.x + qw + reach && o.x + fw > q.x - reach) ys.push(q.y + qd, q.y - fd, q.y, q.y + qd - fd);
  }
  for (const w of LEVELS[o.level].walls) {
    if (w.x !== undefined) { if (o.y < w.b + reach && o.y + fd > w.a - reach) xs.push(w.x + 0.06, w.x - 0.06 - fw); }
    else if (o.x < w.b + reach && o.x + fw > w.a - reach) ys.push(w.y! + 0.06, w.y! - 0.06 - fd);
  }
  const pick = (v: number, cs: number[]): number => cs.reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best), cs[0]);
  const nx = pick(o.x, xs), ny = pick(o.y, ys);
  if (Math.abs(nx - o.x) <= reach) o.x = nx;
  if (Math.abs(ny - o.y) <= reach) o.y = ny;
}

// ---- Snap to a wall, then slide along it ---------------------------------------------------------------------------------

/** A piece set against a wall: where it is, and the run of the wall it can slide along (`axis` is the coordinate that changes). */
export interface WallSnap { x: number; y: number; rot: number; axis: 'x' | 'y'; lo: number; hi: number }

/**
 * Every wall of the piece's floor, nearest first, (its outer edge, or one inside the house) and the pose that sets the piece's back against it,
 * turned to face into the room, keeping its place along the wall where it can. A piece set on a surface, a rug or a mounted piece
 * has no wall to stand against; so does one longer than every wall near it. `o` is left as it was.
 */
export function wallSnaps(_objs: ObjectInstance[], o: ObjectInstance): WallSnap[] {
  const t = TYPES[o.type];
  if (!t || o.on || isRug(o.type) || isMount(o.type) || t.small) return [];
  const m = margin(o.level), rot0 = o.rot, x0 = o.x, y0 = o.y;
  const cx = x0 + footprint(o)[0] / 2, cy = y0 + footprint(o)[1] / 2;
  const found: Array<WallSnap & { cost: number }> = [];
  const consider = (rot: number, perp: 'x' | 'y', at: number, from: number, to: number): void => {
    // Rot 0 has its back at low y, 1 at high x, 2 at high y, 3 at low x (as `backToWall` reads it).
    o.rot = rot;
    const [fw, fd] = footprint(o), len = perp === 'y' ? fw : fd;
    const hi = to - len;
    if (hi < from - 0.3) return;
    const lo = Math.min(from, hi), top = Math.max(from, hi);
    const here = perp === 'y' ? x0 : y0, along = Math.min(top, Math.max(lo, Math.round(here * 4) / 4));
    const x = perp === 'y' ? along : at, y = perp === 'y' ? at : along;
    const cost = Math.hypot(x + fw / 2 - cx, y + fd / 2 - cy);
    found.push({ x, y, rot, axis: perp === 'y' ? 'x' : 'y', lo, hi: top, cost });
  };
  const WX = levelW(o.level), WY = levelH(o.level);
  const spanX: [number, number] = [m.lo, WX - m.hi], spanY: [number, number] = [m.lo, WY - m.hi];
  consider(0, 'y', m.lo, spanX[0], spanX[1]);
  { o.rot = 2; const fd = footprint(o)[1]; consider(2, 'y', WY - m.hi - fd, spanX[0], spanX[1]); }
  consider(3, 'x', m.lo, spanY[0], spanY[1]);
  { o.rot = 1; const fw = footprint(o)[0]; consider(1, 'x', WX - m.hi - fw, spanY[0], spanY[1]); }
  for (const w of LEVELS[o.level].walls) {
    if (w.x !== undefined) {
      consider(3, 'x', w.x + 0.06, w.a, w.b);
      { o.rot = 1; const fw = footprint(o)[0]; consider(1, 'x', w.x - 0.06 - fw, w.a, w.b); }
    } else {
      consider(0, 'y', w.y! + 0.06, w.a, w.b);
      { o.rot = 2; const fd = footprint(o)[1]; consider(2, 'y', w.y! - 0.06 - fd, w.a, w.b); }
    }
  }
  o.rot = rot0; o.x = x0; o.y = y0;
  found.sort((p, q) => p.cost - q.cost);
  return found.map(({ x, y, rot, axis, lo, hi }) => ({ x, y, rot, axis, lo, hi }));
}

/** The nearest wall to set the piece against, or null when it has none (see `wallSnaps`). */
export function snapToWall(objs: ObjectInstance[], o: ObjectInstance): WallSnap | null {
  return wallSnaps(objs, o)[0] ?? null;
}

/** Move a piece set against a wall to `v` along it (a quarter tile at a time), keeping it on the wall's run. */
export function slideAlong(o: ObjectInstance, snap: WallSnap, v: number): void {
  const a = Math.min(snap.hi, Math.max(snap.lo, Math.round(v * 4) / 4));
  if (snap.axis === 'x') o.x = a; else o.y = a;
}

/**
 * The nearest place around where `o` is now that it fits (flush to what is there, as `snapEdges` would leave it), or null when
 * nothing within `radius` does. A piece that is used from one side (a bed, a counter) may be turned to fit, a half turn or a quarter
 * costing a little distance, so a bed set against a fence with its front to the fence comes back facing into the yard.
 * `o` itself is left as it was.
 */
export function nearestFit(objs: ObjectInstance[], o: ObjectInstance, people: Array<{ level: number; x: number; y: number }> = [], radius = 2): { x: number; y: number; rot: number } | null {
  const ox = o.x, oy = o.y, rot0 = o.rot, offs: Array<[number, number, number]> = [];
  for (let dx = -radius; dx <= radius + 1e-9; dx += 0.25) for (let dy = -radius; dy <= radius + 1e-9; dy += 0.25) offs.push([dx, dy, Math.hypot(dx, dy)]);
  offs.sort((a, b) => a[2] - b[2]);
  const turns: Array<[number, number]> = TYPES[o.type]?.spots ? [[0, 0], [2, 0.25], [1, 0.4], [3, 0.4]] : [[0, 0]];
  let best: { x: number; y: number; rot: number; cost: number } | null = null;
  try {
    // Only the nearest 160 spots are tried for each turn: a fit that close is the one the player meant, and each try walks the whole floor.
    for (const [turn, pen] of turns) {
      o.rot = (rot0 + turn) % 4;
      for (const [dx, dy, d] of offs.slice(0, 160)) {
        if (turn === 0 && !dx && !dy) continue;
        if (best && d + pen >= best.cost) break;
        o.x = ox + dx; o.y = oy + dy;
        snapEdges(objs, o);
        if (checkPlacement(objs, o, people).ok) { best = { x: o.x, y: o.y, rot: o.rot, cost: d + pen }; break; }
      }
    }
    return best && { x: best.x, y: best.y, rot: best.rot };
  } finally { o.x = ox; o.y = oy; o.rot = rot0; }
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
  near: [number, number] = [levelW(level) / 2, levelH(level) / 2],
): boolean {
  if (isMount(o.type)) return hang(objs, o, level, people, near);
  const orig = { level: o.level, x: o.x, y: o.y, rot: o.rot };
  const spots: Array<[number, number]> = [];
  for (let x = 0; x <= levelW(level); x += 0.5) for (let y = 0; y <= levelH(level); y += 0.5) spots.push([x, y]);
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

/** Hang a piece on the nearest free stretch of wall on that floor, the house's own walls or one inside it. */
function hang(objs: ObjectInstance[], o: ObjectInstance, level: number, people: Array<{ level: number; x: number; y: number }>, near: [number, number]): boolean {
  const orig = { level: o.level, x: o.x, y: o.y, rot: o.rot };
  const t = TYPES[o.type], OFF = 0.08, spots: Array<[number, number, number]> = [];
  // A wall line and the side the piece hangs on: rot 0 hangs below a wall along x (facing +y), 2 above it; 3 right of a
  // wall along y (facing +x), 1 left of it.
  const along = (rot: number, line: number, a: number, b: number) => {
    const [w, d] = rot % 2 ? [t.D, t.W] : [t.W, t.D], len = rot % 2 ? d : w;
    for (let u = a + 0.1; u <= b - len - 0.1 + 1e-6; u += 0.25) {
      if (rot === 0) spots.push([rot, u, line + OFF]);
      else if (rot === 2) spots.push([rot, u, line - OFF - d]);
      else if (rot === 3) spots.push([rot, line + OFF, u]);
      else spots.push([rot, line - OFF - w, u]);
    }
  };
  const WX = levelW(level), WY = levelH(level);
  along(0, 0, 0, WX); along(2, WY, 0, WX); along(3, 0, 0, WY); along(1, WX, 0, WY);
  for (const wl of LEVELS[level].walls) {
    if (wl.y !== undefined) { along(0, wl.y, wl.a, wl.b); along(2, wl.y, wl.a, wl.b); } else { along(3, wl.x!, wl.a, wl.b); along(1, wl.x!, wl.a, wl.b); }
  }
  spots.sort((p, q) => Math.hypot(p[1] - near[0], p[2] - near[1]) - Math.hypot(q[1] - near[0], q[2] - near[1]));
  o.level = level;
  for (const [rot, x, y] of spots) {
    Object.assign(o, { rot, x, y });
    if (checkPlacement(objs, o, people).ok) return true;
  }
  Object.assign(o, orig);
  return false;
}

/**
 * Set a small piece (a TV) on a free surface on that floor, a TV stand first: the TV unit or its models, the
 * entertainment center, then a dresser or a desk, then anything with a top. False, with nothing changed, if none has room.
 */
export function setOnStand(objs: ObjectInstance[], o: ObjectInstance, level: number): boolean {
  if (!TYPES[o.type]?.small) return false;
  const orig = { level: o.level, x: o.x, y: o.y, rot: o.rot, on: o.on, z: o.z };
  const rank = (h: ObjectInstance) => ['tvunit', 'entcenter', 'dresser', 'desk'].indexOf(kindOf(h.type)) + 1 || 9;
  const hosts = objs.filter((h) => h !== o && !h.on && h.level === level && TYPES[h.type]?.surface).sort((a, b) => rank(a) - rank(b));
  o.level = level;
  for (const host of hosts) {
    const a = surfaceRect(host)!;
    o.rot = host.rot;
    const [w, d] = footprint(o);
    for (const fx of [0.5, 0, 1]) {
      o.x = a[0] + (a[2] - a[0] - w) * fx; o.y = a[1] + (a[3] - a[1] - d) * 0.5;
      putOn(o, host);
      if (checkPlacement(objs, o).ok) return true;
    }
  }
  Object.assign(o, orig);
  if (orig.on === undefined) takeOff(o);
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
