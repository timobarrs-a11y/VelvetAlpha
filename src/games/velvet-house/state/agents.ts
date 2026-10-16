import { TYPES, blocksOf, isRug, isWall, type ObjectInstance } from './objects';
import { ACTIVITIES, GAIN_OF, chainOf } from './activities';
import { NEED_KEYS, tickNeeds, weight, type NeedKey } from './needs';
import { buildGrid, planRoute, randomFree, type Block, type Grid, type RouteLeg } from './pathfinding';
import { LEVELS, STAIRS, WX, WY } from './house';
import type { CharacterNeeds } from './types';
import type { HouseholdState } from './household';
import { consumeMeal, washDishes, scrubDirt, worstDirt } from './household';

export type AgentId = 'jordan' | 'maya';

export interface Slot {
  id: string;
  level: number;
  tag: string;
  stand: [number, number];
  pos: [number, number, number] | null;
  dir: [number, number] | null;
  lie: [number, number] | null;
}

export interface AgentTask {
  act: string;
  slot: Slot | null;
  phase: 'walk' | 'do';
  route: RouteLeg[];
  time: number;
  dur: number;
  next: string[];
}

export interface AgentLook {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  longHair: boolean;
}

export interface Agent {
  id: AgentId;
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  face: [number, number];
  needs: CharacterNeeds;
  task: AgentTask | null;
  idle: number;
  onStairs: boolean;
  lastChain: string | null;
  look: AgentLook;
}

export interface HouseWorld {
  slots: Slot[];
  grids: Grid[];
}

const WALK_SPEED = 1.5;
const STAIR_SPEED = 0.9;
const WALL_HALF = 0.06;

const OWN_SIDE: Record<string, Record<AgentId, string[]>> = {
  sleep: { jordan: ['bedB', 'bedA'], maya: ['bedA', 'bedB'] },
  nap: { jordan: ['bedB', 'bedA'], maya: ['bedA', 'bedB'] },
  eat: { jordan: ['dine1', 'dine2'], maya: ['dine2', 'dine1'] },
  sip: { jordan: ['dine1', 'dine2'], maya: ['dine2', 'dine1'] },
};

const ACT_TAGS: Record<string, string[]> = {
  cook: ['stove'], coffee: ['coffee'], shower: ['shower'], bath: ['tub'],
  read: ['seat'], phone: ['seat'], tv: ['seat'],
  workout: ['tread'], lift: ['lift'], stretch: ['stretch'],
  records: ['records'], arcade: ['arcade'], plants: ['water'], window: ['window'],
  piano: ['piano'], easel: ['easel'], aquarium: ['aquarium'], guitar: ['guitar'],
  massage: ['massage'], hammock: ['hammock'], jukebox: ['jukebox'], bike: ['bike'],
  boxing: ['boxbag'], stargaze: ['stars'], fire: ['fireside'], swim: ['swim'],
};

const CHOICES = [
  'sleep', 'nap', 'cookeat', 'coffee', 'shower', 'bath', 'read', 'phone', 'tv',
  'workout', 'stretch', 'records', 'arcade', 'plants', 'piano', 'easel', 'aquarium',
  'guitar', 'massage', 'hammock', 'jukebox', 'bike', 'boxing', 'stargaze', 'fire', 'swim',
];

export const SITTING_POSES = new Set(['tv', 'read', 'phone', 'desk', 'eat', 'sip', 'eatOut']);

function tagsFor(act: string, id: AgentId): string[] {
  return OWN_SIDE[act]?.[id] ?? ACT_TAGS[act] ?? [];
}

function xf(o: ObjectInstance, lx: number, ly: number): [number, number] {
  const { W, D } = TYPES[o.type];
  switch (o.rot) {
    case 1: return [o.x + (D - ly), o.y + lx];
    case 2: return [o.x + (W - lx), o.y + (D - ly)];
    case 3: return [o.x + ly, o.y + (W - lx)];
    default: return [o.x + lx, o.y + ly];
  }
}

function xdir(rot: number, dx: number, dy: number): [number, number] {
  switch (rot) {
    case 1: return [-dy, dx];
    case 2: return [-dx, -dy];
    case 3: return [dy, -dx];
    default: return [dx, dy];
  }
}

export function buildSlots(objs: ObjectInstance[]): Slot[] {
  const out: Slot[] = [];
  for (const o of objs) {
    const spots = TYPES[o.type]?.spots;
    if (!spots) continue;
    for (const [name, s] of Object.entries(spots)) {
      out.push({
        id: `${o.id}:${name}`,
        level: o.level,
        tag: s.tag,
        stand: xf(o, s.stand[0], s.stand[1]),
        pos: s.pos ? [...xf(o, s.pos[0], s.pos[1]), s.pos[2]] : null,
        dir: s.dir ? xdir(o.rot, s.dir[0], s.dir[1]) : null,
        lie: s.lie ? xdir(o.rot, s.lie[0], s.lie[1]) : null,
      });
    }
  }
  return out;
}

export function buildWorld(objs: ObjectInstance[]): HouseWorld {
  const grids = LEVELS.map((lv, level) => {
    const blocks: Block[] = lv.walls.map((w) =>
      w.x !== undefined
        ? { x0: w.x - WALL_HALF, y0: w.a, x1: w.x + WALL_HALF, y1: w.b }
        : { x0: w.a, y0: w.y! - WALL_HALF, x1: w.b, y1: w.y! + WALL_HALF },
    );
    for (const o of objs) {
      const t = TYPES[o.type];
      if (o.level !== level || !t || isRug(o.type) || isWall(o.type)) continue;
      const rects = blocksOf(o.type).length ? blocksOf(o.type) : [[0, 0, t.W, t.D] as [number, number, number, number]];
      for (const r of rects) {
        const a = xf(o, r[0], r[1]);
        const b = xf(o, r[2], r[3]);
        blocks.push({ x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) });
      }
    }
    return buildGrid(blocks, WX, WY);
  });
  return { slots: buildSlots(objs), grids };
}

export function createAgent(id: AgentId, name: string, needs: Partial<CharacterNeeds> | undefined, look: AgentLook): Agent {
  const [ax, ay] = LEVELS[1].anchor;
  const base: CharacterNeeds = { energy: 80, food: 70, hygiene: 75, fun: 60, comfort: 70, social: 65 };
  for (const k of NEED_KEYS) {
    const v = needs?.[k];
    if (typeof v === 'number' && isFinite(v)) base[k] = Math.max(0, Math.min(100, v));
  }
  return {
    id, name, level: 1, x: ax + (id === 'maya' ? 0.6 : 0), y: ay, z: 0,
    face: [0, 1], needs: base, task: null, idle: id === 'maya' ? 1.2 : 0.4,
    onStairs: false, lastChain: null, look,
  };
}

function freeSlot(world: HouseWorld, ch: Agent, act: string, taken: Set<string>): Slot | null | undefined {
  const tags = tagsFor(act, ch.id);
  if (!tags.length) return undefined;
  const lvReq = ACTIVITIES[act]?.level;
  for (const tag of tags) {
    let best: Slot | null = null;
    let bd = Infinity;
    for (const s of world.slots) {
      if (s.tag !== tag || taken.has(s.id) || (lvReq !== undefined && s.level !== lvReq)) continue;
      const d = Math.hypot(s.stand[0] - ch.x, s.stand[1] - ch.y) + Math.abs(s.level - ch.level) * 6;
      if (d < bd) { bd = d; best = s; }
    }
    if (best) return best;
  }
  return null;
}

function chainAvailable(world: HouseWorld, ch: Agent, chain: string, taken: Set<string>): boolean {
  return chainOf(chain).every((act) => freeSlot(world, ch, act, taken) !== null);
}

function chainScore(ch: Agent, chain: string, hourF: number): number {
  const night = hourF >= 22.5 || hourF < 6;
  if (chain === 'sleep') return night && ch.needs.energy < 90 ? 200 : ch.needs.energy < 15 ? 120 : -1;
  if (night) return -1;
  if (chain === 'nap' && ch.needs.energy > 40) return -1;
  const gain = ACTIVITIES[GAIN_OF[chain] ?? chain];
  if (!gain?.gives) return -1;
  let s = 0;
  for (const [k, g] of Object.entries(gain.gives) as [NeedKey, number][]) s += weight(ch.needs[k]) * g;
  return ch.lastChain === chain ? s * 0.4 : s;
}

function takenBy(other: Agent | null): Set<string> {
  return new Set(other?.task?.slot ? [other.task.slot.id] : []);
}

export function chooseChain(world: HouseWorld, ch: Agent, other: Agent | null, hourF: number, rng: () => number): string | null {
  const taken = takenBy(other);
  let best: string | null = null;
  let bs = 2.5;
  for (const c of CHOICES) {
    const sc = chainScore(ch, c, hourF);
    if (sc < 0) continue;
    const noisy = sc + rng() * 4;
    if (noisy > bs && chainAvailable(world, ch, c, taken)) { bs = noisy; best = c; }
  }
  return best;
}

function routeTo(world: HouseWorld, ch: Agent, level: number, x: number, y: number): RouteLeg[] {
  return planRoute(ch, level, x, y, (l) => world.grids[l], STAIRS, WX, WY);
}

function startAct(world: HouseWorld, ch: Agent, act: string, next: string[], other: Agent | null, rng: () => number): boolean {
  const slot = freeSlot(world, ch, act, takenBy(other));
  if (slot === null) return false;
  const meta = ACTIVITIES[act];
  let goal: [number, number, number];
  if (slot) goal = [slot.level, slot.stand[0], slot.stand[1]];
  else {
    const [gx, gy] = randomFree(world.grids[ch.level], rng, LEVELS[ch.level].anchor);
    goal = [ch.level, gx, gy];
  }
  ch.task = { act, slot: slot ?? null, phase: 'walk', route: routeTo(world, ch, ...goal), time: 0, dur: meta?.dur ?? 8, next };
  return true;
}

export function startChain(world: HouseWorld, ch: Agent, chain: string, other: Agent | null, rng: () => number): boolean {
  const [first, ...rest] = chainOf(chain);
  if (!startAct(world, ch, first, rest, other, rng)) return false;
  ch.lastChain = chain;
  return true;
}

/** Walks the current route; returns true once the destination is reached. */
function moveAlong(ch: Agent, dt: number, mul: number): boolean {
  const route = ch.task!.route;
  let budget = WALK_SPEED * dt * mul;
  while (route.length) {
    const leg = route[0];
    if (leg.type === 'stair') {
      ch.onStairs = true;
      leg.t += dt * mul * STAIR_SPEED;
      if (leg.t < 1) return false;
      ch.level = leg.up ? leg.st.upper : leg.st.lower;
      [ch.x, ch.y] = leg.up ? leg.st.upperNode : leg.st.lowerNode;
      ch.onStairs = false;
      route.shift();
      return false;
    }
    if (!leg.pts.length) { route.shift(); continue; }
    const [tx, ty] = leg.pts[0];
    const dx = tx - ch.x;
    const dy = ty - ch.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-4) ch.face = [dx / d, dy / d];
    if (d <= budget) {
      ch.x = tx; ch.y = ty; budget -= d;
      leg.pts.shift();
      continue;
    }
    ch.x += (dx / d) * budget;
    ch.y += (dy / d) * budget;
    return false;
  }
  return true;
}

function arrive(ch: Agent): void {
  const t = ch.task!;
  t.phase = 'do';
  t.time = 0;
  const s = t.slot;
  if (s?.pos) { [ch.x, ch.y, ch.z] = s.pos; ch.level = s.level; }
  if (s?.lie) ch.face = s.lie;
  else if (s?.dir) ch.face = s.dir;
}

function finish(world: HouseWorld, ch: Agent, other: Agent | null, rng: () => number): void {
  const t = ch.task!;
  if (t.slot?.pos) { [ch.x, ch.y] = t.slot.stand; ch.z = 0; }
  ch.task = null;
  while (t.next.length) {
    if (startAct(world, ch, t.next.shift()!, t.next, other, rng)) return;
  }
  ch.idle = 1.5 + rng() * 2.5;
}

export function isAsleep(ch: Agent): boolean {
  return !!ch.task && ch.task.phase === 'do' && (ch.task.act === 'sleep' || ch.task.act === 'nap');
}

export function poseOf(ch: Agent): string {
  const t = ch.task;
  return t && t.phase === 'do' ? ACTIVITIES[t.act]?.pose ?? 'stand' : 'stand';
}

export function isWalking(ch: Agent): boolean {
  return !!ch.task && ch.task.phase === 'walk' && !ch.onStairs;
}

export function statusText(ch: Agent): string {
  const t = ch.task;
  if (!t) return 'Taking a breather';
  const verb = ACTIVITIES[t.act]?.verb ?? 'Busy';
  if (ch.onStairs) return 'Taking the stairs';
  return t.phase === 'walk' ? `Heading off: ${verb.toLowerCase()}` : verb;
}

export function tickAgent(
  world: HouseWorld, ch: Agent, other: Agent | null,
  dt: number, gameMin: number, walkMul: number, hourF: number, rng: () => number,
  household?: HouseholdState,
): void {
  const t = ch.task;
  const doingAct = t && t.phase === 'do' ? ACTIVITIES[t.act] : null;
  ch.needs = tickNeeds(ch.needs, {
    away: false, asleep: isAsleep(ch), fitness: 0, starving: ch.needs.food < 15, messLevel: 0, hasBed: true,
    activity: doingAct ? { gives: doingAct.gives, rate: doingAct.rate, dur: doingAct.dur } : null,
    activityName: t?.act ?? null, foodScale: 1, coffeeBoost: 1, hasBigTv: false, hasBookshelf: false, hasRecords: false,
  }, gameMin).needs;

  if (!t) {
    ch.idle -= dt * walkMul;
    if (ch.idle > 0) return;
    const chain = chooseChain(world, ch, other, hourF, rng);
    if (!chain || !startChain(world, ch, chain, other, rng)) startAct(world, ch, 'wander', [], other, rng);
    return;
  }
  if (t.phase === 'walk') {
    if (moveAlong(ch, dt, walkMul)) arrive(ch);
    return;
  }
  t.time += gameMin;
  if (household && t.act === 'eat' && t.time >= 0.1 && t.time < gameMin + 0.1) consumeMeal(household);
  if (household && t.act === 'wash' && t.time >= 0.1 && t.time < gameMin + 0.1) washDishes(household, 99);
  if (household && t.act === 'scrub' && t.slot == null && t.time >= 0.1) { const d = worstDirt(household); if (d) scrubDirt(household, d); }
  const done = t.act === 'sleep'
    ? ch.needs.energy >= 99 || (hourF >= 6.5 && hourF < 22 && ch.needs.energy >= 85)
    : t.time >= t.dur;
  if (done) finish(world, ch, other, rng);
}
