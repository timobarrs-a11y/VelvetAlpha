export interface PatternEvent {
  act: string;
  at: number;
}

export interface PatternDef {
  id: string;
  seq?: string[];
  within?: number;
  chance: number;
  when?: (ctx: PatternCheckContext) => boolean;
  check?: (ctx: PatternCheckContext) => boolean;
  topic: (ctx: PatternCheckContext) => string;
}

export interface PatternCheckContext {
  hour: number;
  dishes: number;
  servings: number;
  hasDelivery: boolean;
  hasParcel: boolean;
  power: boolean;
  foodNeed: number;
  energyNeed: number;
  lawnLen: number;
  lawnWeeds: number;
  messLevel: number;
  deepCleaned: boolean;
  petHungry: boolean;
  petName: string;
  simName: string;
}

export interface NoticeState {
  topic: string;
  until: number;
}

export const NOTICE_TTL = 90;

export const PATTERNS: PatternDef[] = [
  { id: 'freshStart', seq: ['shower', 'cook'], within: 240, chance: 0.85, when: c => c.hour < 12, topic: c => `${c.simName} got up, showered and cooked breakfast before work` },
  { id: 'cleanUp', seq: ['eat', 'wash'], within: 120, chance: 0.75, topic: c => `${c.simName} did the dishes right after eating without being asked` },
  { id: 'gymThenShower', seq: ['lift', 'shower'], within: 180, chance: 0.6, topic: c => `${c.simName} worked out in the basement and showered right after, looking pretty good` },
  { id: 'danceFever', seq: ['dance', 'dance'], within: 300, chance: 0.8, topic: c => `${c.simName} has been throwing solo dance parties all day` },
  { id: 'couchPotato', seq: ['tv', 'tv', 'tv'], within: 480, chance: 0.8, topic: c => `${c.simName} has been glued to the TV for hours` },
  { id: 'dishesPile', check: c => c.dishes >= 3, chance: 0.9, topic: () => 'the dirty dishes have been piling up on the table' },
  { id: 'emptyFridge', check: c => c.servings === 0 && !c.hasDelivery && !c.hasParcel, chance: 0.9, topic: () => 'the fridge is completely empty and they need groceries' },
  { id: 'powerOut', check: c => !c.power, chance: 1, topic: () => 'the power got cut because the bill went unpaid' },
  { id: 'starving', check: c => c.foodNeed < 15, chance: 0.9, topic: c => `${c.simName} hasn't eaten in hours and looks drained` },
  { id: 'wornOut', check: c => c.energyNeed < 15, chance: 0.8, topic: c => `${c.simName} looks completely worn out` },
  { id: 'lawn', check: c => c.lawnLen > 0.78 || c.lawnWeeds >= 9, chance: 0.7, topic: c => `the backyard is a jungle: the grass is ${c.lawnLen > 0.78 ? 'overgrown' : 'full of dandelions'} and the neighbors are starting to look` },
  { id: 'filthy', check: c => c.messLevel >= 12, chance: 0.85, topic: () => 'the house is getting gross, with footprints, crumbs and smudges on every floor' },
  { id: 'deepClean', check: c => c.deepCleaned, chance: 0.9, topic: c => `${c.simName} went floor to floor and scrubbed the whole house without being asked` },
  { id: 'petHungry', check: c => c.petHungry, chance: 0.9, topic: c => `${c.petName} is starving and nobody has filled the bowl` },
  { id: 'petCare', seq: ['feedPet', 'playPet'], within: 240, chance: 0.6, topic: c => `${c.simName} fed ${c.petName} and then played with them for a while` },
];

export function matchesSeq(seq: string[], within: number, events: PatternEvent[], now: number): boolean {
  let i = seq.length - 1;
  for (let k = events.length - 1; k >= 0 && i >= 0; k--) {
    if (now - events[k].at > within) break;
    if (events[k].act === seq[i]) i--;
  }
  return i < 0;
}

export interface PatternCheckInput {
  ctx: PatternCheckContext;
  events: PatternEvent[];
  now: number;
  firedToday: Record<string, number>;
  day: number;
  rng: () => number;
}

export interface PatternHit {
  pattern: PatternDef;
  topic: string;
  notice: NoticeState;
}

export function checkPatterns(input: PatternCheckInput): PatternHit | null {
  for (const p of PATTERNS) {
    if (input.firedToday[p.id] === input.day) continue;
    const hit = p.check
      ? p.check(input.ctx)
      : p.seq && p.within
        ? matchesSeq(p.seq, p.within, input.events, input.now) && (!p.when || p.when(input.ctx))
        : false;
    if (!hit) continue;
    if (input.rng() > p.chance) continue;
    return {
      pattern: p,
      topic: p.topic(input.ctx),
      notice: { topic: p.topic(input.ctx), until: input.now + NOTICE_TTL },
    };
  }
  return null;
}
