import type { RNG } from './rng';

export interface FridgeState {
  fresh: number;
  basic: number;
}

export interface BillState {
  amount: number;
  due: number;
  overdue: boolean;
}

export interface ParcelState {
  kind: 'groceries' | 'takeout';
  servings: number;
  fresh: boolean;
  taken: boolean;
  for?: unknown;
}

export interface DeliveryState {
  kind: 'groceries' | 'takeout';
  arrive: number;
  for?: unknown;
  servings?: number;
  fresh?: boolean;
}

export const SEASON_BILL_EXTRA = [0, 30, 0, 60];
export const BASE_BILL = 180;
export const LATE_FEE = 25;
export const BILL_DUE_HOURS = 48;
export const BILL_INTERVAL_DAYS = 3;
export const BILL_HOUR = 9;

export function billAmount(seasonIdx: number): number {
  return BASE_BILL + (SEASON_BILL_EXTRA[seasonIdx] || 0);
}

export function billDue(absMin: number): number {
  return absMin + BILL_DUE_HOURS * 60;
}

export function nextBillAt(day: number): number {
  return (day + BILL_INTERVAL_DAYS) * 1440 + BILL_HOUR * 60;
}

export function shouldGenerateBill(
  bill: BillState | null,
  nextBillAt: number | null,
  absMin: number
): boolean {
  return !bill && nextBillAt !== null && absMin >= nextBillAt;
}

export function shouldOverdueBill(bill: BillState | null, absMin: number): boolean {
  return !!bill && !bill.overdue && absMin >= bill.due;
}

export function billTotal(bill: BillState): number {
  return bill.amount + (bill.overdue ? LATE_FEE : 0);
}

export function canAfford(money: number, cost: number): boolean {
  return money >= cost;
}

export function spend(money: number, cost: number): { money: number; spent: number; ok: boolean } {
  if (cost > money) return { money, spent: 0, ok: false };
  return { money: money - cost, spent: cost, ok: true };
}

export function earn(money: number, amount: number): { money: number; earned: number } {
  return { money: money + amount, earned: amount };
}

export function workPay(
  clockIn: number,
  absMin: number,
  workStart: number,
  workEnd: number,
  wage: number
): { hours: number; pay: number } {
  const hours = Math.max(0, Math.min(workEnd - workStart, (absMin - clockIn) / 60));
  return { hours, pay: Math.round(hours * wage) };
}

export function deliveryArriveTime(kind: string, absMin: number): number {
  return absMin + (kind === 'takeout' ? 35 : 30);
}

export function shouldDeliver(
  delivery: DeliveryState | null,
  parcel: ParcelState | null,
  absMin: number
): { deliver: boolean; newArrive?: number } {
  if (!delivery || absMin < delivery.arrive) return { deliver: false };
  if (parcel) return { deliver: false, newArrive: delivery.arrive + 15 };
  return { deliver: true };
}

export function servings(fridge: FridgeState): number {
  return fridge.fresh + fridge.basic;
}

export function spoiledFresh(fridge: FridgeState): number {
  return fridge.fresh;
}

export function fridgeAfterSpoil(fridge: FridgeState): FridgeState {
  return { fresh: 0, basic: fridge.basic };
}

export const POWER_CUT_ACTIVITIES = [
  'tv', 'coffee', 'cook', 'records', 'arcade', 'dance', 'danceTogether', 'lightsOn', 'freelance'
];

export function needsPower(activityName: string): boolean {
  return POWER_CUT_ACTIVITIES.includes(activityName);
}

export function errandDuration(kind: string, rng: RNG): number {
  switch (kind) {
    case 'work': return 0;
    case 'market': return 55 + rng.next() * 25;
    case 'shop': return 35 + rng.next() * 20;
    case 'dogwalk': return 30 + rng.next() * 20;
    case 'friends': return 150 + rng.next() * 60;
    default: return 60;
  }
}

export function errandCost(kind: string): number {
  switch (kind) {
    case 'friends': return 20;
    default: return 0;
  }
}
