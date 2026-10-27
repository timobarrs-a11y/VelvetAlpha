/**
 * The phone: the Bank (balance and every transaction), Bills (pay each one by
 * hand), Odd jobs (side-job offers and progress) and Routine (Jordan's day).
 * `phoneView` turns game state into what's shown; `phoneHtml` draws it.
 */
import type { HouseholdState } from '../state/household';
import type { LifeState, SideJobId } from '../state/life';
import { billTotal, openBills, WEEKLY_BILLS, PAYDAY_WEEKDAY } from '../state/finance';
import { SIDE_JOBS, MAX_TAKEN, blockedBy, progress } from '../state/sideJobs';
import { CORNER_MARKET, isWorkday, hourLabel, dayPay } from '../state/routine';
import { DAYS, weekday, clockText } from '../state/time';

export type PhoneTab = 'bank' | 'bills' | 'jobs' | 'routine';

export interface PhoneView {
  balance: number;
  wagesOwed: number;
  paydayLabel: string;
  weeklyBills: number;
  ledger: Array<{ when: string; label: string; amount: number; balance: number }>;
  bills: Array<{ id: string; label: string; total: number; due: string; overdue: boolean; canPay: boolean }>;
  services: { power: boolean; water: boolean; internet: boolean };
  offers: Array<{ id: string; title: string; client: string; pay: number; hours: string; expires: string }>;
  canTake: boolean;
  taken: Array<{ id: string; title: string; client: string; pay: number; pct: number; working: boolean; blocked: string | null }>;
  routine: { wake: string; weekendWake: string; bed: string; shower: boolean };
  job: string;
  canCallIn: boolean;
  calledIn: boolean;
  away: boolean;
}

function dueLabel(dueDay: number, day: number): string {
  const d = dueDay - day;
  if (d < 0) return 'Overdue';
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due ${DAYS[weekday(dueDay)]}`;
}

function hoursLabel(min: number): string {
  const h = min / 60;
  return `${h % 1 ? h.toFixed(1) : h} h`;
}

function leftLabel(minutes: number): string {
  if (minutes < 60) return 'expires soon';
  const h = Math.round(minutes / 60);
  return h >= 24 ? `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? '' : 's'} left` : `${h} h left`;
}

export function phoneView(h: HouseholdState, life: LifeState, day: number, minutes: number, away: boolean): PhoneView {
  const now = day * 1440 + minutes;
  const hour = minutes / 60;
  const daysToPay = (PAYDAY_WEEKDAY - weekday(day) + 7) % 7;
  return {
    balance: h.money,
    wagesOwed: Math.round(life.wagesOwed),
    paydayLabel: daysToPay === 0 ? 'today' : daysToPay === 1 ? 'tomorrow' : DAYS[PAYDAY_WEEKDAY],
    weeklyBills: WEEKLY_BILLS,
    ledger: life.ledger.slice(0, 25).map(t => ({
      when: `${DAYS[weekday(t.day)]} ${clockText(t.minutes)}`, label: t.label, amount: t.amount, balance: t.balance,
    })),
    bills: openBills(life).map(b => ({
      id: b.id, label: b.label, total: billTotal(b), due: dueLabel(b.dueDay, day), overdue: b.overdue, canPay: h.money >= billTotal(b),
    })),
    services: { power: h.power, water: life.water, internet: life.internet },
    offers: life.offers.map(o => ({
      id: o.id, title: SIDE_JOBS[o.job].title, client: o.client, pay: SIDE_JOBS[o.job].pay,
      hours: hoursLabel(SIDE_JOBS[o.job].minutes), expires: leftLabel(o.expires - now),
    })),
    canTake: life.taken.length < MAX_TAKEN,
    taken: life.taken.map(t => ({
      id: t.id, title: SIDE_JOBS[t.job as SideJobId].title, client: t.client, pay: SIDE_JOBS[t.job].pay,
      pct: progress(t), working: life.working === t.id, blocked: blockedBy(h, life, t),
    })),
    routine: {
      wake: hourLabel(life.routine.wake), weekendWake: hourLabel(life.routine.weekendWake),
      bed: hourLabel(life.routine.bed), shower: life.routine.shower,
    },
    job: `${CORNER_MARKET.title}, ${CORNER_MARKET.place} · $${CORNER_MARKET.wage}/hr · ${hourLabel(CORNER_MARKET.start)}–${hourLabel(CORNER_MARKET.end)} weekdays · $${dayPay()} a day`,
    canCallIn: isWorkday(day) && !life.today.left && !life.today.calledIn && hour < CORNER_MARKET.end,
    calledIn: life.today.calledIn,
    away,
  };
}

const esc = (t: string): string => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US')}`;

const TABS: Array<[PhoneTab, string]> = [['bank', 'Bank'], ['bills', 'Bills'], ['jobs', 'Odd jobs'], ['routine', 'Routine']];

export function phoneHtml(v: PhoneView, tab: PhoneTab): string {
  const dueCount = v.bills.length;
  const tabs = `<div class="vh-shop-tabs vh-phone-tabs">${TABS.map(([k, l]) =>
    `<button data-phone-tab="${k}" class="${k === tab ? 'vh-active' : ''}">${l}${k === 'bills' && dueCount ? ` (${dueCount})` : ''}${k === 'jobs' && v.offers.length ? ` (${v.offers.length})` : ''}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'bank') {
    body = `<div class="vh-bank">
      <p class="vh-bank-label">Checking</p>
      <p class="vh-bank-balance" data-balance>${money(v.balance)}</p>
      <div class="vh-home-row"><span>Paycheck ${v.paydayLabel}</span><strong>${money(v.wagesOwed)} so far</strong></div>
      <div class="vh-home-row"><span>Bills each week</span><strong>${money(v.weeklyBills)}</strong></div>
      <h4 class="vh-order-floor">Transactions</h4>
      ${v.ledger.length ? `<ul class="vh-txns">${v.ledger.map(t => `<li>
        <span class="vh-txn-what"><strong>${esc(t.label)}</strong><small>${t.when}</small></span>
        <span class="vh-txn-amt ${t.amount < 0 ? 'vh-out' : 'vh-in'}">${t.amount < 0 ? '' : '+'}${money(t.amount)}<small>${money(t.balance)}</small></span>
      </li>`).join('')}</ul>` : '<p class="vh-empty">No transactions yet.</p>'}
    </div>`;
  } else if (tab === 'bills') {
    const svc = (name: string, on: boolean) => `<div class="vh-home-row"><span>${name}</span><strong class="${on ? '' : 'vh-off'}">${on ? 'On' : 'OFF'}</strong></div>`;
    body = `<div class="vh-bills">
      ${v.bills.length ? v.bills.map(b => `<div class="vh-shop-card${b.overdue ? ' vh-overdue' : ''}">
        <div class="vh-shop-info"><strong>${b.label}</strong><span class="vh-shop-desc">${b.due}${b.overdue ? ' · late fee added' : ''}</span></div>
        <div class="vh-shop-actions"><span class="vh-price">${money(b.total)}</span>
          <button data-pay="${b.id}" ${b.canPay ? '' : 'disabled'}>${b.canPay ? 'Pay' : 'Not enough'}</button></div>
      </div>`).join('') : '<p class="vh-empty">All paid up.</p>'}
      <h4 class="vh-order-floor">At home</h4>
      ${svc('Power', v.services.power)}${svc('Water', v.services.water)}${svc('Internet', v.services.internet)}
    </div>`;
  } else if (tab === 'jobs') {
    body = `<div class="vh-jobs">
      <h4 class="vh-order-floor">Working on</h4>
      ${v.taken.length ? v.taken.map(t => `<div class="vh-shop-card">
        <div class="vh-shop-info"><strong>${t.title}</strong><span class="vh-shop-desc">For ${esc(t.client)} · ${money(t.pay)} when finished</span>
          <div class="vh-progress" role="progressbar" aria-valuenow="${t.pct}" aria-valuemin="0" aria-valuemax="100" data-bar="${t.id}"><i style="width:${t.pct}%"></i></div>
          <span class="vh-shop-desc"><span data-pct="${t.id}">${t.pct}</span>% done${t.blocked ? ` · ${t.blocked}` : ''}</span></div>
        <div class="vh-shop-actions"><button data-work="${t.id}" ${t.working || t.blocked || v.away ? 'disabled' : ''}>${t.working ? 'Working' : 'Work on it'}</button></div>
      </div>`).join('') : '<p class="vh-empty">Nothing yet. Take an offer below.</p>'}
      <h4 class="vh-order-floor">Offers</h4>
      ${v.offers.length ? v.offers.map(o => `<div class="vh-shop-card">
        <div class="vh-shop-info"><strong>${o.title}</strong><span class="vh-shop-desc">For ${esc(o.client)} · ${o.hours} · <span data-exp="${o.id}">${o.expires}</span></span></div>
        <div class="vh-shop-actions"><span class="vh-price">${money(o.pay)}</span><button data-take="${o.id}" ${v.canTake ? '' : 'disabled'}>Take it</button></div>
      </div>`).join('') : '<p class="vh-empty">New offers come in every morning.</p>'}
      <p class="vh-wardrobe-hint">Paid when the work is finished. He can stop and come back to it.</p>
    </div>`;
  } else {
    const step = (key: string, label: string, value: string) => `<div class="vh-home-row vh-step-row"><span>${label}</span>
      <span class="vh-stepper"><button data-routine="${key}" data-delta="-0.5" aria-label="Earlier">−</button><strong>${value}</strong><button data-routine="${key}" data-delta="0.5" aria-label="Later">+</button></span></div>`;
    body = `<div class="vh-routine">
      <p class="vh-wardrobe-hint">${esc(v.job)}</p>
      ${step('wake', 'Wake up on workdays', v.routine.wake)}
      ${step('weekendWake', 'Wake up on weekends', v.routine.weekendWake)}
      ${step('bed', 'Bedtime', v.routine.bed)}
      <div class="vh-home-row"><span>Shower in the morning</span><button data-routine="shower" class="vh-toggle" aria-pressed="${v.routine.shower}">${v.routine.shower ? 'Yes' : 'No'}</button></div>
      <div class="vh-home-actions">
        ${v.calledIn ? '<p class="vh-wardrobe-hint">Staying home today. No pay for today.</p>'
          : v.canCallIn ? '<button data-callin>Stay home today (no pay)</button>' : ''}
      </div>
    </div>`;
  }
  return `<div class="vh-phone">${tabs}${body}</div>`;
}

/**
 * The parts of the view that tick by on their own (progress, time left on
 * offers). The page is redrawn only when the rest changes; these are updated
 * in place, so buttons aren't replaced under the player's finger.
 */
export function phoneStructure(v: PhoneView): PhoneView {
  return { ...v, taken: v.taken.map(t => ({ ...t, pct: 0 })), offers: v.offers.map(o => ({ ...o, expires: '' })) };
}

/** Updates progress bars and time left in place. */
export function patchPhone(root: HTMLElement, v: PhoneView): void {
  for (const t of v.taken) {
    const bar = root.querySelector<HTMLElement>(`[data-bar="${t.id}"]`);
    if (bar) { bar.setAttribute('aria-valuenow', String(t.pct)); (bar.firstElementChild as HTMLElement | null)?.style.setProperty('width', `${t.pct}%`); }
    const pct = root.querySelector<HTMLElement>(`[data-pct="${t.id}"]`);
    if (pct) pct.textContent = String(t.pct);
  }
  for (const o of v.offers) {
    const exp = root.querySelector<HTMLElement>(`[data-exp="${o.id}"]`);
    if (exp) exp.textContent = o.expires;
  }
}

/** Counts a number shown as money from one value to another, e.g. $958 → $558 after rent. */
export function animateMoney(node: HTMLElement, from: number, to: number, ms = 700): void {
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / ms);
    const eased = 1 - Math.pow(1 - k, 3);
    node.textContent = money(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
