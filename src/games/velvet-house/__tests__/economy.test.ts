import { describe, it, expect } from 'vitest';
import {
  billAmount, billDue, nextBillAt, shouldGenerateBill, shouldOverdueBill,
  billTotal, canAfford, spend, earn, workPay, deliveryArriveTime,
  shouldDeliver, servings, spoiledFresh, fridgeAfterSpoil,
  needsPower, errandCost, SEASON_BILL_EXTRA, BASE_BILL, LATE_FEE,
} from '../state/economy';
import { RNG } from '../state/rng';
import type { BillState, FridgeState, DeliveryState, ParcelState } from '../state/economy';

describe('economy — bill amounts', () => {
  it('calculates base bill with seasonal extra', () => {
    expect(billAmount(0)).toBe(180);
    expect(billAmount(1)).toBe(210);
    expect(billAmount(2)).toBe(180);
    expect(billAmount(3)).toBe(240);
  });

  it('season extras match original array', () => {
    expect(SEASON_BILL_EXTRA).toEqual([0, 30, 0, 60]);
  });

  it('computes due time as 48 hours after bill arrival', () => {
    expect(billDue(1000)).toBe(1000 + 48 * 60);
  });

  it('computes next bill time 3 days after given day at 9am', () => {
    expect(nextBillAt(1)).toBe((1 + 3) * 1440 + 9 * 60);
  });
});

describe('economy — bill triggers', () => {
  it('should generate bill when no bill and time reached', () => {
    expect(shouldGenerateBill(null, 500, 500)).toBe(true);
    expect(shouldGenerateBill(null, 500, 499)).toBe(false);
    expect(shouldGenerateBill({ amount: 180, due: 600, overdue: false }, 500, 500)).toBe(false);
    expect(shouldGenerateBill(null, null, 500)).toBe(false);
  });

  it('should mark overdue when past due and not already overdue', () => {
    const bill: BillState = { amount: 180, due: 600, overdue: false };
    expect(shouldOverdueBill(bill, 600)).toBe(true);
    expect(shouldOverdueBill(bill, 599)).toBe(false);
    expect(shouldOverdueBill({ ...bill, overdue: true }, 700)).toBe(false);
    expect(shouldOverdueBill(null, 700)).toBe(false);
  });
});

describe('economy — payments', () => {
  it('billTotal includes late fee only when overdue', () => {
    expect(billTotal({ amount: 180, due: 600, overdue: false })).toBe(180);
    expect(billTotal({ amount: 180, due: 600, overdue: true })).toBe(205);
  });

  it('canAfford checks money >= cost', () => {
    expect(canAfford(100, 50)).toBe(true);
    expect(canAfford(50, 100)).toBe(false);
    expect(canAfford(100, 100)).toBe(true);
  });

  it('spend returns updated money or rejects', () => {
    expect(spend(100, 30)).toEqual({ money: 70, spent: 30, ok: true });
    expect(spend(20, 30)).toEqual({ money: 20, spent: 0, ok: false });
  });

  it('earn adds to money', () => {
    expect(earn(100, 50)).toEqual({ money: 150, earned: 50 });
  });

  it('LATE_FEE is 25', () => {
    expect(LATE_FEE).toBe(25);
  });
});

describe('economy — work pay', () => {
  it('calculates pay for full shift', () => {
    const r = workPay(9 * 60, 17 * 60, 9, 17, 15);
    expect(r.hours).toBe(8);
    expect(r.pay).toBe(120);
  });

  it('clamps hours to work window', () => {
    const r = workPay(7 * 60, 20 * 60, 9, 17, 15);
    expect(r.hours).toBe(8);
    expect(r.pay).toBe(120);
  });

  it('clamps to work window length', () => {
    const r = workPay(18 * 60, 20 * 60, 9, 17, 15);
    expect(r.hours).toBe(2);
    expect(r.pay).toBe(30);
  });
});

describe('economy — deliveries', () => {
  it('deliveryArriveTime differs by kind', () => {
    expect(deliveryArriveTime('groceries', 100)).toBe(130);
    expect(deliveryArriveTime('takeout', 100)).toBe(135);
  });

  it('shouldDeliver when arrived and no parcel', () => {
    const d: DeliveryState = { kind: 'groceries', arrive: 100 };
    expect(shouldDeliver(d, null, 100)).toEqual({ deliver: true });
    expect(shouldDeliver(d, null, 99)).toEqual({ deliver: false });
  });

  it('defers delivery when parcel already waiting', () => {
    const d: DeliveryState = { kind: 'groceries', arrive: 100 };
    const p: ParcelState = { kind: 'groceries', servings: 8, fresh: true, taken: false };
    const r = shouldDeliver(d, p, 100);
    expect(r.deliver).toBe(false);
    expect(r.newArrive).toBe(115);
  });
});

describe('economy — fridge', () => {
  it('servings sums fresh + basic', () => {
    expect(servings({ fresh: 4, basic: 8 })).toBe(12);
  });

  it('spoiledFresh returns fresh count', () => {
    expect(spoiledFresh({ fresh: 4, basic: 8 })).toBe(4);
  });

  it('fridgeAfterSpoil zeroes fresh, keeps basic', () => {
    expect(fridgeAfterSpoil({ fresh: 4, basic: 8 })).toEqual({ fresh: 0, basic: 8 });
  });
});

describe('economy — power', () => {
  it('needsPower matches original list', () => {
    expect(needsPower('tv')).toBe(true);
    expect(needsPower('cook')).toBe(true);
    expect(needsPower('sleep')).toBe(false);
    expect(needsPower('wander')).toBe(false);
  });
});

describe('economy — errands', () => {
  it('errandCost returns 20 for friends, 0 otherwise', () => {
    expect(errandCost('friends')).toBe(20);
    expect(errandCost('market')).toBe(0);
    expect(errandCost('work')).toBe(0);
  });
});
