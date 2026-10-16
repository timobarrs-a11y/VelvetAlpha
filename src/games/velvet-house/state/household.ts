import { seasonIdx } from './time';

export interface FridgeState {
  basic: number;
  fresh: number;
}

export interface BillState {
  amount: number;
  dueAbsMin: number;
  overdue: boolean;
}

export interface ParcelState {
  kind: 'groceries' | 'takeout';
  servings: number;
  fresh: boolean;
}

export interface DeliveryState {
  kind: 'groceries' | 'takeout';
  arriveAbsMin: number;
  servings: number;
  fresh: boolean;
}

export interface DirtSpot {
  id: number;
  level: number;
  kind: 'floor' | 'wall';
  type: string;
  x: number;
  y: number;
  a: number;
  max: number;
  claim: boolean;
}

export interface HouseholdState {
  money: number;
  earnedToday: number;
  spentToday: number;
  power: boolean;
  fridge: FridgeState;
  dishes: number;
  laundryPile: number;
  bill: BillState | null;
  nextBillAt: number | null;
  delivery: DeliveryState | null;
  parcel: ParcelState | null;
  dirt: DirtSpot[];
  dirtClock: number;
  dirtSeq: number;
}

export function createHousehold(): HouseholdState {
  return {
    money: 850,
    earnedToday: 0,
    spentToday: 0,
    power: true,
    fridge: { basic: 8, fresh: 0 },
    dishes: 0,
    laundryPile: 0,
    bill: null,
    nextBillAt: (1 + 3) * 1440 + 9 * 60,
    delivery: null,
    parcel: null,
    dirt: [],
    dirtClock: 0,
    dirtSeq: 0,
  };
}

export function servings(h: HouseholdState): number {
  return h.fridge.basic + h.fridge.fresh;
}

export function messOf(h: HouseholdState): number {
  return h.dirt.reduce((s, d) => s + d.a, 0);
}

export function spend(h: HouseholdState, amount: number): boolean {
  if (amount > h.money) return false;
  h.money -= amount;
  h.spentToday += amount;
  return true;
}

export function earn(h: HouseholdState, amount: number): void {
  h.money += amount;
  h.earnedToday += amount;
}

export function orderGroceries(h: HouseholdState, absMin: number, servingsCount: number, fresh: boolean): boolean {
  if (h.delivery || h.parcel) return false;
  h.delivery = { kind: 'groceries', arriveAbsMin: absMin + 30, servings: servingsCount, fresh };
  return true;
}

export function orderTakeout(h: HouseholdState, absMin: number): boolean {
  if (h.delivery || h.parcel) return false;
  h.delivery = { kind: 'takeout', arriveAbsMin: absMin + 35, servings: 1, fresh: false };
  return true;
}

export function payBill(h: HouseholdState, absMin: number, log: (msg: string) => void): void {
  if (!h.bill) return;
  const total = h.bill.amount + (h.bill.overdue ? 25 : 0);
  if (!spend(h, total)) {
    log(`Not enough for the bill. You need $${total - h.money} more.`);
    return;
  }
  if (h.bill.overdue) {
    h.power = true;
    log('Bill paid with a $25 late fee. The power is back on.');
  } else {
    log(`Paid the $${h.bill.amount} bill.`);
  }
  h.bill = null;
  h.nextBillAt = absMin + 3 * 1440;
}

export function billTick(h: HouseholdState, absMin: number, log: (msg: string) => void): void {
  if (!h.bill && h.nextBillAt !== null && absMin >= h.nextBillAt) {
    const extra = [0, 30, 0, 60][seasonIdx(Math.floor(absMin / 1440))];
    h.bill = { amount: 180 + extra, dueAbsMin: absMin + 2 * 1440, overdue: false };
    h.nextBillAt = null;
    const note = extra ? (seasonIdx(Math.floor(absMin / 1440)) === 3 ? ' Heating is up this time of year.' : ' The AC bumped it up.') : '';
    log(`Rent and utilities: $${h.bill.amount} due in two days.${note}`);
  }
  if (h.bill && !h.bill.overdue && absMin >= h.bill.dueAbsMin) {
    h.bill.overdue = true;
    h.power = false;
    const spoiled = h.fridge.fresh;
    h.fridge.fresh = 0;
    log(`The bill went unpaid and the power got cut.${spoiled ? ` ${spoiled} fresh meals spoiled in the dead fridge.` : ''}`);
  }
}

export function deliveryTick(h: HouseholdState, absMin: number, log: (msg: string) => void): void {
  if (h.delivery && absMin >= h.delivery.arriveAbsMin) {
    if (h.parcel) {
      h.delivery.arriveAbsMin += 15;
      return;
    }
    h.parcel = { kind: h.delivery.kind, servings: h.delivery.servings, fresh: h.delivery.fresh };
    h.delivery = null;
    if (h.parcel.kind === 'groceries') {
      log(`Groceries arrived at the door (${h.parcel.servings} ${h.parcel.fresh ? 'fresh ' : ''}meals). Someone needs to put them away.`);
    } else {
      log('Takeout is at the door.');
    }
  }
}

export function stockFridge(h: HouseholdState, log: (msg: string) => void): void {
  if (!h.parcel) return;
  if (h.parcel.kind === 'groceries') {
    if (h.parcel.fresh) h.fridge.fresh += h.parcel.servings;
    else h.fridge.basic += h.parcel.servings;
    log('Groceries put away in the fridge.');
  }
  h.parcel = null;
}

export function consumeMeal(h: HouseholdState): boolean {
  if (h.fridge.fresh > 0) { h.fridge.fresh--; h.dishes++; return true; }
  if (h.fridge.basic > 0) { h.fridge.basic--; h.dishes++; return true; }
  return false;
}

export function washDishes(h: HouseholdState, count: number): void {
  h.dishes = Math.max(0, h.dishes - count);
}

export function laundryTick(h: HouseholdState, gameMin: number): void {
  h.laundryPile = Math.min(6, h.laundryPile + gameMin / 480);
}

export function doLaundry(h: HouseholdState): void {
  h.laundryPile = Math.max(0, h.laundryPile - 3);
}

export function addDirt(h: HouseholdState, level: number, kind: 'floor' | 'wall', type: string, x: number, y: number, max = 1): DirtSpot | null {
  const existing = h.dirt.find((d) => d.level === level && d.kind === kind && d.type === type && Math.abs(d.x - x) < 0.3 && Math.abs(d.y - y) < 0.3);
  if (existing) {
    existing.a = Math.min(existing.max, existing.a + 0.3);
    return existing;
  }
  const d: DirtSpot = { id: ++h.dirtSeq, level, kind, type, x, y, a: 0.3, max, claim: false };
  h.dirt.push(d);
  return d;
}

export function dirtTick(h: HouseholdState, gameMin: number): void {
  for (const d of h.dirt) {
    if (!d.claim && d.a < d.max) d.a = Math.min(d.max, d.a + gameMin / 75);
  }
}

export function scrubDirt(h: HouseholdState, spot: DirtSpot): void {
  spot.a = 0;
  spot.claim = false;
  h.dirt = h.dirt.filter((d) => d.a > 0.02);
}

export function worstDirt(h: HouseholdState): DirtSpot | null {
  const cands = h.dirt.filter((d) => !d.claim && d.a > 0.12);
  if (!cands.length) return null;
  return cands.sort((a, b) => b.a - a.a)[0];
}

export interface WorkSchedule {
  start: number;
  end: number;
  leave: number;
  wage: number;
  job: string;
}

export const JORDAN_WORK: WorkSchedule = { start: 8, end: 15, leave: 7.5, wage: 18, job: 'the office' };
export const MAYA_WORK: WorkSchedule = { start: 11, end: 17.5, leave: 10.5, wage: 20, job: 'the studio' };

export function newDayReset(h: HouseholdState, log: (msg: string) => void): void {
  log(`Yesterday: +$${h.earnedToday} earned, −$${h.spentToday} spent.`);
  h.earnedToday = 0;
  h.spentToday = 0;
}
