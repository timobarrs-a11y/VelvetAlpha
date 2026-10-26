import { describe, it, expect } from 'vitest';
import { createHousehold } from '../state/household';
import { createLife, parseLife } from '../state/life';
import { financeTick, payBill, withdraw, nextWeekday, billTotal, WEEKLY_BILLS } from '../state/finance';
import {
  sideJobsTick, takeOffer, blockedBy, startWork, addWork, finishJob, workRate, progress, OFFERS_TODAY, MAX_TAKEN,
} from '../state/sideJobs';
import { routineStep, morningActs, isNight, isWorkday, rollDay, dayPay, clampRoutine, hourLabel } from '../state/routine';
import { weekday } from '../state/time';

const quiet = () => {};
const at = (h: number) => h * 60;

// Day 1 is a Saturday, so day 3 is Monday, day 5 Wednesday and day 7 Friday.
describe('bills', () => {
  it('arrive three days before they are due: rent first, for Monday', () => {
    const h = createHousehold();
    const life = createLife();
    financeTick(h, life, 1, at(6.5), quiet);
    expect(life.bills.map(b => `${b.label} ${b.dueDay}`)).toEqual(['Rent 3']);
    financeTick(h, life, 2, at(9), quiet);
    expect(life.bills.map(b => b.label)).toContain('Electric');
    financeTick(h, life, 4, at(9), quiet);
    expect(life.bills.map(b => b.label).sort()).toEqual(['Electric', 'Internet', 'Rent', 'Water']);
    expect(WEEKLY_BILLS).toBe(540);
  });

  it('only one of each per week', () => {
    const h = createHousehold();
    const life = createLife();
    for (let m = 0; m < 1440; m += 30) financeTick(h, life, 1, m, quiet);
    expect(life.bills.filter(b => b.kind === 'rent')).toHaveLength(1);
  });

  it('paying one takes it out of the bank, with a ledger line', () => {
    const h = createHousehold();
    h.money = 958;
    const life = createLife();
    financeTick(h, life, 1, at(10), quiet);
    const rent = life.bills[0];
    expect(payBill(h, life, rent.id, 1, at(10), quiet)).toBe(true);
    expect(h.money).toBe(558);
    expect(life.ledger[0]).toMatchObject({ label: 'Rent', amount: -400, balance: 558 });
    expect(life.bills).toHaveLength(0);
  });

  it("can't be paid without the money", () => {
    const h = createHousehold();
    h.money = 100;
    const life = createLife();
    financeTick(h, life, 1, at(10), quiet);
    const msgs: string[] = [];
    expect(payBill(h, life, life.bills[0].id, 1, at(10), m => msgs.push(m))).toBe(false);
    expect(msgs[0]).toContain('$300 more');
    expect(h.money).toBe(100);
  });

  it('go overdue the day after: a late fee, and the service goes off until paid', () => {
    const h = createHousehold();
    h.money = 2000;
    h.fridge.fresh = 3;
    const life = createLife();
    financeTick(h, life, 2, at(9), quiet);
    const electric = life.bills.find(b => b.kind === 'electric')!;
    financeTick(h, life, 5, at(20), quiet);
    expect(electric.overdue).toBe(false);
    financeTick(h, life, 6, at(0.1), quiet);
    expect(electric.overdue).toBe(true);
    expect(h.power).toBe(false);
    expect(h.fridge.fresh).toBe(0);
    expect(billTotal(electric)).toBe(95);
    payBill(h, life, electric.id, 6, at(8), quiet);
    expect(h.power).toBe(true);
  });

  it('remind the day before', () => {
    const h = createHousehold();
    const life = createLife();
    financeTick(h, life, 1, at(10), quiet);
    const msgs: string[] = [];
    financeTick(h, life, 2, at(9.5), m => msgs.push(m));
    expect(msgs.some(m => m.startsWith('Reminder: rent'))).toBe(true);
  });
});

describe('the paycheck', () => {
  it("arrives on Friday evening with the week's wages", () => {
    const h = createHousehold();
    h.money = 0;
    const life = createLife();
    life.wagesOwed = dayPay() * 5;
    expect(weekday(7)).toBe(4);
    financeTick(h, life, 7, at(17), quiet);
    expect(h.money).toBe(0);
    financeTick(h, life, 7, at(17.5), quiet);
    expect(h.money).toBe(800);
    expect(life.ledger[0].label).toBe('Paycheck: Corner Market');
    financeTick(h, life, 7, at(18), quiet);
    expect(h.money).toBe(800);
  });
});

describe('side jobs', () => {
  it('offers arrive at 7:00 and expire after two days', () => {
    const life = createLife();
    sideJobsTick(life, 1, at(6), () => 0.3, quiet);
    expect(life.offers).toHaveLength(0);
    sideJobsTick(life, 1, at(7), () => 0.3, quiet);
    expect(life.offers).toHaveLength(OFFERS_TODAY);
    sideJobsTick(life, 3, at(7.5), () => 0.3, quiet);
    expect(life.offers).toHaveLength(OFFERS_TODAY);
    expect(life.offerDay).toBe(3);
  });

  it('a taken job fills up with work, keeps its progress, and pays only when finished', () => {
    const h = createHousehold();
    h.money = 0;
    const life = createLife();
    life.offers.push({ id: 'o1', job: 'website', client: 'Mr. Patel', expires: 99999 });
    const t = takeOffer(life, 'o1')!;
    expect(blockedBy(h, life, t)).toBeNull();
    startWork(h, life, t);
    expect(addWork(t, 90, 1)).toBe(false);
    expect(progress(t)).toBe(50);
    life.working = null; // got up to do something else
    expect(h.money).toBe(0);
    expect(addWork(t, 90, 1)).toBe(true);
    finishJob(h, life, t, 1, at(20), quiet);
    expect(h.money).toBe(120);
    expect(life.taken).toHaveLength(0);
    expect(life.ledger[0].label).toBe('Side job: build a website for Mr. Patel');
  });

  it("can't be worked on without what it needs", () => {
    const h = createHousehold();
    const life = createLife();
    life.offers.push({ id: 'o1', job: 'website', client: 'x', expires: 99999 }, { id: 'o2', job: 'bake', client: 'y', expires: 99999 });
    const web = takeOffer(life, 'o1')!;
    const bake = takeOffer(life, 'o2')!;
    life.internet = false;
    expect(blockedBy(h, life, web)).toBe('The internet is off.');
    h.fridge = { basic: 1, fresh: 0 };
    expect(blockedBy(h, life, bake)).toContain('food');
    h.fridge = { basic: 3, fresh: 0 };
    startWork(h, life, bake);
    expect(h.fridge.basic).toBe(1);
    expect(blockedBy(h, life, bake)).toBeNull();
  });

  it('only so many can wait, and work is slower when tired', () => {
    const life = createLife();
    for (let i = 0; i < 5; i++) life.offers.push({ id: `o${i}`, job: 'logo', client: 'x', expires: 99999 });
    for (let i = 0; i < 5; i++) takeOffer(life, `o${i}`);
    expect(life.taken).toHaveLength(MAX_TAKEN);
    expect(workRate({ energy: 20, fun: 80 })).toBe(0.75);
    expect(workRate({ energy: 80, fun: 80 })).toBe(1);
  });
});

describe('the routine', () => {
  it('wakes him on a workday, sends him to work at 8 and brings him home at 5', () => {
    const life = createLife(3);
    expect(isWorkday(3)).toBe(true);
    expect(routineStep(life, 3, 5.9, { asleep: true, away: false })).toBeNull();
    expect(routineStep(life, 3, 6, { asleep: true, away: false })).toBe('wake');
    life.today.woke = true;
    expect(routineStep(life, 3, 7.9, { asleep: false, away: false })).toBeNull();
    expect(routineStep(life, 3, 8, { asleep: false, away: false })).toBe('leave');
    life.today.left = true;
    expect(routineStep(life, 3, 12, { asleep: false, away: true })).toBeNull();
    expect(routineStep(life, 3, 17, { asleep: false, away: true })).toBe('return');
  });

  it('lets him sleep in and stay home on weekends, or when he calls in', () => {
    const life = createLife(1);
    expect(isWorkday(1)).toBe(false);
    expect(routineStep(life, 1, 6, { asleep: true, away: false })).toBeNull();
    expect(routineStep(life, 1, 8, { asleep: true, away: false })).toBe('wake');
    life.today.woke = true;
    expect(routineStep(life, 1, 9, { asleep: false, away: false })).toBeNull();
    rollDay(life, 3);
    life.today.calledIn = true;
    life.today.woke = true;
    expect(routineStep(life, 3, 9, { asleep: false, away: false })).toBeNull();
  });

  it('has a morning routine and a night that follow the settings', () => {
    expect(morningActs({ wake: 6, weekendWake: 8, bed: 24, shower: true }, true)).toEqual(['mirror', 'shower', 'cook', 'eat']);
    expect(morningActs({ wake: 6, weekendWake: 8, bed: 24, shower: false }, false)).toEqual(['mirror']);
    const r = { wake: 6, weekendWake: 8, bed: 24, shower: true };
    expect(isNight(r, 3, 23.5)).toBe(false);
    expect(isNight(r, 3, 0.5)).toBe(true);
    expect(isNight(r, 3, 6.2)).toBe(false);
    expect(clampRoutine({ wake: 3, weekendWake: 12, bed: 30, shower: true })).toMatchObject({ wake: 5, weekendWake: 10, bed: 26 });
    expect(hourLabel(24)).toBe('12:00 AM');
    expect(hourLabel(6.5)).toBe('6:30 AM');
  });
});

describe('saving', () => {
  it('reads a saved life back, and starts fresh from nonsense', () => {
    const life = createLife(4);
    life.wagesOwed = 320;
    life.routine.wake = 5.5;
    life.taken.push({ id: 'o9', job: 'tutor', client: 'x', done: 30, started: true });
    const back = parseLife(JSON.parse(JSON.stringify(life)), 4);
    expect(back).toEqual(life);
    expect(parseLife('nope', 2)).toEqual(createLife(2));
    expect(parseLife({ taken: [{ id: 'a', job: 'hack' }] }, 2).taken).toEqual([]);
  });

  it('nextWeekday finds the coming Monday', () => {
    expect(nextWeekday(1, 0)).toBe(3);
    expect(nextWeekday(3, 0)).toBe(3);
    expect(withdraw(createHousehold(), createLife(), 1, 0, 'x', 99999)).toBe(false);
  });
});

describe('the phone', async () => {
  const { phoneView, phoneHtml, phoneStructure } = await import('../ui/phone');

  it('shows the balance, bills with Pay, offers, and what it can afford', () => {
    const h = createHousehold();
    h.money = 300;
    const life = createLife(1);
    financeTick(h, life, 1, at(10), quiet);
    life.offers.push({ id: 'o1', job: 'logo', client: 'Mr. Patel', expires: 1 * 1440 + at(10) + 2880 });
    const v = phoneView(h, life, 1, at(10), false);
    expect(v.bills[0]).toMatchObject({ label: 'Rent', total: 400, due: 'Due Mon', canPay: false });
    expect(phoneHtml(v, 'bills')).toContain('Not enough');
    expect(phoneHtml(v, 'bank')).toContain('$300');
    expect(phoneHtml(v, 'jobs')).toContain('Design a logo');
    expect(v.offers[0].expires).toBe('2 days left');
    expect(phoneHtml(v, 'routine')).toContain('Wake up on workdays');
  });

  it("doesn't redraw just because a progress bar moved", () => {
    const h = createHousehold();
    const life = createLife(1);
    life.taken.push({ id: 't1', job: 'tutor', client: 'x', done: 10, started: true });
    const a = phoneView(h, life, 1, at(18), false);
    life.taken[0].done = 40;
    const b = phoneView(h, life, 1, at(18.5), false);
    expect(a.taken[0].pct).not.toBe(b.taken[0].pct);
    expect(phoneHtml(phoneStructure(a), 'jobs')).toBe(phoneHtml(phoneStructure(b), 'jobs'));
  });
});
