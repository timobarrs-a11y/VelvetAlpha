import { describe, it, expect } from 'vitest';
import {
  createHousehold, spend, earn, servings, messOf,
  billTick, deliveryTick, orderGroceries, orderTakeout, stockFridge,
  consumeMeal, washDishes, laundryTick, doLaundry,
  addDirt, dirtTick, scrubDirt, worstDirt, payBill, newDayReset,
} from '../state/household';

const noopLog = () => {};

describe('household economy', () => {
  it('starts with $850 and 8 basic meals', () => {
    const h = createHousehold();
    expect(h.money).toBe(850);
    expect(servings(h)).toBe(8);
  });

  it('spend returns false when broke and deducts when not', () => {
    const h = createHousehold();
    expect(spend(h, 900)).toBe(false);
    expect(h.money).toBe(850);
    expect(spend(h, 100)).toBe(true);
    expect(h.money).toBe(750);
    expect(h.spentToday).toBe(100);
  });

  it('earn adds to money and earnedToday', () => {
    const h = createHousehold();
    earn(h, 50);
    expect(h.money).toBe(900);
    expect(h.earnedToday).toBe(50);
  });

  it('newDayReset zeroes the daily tallies and logs', () => {
    const h = createHousehold();
    earn(h, 100);
    spend(h, 30);
    let msg = '';
    newDayReset(h, (m) => (msg = m));
    expect(h.earnedToday).toBe(0);
    expect(h.spentToday).toBe(0);
    expect(msg).toContain('100');
    expect(msg).toContain('30');
  });
});

describe('fridge and meals', () => {
  it('consumes fresh before basic', () => {
    const h = createHousehold();
    h.fridge.fresh = 3;
    expect(consumeMeal(h)).toBe(true);
    expect(h.fridge.fresh).toBe(2);
    expect(h.dishes).toBe(1);
  });

  it('returns false when empty', () => {
    const h = createHousehold();
    h.fridge.basic = 0;
    h.fridge.fresh = 0;
    expect(consumeMeal(h)).toBe(false);
  });

  it('stocking groceries adds servings', () => {
    const h = createHousehold();
    orderGroceries(h, 100, 8, true);
    deliveryTick(h, 131, noopLog);
    expect(h.parcel).not.toBeNull();
    stockFridge(h, noopLog);
    expect(h.fridge.fresh).toBe(8);
    expect(h.parcel).toBeNull();
  });

  it('washing dishes reduces the count', () => {
    const h = createHousehold();
    h.dishes = 5;
    washDishes(h, 3);
    expect(h.dishes).toBe(2);
    washDishes(h, 99);
    expect(h.dishes).toBe(0);
  });
});

describe('bills', () => {
  it('issues a bill when nextBillAt is reached', () => {
    const h = createHousehold();
    billTick(h, h.nextBillAt!, noopLog);
    expect(h.bill).not.toBeNull();
    expect(h.nextBillAt).toBeNull();
    expect(h.bill!.amount).toBeGreaterThanOrEqual(180);
  });

  it('cuts power when overdue', () => {
    const h = createHousehold();
    billTick(h, h.nextBillAt!, noopLog);
    expect(h.bill).not.toBeNull();
    h.fridge.fresh = 2;
    billTick(h, h.bill!.dueAbsMin, noopLog);
    expect(h.bill!.overdue).toBe(true);
    expect(h.power).toBe(false);
    expect(h.fridge.fresh).toBe(0);
  });

  it('payBill restores power and schedules the next bill', () => {
    const h = createHousehold();
    billTick(h, h.nextBillAt!, noopLog);
    const due = h.bill!.dueAbsMin;
    billTick(h, due, noopLog);
    expect(h.power).toBe(false);
    payBill(h, due + 1, noopLog);
    expect(h.power).toBe(true);
    expect(h.bill).toBeNull();
    expect(h.nextBillAt).toBe(due + 1 + 3 * 1440);
  });
});

describe('deliveries', () => {
  it('groceries arrive and become a parcel', () => {
    const h = createHousehold();
    orderGroceries(h, 100, 8, false);
    deliveryTick(h, 129, noopLog);
    expect(h.parcel).toBeNull();
    deliveryTick(h, 130, noopLog);
    expect(h.parcel).not.toBeNull();
    expect(h.parcel!.kind).toBe('groceries');
  });

  it('takeout arrives and becomes a parcel', () => {
    const h = createHousehold();
    orderTakeout(h, 100);
    deliveryTick(h, 136, noopLog);
    expect(h.parcel).not.toBeNull();
    expect(h.parcel!.kind).toBe('takeout');
  });

  it('blocks a second delivery while one is pending', () => {
    const h = createHousehold();
    orderGroceries(h, 100, 8, false);
    expect(orderTakeout(h, 100)).toBe(false);
  });
});

describe('dirt and cleaning', () => {
  it('accumulates over time', () => {
    const h = createHousehold();
    addDirt(h, 1, 'floor', 'dust', 4, 3);
    dirtTick(h, 30);
    expect(h.dirt[0].a).toBeGreaterThan(0.3);
  });

  it('worstDirt finds the messiest unclaimed spot', () => {
    const h = createHousehold();
    addDirt(h, 1, 'floor', 'dust', 4, 3);
    addDirt(h, 0, 'floor', 'mud', 2, 1);
    h.dirt[1].a = 0.9;
    const w = worstDirt(h);
    expect(w).not.toBeNull();
    expect(w!.type).toBe('mud');
  });

  it('scrubDirt removes the spot', () => {
    const h = createHousehold();
    const d = addDirt(h, 1, 'floor', 'dust', 4, 3)!;
    scrubDirt(h, d);
    expect(h.dirt.length).toBe(0);
  });

  it('messOf sums all dirt amounts', () => {
    const h = createHousehold();
    addDirt(h, 1, 'floor', 'dust', 4, 3);
    addDirt(h, 0, 'floor', 'mud', 2, 1);
    h.dirt[0].a = 0.5;
    h.dirt[1].a = 0.3;
    expect(messOf(h)).toBeCloseTo(0.8);
  });
});

describe('laundry', () => {
  it('piles up over time', () => {
    const h = createHousehold();
    laundryTick(h, 480);
    expect(h.laundryPile).toBeGreaterThan(0);
  });

  it('doLaundry reduces the pile', () => {
    const h = createHousehold();
    h.laundryPile = 4;
    doLaundry(h);
    expect(h.laundryPile).toBe(1);
  });
});
