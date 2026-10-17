/**
 * Drawer UI — the sidebar/bottom-sheet with pages: Shop, Goals, Do, Partner, You, Home, Log.
 * Pure DOM manipulation, called from main.ts.
 */
import { CATALOG, TABS, itemsForTab, lockOf, type CatalogEntry } from '../state/catalog';
import { SETTLE, LIFE, lifeGoalProgress, type GoalContext } from '../state/goals';
import { careerTitle } from '../state/career';

import { clockText, season, weekday, DAYS } from '../state/time';

export type DrawerPage = 'shop' | 'goals' | 'do' | 'partner' | 'you' | 'home' | 'log' | '';

export interface DrawerCallbacks {
  onClose: () => void;
  onBuy: (item: CatalogEntry, color?: string) => void;
  onOrder: (chain: string) => void;
  onPayBill: () => void;
  onOrderGroceries: () => void;
  onOrderTakeout: () => void;
  onTalk: () => void;
  onRestart: () => void;
  onPickLifeGoal: (goal: string) => void;
}

export interface DrawerState {
  page: DrawerPage;
  shopTab: string;
  money: number;
  bond: number;
  day: number;
  minutes: number;
  owned: Set<string>;
  careerLevel: number;
  careerPerf: number;
  lifeGoal: string | null;
  settleSeen: string[];
  goalCtx: GoalContext;
  dishes: number;
  laundryPile: number;
  fridgeBasic: number;
  fridgeFresh: number;
  power: boolean;
  billAmount: number | null;
  billOverdue: boolean;
  petCount: number;
  log: string[];
  partnerName: string;
  simName: string;
  townName: string;
  deliveryPending: boolean;
  mayaStatus: string;
}

const PAGE_TITLES: Record<string, string> = {
  shop: 'Shop',
  goals: 'Goals',
  do: 'Give an order',
  partner: 'Partner',
  you: 'You',
  home: 'Household',
  log: 'Today',
};

export function createDrawer(cb: DrawerCallbacks): {
  el: HTMLElement;
  dock: HTMLElement;
  open: (pg: DrawerPage) => void;
  close: () => void;
  render: (state: DrawerState) => void;
} {
  const el = document.createElement('aside');
  el.className = 'vh-drawer';
  el.dataset.open = '';
  el.hidden = true;
  el.innerHTML = `
    <div class="vh-drawer-head">
      <strong data-title>Shop</strong>
      <button class="vh-drawer-close" aria-label="Close">&times;</button>
    </div>
    <div class="vh-drawer-body">
      <section data-page="shop"></section>
      <section data-page="goals"></section>
      <section data-page="do"></section>
      <section data-page="partner"></section>
      <section data-page="you"></section>
      <section data-page="home"></section>
      <section data-page="log"></section>
    </div>`;

  const dock = document.createElement('nav');
  dock.className = 'vh-dock';
  dock.innerHTML = ['shop', 'goals', 'do', 'partner', 'you', 'home', 'log']
    .map(pg => `<button data-open="${pg}" aria-pressed="false">${PAGE_TITLES[pg]}</button>`)
    .join('');

  const closeBtn = el.querySelector('.vh-drawer-close')!;
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); cb.onClose(); openPage(''); });

  let currentPage: DrawerPage = '';

  function openPage(pg: DrawerPage): void {
    currentPage = pg;
    el.hidden = pg === '';
    el.dataset.open = pg;
    const titleEl = el.querySelector('[data-title]')!;
    titleEl.textContent = pg ? PAGE_TITLES[pg] : '';
    dock.querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.open === pg));
    });
  }

  dock.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      const pg = b.dataset.open as DrawerPage;
      openPage(currentPage === pg ? '' : pg);
    });
  });

  function render(state: DrawerState): void {
    if (state.page !== currentPage && state.page !== '') openPage(state.page);
    if (currentPage === 'shop') renderShop(state);
    else if (currentPage === 'goals') renderGoals(state);
    else if (currentPage === 'do') renderDo(state);
    else if (currentPage === 'partner') renderPartner(state);
    else if (currentPage === 'you') renderYou(state);
    else if (currentPage === 'home') renderHome(state);
    else if (currentPage === 'log') renderLog(state);
  }

  function renderShop(state: DrawerState): void {
    const sec = el.querySelector('[data-page="shop"]')!;
    const tab = state.shopTab || 'Today';
    const tabBtns = TABS.map(t =>
      `<button data-tab="${t}" class="${t === tab ? 'vh-active' : ''}">${t}</button>`
    ).join('');

    const items = itemsForTab(tab);
    const cards = items.map(item => {
      const lock = lockOf(item.id, state.day, state.bond);
      const owned = state.owned.has(item.id) && !item.repeat;
      const locked = lock?.locked;
      const tooExpensive = item.price > state.money;
      const cls = locked ? 'vh-locked' : owned ? 'vh-owned' : tooExpensive ? 'vh-poor' : '';
      const cols = item.cols
        ? `<div class="vh-swatches">${item.cols.map(c => `<span class="vh-swatch" style="background:${c}" data-color="${c}"></span>`).join('')}</div>`
        : '';
      const lockHint = locked ? `<span class="vh-lock">${lock!.hint}</span>` : '';
      return `<div class="vh-shop-card ${cls}" data-item="${item.id}">
        <div class="vh-shop-icon" data-icon="${item.id}"></div>
        <div class="vh-shop-info">
          <strong>${item.name}</strong>
          ${item.desc ? `<span class="vh-shop-desc">${item.desc}</span>` : ''}
          ${cols}
          ${lockHint}
        </div>
        <div class="vh-shop-actions">
          <span class="vh-price">$${item.price}</span>
          <button data-buy="${item.id}" ${locked || (owned ? 'disabled' : '')}>${owned ? 'Owned' : 'Buy'}</button>
        </div>
      </div>`;
    }).join('');

    sec.innerHTML = `<div class="vh-shop-tabs">${tabBtns}</div><div class="vh-shop-list">${cards || '<p class="vh-empty">Nothing here yet.</p>'}</div>`;

    sec.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => { state.shopTab = (b as HTMLElement).dataset.tab!; render(state); });
    });
    sec.querySelectorAll('[data-buy]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (b as HTMLElement).dataset.buy!;
        const item = CATALOG.find(c => c.id === id);
        if (item) cb.onBuy(item);
      });
    });
    sec.querySelectorAll('.vh-swatch').forEach(s => {
      s.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = (s.closest('.vh-shop-card') as HTMLElement)?.dataset.item;
        const item = CATALOG.find(c => c.id === card);
        if (item) cb.onBuy(item, (s as HTMLElement).dataset.color);
      });
    });
  }

  function renderGoals(state: DrawerState): void {
    const sec = el.querySelector('[data-page="goals"]')!;
    const settleItems = SETTLE.map(g => {
      const done = state.settleSeen.includes(g.id);
      return `<li class="${done ? 'vh-done' : ''}">
        <span class="vh-check">${done ? '\u2713' : '\u25CB'}</span>
        <span>${g.text}</span>
      </li>`;
    }).join('');

    const lifeGoalHtml = state.lifeGoal ? (() => {
      const path = LIFE[state.lifeGoal];
      if (!path) return '';
      const prog = lifeGoalProgress(state.lifeGoal, state.goalCtx.flags.lifeStep ?? 0);
      const steps = path.steps.map((s, i) => {
        const done = i < (state.goalCtx.flags.lifeStep ?? 0);
        return `<li class="${done ? 'vh-done' : ''}"><span class="vh-check">${done ? '\u2713' : '\u25CB'}</span><span>${s.text}</span></li>`;
      }).join('');
      return `<div class="vh-life-goal">
        <h4>${path.name} (${prog.current}/${prog.total})</h4>
        <ol>${steps}</ol>
      </div>`;
    })() : `<div class="vh-life-goal"><p>Choose a life goal to start earning rewards.</p></div>`;

    sec.innerHTML = `<div class="vh-goals">
      <h4>Move-in checklist</h4>
      <ul class="vh-checklist">${settleItems}</ul>
      ${lifeGoalHtml}
    </div>`;
  }

  function renderDo(state: DrawerState): void {
    const sec = el.querySelector('[data-page="do"]')!;
    const acts: { chain: string; label: string }[] = [
      { chain: 'cookeat', label: 'Cook a meal' },
      { chain: 'coffee', label: 'Make coffee' },
      { chain: 'shower', label: 'Take a shower' },
      { chain: 'tv', label: 'Watch TV' },
      { chain: 'workout', label: 'Work out' },
      { chain: 'read', label: 'Read a book' },
      { chain: 'dance', label: 'Dance' },
      { chain: 'clean', label: 'Clean up' },
      { chain: 'sleep', label: 'Go to sleep' },
    ];
    const buttons = acts.map(a =>
      `<button data-order="${a.chain}" class="vh-order-btn">${a.label}</button>`
    ).join('');
    sec.innerHTML = `<div class="vh-do"><p>Tell ${state.simName} what to do:</p><div class="vh-order-grid">${buttons}</div></div>`;
    sec.querySelectorAll('[data-order]').forEach(b => {
      b.addEventListener('click', () => cb.onOrder((b as HTMLElement).dataset.order!));
    });
  }

  function renderPartner(state: DrawerState): void {
    const sec = el.querySelector('[data-page="partner"]')!;
    sec.innerHTML = `<div class="vh-partner">
      <div class="vh-bond-bar">
        <span>Bond</span>
        <div class="vh-bar"><i style="width:${state.bond}%"></i></div>
        <strong>${state.bond}</strong>
      </div>
      <p class="vh-status">${state.mayaStatus}</p>
      <button data-talk class="vh-talk-btn">Talk to ${state.partnerName}</button>
    </div>`;
    sec.querySelector('[data-talk]')?.addEventListener('click', () => cb.onTalk());
  }

  function renderYou(state: DrawerState): void {
    const sec = el.querySelector('[data-page="you"]')!;
    sec.innerHTML = `<div class="vh-you">
      <h4>${state.simName}</h4>
      <p>Day ${state.day}, ${DAYS[weekday(state.day)]}, ${clockText(state.minutes)}</p>
      <p>${season(state.day)}</p>
      <p>Job: ${careerTitle({ level: state.careerLevel, perf: state.careerPerf })}</p>
    </div>`;
  }

  function renderHome(state: DrawerState): void {
    const sec = el.querySelector('[data-page="home"]')!;
    const sv = state.fridgeBasic + state.fridgeFresh;
    sec.innerHTML = `<div class="vh-home">
      <div class="vh-home-row"><span>Money</span><strong>$${state.money}</strong></div>
      <div class="vh-home-row"><span>Fridge</span><strong>${sv} meals</strong></div>
      <div class="vh-home-row"><span>Dishes</span><strong>${state.dishes}</strong></div>
      <div class="vh-home-row"><span>Laundry</span><strong>${state.laundryPile}/6</strong></div>
      <div class="vh-home-row"><span>Power</span><strong>${state.power ? 'On' : 'OFF'}</strong></div>
      ${state.billAmount !== null ? `<div class="vh-home-row vh-bill"><span>Bill due</span><strong>$${state.billAmount}${state.billOverdue ? ' (OVERDUE)' : ''}</strong></div>` : ''}
      <div class="vh-home-actions">
        ${state.billAmount !== null ? `<button data-paybill>Pay bill</button>` : ''}
        <button data-groceries ${state.deliveryPending ? 'disabled' : ''}>Order groceries ($40)</button>
        <button data-takeout ${state.deliveryPending ? 'disabled' : ''}>Order takeout ($25)</button>
      </div>
    </div>`;
    sec.querySelector('[data-paybill]')?.addEventListener('click', () => cb.onPayBill());
    sec.querySelector('[data-groceries]')?.addEventListener('click', () => cb.onOrderGroceries());
    sec.querySelector('[data-takeout]')?.addEventListener('click', () => cb.onOrderTakeout());
  }

  function renderLog(state: DrawerState): void {
    const sec = el.querySelector('[data-page="log"]')!;
    const items = state.log.slice(0, 20).map(l => `<li>${l}</li>`).join('');
    sec.innerHTML = `<ul class="vh-log-list">${items || '<li class="vh-empty">Nothing happening yet.</li>'}</ul>`;
  }

  return {
    el,
    dock,
    open: openPage,
    close: () => openPage(''),
    render,
  };
}
