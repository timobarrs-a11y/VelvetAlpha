/**
 * Side jobs done at home for extra money: offers arrive on the phone each
 * morning and expire if nobody takes them. A taken job fills a progress bar
 * while Jordan works on it at the right spot. He can stop and come back, and
 * it pays only once it's finished.
 */
import type { HouseholdState } from './household';
import { deposit } from './finance';
import { nextId, type LifeState, type SideJobId, type TakenJob } from './life';

export interface SideJobDef {
  title: string;
  /** The activity Jordan does while working on it (see activities.ts). */
  act: 'sideDesk' | 'sideBake';
  /** Game minutes of work. */
  minutes: number;
  pay: number;
  power: boolean;
  internet: boolean;
  water: boolean;
  /** Meals' worth of food from the fridge, used when the job starts. */
  servings: number;
}

export const SIDE_JOBS: Record<SideJobId, SideJobDef> = {
  website: { title: 'Build a website', act: 'sideDesk', minutes: 180, pay: 120, power: true, internet: true, water: false, servings: 0 },
  logo: { title: 'Design a logo', act: 'sideDesk', minutes: 120, pay: 80, power: true, internet: true, water: false, servings: 0 },
  laptop: { title: "Fix a neighbour's laptop", act: 'sideDesk', minutes: 90, pay: 60, power: true, internet: false, water: false, servings: 0 },
  bake: { title: 'Bake a batch for the café', act: 'sideBake', minutes: 120, pay: 70, power: true, internet: false, water: true, servings: 2 },
  tutor: { title: 'Tutor a student online', act: 'sideDesk', minutes: 60, pay: 45, power: true, internet: true, water: false, servings: 0 },
};

export const SIDE_ACTS = new Set(['sideDesk', 'sideBake']);

/**
 * New offers each morning. Free and paid players will differ here (1 and 3,
 * docs/velvet-house/free-and-paid.md); until the paywall is built everyone gets
 * the paid amount.
 */
export const OFFERS_PER_DAY = { free: 1, paid: 3 } as const;
export const OFFERS_TODAY = OFFERS_PER_DAY.paid;
export const OFFER_HOUR = 7;
/** An offer disappears this many game minutes after it arrives. */
export const OFFER_LIFE = 2 * 1440;
/** How many taken jobs can wait at once. */
export const MAX_TAKEN = 3;

const CLIENTS = [
  'Lena at the flower shop', 'Mr. Patel', 'the bakery on Elm', 'Coach Rivera', 'Mrs. Nguyen next door',
  'a dog groomer', 'the corner gym', 'Sam from book club', 'a food truck', 'the youth soccer league',
  'Dr. Okoye', 'a wedding photographer', 'the record store', 'Grandpa Joe', 'a new yoga studio',
];

const JOB_IDS = Object.keys(SIDE_JOBS) as SideJobId[];

/** The day's offers arrive at 7:00, and old ones expire. */
export function sideJobsTick(life: LifeState, day: number, minutes: number, rng: () => number, log: (msg: string) => void): void {
  const now = day * 1440 + minutes;
  const before = life.offers.length;
  life.offers = life.offers.filter(o => o.expires > now);
  const expired = before - life.offers.length;
  if (expired > 0) log(expired === 1 ? 'A side-job offer expired.' : `${expired} side-job offers expired.`);

  if (life.offerDay < day && minutes >= OFFER_HOUR * 60) {
    life.offerDay = day;
    for (let i = 0; i < OFFERS_TODAY; i++) {
      const job = JOB_IDS[Math.floor(rng() * JOB_IDS.length) % JOB_IDS.length];
      const client = CLIENTS[Math.floor(rng() * CLIENTS.length) % CLIENTS.length];
      life.offers.push({ id: nextId(life, 'o'), job, client, expires: now + OFFER_LIFE });
    }
    const n: number = OFFERS_TODAY;
    log(`${n === 1 ? 'A new side-job offer' : `${n} new side-job offers`} on the phone.`);
  }
}

export function takeOffer(life: LifeState, offerId: string): TakenJob | null {
  const o = life.offers.find(x => x.id === offerId);
  if (!o || life.taken.length >= MAX_TAKEN) return null;
  life.offers = life.offers.filter(x => x !== o);
  const taken: TakenJob = { id: o.id, job: o.job, client: o.client, done: 0, started: false };
  life.taken.push(taken);
  return taken;
}

/** Why a job can't be worked on right now, or null if it can. */
export function blockedBy(h: HouseholdState, life: LifeState, t: TakenJob): string | null {
  const def = SIDE_JOBS[t.job];
  if (def.power && !h.power) return 'The power is off.';
  if (def.internet && !life.internet) return 'The internet is off.';
  if (def.water && !life.water) return 'The water is off.';
  if (!t.started && def.servings > (h.fridge.basic + h.fridge.fresh)) return `Needs ${def.servings} meals' worth of food in the fridge.`;
  return null;
}

/** Takes ingredients the first time a job is worked on. */
export function startWork(h: HouseholdState, life: LifeState, t: TakenJob): void {
  if (!t.started) {
    let need = SIDE_JOBS[t.job].servings;
    while (need > 0 && h.fridge.basic > 0) { h.fridge.basic--; need--; }
    while (need > 0 && h.fridge.fresh > 0) { h.fridge.fresh--; need--; }
    t.started = true;
  }
  life.working = t.id;
}

/** How fast work goes: slower when tired or bored. */
export function workRate(needs: { energy: number; fun: number }): number {
  return needs.energy < 30 || needs.fun < 30 ? 0.75 : 1;
}

/** Adds work; true once the job is finished. */
export function addWork(t: TakenJob, gameMin: number, rate: number): boolean {
  t.done = Math.min(SIDE_JOBS[t.job].minutes, t.done + gameMin * rate);
  return t.done >= SIDE_JOBS[t.job].minutes;
}

/** Pays for a finished job and clears it. */
export function finishJob(h: HouseholdState, life: LifeState, t: TakenJob, day: number, minutes: number, log: (msg: string) => void): void {
  const def = SIDE_JOBS[t.job];
  deposit(h, life, day, minutes, `Side job: ${def.title.toLowerCase()} for ${t.client}`, def.pay);
  life.taken = life.taken.filter(x => x !== t);
  if (life.working === t.id) life.working = null;
  log(`Finished: ${def.title.toLowerCase()} for ${t.client}. +$${def.pay}.`);
}

export function progress(t: TakenJob): number {
  return Math.round((t.done / SIDE_JOBS[t.job].minutes) * 100);
}
