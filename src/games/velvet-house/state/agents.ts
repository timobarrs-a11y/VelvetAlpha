import type { Garment } from './garment';
import type { HeadImages } from './headSprites';
import type { BodyImages } from './bodySprites';
import { TYPES, blocksOf, isRug, isWall, type ObjectInstance } from './objects';
import { ACTIVITIES, GAIN_OF, chainOf } from './activities';
import { NEED_KEYS, tickNeeds, weight, type NeedKey } from './needs';
import { buildGrid, planRoute, randomFree, type Block, type Grid, type RouteLeg } from './pathfinding';
import { LEVELS, STAIRS, WX, WY } from './house';
import type { CharacterNeeds } from './types';
import type { HouseholdState } from './household';
import { consumeMeal, washDishes, scrubDirt, worstDirt } from './household';

/** 'jordan' and 'maya' live in the house; any other id is a visitor a script brings in (Dez, the movers). */
export type AgentId = string;

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
  topStyle: string;
  bottom: string;
  longHair: boolean;
  // Second colour for tops that have one: the tie, the shirt under a coat, a vest.
  accent?: string;
  // The cut of the pants ('jeans', 'cheer_skirt', ...) and their trim; plain pants when unset.
  bottomStyle?: string;
  bottomAccent?: string;
  // A designed garment worn on the body or legs (state/garment.ts); it is drawn over `top` and `bottom`, which hold its base colour.
  topGarment?: Garment;
  bottomGarment?: Garment;
  // The person's real avatar head, when the host sent one. Never saved.
  heads?: HeadImages;
  // The person's real avatar hands, when the host sent them. Never saved.
  body?: BodyImages;
}

export interface Agent {
  id: AgentId;
  /** 'npc': a visitor a script spawned. Needs don't tick and free will never picks their next move. */
  kind?: 'household' | 'npc';
  /** True while a script owns them: free will and idle picking are skipped, and they keep moving while the clock is paused. */
  scripted?: boolean;
  /** What they carry in their arms (a prop the art draws): 'pbox', 'groceries', 'parcel'. */
  carrying?: string;
  /** A line shown over their head for a moment (a bark), with the time it was said. */
  bubble?: { text: string; at: number };
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  face: [number, number];
  /** True while turning on the spot before walking off. */
  turning?: boolean;
  needs: CharacterNeeds;
  task: AgentTask | null;
  idle: number;
  onStairs: boolean;
  lastChain: string | null;
  // The last few things they did, newest first: they avoid repeating them.
  recent?: string[];
  look: AgentLook;
  // Out of the house (at work): hidden, and only their needs change.
  away?: 'work' | null;
}

/** When someone sleeps on their own: night starts at `nightStart` and they get up after `wakeAt`. */
export interface SleepTimes {
  nightStart: number;
  wakeAt: number;
}

const DEFAULT_SLEEP: SleepTimes = { nightStart: 22.5, wakeAt: 6 };

export interface HouseWorld {
  slots: Slot[];
  grids: Grid[];
}

const WALK_SPEED = 1.5;
const STAIR_SPEED = 0.6;
// Turning: how fast they swing round (radians per second). Someone more than TURN_STOP off the
// way they're heading stops and turns on the spot, and starts walking again once within TURN_GO.
const TURN_RATE = 9;
const TURN_STOP = 0.9;
const TURN_GO = 0.25;

/** Rotates a facing toward a wanted direction by at most `step` radians; `left` is what remains. */
export function turnToward(face: [number, number], want: [number, number], step: number): { face: [number, number]; left: number } {
  const a = Math.atan2(face[1], face[0]);
  let d = Math.atan2(want[1], want[0]) - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) <= step) return { face: [want[0], want[1]], left: 0 };
  const n = a + Math.sign(d) * step;
  return { face: [Math.cos(n), Math.sin(n)], left: Math.abs(d) - step };
}
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
  // Everyday life (see activities.ts); `open` ones need no object.
  newspaper: ['seat'], snack: ['fridge'], wipeCounter: ['sink'], journal: ['desk'], freelance: ['desk'],
  mirror: ['mirror'], foldClothes: ['dresser'], makeBed: ['makebed'], laundry: ['washer'],
  rummage: ['rummage'], tend: ['garden'],
  // Side jobs (sideJobs.ts): never chosen on their own, only when the player says.
  sideDesk: ['desk'], sideBake: ['stove'],
};

const CHOICES = [
  'sleep', 'nap', 'cookeat', 'coffee', 'shower', 'bath', 'read', 'phone', 'tv',
  'workout', 'stretch', 'records', 'arcade', 'plants', 'piano', 'easel', 'aquarium',
  'guitar', 'massage', 'hammock', 'jukebox', 'bike', 'boxing', 'stargaze', 'fire', 'swim',
  // Everyday life on every floor, chosen even when nothing is urgent.
  'newspaper', 'tend', 'rakeYard', 'yardWorkout', 'phonePace',
  'window', 'snack', 'wipeCounter', 'soloDance',
  'journal', 'freelance', 'mirror', 'foldClothes', 'makeBed', 'meditate',
  'laundry', 'rummage', 'lift', 'jumprope', 'shadowbox',
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

/** A visitor: spawned by a script, no needs, drawn like anyone else. */
export function createNpc(id: string, name: string, look: AgentLook, at: { level: number; x: number; y: number }): Agent {
  return {
    id, kind: 'npc', scripted: true, name, level: at.level, x: at.x, y: at.y, z: 0, face: [0, 1],
    needs: { energy: 100, food: 100, hygiene: 100, fun: 100, comfort: 100, social: 100 },
    task: null, idle: 0, onStairs: false, lastChain: null, look,
  };
}

/**
 * Walks to a place with nothing to do at the end (scripts, a visitor arriving). The walk is a task like any other, so
 * stairs, doors and turning on the spot all work; it is finished when `ch.task` is null again.
 */
export function startGoto(world: HouseWorld, ch: Agent, to: { level: number; x: number; y: number }): boolean {
  const route = routeTo(world, ch, to.level, to.x, to.y);
  ch.task = { act: 'goto', slot: null, phase: 'walk', route, time: 0, dur: 0, next: [] };
  return true;
}

/** Puts someone at a spot at once (setting a scene up). */
export function placeAgent(ch: Agent, at: { level: number; x: number; y: number }, face?: [number, number]): void {
  ch.level = at.level; ch.x = at.x; ch.y = at.y; ch.z = 0; ch.onStairs = false; ch.task = null; ch.turning = false;
  if (face) ch.face = face;
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

function chainScore(ch: Agent, chain: string, hourF: number, sleep: SleepTimes = DEFAULT_SLEEP): number {
  const night = sleep.nightStart < sleep.wakeAt
    ? hourF >= sleep.nightStart && hourF < sleep.wakeAt
    : hourF >= sleep.nightStart || hourF < sleep.wakeAt;
  if (chain === 'sleep') return night && ch.needs.energy < 90 ? 200 : ch.needs.energy < 15 ? 120 : -1;
  if (night) return -1;
  if (chain === 'nap' && ch.needs.energy > 40) return -1;
  const gain = ACTIVITIES[GAIN_OF[chain] ?? chain];
  if (!gain?.gives) return -1;
  // What it does for their needs, plus how much they simply like doing it.
  let s = gain.appeal ?? 0;
  for (const [k, g] of Object.entries(gain.gives) as [NeedKey, number][]) s += weight(ch.needs[k]) * g;
  return ch.lastChain === chain ? s * 0.4 : s;
}

function takenBy(other: Agent | null): Set<string> {
  return new Set(other?.task?.slot ? [other.task.slot.id] : []);
}

// A need this pressing is handled first, whatever else is on offer.
const URGENT = 20;
// How many recent activities someone remembers, and avoids repeating.
const RECENT = 4;

export function chooseChain(world: HouseWorld, ch: Agent, other: Agent | null, hourF: number, rng: () => number, sleep?: SleepTimes): string | null {
  const taken = takenBy(other);
  const options: Array<{ chain: string; score: number }> = [];
  for (const c of CHOICES) {
    let sc = chainScore(ch, c, hourF, sleep);
    if (sc < 0) continue;
    // Something they did a moment ago is less tempting.
    if (ch.recent?.includes(c)) sc *= 0.35;
    const noisy = sc + rng() * 2;
    if (noisy > 2.5 && chainAvailable(world, ch, c, taken)) options.push({ chain: c, score: noisy });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  // Hungry, filthy or exhausted: deal with it. Otherwise, like a Sim, pick
  // among the good options, the better ones more often, so a content day is
  // full of different things instead of the same favourite on repeat.
  if (options[0].score >= URGENT) return options[0].chain;
  const pool = options.slice(0, 8);
  const total = pool.reduce((s, o) => s + o.score * o.score, 0);
  let r = rng() * total;
  for (const o of pool) { r -= o.score * o.score; if (r <= 0) return o.chain; }
  return pool[0].chain;
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
  else if (meta?.open && meta.level !== undefined) {
    // Anywhere free on its floor: the yard, the living room, the basement.
    const [gx, gy] = randomFree(world.grids[meta.level], rng, LEVELS[meta.level].anchor);
    goal = [meta.level, gx, gy];
  } else {
    const [gx, gy] = randomFree(world.grids[ch.level], rng, LEVELS[ch.level].anchor);
    goal = [ch.level, gx, gy];
  }
  ch.task = { act, slot: slot ?? null, phase: 'walk', route: routeTo(world, ch, ...goal), time: 0, dur: meta?.dur ?? 8, next };
  return true;
}

/** Several activities in a row, e.g. the morning routine. Skips any that can't be done. */
export function startSequence(world: HouseWorld, ch: Agent, acts: string[], other: Agent | null, rng: () => number): boolean {
  const queue = [...acts];
  while (queue.length) {
    if (startAct(world, ch, queue.shift()!, queue, other, rng)) return true;
  }
  return false;
}

export function startChain(world: HouseWorld, ch: Agent, chain: string, other: Agent | null, rng: () => number): boolean {
  const [first, ...rest] = chainOf(chain);
  if (!startAct(world, ch, first, rest, other, rng)) return false;
  ch.lastChain = chain;
  ch.recent = [chain, ...(ch.recent ?? []).filter(c => c !== chain)].slice(0, RECENT);
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
    if (d > 1e-4) {
      // Swing round toward the way they're going; if it's well off, turn on the spot first.
      const want: [number, number] = [dx / d, dy / d];
      const off = Math.abs(Math.atan2(ch.face[0] * want[1] - ch.face[1] * want[0], ch.face[0] * want[0] + ch.face[1] * want[1]));
      ch.turning = off > (ch.turning ? TURN_GO : TURN_STOP);
      ch.face = turnToward(ch.face, want, TURN_RATE * dt * mul).face;
      if (ch.turning) return false;
    }
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
  ch.turning = false;
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
  ch.turning = false;
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
  return !!ch.task && ch.task.phase === 'walk' && !ch.onStairs && !ch.turning;
}

export function statusText(ch: Agent): string {
  if (ch.away === 'work') return 'At work';
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
  sleep: SleepTimes = DEFAULT_SLEEP,
): void {
  if (ch.away) {
    ch.needs = tickNeeds(ch.needs, {
      away: true, asleep: false, fitness: 0, starving: ch.needs.food < 15, messLevel: 0, hasBed: true,
      activity: null, activityName: null, foodScale: 1, coffeeBoost: 1, hasBigTv: false, hasBookshelf: false, hasRecords: false,
    }, gameMin).needs;
    return;
  }
  const t = ch.task;
  const doingAct = t && t.phase === 'do' ? ACTIVITIES[t.act] : null;
  if (ch.kind !== 'npc') ch.needs = tickNeeds(ch.needs, {
    away: false, asleep: isAsleep(ch), fitness: 0, starving: ch.needs.food < 15, messLevel: 0, hasBed: true,
    activity: doingAct ? { gives: doingAct.gives, rate: doingAct.rate, dur: doingAct.dur } : null,
    activityName: t?.act ?? null, foodScale: 1, coffeeBoost: 1, hasBigTv: false, hasBookshelf: false, hasRecords: false,
  }, gameMin).needs;

  if (!t) {
    // Someone a script is directing waits for the next instruction instead of choosing something to do.
    if (ch.scripted) return;
    ch.idle -= dt * walkMul;
    if (ch.idle > 0) return;
    const chain = chooseChain(world, ch, other, hourF, rng, sleep);
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
    ? ch.needs.energy >= 99 || (hourF >= sleep.wakeAt + 0.5 && hourF < 22 && ch.needs.energy >= 85)
    : t.time >= t.dur;
  if (done) finish(world, ch, other, rng);
}
