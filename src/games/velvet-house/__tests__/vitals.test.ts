import { describe, it, expect } from 'vitest';
import { createHousehold } from '../state/household';
import { createLife } from '../state/life';
import { foodLevel, tidyLevel, tickFitness, snackTick, addFood, billsStatus, vitals, FOOD_FULL } from '../state/vitals';

describe('vitals', () => {
  it('food is how full the fridge is, against ten servings', () => {
    const h = createHousehold(); h.fridge.basic = 0; h.fridge.fresh = 0;
    expect(foodLevel(h)).toBe(0);
    addFood(h, FOOD_FULL / 2, false);
    expect(foodLevel(h)).toBe(50);
    addFood(h, 20, true);
    expect(foodLevel(h)).toBe(100);
  });

  it('tidy falls with dishes and laundry', () => {
    const h = createHousehold(); h.dishes = 0; h.laundryPile = 0;
    expect(tidyLevel(h)).toBe(100);
    h.dishes = 5; h.laundryPile = 4;
    expect(tidyLevel(h)).toBe(40);
  });

  it('fitness rises on the treadmill and fades with time, between 0 and 100', () => {
    const flags: Record<string, unknown> = {};
    expect(tickFitness(flags, 60, false)).toBeCloseTo(19.7, 1);
    expect(tickFitness(flags, 20, true)).toBeCloseTo(22.6, 1);
    for (let i = 0; i < 200; i++) tickFitness(flags, 60, false);
    expect(flags.fitness).toBe(0);
    for (let i = 0; i < 200; i++) tickFitness(flags, 60, true);
    expect(flags.fitness).toBe(100);
  });

  it('the household grazes a serving every eight game hours, fresh first, and stops at empty', () => {
    const h = createHousehold(); h.fridge.basic = 1; h.fridge.fresh = 1;
    const flags: Record<string, unknown> = {};
    expect(snackTick(h, flags, 7 * 60)).toBe(false);
    expect(snackTick(h, flags, 60)).toBe(true);
    expect(h.fridge).toEqual({ basic: 1, fresh: 0 });
    expect(snackTick(h, flags, 8 * 60)).toBe(true);
    expect(snackTick(h, flags, 8 * 60)).toBe(false);
    expect(h.fridge).toEqual({ basic: 0, fresh: 0 });
  });

  it('bills say what is next and whether it is late', () => {
    const life = createLife(1);
    life.bills = [];
    expect(billsStatus(life, 1).label).toBe('Paid up');
    life.bills.push({ id: 'r', kind: 'rent', label: 'Rent', amount: 400, dueDay: 3, fee: 25, overdue: false, reminded: false } as never);
    expect(billsStatus(life, 1)).toMatchObject({ label: 'Due in 2 days', overdue: false, amount: 400 });
    life.bills[0].overdue = true;
    expect(billsStatus(life, 4)).toMatchObject({ label: 'Overdue', overdue: true, amount: 425 });
  });

  it('puts it all together', () => {
    const h = createHousehold();
    const v = vitals(h, createLife(1), { fitness: 55 }, 1, 120);
    expect(v.fitness).toBe(55);
    expect(v.bond).toBe(100);
    expect(v.bills.label).toBeDefined();
  });
});
