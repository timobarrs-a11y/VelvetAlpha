/**
 * Drawer UI — the sidebar/bottom-sheet with pages: Shop, Goals, Do, Partner, You, Home, Log.
 * Pure DOM manipulation, called from main.ts.
 */
import { CATALOG, TABS, itemsForTab, lockOf, type CatalogEntry } from '../state/catalog';
import { SETTLE, LIFE, lifeGoalProgress, type GoalContext } from '../state/goals';
import { careerTitle } from '../state/career';

import { clockText, season, weekday, DAYS } from '../state/time';
import type { OwnedCloth, WardrobePersona } from '../state/clothing';

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
  onWear: (cloth: OwnedCloth) => void;
  // A persona: a whole look (shirt, pants and hat) in one tap.
  onWearPersona: (id: string) => void;
  // The salon: avatar items that are the player's everywhere once bought.
  onBuyAvatarItem: (itemId: string) => void;
}

// One thing for sale in the salon (see src/data/avatarCatalog.ts).
export interface SalonItem {
  id: string;
  name: string;
  price: number;
  owned: boolean;
  swatch?: string;
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
  closet: OwnedCloth[];
  personas: WardrobePersona[];
  wearing: { top: string; topStyle: string; bottom: string; bottomStyle?: string; hat?: string };
  salon: SalonItem[];
}

const SALON_TAB = 'Salon';

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
  // The shop tab stays where the player left it across refreshes (a purchase
  // redraws the drawer, and shouldn't bounce them back to the first tab).
  let currentTab = '';

  function openPage(pg: DrawerPage): void {
    currentPage = pg;
    el.hidden = pg === '';
    el.dataset.open = pg;
    const titleEl = el.querySelector('[data-title]')!;
    titleEl.textContent = pg ? PAGE_TITLES[pg] : '';
    dock.querySelectorAll<HTMLButtonElement>('button[data-open]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.open === pg));
    });
  }

  dock.querySelectorAll<HTMLButtonElement>('button[data-open]').forEach(b => {
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
    const tab = currentTab || state.shopTab || 'Today';
    const tabBtns = [...TABS, SALON_TAB].map(t =>
      `<button data-tab="${t}" class="${t === tab ? 'vh-active' : ''}">${t}</button>`
    ).join('');

    if (tab === SALON_TAB) {
      renderSalon(sec, tabBtns, state);
      return;
    }

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
      b.addEventListener('click', () => { currentTab = (b as HTMLElement).dataset.tab!; render(state); });
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

  // The salon sells looks for the player's own avatar. Bought here, they're
  // theirs outside the game too: in the avatar creator and everywhere their
  // face appears.
  function renderSalon(sec: Element, tabBtns: string, state: DrawerState): void {
    const cards = state.salon.map(item => {
      const tooExpensive = !item.owned && item.price > state.money;
      const cls = item.owned ? 'vh-owned' : tooExpensive ? 'vh-poor' : '';
      const swatch = item.swatch ? `<div class="vh-swatches"><span class="vh-swatch" style="background:${item.swatch}"></span></div>` : '';
      return `<div class="vh-shop-card ${cls}" data-salon-item="${item.id}">
        <div class="vh-shop-info">
          <strong>${item.name}</strong>
          <span class="vh-shop-desc">${item.owned ? 'Yours, in the game and out of it.' : 'Wear it in Velvet too, not just here.'}</span>
          ${swatch}
        </div>
        <div class="vh-shop-actions">
          <span class="vh-price">$${item.price}</span>
          <button data-salon-buy="${item.id}" ${item.owned ? 'disabled' : ''}>${item.owned ? 'Owned' : 'Buy'}</button>
        </div>
      </div>`;
    }).join('');
    sec.innerHTML = `<div class="vh-shop-tabs">${tabBtns}</div><div class="vh-shop-list">${cards || '<p class="vh-empty">The salon is restocking.</p>'}</div>`;
    sec.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => { currentTab = (b as HTMLElement).dataset.tab!; render(state); });
    });
    sec.querySelectorAll('[data-salon-buy]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.onBuyAvatarItem((b as HTMLElement).dataset.salonBuy!);
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
    // Grouped by where it happens, so the whole house is on offer.
    const groups: { floor: string; acts: { chain: string; label: string }[] }[] = [
      { floor: 'Kitchen & living room', acts: [
        { chain: 'cookeat', label: 'Cook a meal' }, { chain: 'coffee', label: 'Make coffee' },
        { chain: 'snack', label: 'Grab a snack' }, { chain: 'wipeCounter', label: 'Wipe the counters' },
        { chain: 'clean', label: 'Clean up' }, { chain: 'tv', label: 'Watch TV' },
        { chain: 'read', label: 'Read a book' }, { chain: 'window', label: 'Look out the window' },
        { chain: 'dance', label: 'Dance' }, { chain: 'soloDance', label: 'Dance around' },
      ] },
      { floor: 'Upstairs', acts: [
        { chain: 'shower', label: 'Take a shower' }, { chain: 'mirror', label: 'Get ready' },
        { chain: 'makeBed', label: 'Make the bed' }, { chain: 'foldClothes', label: 'Fold clothes' },
        { chain: 'journal', label: 'Write in a journal' }, { chain: 'freelance', label: 'Freelance' },
        { chain: 'meditate', label: 'Meditate' }, { chain: 'sleep', label: 'Go to sleep' },
      ] },
      { floor: 'Basement', acts: [
        { chain: 'workout', label: 'Run & lift' }, { chain: 'jumprope', label: 'Skip rope' },
        { chain: 'shadowbox', label: 'Shadowbox' }, { chain: 'stretch', label: 'Stretch' },
        { chain: 'laundry', label: 'Do laundry' }, { chain: 'rummage', label: 'Go through boxes' },
      ] },
      { floor: 'Yard', acts: [
        { chain: 'newspaper', label: 'Read the paper' }, { chain: 'tend', label: 'Tend the garden' },
        { chain: 'rakeYard', label: 'Rake the yard' }, { chain: 'yardWorkout', label: 'Jumping jacks' },
        { chain: 'phonePace', label: 'Call a friend' },
      ] },
    ];
    const html = groups.map(g => `<h4 class="vh-order-floor">${g.floor}</h4><div class="vh-order-grid">${
      g.acts.map(a => `<button data-order="${a.chain}" class="vh-order-btn">${a.label}</button>`).join('')}</div>`).join('');
    sec.innerHTML = `<div class="vh-do"><p>Tell ${state.simName} what to do:</p>${html}</div>`;
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

  let youWardrobeHtml = '';
  function renderYou(state: DrawerState): void {
    const sec = el.querySelector('[data-page="you"]')!;
    const w = state.wearing, same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const isWorn = (c: OwnedCloth): boolean =>
      c.slot === 'top' ? c.style === w.topStyle && same(c.col, w.top)
      : c.slot === 'bottom' ? c.style === (w.bottomStyle || 'pants') && same(c.col, w.bottom)
      : c.slot === 'hat' ? c.style === w.hat : false;
    const item = (c: OwnedCloth) =>
      `<button class="vh-wardrobe-item ${isWorn(c) ? 'vh-worn' : ''}"
        data-wear="${c.id}" data-col="${c.col}" title="Wear ${c.name}">
        <canvas class="vh-cloth-preview" width="36" height="36" data-col="${c.col}" data-style="${c.style}" data-slot="${c.slot}" data-accent="${c.accent ?? ''}"></canvas>
        <span>${c.name}</span>
      </button>`;
    // Shirts, pants and hats each get their own list, so any shirt can go with any pants.
    const group = (title: string, slots: string[]) => {
      const list = state.closet.filter(c => slots.includes(c.slot));
      return list.length ? `<h5 class="vh-wardrobe-group">${title}</h5><div class="vh-wardrobe">${list.map(item).join('')}</div>` : '';
    };
    const closet = group('Shirts', ['top']) + group('Pants', ['bottom']) + group('Hats', ['hat']) + group('Shoes & more', ['shoes', 'glasses']);
    const personas = state.personas.length
      ? `<h5 class="vh-wardrobe-group">Personas</h5><div class="vh-personas">${state.personas.map(p =>
        `<button class="vh-persona" data-persona="${p.id}" title="Change into the ${p.label} look: shirt, pants and hat"><span class="vh-persona-icon">${p.icon}</span><span>${p.label}</span></button>`).join('')}</div>
        <p class="vh-wardrobe-hint">Or mix: any shirt with any pants and hat below.</p>`
      : '';
    // The page is rebuilt four times a second while the game runs, which would eat clicks on buttons.
    // The clock and name are cheap text; the wardrobe is only rebuilt when something in it changes.
    if (!sec.querySelector('.vh-you')) {
      sec.innerHTML = `<div class="vh-you">
        <div data-you-head></div>
        <canvas class="vh-outfit-preview" width="140" height="120"></canvas>
        <h4>Wardrobe</h4>
        <div data-you-wardrobe></div>
        <p class="vh-wardrobe-hint">Buy more clothes in the Shop's Clothes tab.</p>
      </div>`;
      youWardrobeHtml = '';
    }
    sec.querySelector('[data-you-head]')!.innerHTML = `<h4>${state.simName}</h4>
      <p>Day ${state.day}, ${DAYS[weekday(state.day)]}, ${clockText(state.minutes)}</p>
      <p>${season(state.day)}</p>
      <p>Job: ${careerTitle({ level: state.careerLevel, perf: state.careerPerf })}</p>`;
    drawOutfitPreview(sec.querySelector('.vh-outfit-preview')!, state.wearing);
    const wardrobeHtml = `${personas}${closet || '<p class="vh-empty">Nothing in the closet yet.</p>'}`;
    if (wardrobeHtml === youWardrobeHtml) return;
    youWardrobeHtml = wardrobeHtml;
    const box = sec.querySelector('[data-you-wardrobe]')!;
    box.innerHTML = wardrobeHtml;
    box.querySelectorAll<HTMLCanvasElement>('.vh-cloth-preview').forEach(cv => drawSwatch(cv));
    box.querySelectorAll('[data-wear]').forEach(b => {
      b.addEventListener('click', () => {
        const cloth = state.closet.find(c => c.id === (b as HTMLElement).dataset.wear && c.col === (b as HTMLElement).dataset.col);
        if (cloth) cb.onWear(cloth);
      });
    });
    box.querySelectorAll('[data-persona]').forEach(b => b.addEventListener('click', () => cb.onWearPersona((b as HTMLElement).dataset.persona!)));
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

/** Draws the mini outfit preview: a torso wearing the current top with its fabric pattern. */
function drawOutfitPreview(cv: HTMLCanvasElement, wearing: { top: string; topStyle: string; bottom: string; bottomStyle?: string }): void {
  const c = cv.getContext('2d');
  if (!c) return;
  const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.save();
  // Head
  c.fillStyle = '#C68E6A';
  c.beginPath(); c.arc(W / 2, 24, 13, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#2B1D16';
  c.beginPath(); c.ellipse(W / 2, 16, 13, 7, 0, Math.PI, Math.PI * 2); c.fill();
  // Torso (top color)
  c.fillStyle = wearing.top;
  c.beginPath();
  c.moveTo(W / 2 - 24, H - 8); c.lineTo(W / 2 - 18, 52); c.lineTo(W / 2 + 18, 52); c.lineTo(W / 2 + 24, H - 8);
  c.closePath(); c.fill();
  drawFabricPattern(c, W / 2 - 24, 52, 48, H - 60, wearing.topStyle);
  // Legs (bottom color), or a skirt over bare legs
  const skirt = wearing.bottomStyle === 'skirt' || wearing.bottomStyle === 'cheer_skirt';
  c.fillStyle = skirt ? '#C68E6A' : wearing.bottom;
  c.fillRect(W / 2 - 16, H - 8, 12, 8); c.fillRect(W / 2 + 4, H - 8, 12, 8);
  if (skirt) {
    c.fillStyle = wearing.bottom;
    c.beginPath(); c.moveTo(W / 2 - 19, H - 16); c.lineTo(W / 2 + 19, H - 16); c.lineTo(W / 2 + 25, H - 6); c.lineTo(W / 2 - 25, H - 6); c.closePath(); c.fill();
  }
  c.restore();
}

/** Draws the same fabric pattern on a wardrobe swatch. */
function drawSwatch(cv: HTMLCanvasElement): void {
  const c = cv.getContext('2d');
  if (!c) return;
  const col = cv.dataset.col || '#888';
  const style = cv.dataset.style || 'tee';
  c.clearRect(0, 0, cv.width, cv.height);
  if (cv.dataset.slot === 'bottom') { drawPantsSwatch(c, col, style, cv.dataset.accent || '#ffffff'); return; }
  if (cv.dataset.slot === 'hat') { drawHatSwatch(c, style); return; }
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(8, 32); c.lineTo(11, 12); c.lineTo(25, 12); c.lineTo(28, 32);
  c.closePath(); c.fill();
  drawFabricPattern(c, 8, 12, 20, 20, style, cv.dataset.accent);
}

/** A pair of pants (or a skirt) in its colour, with the trim that tells the cut apart. */
function drawPantsSwatch(c: CanvasRenderingContext2D, col: string, style: string, accent: string): void {
  c.fillStyle = col;
  if (style === 'skirt' || style === 'cheer_skirt') {
    c.beginPath(); c.moveTo(11, 8); c.lineTo(25, 8); c.lineTo(31, 26); c.lineTo(5, 26); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
    for (let x = 9; x <= 27; x += 3.6) { c.beginPath(); c.moveTo(11 + (x - 5) * 0.2, 8); c.lineTo(x, 26); c.stroke(); }
    if (style === 'cheer_skirt') { c.fillStyle = accent; c.fillRect(5, 24, 26, 2.4); }
    return;
  }
  const wide = style === 'baggy' ? 2 : 0, short = style === 'shorts';
  const bottom = short ? 20 : 32;
  c.beginPath();
  c.moveTo(9 - wide, 6); c.lineTo(27 + wide, 6); c.lineTo(28 + wide, bottom); c.lineTo(19.5, bottom); c.lineTo(18, 14); c.lineTo(16.5, bottom); c.lineTo(8 - wide, bottom);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(9 - wide, 6, 18 + wide * 2, 2.4);
  if (style === 'chef_pants') { c.fillStyle = accent; for (let y = 10; y < bottom; y += 5) for (let x = 10 + ((y / 5) % 2) * 2.5; x < 26; x += 5) c.fillRect(x, y, 2.5, 2.5); }
  if (style === 'breeches') { c.fillStyle = accent; c.fillRect(8, 24, 8.5, 8); c.fillRect(19.5, 24, 8.5, 8); }
  if (style === 'leather') { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(11, 9, 1.6, 20); c.fillRect(22, 9, 1.6, 20); }
}

/** A hat, by its avatar name, in the colours it always has. */
function drawHatSwatch(c: CanvasRenderingContext2D, style: string): void {
  const dome = (fill: string, y = 22) => { c.fillStyle = fill; c.beginPath(); c.ellipse(18, y, 11, 10, 0, Math.PI, 0); c.closePath(); c.fill(); };
  const brim = (fill: string, y: number, rx = 14) => { c.fillStyle = fill; c.beginPath(); c.ellipse(18, y, rx, 3, 0, 0, Math.PI * 2); c.fill(); };
  switch (style) {
    case 'chef_hat': c.fillStyle = '#F7F5F0'; [[11, 14], [18, 11], [25, 14]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 6.5, 0, 7); c.fill(); }); c.fillRect(9, 16, 18, 10); break;
    case 'cop_cap': dome('#1D2B4A'); brim('#0D0F13', 24, 12); c.fillStyle = '#C9A24A'; c.fillRect(16, 14, 4, 4); break;
    case 'nurse_cap': c.fillStyle = '#FBFBF9'; c.beginPath(); c.moveTo(7, 24); c.lineTo(10, 10); c.lineTo(26, 10); c.lineTo(29, 24); c.closePath(); c.fill(); c.fillStyle = '#C2262E'; c.fillRect(16.4, 11, 3.2, 10); c.fillRect(13, 14.4, 10, 3.2); break;
    case 'hair_bow': c.fillStyle = '#C2262E'; c.beginPath(); c.moveTo(18, 18); c.lineTo(5, 10); c.lineTo(5, 26); c.closePath(); c.fill(); c.beginPath(); c.moveTo(18, 18); c.lineTo(31, 10); c.lineTo(31, 26); c.closePath(); c.fill(); c.fillStyle = '#E0353D'; c.beginPath(); c.arc(18, 18, 3.4, 0, 7); c.fill(); break;
    case 'snapback': dome('#17171B', 22); brim('#C2262E', 23, 14); c.fillStyle = '#C9A24A'; c.fillRect(16.5, 13, 3, 3); break;
    case 'bandana': dome('#A8322D', 22); c.fillStyle = '#F4EDE0'; [[12, 18], [18, 14], [24, 18]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 1.1, 0, 7); c.fill(); }); break;
    case 'tricorn': c.fillStyle = '#332A26'; c.beginPath(); c.moveTo(3, 22); c.lineTo(18, 8); c.lineTo(33, 22); c.quadraticCurveTo(18, 28, 3, 22); c.fill(); c.strokeStyle = '#C9A24A'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(3, 22); c.quadraticCurveTo(18, 28, 33, 22); c.stroke(); break;
    case 'top_hat': c.fillStyle = '#1B1B1F'; c.fillRect(10, 6, 16, 18); brim('#141417', 24, 14); c.fillStyle = '#7A1F2B'; c.fillRect(10, 19, 16, 3); break;
    case 'beanie': dome('#3D6B73', 24); c.fillStyle = '#4E8590'; c.fillRect(7, 21, 22, 5); c.fillStyle = '#F0E9DC'; c.beginPath(); c.arc(18, 11, 3.4, 0, 7); c.fill(); break;
    case 'baseball_cap': dome('#27406B', 22); brim('#1D3150', 24, 13); c.fillStyle = '#1D3150'; c.beginPath(); c.ellipse(24, 24, 11, 3, 0, 0, Math.PI); c.fill(); break;
    case 'cowboy_hat': c.fillStyle = '#8A5A3B'; c.beginPath(); c.moveTo(11, 22); c.quadraticCurveTo(11, 8, 18, 12); c.quadraticCurveTo(25, 8, 25, 22); c.closePath(); c.fill(); brim('#6E4529', 23, 16); c.fillStyle = '#D4AF37'; c.fillRect(16.5, 19, 3, 2.4); break;
    case 'beret': c.fillStyle = '#7A1F2B'; c.beginPath(); c.ellipse(19, 18, 13, 8, -0.12, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5A1620'; c.fillRect(21, 9, 2, 3); break;
    case 'headband': c.strokeStyle = '#E8707A'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(18, 28, 14, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); break;
    case 'bucket_hat': dome('#C9B88A', 21); brim('#B8A778', 23, 15); break;
    case 'headwrap': dome('#D9A441', 22); c.fillStyle = '#7A1F2B'; [[12, 18], [18, 14], [24, 18], [15, 21], [22, 22]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 1, 0, 7); c.fill(); }); c.fillStyle = '#D9A441'; c.beginPath(); c.ellipse(14, 10, 5, 2.6, -0.4, 0, 7); c.ellipse(22, 10, 5, 2.6, 0.4, 0, 7); c.fill(); break;
    default: c.strokeStyle = '#8E9C96'; c.lineWidth = 2; c.beginPath(); c.arc(18, 18, 9, 0, 7); c.moveTo(12, 24); c.lineTo(24, 12); c.stroke();
  }
}

/** Fabric-pattern overlay shared by the outfit preview and wardrobe swatches. */
function drawFabricPattern(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: string, accent?: string): void {
  if (!style || style === 'tee' || style === 'blazer') return;
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.translate(x, y);
  if (style === 'sweater' || style === 'tank') {
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
    for (let yy = 0; yy < h; yy += 6) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
  } else if (style === 'flannel') {
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
    for (let yy = 0; yy < h; yy += 5) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.moveTo(yy, 0); c.lineTo(yy, h); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1;
    for (let yy = 2.5; yy < h; yy += 5) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.moveTo(yy, 0); c.lineTo(yy, h); c.stroke(); }
  } else if (style === 'dress') {
    c.fillStyle = 'rgba(255,255,255,.55)';
    for (let yy = 2; yy < h; yy += 5) for (let xx = (yy % 10 < 5 ? 2 : 4); xx < w; xx += 5) { c.beginPath(); c.arc(xx, yy, 1, 0, 7); c.fill(); }
  } else if (style === 'jersey') {
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillRect(0, h / 2 - 5, w, 3); c.fillRect(0, h / 2 + 2, w, 3);
  } else if (style === 'hoodie' || style === 'puffer') {
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.5;
    for (let yy = 0; yy < h; yy += 5) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
  } else if (style === 'denim') {
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 0.8;
    for (let yy = 0; yy < h; yy += 3) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); }
  } else if (style === 'cheer') {
    c.fillStyle = accent || '#F4F1EA'; c.fillRect(0, h * 0.5, w, 2.4); c.fillRect(0, h * 0.5 + 4, w, 1.2);
  } else if (style === 'cop') {
    c.fillStyle = accent || '#C9A24A'; c.fillRect(w * 0.55, h * 0.3, 3, 3.4);
  } else if (style === 'scrubs') {
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(w * 0.3, 0); c.lineTo(w * 0.7, 0); c.lineTo(w * 0.5, h * 0.35); c.closePath(); c.fill();
  } else if (style === 'rockstar') {
    c.fillStyle = '#E9E9EE'; c.beginPath(); c.moveTo(w * 0.35, 0); c.lineTo(w * 0.65, 0); c.lineTo(w * 0.5, h * 0.5); c.closePath(); c.fill();
  } else if (style === 'streetwear') {
    c.fillStyle = accent || '#17171B'; c.beginPath(); c.arc(w * 0.5, h * 0.62, 2.6, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 1); c.lineTo(w, 1); c.stroke();
  } else if (style === 'president') {
    c.fillStyle = '#F2EFE8'; c.beginPath(); c.moveTo(w * 0.3, 0); c.lineTo(w * 0.7, 0); c.lineTo(w * 0.5, h * 0.55); c.closePath(); c.fill();
    c.fillStyle = accent || '#B3202F'; c.fillRect(w * 0.45, h * 0.12, w * 0.1, h * 0.4);
  }
  c.restore();
}
