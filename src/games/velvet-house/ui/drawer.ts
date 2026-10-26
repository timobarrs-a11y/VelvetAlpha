/**
 * Drawer UI — the sidebar/bottom-sheet with pages: Shop, Goals, Do, Partner, You, Home, Log.
 * Pure DOM manipulation, called from main.ts.
 */
import { CATALOG, TABS, itemsForTab, lockOf, type CatalogEntry } from '../state/catalog';
import { SETTLE, LIFE, lifeGoalProgress, type GoalContext } from '../state/goals';
import { careerTitle } from '../state/career';
import { paperCss, floorCss, type LookInfo } from './swatch';

import { clockText, season, weekday, DAYS } from '../state/time';
import type { OwnedCloth } from '../state/clothing';

export type DrawerPage = 'shop' | 'arrange' | 'goals' | 'do' | 'partner' | 'you' | 'home' | 'log' | '';

export interface DrawerCallbacks {
  onClose: () => void;
  // The open page changed (dock tap, close button, or opened from code).
  onPage?: (page: DrawerPage) => void;
  // Arrange mode's list: pick a piece, or act on the selected one.
  onArrangePick?: (id: string) => void;
  onArrangeRotate?: () => void;
  onArrangeColour?: () => void;
  onArrangeFloor?: (level: number) => void;
  onArrangeStore?: () => void;
  onArrangeUnstore?: (id: string) => void;
  // Shop: which floor Paint, Wallpaper and Floors are going on.
  onPickFloor?: (level: number) => void;
  onBuy: (item: CatalogEntry, color?: string) => void;
  onOrder: (chain: string) => void;
  onPayBill: () => void;
  onOrderGroceries: () => void;
  onOrderTakeout: () => void;
  onTalk: () => void;
  onRestart: () => void;
  onPickLifeGoal: (goal: string) => void;
  onWear: (cloth: OwnedCloth) => void;
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

// One movable piece in the Arrange list.
export interface ArrangeItem {
  id: string;
  name: string;
  room: string;
  level: number;
  color?: string;
}

export interface ArrangeState {
  floors: string[];
  // Floor numbers in the order to list them (the attic only once built).
  order: number[];
  // The floor on screen: its pieces are listed first.
  level: number;
  items: ArrangeItem[];
  // Put away: not in the house until placed.
  stored: Array<{ id: string; name: string; color?: string }>;
  selected: null | {
    canStore: boolean;
    id: string;
    name: string;
    where: string;
    canColour: boolean;
    // Floors it can be carried to.
    moveTo: number[];
  };
}

export interface DrawerState {
  // The floor on screen, and how to draw a wallpaper or floor id as a preview.
  level?: number;
  lookInfo?: (kind: 'paper' | 'floor', key: string) => LookInfo | null;
  pictureThumbs?: Record<string, string>;
  levelNames?: string[];
  // The floors paint, wallpaper and floors can go on, in order.
  shopLevels?: number[];
  arrange?: ArrangeState | null;
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
  wearing: { top: string; topStyle: string; bottom: string };
  salon: SalonItem[];
}

const SALON_TAB = 'Salon';

const esc = (t: string): string => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const PAGE_TITLES: Record<string, string> = {
  shop: 'Shop',
  arrange: 'Arrange',
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
      <section data-page="arrange"></section>
      <section data-page="goals"></section>
      <section data-page="do"></section>
      <section data-page="partner"></section>
      <section data-page="you"></section>
      <section data-page="home"></section>
      <section data-page="log"></section>
    </div>`;

  const dock = document.createElement('nav');
  dock.className = 'vh-dock';
  // The dock is tight on a phone, so the long page titles get a short label.
  const DOCK_LABELS: Record<string, string> = { do: 'Orders' };
  dock.innerHTML = ['shop', 'arrange', 'goals', 'do', 'partner', 'you', 'home', 'log']
    .map(pg => `<button data-open="${pg}" aria-pressed="false">${DOCK_LABELS[pg] ?? PAGE_TITLES[pg]}</button>`)
    .join('');

  const closeBtn = el.querySelector('.vh-drawer-close')!;
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); cb.onClose(); openPage(''); });

  let currentPage: DrawerPage = '';
  // The shop tab stays where the player left it across refreshes (a purchase
  // redraws the drawer, and shouldn't bounce them back to the first tab).
  let currentTab = '';

  function openPage(pg: DrawerPage): void {
    const changed = pg !== currentPage;
    currentPage = pg;
    el.hidden = pg === '';
    el.dataset.open = pg;
    const titleEl = el.querySelector('[data-title]')!;
    titleEl.textContent = pg ? PAGE_TITLES[pg] : '';
    dock.querySelectorAll<HTMLButtonElement>('button[data-open]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.open === pg));
    });
    if (changed) cb.onPage?.(pg);
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
    else if (currentPage === 'arrange') renderArrange(state);
    else if (currentPage === 'goals') renderGoals(state);
    else if (currentPage === 'do') renderDo(state);
    else if (currentPage === 'partner') renderPartner(state);
    else if (currentPage === 'you') renderYou(state);
    else if (currentPage === 'home') renderHome(state);
    else if (currentPage === 'log') renderLog(state);
  }


  // Arrange mode's list: every movable piece in the house, floor by floor.
  // Tapping one jumps to its floor and selects it, ready to drag. Redrawn only
  // when something changed, since this page is refreshed several times a second
  // and a rebuild would reset the list's scroll and eat taps.
  let arrangeSig = '';
  let arrangeSelected: string | null = null;
  function renderArrange(state: DrawerState): void {
    const sec = el.querySelector('[data-page="arrange"]') as HTMLElement;
    const a = state.arrange;
    const sig = JSON.stringify(a ?? null);
    if (sig === arrangeSig) return;
    arrangeSig = sig;
    if (!a) { sec.innerHTML = ''; return; }
    const keep = sec.querySelector<HTMLElement>('.vh-arr-list');
    const scroll = keep ? [keep.scrollLeft, keep.scrollTop] : [0, 0];
    const sel = a.selected;
    const bar = sel
      ? `<div class="vh-arr-bar">
          <div class="vh-arr-what"><strong>${esc(sel.name)}</strong><small>${esc(sel.where)}</small></div>
          <div class="vh-arr-acts">
            <button data-arr="rotate" title="Turn it (R)">Rotate</button>
            ${sel.canColour ? '<button data-arr="colour" title="Change colour (C)">Colour</button>' : ''}
            ${sel.canStore ? '<button data-arr="store" title="Put it in storage">Store</button>' : ''}
          </div>
          ${sel.moveTo.length ? `<div class="vh-arr-floors"><span>Carry to</span>${sel.moveTo.map(l => `<button data-arr-floor="${l}">${esc(a.floors[l])}</button>`).join('')}</div>` : ''}
        </div>`
      : `<p class="vh-arr-hint">Tap a piece below, or tap one in the house, then drag it where you want it.</p>`;
    const order = [a.level, ...a.order.filter(l => l !== a.level)];
    const groups = order.map((level) => {
      const name = a.floors[level];
      const items = a.items.filter(i => i.level === level);
      if (!items.length) return '';
      return `<div class="vh-arr-group"><h4 class="vh-order-floor">${esc(name)}</h4><div class="vh-arr-items">${
        items.map(i => `<button class="vh-arr-item${i.id === sel?.id ? ' vh-sel' : ''}" data-arr-pick="${i.id}" aria-pressed="${i.id === sel?.id}">
          <span class="vh-arr-dot"${i.color ? ` style="background:${i.color}"` : ''}></span>
          <span class="vh-arr-name"><strong>${esc(i.name)}</strong><small>${esc(i.room)}</small></span>
        </button>`).join('')}</div></div>`;
    }).join('');
    const stash = a.stored.length
      ? `<div class="vh-arr-group"><h4 class="vh-order-floor">In storage (${a.stored.length})</h4><div class="vh-arr-items">${
        a.stored.map(i => `<button class="vh-arr-item vh-stored" data-arr-unstore="${i.id}" title="Put it in the house">
          <span class="vh-arr-dot"${i.color ? ` style="background:${i.color}"` : ''}></span>
          <span class="vh-arr-name"><strong>${esc(i.name)}</strong><small>Tap to place</small></span>
        </button>`).join('')}</div></div>` : '';
    sec.innerHTML = `<div class="vh-arr">${bar}<div class="vh-arr-list">${groups}${stash}${groups || stash ? '' : '<p class="vh-empty">Nothing here can be moved.</p>'}</div></div>`;
    const list = sec.querySelector<HTMLElement>('.vh-arr-list')!;
    list.scrollLeft = scroll[0]; list.scrollTop = scroll[1];
    if (sel && sel.id !== arrangeSelected) sec.querySelector('.vh-sel')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    arrangeSelected = sel?.id ?? null;
    sec.querySelectorAll<HTMLElement>('[data-arr-pick]').forEach(b => b.addEventListener('click', () => cb.onArrangePick?.(b.dataset.arrPick!)));
    sec.querySelector('[data-arr="store"]')?.addEventListener('click', () => cb.onArrangeStore?.());
    sec.querySelectorAll<HTMLElement>('[data-arr-unstore]').forEach(b => b.addEventListener('click', () => cb.onArrangeUnstore?.(b.dataset.arrUnstore!)));
    sec.querySelector('[data-arr="rotate"]')?.addEventListener('click', () => cb.onArrangeRotate?.());
    sec.querySelector('[data-arr="colour"]')?.addEventListener('click', () => cb.onArrangeColour?.());
    sec.querySelectorAll<HTMLElement>('[data-arr-floor]').forEach(b => b.addEventListener('click', () => cb.onArrangeFloor?.(Number(b.dataset.arrFloor))));
  }

  let shopHtml = '';
  function iconStyle(item: CatalogEntry, state: DrawerState): string {
    if (item.icon === 'paint' && item.color) return `background:${item.color}`;
    if (item.icon === 'paper' && item.pattern) return `background:${paperCss(state.lookInfo?.('paper', item.pattern) ?? null, state.pictureThumbs?.[item.pattern]).replace(/"/g, "'")}`;
    if (item.icon === 'floor' && item.floor) return `background:${floorCss(state.lookInfo?.('floor', item.floor) ?? null)}`;
    return '';
  }

  function renderShop(state: DrawerState): void {
    const sec = el.querySelector('[data-page="shop"]')!;
    const tab = currentTab || state.shopTab || 'Today';
    const tabBtns = [...TABS, SALON_TAB].map(t =>
      `<button data-tab="${t}" class="${t === tab ? 'vh-active' : ''}">${t}</button>`
    ).join('');

    if (tab === SALON_TAB) {
      shopHtml = '';
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
        <div class="vh-shop-icon" data-icon="${item.id}" style="${iconStyle(item, state)}"></div>
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

    const styling = tab === 'Paint' || tab === 'Wallpaper' || tab === 'Floors';
    const floorPick = styling && state.levelNames
      ? `<div class="vh-floorpick"><span>Goes on</span>${(state.shopLevels ?? [0, 1, 2]).map(l => `<button data-pickfloor="${l}" class="${state.level === l ? 'vh-active' : ''}">${esc(state.levelNames![l])}</button>`).join('')}</div>`
      : '';
    const html = `<div class="vh-shop-tabs">${tabBtns}</div>${floorPick}<div class="vh-shop-list">${cards || '<p class="vh-empty">Nothing here yet.</p>'}</div>`;
    // Unchanged since the last refresh: leave it alone, so picture previews aren't reloaded several times a second.
    if (html === shopHtml && sec.firstElementChild) return;
    shopHtml = html;
    sec.innerHTML = html;
    sec.querySelectorAll<HTMLElement>('[data-pickfloor]').forEach(b => b.addEventListener('click', () => cb.onPickFloor?.(Number(b.dataset.pickfloor))));

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

  function renderYou(state: DrawerState): void {
    const sec = el.querySelector('[data-page="you"]')!;
    const closet = state.closet.map(c =>
      `<button class="vh-wardrobe-item ${c.style === state.wearing.topStyle || c.col === state.wearing.top || c.col === state.wearing.bottom ? 'vh-worn' : ''}"
        data-wear="${c.id}" data-col="${c.col}" title="Wear ${c.name}">
        <canvas class="vh-cloth-preview" width="36" height="36" data-col="${c.col}" data-style="${c.style}"></canvas>
        <span>${c.name}</span>
      </button>`).join('');
    sec.innerHTML = `<div class="vh-you">
      <h4>${state.simName}</h4>
      <p>Day ${state.day}, ${DAYS[weekday(state.day)]}, ${clockText(state.minutes)}</p>
      <p>${season(state.day)}</p>
      <p>Job: ${careerTitle({ level: state.careerLevel, perf: state.careerPerf })}</p>
      <canvas class="vh-outfit-preview" width="140" height="120"></canvas>
      <h4>Wardrobe</h4>
      <div class="vh-wardrobe">${closet || '<p class="vh-empty">Nothing in the closet yet.</p>'}</div>
      <p class="vh-wardrobe-hint">Buy more clothes in the Shop's Clothes tab.</p>
    </div>`;
    drawOutfitPreview(sec.querySelector('.vh-outfit-preview')!, state.wearing);
    sec.querySelectorAll<HTMLCanvasElement>('.vh-cloth-preview').forEach(cv => drawSwatch(cv));
    sec.querySelectorAll('[data-wear]').forEach(b => {
      b.addEventListener('click', () => {
        const cloth = state.closet.find(c => c.id === (b as HTMLElement).dataset.wear && c.col === (b as HTMLElement).dataset.col);
        if (cloth) cb.onWear(cloth);
      });
    });
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
function drawOutfitPreview(cv: HTMLCanvasElement, wearing: { top: string; topStyle: string; bottom: string }): void {
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
  // Legs (bottom color)
  c.fillStyle = wearing.bottom;
  c.fillRect(W / 2 - 16, H - 8, 12, 8); c.fillRect(W / 2 + 4, H - 8, 12, 8);
  c.restore();
}

/** Draws the same fabric pattern on a wardrobe swatch. */
function drawSwatch(cv: HTMLCanvasElement): void {
  const c = cv.getContext('2d');
  if (!c) return;
  const col = cv.dataset.col || '#888';
  const style = cv.dataset.style || 'tee';
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(8, 32); c.lineTo(11, 12); c.lineTo(25, 12); c.lineTo(28, 32);
  c.closePath(); c.fill();
  drawFabricPattern(c, 8, 12, 20, 20, style);
}

/** Fabric-pattern overlay shared by the outfit preview and wardrobe swatches. */
function drawFabricPattern(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: string): void {
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
  }
  c.restore();
}
