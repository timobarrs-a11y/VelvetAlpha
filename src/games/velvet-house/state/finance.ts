/**
 * Bills and the bank. Rent, electric, water and internet come due on fixed
 * weekdays, each a fixed amount, and the player pays each one by hand. Every
 * dollar in or out lands in the ledger. Pay from the job builds up during the
 * week and arrives on Friday evening.
 */
import { weekday } from './time';
import type { HouseholdState } from './household';
import { nextId, LEDGER_MAX, type Bill, type BillKind, type LifeState } from './life';

export interface BillDef {
  kind: BillKind;
  label: string;
  amount: number;
  /** 0 = Monday … 6 = Sunday. */
  dueWeekday: number;
  fee: number;
}

export const BILLS: BillDef[] = [
  { kind: 'rent', label: 'Rent', amount: 400, dueWeekday: 0, fee: 25 },
  { kind: 'electric', label: 'Electric', amount: 70, dueWeekday: 2, fee: 25 },
  { kind: 'water', label: 'Water', amount: 40, dueWeekday: 4, fee: 25 },
  { kind: 'internet', label: 'Internet', amount: 30, dueWeekday: 4, fee: 10 },
];

/** A bill arrives this many days before it's due, at 9:00. */
export const BILL_NOTICE_DAYS = 3;
export const BILL_HOUR = 9;
/** Pay from the week's work arrives on Friday at this hour. */
export const PAYDAY_WEEKDAY = 4;
export const PAYDAY_HOUR = 17.5;

/** The next day on or after `day` that falls on `wd`. */
export function nextWeekday(day: number, wd: number): number {
  return day + ((wd - weekday(day) + 7) % 7);
}

export function billTotal(b: Bill): number {
  return b.amount + (b.overdue ? b.fee : 0);
}

/** Money in or out, with a line in the ledger. */
export function record(h: HouseholdState, life: LifeState, day: number, minutes: number, label: string, amount: number): void {
  life.ledger.unshift({ day, minutes: Math.floor(minutes), label, amount, balance: h.money });
  if (life.ledger.length > LEDGER_MAX) life.ledger.length = LEDGER_MAX;
}

/** Take money out for something, if there's enough. */
export function withdraw(h: HouseholdState, life: LifeState, day: number, minutes: number, label: string, amount: number): boolean {
  if (amount > h.money) return false;
  h.money -= amount;
  h.spentToday += amount;
  record(h, life, day, minutes, label, -amount);
  return true;
}

export function deposit(h: HouseholdState, life: LifeState, day: number, minutes: number, label: string, amount: number): void {
  h.money += amount;
  h.earnedToday += amount;
  record(h, life, day, minutes, label, amount);
}

function consequence(h: HouseholdState, life: LifeState, kind: BillKind, on: boolean): void {
  if (kind === 'electric') h.power = on;
  if (kind === 'water') life.water = on;
  if (kind === 'internet') life.internet = on;
}

const LATE_LINE: Record<BillKind, string> = {
  rent: "Rent is late. A $25 late fee was added, and there's a note from the landlord on the door.",
  electric: 'The electric bill went unpaid and the power is off.',
  water: 'The water bill went unpaid and the water is off. No showers until it is paid.',
  internet: 'The internet bill went unpaid and the internet is off. Computer side jobs are on hold.',
};

/**
 * Runs every step: new bills arrive, reminders go out the day before, unpaid
 * bills go overdue (with a fee and the service off), and Friday's paycheck lands.
 */
export function financeTick(h: HouseholdState, life: LifeState, day: number, minutes: number, log: (msg: string) => void): void {
  const hour = minutes / 60;
  for (const def of BILLS) {
    const dueDay = nextWeekday(day, def.dueWeekday);
    const daysOut = dueDay - day;
    const arrived = daysOut < BILL_NOTICE_DAYS || (daysOut === BILL_NOTICE_DAYS && hour >= BILL_HOUR);
    if (arrived && dueDay > life.issued[def.kind]) {
      life.issued[def.kind] = dueDay;
      life.bills.push({ id: nextId(life, 'b'), kind: def.kind, label: def.label, amount: def.amount, dueDay, fee: def.fee, overdue: false, reminded: false });
      log(`${def.label} bill arrived: $${def.amount}, due ${daysOut === 0 ? 'today' : daysOut === 1 ? 'tomorrow' : `in ${daysOut} days`}. Pay it on the phone.`);
    }
  }
  for (const b of life.bills) {
    if (!b.reminded && !b.overdue && day === b.dueDay - 1 && hour >= BILL_HOUR) {
      b.reminded = true;
      log(`Reminder: ${b.label.toLowerCase()} ($${b.amount}) is due tomorrow.`);
    }
    if (!b.overdue && day > b.dueDay) {
      b.overdue = true;
      consequence(h, life, b.kind, false);
      if (b.kind === 'electric') {
        const spoiled = h.fridge.fresh;
        h.fridge.fresh = 0;
        log(`${LATE_LINE.electric}${spoiled ? ` ${spoiled} fresh meals spoiled in the dead fridge.` : ''}`);
      } else {
        log(LATE_LINE[b.kind]);
      }
    }
  }
  if (weekday(day) === PAYDAY_WEEKDAY && hour >= PAYDAY_HOUR && life.lastPayDay !== day) {
    life.lastPayDay = day;
    if (life.wagesOwed > 0) {
      const pay = Math.round(life.wagesOwed);
      life.wagesOwed = 0;
      deposit(h, life, day, minutes, 'Paycheck: Corner Market', pay);
      log(`Payday! $${pay} went into the bank.`);
    }
  }
}

/** Pay one bill from the bank. The service comes back on if nothing else of its kind is overdue. */
export function payBill(h: HouseholdState, life: LifeState, id: string, day: number, minutes: number, log: (msg: string) => void): boolean {
  const b = life.bills.find(x => x.id === id);
  if (!b) return false;
  const total = billTotal(b);
  if (!withdraw(h, life, day, minutes, `${b.label}${b.overdue ? ' (with late fee)' : ''}`, total)) {
    log(`Not enough in the bank for ${b.label.toLowerCase()}. You need $${total - h.money} more.`);
    return false;
  }
  life.bills = life.bills.filter(x => x !== b);
  if (b.overdue && !life.bills.some(x => x.kind === b.kind && x.overdue)) {
    consequence(h, life, b.kind, true);
    const back: Partial<Record<BillKind, string>> = { electric: ' The power is back on.', water: ' The water is back on.', internet: ' The internet is back.' };
    log(`Paid ${b.label.toLowerCase()}: $${total}.${back[b.kind] ?? ''}`);
  } else {
    log(`Paid ${b.label.toLowerCase()}: $${total}.`);
  }
  return true;
}

/** Bills still to pay, soonest first. */
export function openBills(life: LifeState): Bill[] {
  return [...life.bills].sort((a, b) => a.dueDay - b.dueDay);
}

/** What the bills cost in a week, for the Bank page. */
export const WEEKLY_BILLS = BILLS.reduce((s, b) => s + b.amount, 0);
