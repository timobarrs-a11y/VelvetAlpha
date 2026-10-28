/**
 * Pets: a cat or a dog that lives in the house. This file is the model and the decisions, pure and testable;
 * systems/pets.ts moves them through the house, and art/houseArt.js draws them.
 */
export type PetKind = 'cat' | 'dog';
export type PetState = 'idle' | 'walk' | 'sleep' | 'eat' | 'sit' | 'beg' | 'door' | 'potty' | 'litter' | 'groom' | 'wait' | 'happy';
export type PetPose = 'stand' | 'walk' | 'run' | 'sit' | 'sleep' | 'eat' | 'crouch' | 'groom' | 'play' | 'happy';
export type PetWant = 'feed' | 'play' | 'love' | null;

export interface PetNeeds {
  food: number;
  play: number;
  love: number;
  bladder?: number;
}

export interface Pet {
  id: string;
  kind: PetKind;
  coat: PetCoat;
  furRGB: string;
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  alpha: number;
  /** Which way they face in the world; the art works out front/back and left/right from the camera. */
  face?: [number, number];
  front: boolean;
  flip: number;
  route: unknown[];
  state: PetState;
  pose: PetPose;
  /** Game minutes left in the current state. */
  timer: number;
  seed: number;
  needs: PetNeeds;
  bowlFood: number;
  litterUses: number;
  litterT: number;
  /** Seconds of hearts still floating over them. */
  hearts: number;
  away: { until: number } | null;
  /** The id of the person holding them (petting, playing, walking), or null. */
  hold: unknown | null;
  cameIn: number;
  spd: number;
  want: PetWant;
  /** The id of the person they went to sit with. */
  who: unknown | null;
  next: { state: PetState; dur: number; who: unknown } | null;
  offBed?: number[];
  doorLogged?: boolean;
  followT?: number;
  /** Their things, by object id. */
  bowl?: unknown;
  bed?: unknown;
  litter?: unknown;
  /** Set while a person holding them has reached the doing part of their act, so the reward lands once. */
  heldDid?: string | null;
}

export interface PetCoat {
  n: string;
  c: string;
  d: string;
  rgb: string;
}

export const PET_COATS: Record<PetKind, PetCoat[]> = {
  cat: [
    { n: 'orange tabby', c: '#D9822B', d: '#B5651D', rgb: '217,130,43' },
    { n: 'gray', c: '#8E8A90', d: '#6E6A70', rgb: '142,138,144' },
    { n: 'black', c: '#2F2C34', d: '#1E1C22', rgb: '60,56,64' },
    { n: 'cream', c: '#EFE3CF', d: '#CDBFA8', rgb: '220,210,190' },
  ],
  dog: [
    { n: 'golden', c: '#D2A86E', d: '#A87E48', rgb: '201,162,107' },
    { n: 'chocolate', c: '#6B4A35', d: '#4F3524', rgb: '107,74,53' },
    { n: 'black and white', c: '#2F2C34', d: '#F2EEE8', rgb: '60,56,64' },
    { n: 'corgi', c: '#D98B4A', d: '#F2EEE8', rgb: '217,139,74' },
  ],
};

export const PET_NAMES: Record<PetKind, string[]> = {
  cat: ['Biscuit', 'Mochi', 'Pepper', 'Juniper', 'Nori'],
  dog: ['Waffles', 'Bruno', 'Cocoa', 'Rocket', 'Pudding'],
};

/** What a pet does to let you know, in the log. */
export const PET_BEG: Record<PetKind, Record<'feed' | 'play' | 'love', string[]>> = {
  cat: {
    feed: ['{n} is yelling at the empty bowl.', '{n} is weaving between ankles. Food, please.'],
    play: ['{n} knocked a pen off the counter. Bored.', '{n} is staring at the feather toy.'],
    love: ['{n} headbutted a shin. Pet me.'],
  },
  dog: {
    feed: ['{n} is sitting next to the bowl with huge eyes.', '{n} nosed the empty bowl across the floor.'],
    play: ['{n} dropped a slobbery ball at your feet.', '{n} is doing play bows.'],
    love: ['{n} put a head on your knee and sighed.'],
  },
};

export const PET_STATE_POSE: Record<string, PetPose> = {
  potty: 'crouch',
  eat: 'eat',
  sleep: 'sleep',
  litter: 'crouch',
  door: 'sit',
  beg: 'sit',
  sit: 'sit',
  idle: 'stand',
  groom: 'groom',
  wait: 'sit',
  happy: 'happy',
};

export const PET_DECAY: Record<PetKind, PetNeeds> = {
  dog: { food: 5, play: 5.5, love: 3.5, bladder: 7 },
  cat: { food: 4, play: 4, love: 3 },
};

/** The litter box: a cat goes after this many game minutes, and stops using it after this many uses. */
export const LITTER = { every: 280, tooDirty: 5, scoopAt: 3 };

export function petMood(p: Pet): 'happy' | 'okay' | 'needy' | 'miserable' {
  const vals = Object.values(p.needs);
  const v = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (v > 70) return 'happy';
  if (v > 45) return 'okay';
  if (v > 25) return 'needy';
  return 'miserable';
}

export function petFree(p: Pet): boolean {
  return !p.away && !p.hold && !(p.route[0] && (p.route[0] as { type?: string }).type === 'stair');
}

export function petWantsNow(p: Pet): boolean {
  if (p.want === 'feed') return p.needs.food < 50 && !(p.bowlFood > 0);
  if (p.want === 'play') return p.needs.play < 55;
  if (p.want === 'love') return p.needs.love < 55;
  return false;
}

export function petDecayNeeds(p: Pet, gm: number): void {
  const D = PET_DECAY[p.kind];
  const slow = p.away ? 0.4 : p.state === 'sleep' ? 0.35 : 1;
  for (const k in p.needs) {
    const key = k as keyof PetNeeds;
    const d = D[key] || 0;
    const mul = key === 'bladder' ? (p.away ? 0 : 1) : slow;
    p.needs[key] = Math.max(0, Math.min(100, p.needs[key]! - d * mul * gm / 60)) as number;
  }
}

/** What finishing the current state does: a meal eaten, the litter box used, a bladder emptied. */
export function petEnd(p: Pet): void {
  if (p.state === 'eat') {
    const take = Math.min(p.bowlFood || 0, 1);
    p.bowlFood = (p.bowlFood || 0) - take;
    if (take) p.needs.food = Math.min(100, p.needs.food + 60);
  }
  if (p.state === 'litter') {
    p.litterUses = (p.litterUses || 0) + 1;
    p.litterT = 0;
  }
  if (p.state === 'potty') {
    p.needs.bladder = 100;
    p.doorLogged = false;
  }
  if (p.z > 0) {
    if (p.offBed) [p.x, p.y] = p.offBed;
    p.z = 0;
  }
  p.state = 'idle';
  p.pose = 'stand';
  p.timer = 0;
  p.want = null;
}

export function petPick(pets: Pet[], kind: 'play' | 'love'): Pet | null {
  const free = pets.filter(petFree);
  if (!free.length) return null;
  free.sort((a, b) => a.needs[kind] - b.needs[kind]);
  return free[0];
}

export function weight(v: number): number {
  return Math.max(0, 1 - v / 100);
}

export function petScoreForActivity(
  pets: Pet[],
  petFood: number,
  n: string,
  isMaya: boolean,
  hour: number
): number {
  const home = pets.filter(p => !p.away);
  const mul = isMaya ? 1.25 : 1;
  if (!home.length) return -1;

  if (n === 'feedPet') {
    const p = home.find(q => q.needs.food < 50 && !(q.bowlFood > 0));
    return p && petFood > 0 ? (0.25 + weight(p.needs.food) * 0.5) * mul : -1;
  }
  if (n === 'scoop') {
    const p = home.find(q => q.kind === 'cat');
    return p && p.litterUses >= LITTER.scoopAt ? 0.05 * p.litterUses * mul : -1;
  }
  if (n === 'walkDog') {
    const p = home.find(q => q.kind === 'dog');
    return p && petFree(p) && (p.needs.bladder! < 45 || p.needs.play < 45) && hour >= 6 && hour < 22.5
      ? (0.12 + weight(p.needs.bladder || 50) * 0.6 + weight(p.needs.play) * 0.25) * mul
      : -1;
  }
  const p = petPick(pets, n === 'playPet' ? 'play' : 'love');
  if (!p) return -1;
  return (n === 'playPet'
    ? 0.05 + weight(p.needs.play) * 0.4
    : 0.08 + weight(p.needs.love) * 0.45
  ) * (isMaya ? 1.15 : 1) * mul;
}

export function petActivityLabel(p: Pet, hour: number): string {
  if (p.away) return `back around ${clockText(p.away.until % 1440)}`;
  if (p.hold) {
    const h = p.hold as { task?: { name?: string; phase?: string }, away?: unknown };
    if (h.task && h.task.name === 'errand') return 'Going for a walk';
    if (h.task && h.task.phase === 'do') return h.task.name === 'playPet' ? 'Playing' : 'Getting pets';
    return 'Waiting';
  }
  return stateLabel(p, hour);
}

/** The label when a person holds them: what that person is doing with them. */
export function petStatusText(p: Pet, hour: number, holder: { name: string; act: string | null; phase: string | null } | null): string {
  if (p.away) return `Back around ${clockText(p.away.until % 1440)}`;
  if (p.hold && holder) {
    if (holder.act === 'walkDog') return holder.phase === 'do' ? `Out in the yard with ${holder.name}` : `Going for a walk with ${holder.name}`;
    if (holder.phase === 'do') return holder.act === 'playPet' ? `Playing with ${holder.name}` : `Getting pets from ${holder.name}`;
    return `Waiting for ${holder.name}`;
  }
  return stateLabel(p, hour);
}

function stateLabel(p: Pet, hour: number): string {
  if (p.state === 'walk') {
    if (p.next?.state === 'door') return 'Heading to the door';
    if (p.next?.state === 'eat') return 'Heading to the bowl';
    if (p.next?.state === 'sleep') return 'Off to bed';
    return 'Trotting around';
  }
  if (p.state === 'beg') return ({ feed: 'Begging for food', play: 'Wants to play', love: 'Wants attention' } as Record<string, string>)[p.want || ''] || 'Hanging out';
  const night = hour >= 23 || hour < 6.5;
  const labels: Record<string, string> = {
    potty: 'Doing their business', sleep: night ? 'Asleep' : 'Napping', eat: 'Eating', door: 'Waiting to go out',
    litter: 'In the litter box', groom: 'Grooming', sit: p.who ? 'Hanging out' : 'Sitting', idle: 'Chilling', wait: 'Waiting', happy: 'Happy',
  };
  return labels[p.state] || 'Chilling';
}

function clockText(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.floor(mins % 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---- Making one, and keeping one ----

export function pickCoat(kind: PetKind, prefer: string | undefined, rng: () => number): PetCoat {
  const coats = PET_COATS[kind];
  return coats.find(c => c.n === prefer) ?? coats[Math.floor(rng() * coats.length) % coats.length];
}

export function pickName(kind: PetKind, taken: string[], rng: () => number): string {
  const free = PET_NAMES[kind].filter(n => !taken.includes(n));
  const pool = free.length ? free : PET_NAMES[kind];
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

export function createPet(id: string, kind: PetKind, coat: PetCoat, name: string, at: { level: number; x: number; y: number }, seed: number): Pet {
  return {
    id, kind, coat, furRGB: coat.rgb, name, level: at.level, x: at.x, y: at.y, z: 0, alpha: 1, face: [0, 1], front: true, flip: 1,
    route: [], state: 'idle', pose: 'stand', timer: 2, seed,
    needs: kind === 'dog' ? { food: 75, play: 55, love: 50, bladder: 85 } : { food: 75, play: 60, love: 50 },
    bowlFood: 2, litterUses: 0, litterT: 0, hearts: 3, away: null, hold: null, cameIn: 0, spd: 1, want: null, who: null, next: null,
    bowl: null, bed: null, litter: null,
  };
}

/** What goes in the save: who they are and how they are, not where they were walking to. */
export function serializePet(p: Pet): Record<string, unknown> {
  return {
    id: p.id, kind: p.kind, name: p.name, coat: p.coat, level: p.level, x: p.x, y: p.y, needs: { ...p.needs },
    bowlFood: p.bowlFood, litterUses: p.litterUses, litterT: p.litterT, seed: p.seed,
    bowl: typeof p.bowl === 'string' ? p.bowl : null, bed: typeof p.bed === 'string' ? p.bed : null, litter: typeof p.litter === 'string' ? p.litter : null,
  };
}

/** A pet from a save (this game's or the old game's); null when it is not one. */
export function revivePet(raw: unknown): Pet | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const kind: PetKind = r.kind === 'dog' ? 'dog' : 'cat';
  if (typeof r.id !== 'string') return null;
  const rc = r.coat as Partial<PetCoat> | undefined;
  const coat = (rc && typeof rc.c === 'string' && typeof rc.d === 'string')
    ? { n: typeof rc.n === 'string' ? rc.n : 'mixed', c: rc.c, d: rc.d, rgb: typeof rc.rgb === 'string' ? rc.rgb : '160,140,120' }
    : PET_COATS[kind][0];
  const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  const needsIn = (r.needs && typeof r.needs === 'object' ? r.needs : {}) as Record<string, unknown>;
  const needs: PetNeeds = { food: num(needsIn.food, 70), play: num(needsIn.play, 60), love: num(needsIn.love, 50) };
  if (kind === 'dog') needs.bladder = num(needsIn.bladder, 80);
  const p = createPet(r.id, kind, coat, typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 14) : PET_NAMES[kind][0],
    { level: Math.max(0, Math.floor(num(r.level, 1))), x: num(r.x, 1.5), y: num(r.y, 5) }, num(r.seed, 0));
  p.needs = needs;
  p.bowlFood = num(r.bowlFood, 0); p.litterUses = num(r.litterUses, 0); p.litterT = num(r.litterT, 0); p.hearts = 0; p.timer = 1;
  p.bowl = typeof r.bowl === 'string' ? r.bowl : null; p.bed = typeof r.bed === 'string' ? r.bed : null; p.litter = typeof r.litter === 'string' ? r.litter : null;
  return p;
}

// ---- Deciding what to do next ----

/** What a pet knows about the house when it decides. */
export interface PetWorld {
  hour: number;
  people: Array<{ id: string; level: number; x: number; y: number; asleep: boolean; away: boolean }>;
  /** One of the pet's own things, by object id: its floor and a point in its local frame (null when it is gone). */
  thing: (id: unknown) => { level: number; at: (lx: number, ly: number) => [number, number] } | null;
  randomFree: (level: number) => [number, number];
  spotNear: (who: { level: number; x: number; y: number }, p: Pet) => [number, number];
  /** The front door, on the main floor. */
  door: [number, number];
  mainFloor: number;
  /** The yard's level, or null when the house has none. */
  yard: number | null;
  /** The indoor floors a pet wanders between. */
  floors: number[];
  rng: () => number;
}

export type PetAction =
  | { kind: 'go'; level: number; x: number; y: number; state: PetState; dur: number; who?: string | null; spd?: number; want?: PetWant }
  | { kind: 'stay'; state: PetState; dur: number }
  | { kind: 'accident'; level: number; x: number; y: number };

const inWindow = (h: number, a: number, b: number) => (a < b ? h >= a && h < b : h >= a || h < b);

/**
 * What to do next, in the order a pet cares: the litter box or an accident, the bowl when hungry and there is food,
 * the yard or the door for a dog that needs to go, bed at night or when the house is quiet, then company (begging
 * when something is wanted), a run for a dog, grooming for a cat, and otherwise a wander.
 */
export function petDecide(p: Pet, w: PetWorld): PetAction {
  const night = inWindow(w.hour, 23, 6.5);
  const people = w.people.filter(c => !c.away && !c.asleep);
  const r = w.rng;
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length) % a.length];
  p.want = null;
  const litter = p.kind === 'cat' ? w.thing(p.litter) : null;
  if (litter && p.litterT > LITTER.every) {
    if ((p.litterUses || 0) >= LITTER.tooDirty) {
      p.litterT = 0;
      const [lx, ly] = litter.at(0.35, 1.0);
      return { kind: 'accident', level: litter.level, x: lx, y: ly };
    }
    const [sx, sy] = litter.at(0.35, 0.85);
    return { kind: 'go', level: litter.level, x: sx, y: sy, state: 'litter', dur: 4 };
  }
  const bowl = w.thing(p.bowl);
  if (p.needs.food < 50 && p.bowlFood > 0 && bowl) {
    const [sx, sy] = bowl.at(0.3, 0.68);
    return { kind: 'go', level: bowl.level, x: sx, y: sy, state: 'eat', dur: 6 };
  }
  if (p.kind === 'dog' && (p.needs.bladder ?? 100) < 35 && !night && w.yard !== null) {
    const [x, y] = w.randomFree(w.yard);
    return { kind: 'go', level: w.yard, x, y, state: 'potty', dur: 3 };
  }
  if (p.kind === 'dog' && (p.needs.bladder ?? 100) < 30) return { kind: 'go', level: w.mainFloor, x: w.door[0] + 0.55, y: w.door[1] + 0.35, state: 'door', dur: 25 };
  const bed = w.thing(p.bed);
  const sleepy = night || (!people.length && r() < 0.6) || (p.kind === 'cat' && r() < 0.28) || (p.kind === 'dog' && r() < 0.1);
  if (sleepy && bed) {
    const [sx, sy] = bed.at(0.4, 1.05);
    return { kind: 'go', level: bed.level, x: sx, y: sy, state: 'sleep', dur: night ? 120 : 35 + r() * 60 };
  }
  const want: PetWant = p.needs.food < 35 && !(p.bowlFood > 0) ? 'feed' : p.needs.play < 40 ? 'play' : p.needs.love < 40 ? 'love' : null;
  if (people.length && (want || r() < 0.4)) {
    const who = pick(people);
    const [x, y] = w.spotNear(who, p);
    p.want = want;
    return { kind: 'go', level: who.level, x, y, state: want ? 'beg' : 'sit', dur: want ? 25 : 10 + r() * 15, who: who.id, want };
  }
  if (p.kind === 'dog' && r() < 0.12) {
    const lv = w.yard !== null && (p.level === w.yard || r() < 0.4) ? w.yard : p.level;
    const [x, y] = w.randomFree(lv);
    return { kind: 'go', level: lv, x, y, state: 'idle', dur: 1, spd: 2.4 };
  }
  if (p.kind === 'cat' && r() < 0.3) return { kind: 'stay', state: 'groom', dur: 6 + r() * 6 };
  const floors = w.floors.length ? w.floors : [p.level];
  const lv = r() < 0.25 ? pick(p.kind === 'dog' && w.yard !== null ? [...floors, w.yard, w.yard] : floors) : p.level;
  const [x, y] = w.randomFree(lv);
  return { kind: 'go', level: lv, x, y, state: 'idle', dur: 2 + r() * 6 };
}
