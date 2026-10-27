import { startChain, startSequence, isAsleep } from '../state/agents';
import { LEVELS } from '../state/house';
import { servings } from '../state/household';
import { withdraw } from '../state/finance';
import { blockedBy, startWork, addWork, finishJob, workRate, SIDE_JOBS, SIDE_ACTS } from '../state/sideJobs';
import { routineStep, morningActs, dayPay, isWorkday, CORNER_MARKET } from '../state/routine';
import type { Game } from '../kernel/game';

/**
 * The life sim at home: what Jordan does with the day (get up, get ready, go to work, come home), the side jobs he works
 * at the desk or the stove, and the bank every purchase goes through. The rules are in state/routine.ts, sideJobs.ts and
 * finance.ts; this connects them to the people in the house.
 */
export function createLifeSim(g: Game): Partial<Game> {
  const { world, people, house, rng, view, log } = g;

  function spendOn(label: string, amount: number): boolean {
    return withdraw(world.household, world.life, world.day, world.minutes, label, amount);
  }

  // Start (or go back to) a side job: Jordan walks to the desk or the stove and works until it's done.
  function workOnJob(id: string): void {
    const jordan = people[0];
    const t = world.life.taken.find((x) => x.id === id);
    if (!t) return;
    if (jordan.away) { log(`${jordan.name} is at work. Side jobs wait for the evening.`); return; }
    const blocked = blockedBy(world.household, world.life, t);
    if (blocked) { log(blocked); return; }
    if (!startChain(house, jordan, SIDE_JOBS[t.job].act, people[1], () => rng.next())) {
      log(SIDE_JOBS[t.job].act === 'sideBake' ? 'The stove is busy.' : 'The desk is busy.');
      return;
    }
    startWork(world.household, world.life, t);
    log(`${jordan.name} is working on: ${SIDE_JOBS[t.job].title.toLowerCase()}.`);
    view.follow = 'jordan';
    if (jordan.level !== view.level) g.setLevel(jordan.level, true);
    g.refreshDrawer();
  }

  // The day's routine: wake up, get ready, go to work, come home.
  function runRoutine(hourF: number): void {
    const jordan = people[0];
    const step = routineStep(world.life, world.day, hourF, { asleep: isAsleep(jordan), away: !!jordan.away });
    if (step === 'wake') {
      world.life.today.woke = true;
      jordan.task = null;
      const work = isWorkday(world.day) && !world.life.today.calledIn && hourF < CORNER_MARKET.start;
      const acts = work ? morningActs(world.life.routine, servings(world.household) > 0) : ['mirror'];
      startSequence(house, jordan, acts.filter((a) => a !== 'shower' || world.life.water), people[1], () => rng.next());
      log(`${jordan.name} is up.`);
    } else if (step === 'leave') {
      world.life.today.left = true;
      world.life.today.woke = true;
      world.life.working = null;
      jordan.task = null;
      jordan.away = 'work';
      log(`${jordan.name} left for work at the ${CORNER_MARKET.place}.`);
    } else if (step === 'return') {
      world.life.today.returned = true;
      world.life.wagesOwed += dayPay();
      jordan.away = null;
      jordan.level = 1;
      [jordan.x, jordan.y] = LEVELS[1].anchor;
      jordan.idle = 0.5;
      g.s.skipping = false;
      log(`${jordan.name} is home from work. +$${dayPay()} toward Friday's paycheck.`);
    }
  }

  // Side-job work: the bar fills while he's at it; it stops if he's worn out or the power, water or internet goes.
  function tickSideJob(gameMin: number): void {
    const jordan = people[0];
    const t = world.life.working ? world.life.taken.find((x) => x.id === world.life.working) : null;
    if (!t) return;
    const task = jordan.task;
    if (!task || !SIDE_ACTS.has(task.act)) { world.life.working = null; return; }
    if (task.phase !== 'do') return;
    const blocked = blockedBy(world.household, world.life, { ...t, started: true });
    const worn = Math.min(jordan.needs.energy, jordan.needs.food, jordan.needs.hygiene) < 15;
    if (blocked || worn) {
      jordan.task = null;
      jordan.idle = 0.5;
      world.life.working = null;
      log(blocked ? `Work stopped: ${blocked}` : `${jordan.name} needs a break. The work is saved.`);
      return;
    }
    if (addWork(t, gameMin, workRate(jordan.needs))) {
      jordan.task = null;
      jordan.idle = 1;
      finishJob(world.household, world.life, t, world.day, world.minutes, log);
    }
  }

  return { spendOn, workOnJob, runRoutine, tickSideJob };
}
