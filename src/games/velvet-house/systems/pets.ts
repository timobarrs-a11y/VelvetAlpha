import { ACTIVITIES } from '../state/activities';
import { buildWorld, isAsleep, placeAgent, startChain, type Agent, type AgentTask } from '../state/agents';
import { relocate } from '../state/arrange';
import { ATTIC, OFFICE, DOOR, LEVELS, LEVEL_NAMES, STAIRS, WX, WY } from '../state/house';
import { addDirt } from '../state/household';
import { TYPES, type ObjectInstance } from '../state/objects';
import { isFreeAt, planRoute, randomFree, spotNear, type RouteLeg } from '../state/pathfinding';
import {
  PET_BEG, PET_STATE_POSE, createPet, petDecayNeeds, petDecide, petEnd, petFree, petMood, petScoreForActivity,
  petStatusText, petWantsNow, pickCoat, pickName, serializePet, walkMinutes, type Pet, type PetKind, type PetWorld,
} from '../state/pets';
import type { PetFrame } from '../art/houseArt.js';
import type { TrayAction } from '../ui/dialogue';
import type { Game } from '../kernel/game';

/** A pet in the Household page: who, where, what they are up to, and how they are. */
export interface PetView { id: string; name: string; kind: PetKind; coat: string; where: string; status: string; needs: Record<string, number>; litterUses: number }

const PET_SPEED = 1.7;
const PET_STAIR = 0.9;
/** The acts a person does with a pet in hand; the pet waits, follows or plays along. */
const HOLD_ACTS = new Set(['playPet', 'petPet', 'walkDog']);
/** Which coat each shop entry brings home. */
const COAT_OF: Record<string, string> = { 'pet-cat': 'orange tabby', 'pet-cat2': 'black', 'pet-dog': 'golden', 'pet-dog2': 'corgi' };

function xf(o: ObjectInstance, lx: number, ly: number): [number, number] {
  const { W, D } = TYPES[o.type];
  switch (o.rot) {
    case 1: return [o.x + (D - ly), o.y + lx];
    case 2: return [o.x + (W - lx), o.y + (D - ly)];
    case 3: return [o.x + ly, o.y + (W - lx)];
    default: return [o.x + lx, o.y + ly];
  }
}

/**
 * Pets: adoption, their own days (eat, sleep, beg, wander, the litter box, the yard), being petted, played with,
 * fed and walked, and what they leave on the floor. The model and the decisions are in state/pets.ts.
 */
export function createPets(g: Game): Partial<Game> {
  const { world, people, house, rng, view, log, art, tray } = g;
  const YARD = LEVELS.findIndex(l => l.yard);
  const indoorFloors = (): number[] => LEVELS.map((_, i) => i).filter(i => !LEVELS[i].yard && i !== OFFICE && (i !== ATTIC || g.hasAttic()));
  const r = () => rng.next();
  const absMin = () => world.day * 1440 + world.minutes;
  const personById = (id: unknown): Agent | null => (typeof id === 'string' ? people.find(c => c.id === id) ?? null : null);
  const petById = (id: unknown): Pet | null => (typeof id === 'string' ? world.pets.find(q => q.id === id) ?? null : null);
  /** Whoever a pet went to be with: a person or another pet. */
  const whoIs = (id: unknown): { level: number; x: number; y: number; z: number; away: boolean } | null => {
    const c = personById(id); if (c) return { level: c.level, x: c.x, y: c.y, z: c.z, away: !!c.away };
    const q = petById(id); return q ? { level: q.level, x: q.x, y: q.y, z: q.z, away: !!q.away } : null;
  };
  const objById = (id: unknown): ObjectInstance | null => (typeof id === 'string' ? world.objs.find(o => o.id === id) ?? null : null);
  const routeTo = (p: { level: number; x: number; y: number }, lv: number, x: number, y: number): RouteLeg[] =>
    planRoute(p, lv, x, y, (l) => house.grids[l], STAIRS, WX, WY);
  const faceToward = (p: Pet, t: { x: number; y: number }): void => {
    const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
    if (d > 1e-3) p.face = [dx / d, dy / d];
  };
  const onStairLeg = (p: Pet): boolean => !!(p.route[0] && (p.route[0] as RouteLeg).type === 'stair');
  // Who was out, so a homecoming can be noticed; which pet a fill is for; the care acts already applied.
  const wasAway = new Map<string, boolean>();
  const feedFor = new Map<string, string>();
  const hooked = new WeakSet<AgentTask>();
  let careClock = 0;

  // ---- Adoption ----
  function adoptPet(kind: PetKind, itemId?: string): Pet {
    const coat = pickCoat(kind, itemId ? COAT_OF[itemId] : undefined, r);
    const id = `pet${++world.petSeq}`;
    const name = pickName(kind, world.pets.map(q => q.name), r);
    const p = createPet(id, kind, coat, name, { level: 1, x: DOOR[0] + 0.7, y: DOOR[1] + 0.3 }, r() * 6);
    const place = (type: string, level: number, near: [number, number]): ObjectInstance | null => {
      const o: ObjectInstance = { id: `${type}-${id}`, type, level, x: near[0], y: near[1], rot: 0, pet: id };
      world.objs.push(o);
      if (!relocate(world.objs, o, level, g.peopleOnFloor(), near)) { world.objs.pop(); return null; }
      art.objectPlaced(o.id);
      return o;
    };
    p.bowl = place('bowl', 1, kind === 'dog' ? [3.9, 2.4] : [4.1, 1.2])?.id ?? null;
    p.bed = place('petbed', 1, kind === 'dog' ? [8.4, 5.6] : [9.0, 4.6])?.id ?? null;
    if (kind === 'cat') p.litter = place('litter', 0, [5.4, 0.6])?.id ?? null;
    Object.assign(house, buildWorld(world.objs));
    world.pets.push(p);
    world.petFood += 6;
    log(`${g.simName} brought home ${name}, a ${coat.n} ${kind}. Bowls and a bed are on the main floor${p.litter ? ', the litter box is in the basement' : ''}.`);
    g.refreshDrawer();
    return p;
  }

  // ---- Moving about ----
  function moveAlong(p: Pet, dt: number, mul: number): boolean {
    const route = p.route as RouteLeg[];
    let budget = PET_SPEED * dt * mul * (p.spd || 1) * (p.kind === 'dog' ? 1.15 : 1);
    while (route.length) {
      const leg = route[0];
      if (leg.type === 'stair') {
        // Out of sight on the stairs for a moment, then on the other floor.
        leg.t += dt * mul * PET_STAIR * (p.spd || 1);
        p.alpha = 0;
        if (leg.t < 1) return false;
        p.level = leg.up ? leg.st.upper : leg.st.lower;
        [p.x, p.y] = leg.up ? leg.st.upperNode : leg.st.lowerNode;
        p.alpha = 1;
        route.shift();
        return false;
      }
      if (!leg.pts.length) { route.shift(); continue; }
      const [tx, ty] = leg.pts[0];
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 1e-4) p.face = [dx / d, dy / d];
      if (d <= budget) { p.x = tx; p.y = ty; budget -= d; leg.pts.shift(); continue; }
      p.x += (dx / d) * budget;
      p.y += (dy / d) * budget;
      return false;
    }
    p.alpha = 1;
    return true;
  }

  function petGo(p: Pet, lv: number, x: number, y: number, state: Pet['state'], dur: number, who: string | null = null, spd = 1): void {
    p.route = routeTo(p, lv, x, y);
    p.next = { state, dur, who };
    p.state = 'walk';
    p.spd = spd;
  }

  function arrive(p: Pet): void {
    const n = p.next || { state: 'idle' as const, dur: 2, who: null };
    p.next = null;
    p.state = n.state;
    p.timer = n.dur;
    p.who = n.who || null;
    p.pose = PET_STATE_POSE[n.state] || 'stand';
    p.spd = 1;
    const who = whoIs(n.who);
    if (who && who.level === p.level) faceToward(p, who);
    const bed = objById(p.bed), litter = objById(p.litter), bowl = objById(p.bowl);
    if (n.state === 'sleep' && bed && bed.level === p.level) { p.offBed = [p.x, p.y]; [p.x, p.y] = xf(bed, 0.4, 0.38); p.z = 0.1; }
    if (n.state === 'cuddle' && who && who.level === p.level) {
      // Curled up against the sleeper, on their bed if that is where they are.
      const pal = petById(n.who);
      p.offBed = [p.x, p.y]; p.x = who.x + 0.16; p.y = who.y + 0.1; p.z = who.z;
      if (pal && r() < 0.5) log(`${p.name} curled up with ${pal.name}.`);
    }
    if (n.state === 'romp') { const pal = petById(n.who); if (pal && r() < 0.5) log(`${p.name} and ${pal.name} are tearing round the ${LEVEL_NAMES[p.level].toLowerCase()}.`); }
    if (n.state === 'litter' && litter) { p.offBed = [p.x, p.y]; [p.x, p.y] = xf(litter, 0.35, 0.28); p.z = 0.2; }
    if (n.state === 'eat' && bowl) { const [bx, by] = xf(bowl, 0.37, 0.2); faceToward(p, { x: bx, y: by }); }
    if (n.state === 'door' && !p.doorLogged) { p.doorLogged = true; log(`${p.name} is sitting by the front door, staring at it. Time for a walk.`); }
    if (n.state === 'beg' && p.want && r() < 0.6) { const lines = PET_BEG[p.kind][p.want]; log(lines[Math.floor(r() * lines.length) % lines.length].replace('{n}', p.name)); }
  }

  function accident(p: Pet, at: { level: number; x: number; y: number }): void {
    addDirt(world.household, at.level, 'floor', 'puddle', at.x, at.y);
    p.needs.love = Math.max(0, p.needs.love - 8);
    log(p.kind === 'dog'
      ? `${p.name} couldn't hold it any longer. There's a puddle in the ${LEVEL_NAMES[at.level].toLowerCase()}.`
      : `The litter box was too dirty, so ${p.name} went next to it instead. Lovely.`);
  }

  function petWorld(hourF: number): PetWorld {
    return {
      hour: hourF,
      people: people.slice(0, 2).map(c => ({ id: c.id, level: c.level, x: c.x, y: c.y, asleep: isAsleep(c), away: !!c.away })),
      thing: (id) => { const o = objById(id); return o ? { level: o.level, at: (lx, ly) => xf(o, lx, ly) } : null; },
      randomFree: (lv) => randomFree(house.grids[lv], r, LEVELS[lv].anchor),
      spotNear: (who, p) => spotNear(who, p, (l) => house.grids[l], WX, WY),
      door: DOOR, mainFloor: 1, yard: YARD >= 0 ? YARD : null, floors: indoorFloors(), rng: r,
      others: world.pets.map(o => ({ id: o.id, kind: o.kind, level: o.level, x: o.x, y: o.y, z: o.z, state: o.state, busy: !!o.hold || !!o.away || onStairLeg(o) })),
    };
  }

  function decide(p: Pet, hourF: number): void {
    const a = petDecide(p, petWorld(hourF));
    if (a.kind === 'go') petGo(p, a.level, a.x, a.y, a.state, a.dur, a.who ?? null, a.spd ?? 1);
    else if (a.kind === 'stay') { p.state = a.state; p.pose = PET_STATE_POSE[a.state] || 'stand'; p.timer = a.dur; }
    else { accident(p, a); p.state = 'idle'; p.pose = 'stand'; p.timer = 5; }
  }

  // ---- In someone's hands ----
  function holdPet(ch: Agent, p: Pet): boolean {
    if (!(petFree(p) || p.hold === ch.id)) return false;
    p.hold = ch.id; p.route = []; p.next = null; p.alpha = 1; p.heldDid = null;
    if (p.z > 0) { if (p.offBed) [p.x, p.y] = p.offBed; p.z = 0; }
    p.state = 'wait'; p.pose = 'sit';
    return true;
  }

  function release(p: Pet): void {
    const did = p.heldDid;
    if (did === 'playPet') { p.needs.play = Math.min(100, p.needs.play + 60); p.needs.love = Math.min(100, p.needs.love + 15); p.hearts = 2; }
    if (did === 'petPet') { p.needs.love = Math.min(100, p.needs.love + 40); p.hearts = 3; }
    p.hold = null; p.heldDid = null; p.route = []; p.state = 'idle'; p.pose = 'stand'; p.timer = 0.5;
  }

  /** Out the front door together, for a while; both come back the same way (see petsTick). */
  function depart(h: Agent, p: Pet): void {
    const until = absMin() + walkMinutes(r);
    h.away = 'walk'; h.awayUntil = until; h.task = null; h.turning = false;
    p.away = { until }; p.hold = null; p.heldDid = 'walkDog'; p.route = []; p.state = 'idle'; p.pose = 'stand'; p.z = 0;
    log(`${h.name} and ${p.name} are off round the block.`);
  }

  function comeHome(h: Agent): void {
    h.away = null; h.awayUntil = undefined;
    placeAgent(h, { level: 1, x: DOOR[0] + 0.9, y: DOOR[1] + 0.2 }, [1, 0]);
    h.needs.fun = Math.min(100, h.needs.fun + 20); h.needs.comfort = Math.min(100, h.needs.comfort + 8); h.needs.energy = Math.max(0, h.needs.energy - 6);
    h.idle = 1;
    log(`${h.name} is back from the walk.`);
  }

  function tickHeld(p: Pet, dt: number, walkMul: number): void {
    const h = personById(p.hold), t = h?.task;
    if (!h || h.away || !t || !HOLD_ACTS.has(t.act)) { release(p); return; }
    if (t.act === 'walkDog') {
      // Trotting after them to the front door; when they get there, the two go out.
      if (t.phase === 'do') { depart(h, p); return; }
      p.followT = (p.followT ?? 0) - dt;
      const far = h.level !== p.level || Math.hypot(h.x - p.x, h.y - p.y) > 0.9;
      if (p.followT <= 0 && far && !onStairLeg(p)) { p.followT = 0.6; p.route = routeTo(p, h.level, h.x + 0.3, h.y + 0.35); }
      if ((p.route as RouteLeg[]).length) { p.pose = 'walk'; moveAlong(p, dt, walkMul * 1.3); return; }
      p.pose = 'happy';
      if (h.level === p.level) faceToward(p, h);
      return;
    }
    if (t.phase === 'do') p.heldDid = t.act;
    p.pose = t.phase === 'do' ? (t.act === 'playPet' ? 'play' : 'happy') : 'sit';
    if (h.level === p.level && h.z === 0) faceToward(p, h);
  }

  // ---- People looking after them ----
  function leaveSeat(ch: Agent): void {
    const s = ch.task?.slot;
    if (s?.pos) { [ch.x, ch.y] = s.stand; ch.z = 0; }
    ch.turning = false;
  }

  /** Sends `ch` to do `act` for pet `p`. Returns false (with a reason in the log for the player) when it can't happen. */
  function orderFor(ch: Agent, act: string, p: Pet, player: boolean): boolean {
    const other = people.find(c => c !== ch && c.kind !== 'npc') ?? null;
    if (act === 'feedPet') {
      if (world.petFood <= 0) { if (player) log('Out of pet food. Order some in the shop (Pets).'); return false; }
      feedFor.set(ch.id, p.id);
      leaveSeat(ch);
      if (!startChain(house, ch, 'feedPet', other, r)) { if (player) log('There is no bowl to fill.'); return false; }
      return true;
    }
    if (act === 'scoop') {
      leaveSeat(ch);
      if (!startChain(house, ch, 'scoop', other, r)) { if (player) log('There is no litter box.'); return false; }
      return true;
    }
    if (act === 'playPet' || act === 'petPet') {
      if (!holdPet(ch, p)) { if (player) log(`${p.name} is busy right now.`); return false; }
      const [x, y] = spotNear({ level: p.level, x: p.x, y: p.y }, ch, (l) => house.grids[l], WX, WY);
      leaveSeat(ch);
      ch.task = { act, slot: null, phase: 'walk', route: routeTo(ch, p.level, x, y), time: 0, dur: ACTIVITIES[act]?.dur ?? 10, next: [] };
      return true;
    }
    if (act === 'walkDog') {
      // To the front door together; from there the two of them are out round the block (depart).
      if (p.kind !== 'dog') return false;
      if (!holdPet(ch, p)) { if (player) log(`${p.name} is busy right now.`); return false; }
      leaveSeat(ch);
      ch.task = { act, slot: null, phase: 'walk', route: routeTo(ch, 1, DOOR[0] + 0.6, DOOR[1] + 0.3), time: 0, dur: ACTIVITIES.walkDog?.dur ?? 1, next: [] };
      log(`${ch.name} grabbed the leash. ${p.name} lost it.`);
      return true;
    }
    return false;
  }

  /** The player's order, from the Household page or a tap on the pet. */
  function petOrder(act: string, petId: string): void {
    const ch = people[0], p = world.pets.find(q => q.id === petId);
    if (!p) return;
    if (ch.away) { log(`${ch.name} is out right now.`); return; }
    if (g.s.scriptMode === 'cutscene') return;
    if (g.isArranging()) g.exitArrange();
    if (!orderFor(ch, act, p, true)) return;
    view.follow = 'jordan';
    if (ch.level !== view.level) g.setLevel(ch.level, true);
    g.syncControls();
  }

  /** Filling the bowl and scooping the box take effect when the person gets there and starts. */
  function careHooks(): void {
    for (const ch of people) {
      const t = ch.task;
      if (!t || t.phase !== 'do' || hooked.has(t)) continue;
      if (t.act === 'feedPet') {
        hooked.add(t);
        const objId = t.slot?.id.split(':')[0];
        const p = world.pets.find(q => q.bowl === objId) ?? world.pets.find(q => q.id === feedFor.get(ch.id))
          ?? [...world.pets].sort((a, b) => (a.bowlFood || 0) - (b.bowlFood || 0) || a.needs.food - b.needs.food)[0];
        feedFor.delete(ch.id);
        if (!p) continue;
        const n = Math.min(world.petFood, 3 - (p.bowlFood || 0));
        if (n <= 0) { log(`${p.name}'s bowl is already full.`); continue; }
        world.petFood -= n;
        p.bowlFood = (p.bowlFood || 0) + n;
        p.needs.love = Math.min(100, p.needs.love + 6);
        log(`${ch.name} filled ${p.name}'s bowl.`);
        if (p.state === 'beg') p.timer = 0;
      } else if (t.act === 'scoop') {
        hooked.add(t);
        const objId = t.slot?.id.split(':')[0];
        const p = world.pets.find(q => q.litter === objId) ?? world.pets.find(q => q.kind === 'cat');
        if (p) { p.litterUses = 0; log(`${ch.name} scooped the litter box.`); }
      }
    }
  }

  /** Residents with nothing on look after a pet that needs it, the partner a little more readily. */
  function autoCare(gameMin: number, hourF: number): void {
    careClock += gameMin;
    if (careClock < 20) return;
    careClock = 0;
    if (!g.s.settleDone) return;
    for (const ch of people.slice(0, 2)) {
      if (ch.task || ch.away || ch.scripted) continue;
      let best: { act: string; score: number } | null = null;
      for (const act of ['feedPet', 'scoop', 'playPet', 'petPet', 'walkDog']) {
        const score = petScoreForActivity(world.pets, world.petFood, act, ch.id === 'maya', hourF);
        if (score > (best?.score ?? 0.3)) best = { act, score };
      }
      if (!best || r() > 0.7) continue;
      const p = best.act === 'walkDog' ? world.pets.find(q => q.kind === 'dog' && petFree(q))
        : best.act === 'scoop' ? world.pets.find(q => q.kind === 'cat')
        : best.act === 'feedPet' ? world.pets.find(q => q.needs.food < 50 && !(q.bowlFood > 0))
        : [...world.pets].filter(petFree).sort((a, b) => a.needs[best!.act === 'playPet' ? 'play' : 'love'] - b.needs[best!.act === 'playPet' ? 'play' : 'love'])[0];
      if (p) orderFor(ch, best.act, p, false);
    }
  }

  /** Fur where they walk, paw prints after a walk. */
  function shed(p: Pet, gameMin: number): void {
    if (p.away || p.z > 0 || LEVELS[p.level]?.yard) return;
    const spot = (type: string, spread: number): void => {
      const x = p.x + (r() - 0.5) * spread, y = p.y + (r() - 0.5) * spread;
      if (isFreeAt(house.grids[p.level], x, y, WX, WY)) addDirt(world.household, p.level, 'floor', type, x, y);
    };
    if (r() < 0.08 * gameMin / 15) spot('fur', 0.8);
    if (p.cameIn && absMin() - p.cameIn < 40 && r() < 0.65 * gameMin / 15) spot('paws', 0.6);
  }

  /** Two pets near each other: a romp is joined, a cat startles when a dog comes bounding in, and they look at each other. */
  function noticeOthers(p: Pet, gameMin: number): void {
    if (p.state === 'walk' || p.state === 'sleep' || p.state === 'cuddle' || p.state === 'eat' || p.state === 'litter' || p.state === 'potty') return;
    for (const o of world.pets) {
      if (o === p || o.away || o.hold || o.level !== p.level) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > 1.2) continue;
      // Someone has come over to play: join in.
      if (o.state === 'romp' && o.who === p.id && p.state !== 'romp') { p.state = 'romp'; p.pose = 'play'; p.timer = Math.max(o.timer, 3); p.who = o.id; faceToward(p, o); continue; }
      // A dog bounding up to a cat: the cat may shoot off somewhere quieter.
      if (p.kind === 'cat' && o.kind === 'dog' && (o.pose === 'run' || o.pose === 'walk') && d < 0.8 && !(p.startleAt && absMin() - p.startleAt < 60) && r() < 0.5 * Math.min(1, gameMin)) {
        p.startleAt = absMin();
        const lv = p.level === 2 ? 1 : 2, [x, y] = randomFree(house.grids[lv], r, LEVELS[lv].anchor);
        petEnd(p); petGo(p, lv, x, y, 'idle', 4, null, 2.4);
        if (r() < 0.5) log(`${p.name} shot ${lv === 2 ? 'upstairs' : 'downstairs'} when ${o.name} came bounding in.`);
        return;
      }
      if (p.state === 'idle' || p.state === 'sit') faceToward(p, o);
    }
  }

  function greet(ch: Agent): void {
    for (const p of world.pets) {
      if (p.kind !== 'dog' || !petFree(p) || p.state === 'sleep') continue;
      petGo(p, 1, DOOR[0] + 0.7, DOOR[1] + 0.4, 'sit', 4, ch.id, 2.2);
      p.hearts = 2;
    }
  }

  // ---- The tick ----
  function petsTick(dt: number, gameMin: number, walkMul: number, hourF: number): void {
    const pets = world.pets;
    if (!pets.length) return;
    for (const ch of people.slice(0, 2)) {
      if (ch.away === 'walk' && ch.awayUntil != null && absMin() >= ch.awayUntil) comeHome(ch);
      const now = !!ch.away;
      if (wasAway.get(ch.id) && !now) greet(ch);
      wasAway.set(ch.id, now);
    }
    for (const p of pets) {
      petDecayNeeds(p, gameMin);
      if (p.hearts > 0) p.hearts -= dt;
      if (p.away) {
        if (absMin() < p.away.until) continue;
        // Back from the walk, through the front door, better for it.
        p.away = null; p.level = 1; p.x = DOOR[0] + 1.2; p.y = DOOR[1] + 0.4; p.z = 0; p.face = [1, 0]; p.cameIn = absMin(); p.timer = 2;
        if (p.heldDid === 'walkDog') { p.heldDid = null; p.needs.bladder = 100; p.needs.play = Math.min(100, p.needs.play + 40); p.needs.love = Math.min(100, p.needs.love + 10); p.doorLogged = false; p.hearts = 2; }
      }
      if (p.kind === 'cat') p.litterT = (p.litterT || 0) + gameMin;
      if (p.kind === 'dog' && (p.needs.bladder ?? 100) <= 0) { petEnd(p); accident(p, p); p.needs.bladder = 100; p.doorLogged = false; }
      if (p.hold) { tickHeld(p, dt, walkMul); shed(p, gameMin); continue; }
      if ((p.route as RouteLeg[]).length) {
        p.pose = (p.spd || 1) > 1.5 ? 'run' : 'walk';
        if (moveAlong(p, dt, walkMul)) arrive(p);
        shed(p, gameMin);
        continue;
      }
      if (p.state === 'walk') { arrive(p); continue; }
      p.timer -= gameMin;
      if ((p.state === 'sit' || p.state === 'cuddle') && p.who) {
        // Company does them good: a person's more than another pet's.
        const who = whoIs(p.who), person = !!personById(p.who);
        if (who && !who.away && who.level === p.level) p.needs.love = Math.min(100, p.needs.love + (person ? 6 : 3) * gameMin / 60);
        else if (!who || who.away) p.timer = 0;
      }
      noticeOthers(p, gameMin);
      if (p.state === 'beg' && p.want && !petWantsNow(p)) p.timer = 0;
      if (p.timer > 0) { shed(p, gameMin); continue; }
      petEnd(p);
      decide(p, hourF);
    }
    careHooks();
    autoCare(gameMin, hourF);
  }

  // ---- What the rest of the game reads ----
  const holderOf = (p: Pet) => { const h = personById(p.hold); return h ? { name: h.name, act: h.task?.act ?? null, phase: h.task?.phase ?? null } : null; };
  const petNames = (): Record<string, string> => Object.fromEntries(world.pets.map(q => [q.id, q.name]));
  const statusOf = (p: Pet): string => petStatusText(p, world.minutes / 60, holderOf(p), petNames());

  function petFrames(): PetFrame[] {
    return world.pets.map(p => ({
      id: p.id, kind: p.kind, coat: { c: p.coat.c, d: p.coat.d }, name: p.name,
      level: p.level, x: p.x, y: p.y, z: p.z, face: p.face ?? [0, 1], pose: p.pose, seed: p.seed, alpha: p.alpha,
      hidden: !!p.away || p.alpha <= 0 || onStairLeg(p),
      hearts: p.hearts, want: p.state === 'beg' ? p.want : null, door: p.state === 'door',
      bowl: typeof p.bowl === 'string' ? p.bowl : null, litter: typeof p.litter === 'string' ? p.litter : null, bowlFood: p.bowlFood, litterUses: p.litterUses,
    }));
  }

  function petViews(): PetView[] {
    return world.pets.map(p => ({
      id: p.id, name: p.name, kind: p.kind, coat: p.coat.c, where: p.away ? 'Out' : LEVEL_NAMES[p.level] ?? '', status: statusOf(p),
      needs: { ...p.needs } as Record<string, number>, litterUses: p.litterUses,
    }));
  }

  function petsContext(): string {
    return world.pets.map(p => `${p.name} the ${p.kind} (${petMood(p)}, ${statusOf(p).toLowerCase()})`).join('; ');
  }

  function petAt(sx: number, sy: number): Pet | null {
    let best: Pet | null = null, bd = 24;
    for (const p of world.pets) {
      if (p.level !== view.level || p.away || p.alpha <= 0) continue;
      const [px, py] = art.project(p.x, p.y, p.z);
      const d = Math.hypot(sx - px, sy - (py - 10));
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function showPetActions(p: Pet, x: number, y: number): void {
    const acts: TrayAction[] = [
      { act: 'petPet', label: `Pet ${p.name}` }, { act: 'playPet', label: 'Play' }, { act: 'feedPet', label: 'Fill bowl' },
      p.kind === 'dog' ? { act: 'walkDog', label: 'Walk' } : { act: 'scoop', label: 'Scoop litter' },
    ];
    tray.show(acts, x, y, (a) => petOrder(a.act, p.id));
  }

  const petsForSave = (): Record<string, unknown>[] => world.pets.map(serializePet);

  return { adoptPet, petsTick, petOrder, petFrames, petViews, petsContext, petAt, showPetActions, petsForSave };
}
