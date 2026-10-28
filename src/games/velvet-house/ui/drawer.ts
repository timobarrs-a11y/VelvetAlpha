import { sameCloth, validateGarment, type Garment } from '../state/garment';
import { createGarmentPreview } from './garmentPreview';
/**
 * Drawer UI — the sidebar/bottom-sheet with pages: Shop, Goals, Do, Partner, You, Home, Log.
 * Pure DOM manipulation, called from main.ts.
 */
import { CATALOG, TABS, itemsForTab, promoLocked, lockOf, setQuote, type CatalogEntry } from '../state/catalog';
import { groupSets, groupsWithTag, PROMO_FILTER } from '../state/setGroups';
import { STYLE_TAGS } from '../state/taste';
import { SETTLE, LIFE, lifeGoalProgress, type GoalContext } from '../state/goals';
import { careerTitle } from '../state/career';
import { paperCss, floorCss, type LookInfo } from './swatch';
import { phoneHtml, phoneStructure, patchPhone, animateMoney, type PhoneTab, type PhoneView } from './phone';

import { clockText, season, weekday, DAYS } from '../state/time';
import type { OwnedCloth, WardrobePersona } from '../state/clothing';

export type DrawerPage = 'shop' | 'arrange' | 'goals' | 'do' | 'phone' | 'partner' | 'you' | 'studio' | 'home' | 'log' | '';

export interface DrawerCallbacks {
  onClose: () => void;
  // The open page changed (dock tap, close button, or opened from code).
  onPage?: (page: DrawerPage) => void;
  // Arrange mode's list: pick a piece, or act on the selected one.
  onArrangePick?: (id: string) => void;
  onArrangeRotate?: () => void;
  onArrangeSet?: () => void;
  onArrangeBack?: () => void;
  onArrangeColour?: () => void;
  onArrangeLook?: (skin: string) => void;
  onArrangeFloor?: (level: number) => void;
  onArrangeStore?: () => void;
  onArrangeUnstore?: (id: string) => void;
  onArrangeTakeDown?: () => void;
  // Shop: which floor Paint, Wallpaper and Floors are going on.
  onPickFloor?: (level: number) => void;
  onPickRoom?: (room: string | null) => void;
  onBuy: (item: CatalogEntry, color?: string) => void;
  onOrder: (chain: string) => void;
  // The Household page's pet buttons: 'feedPet', 'playPet', 'petPet', 'walkDog' or 'scoop' for a pet.
  onPetOrder?: (act: string, petId: string) => void;
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
  // The phone: pay one bill, take a side-job offer, work on a taken job,
  // change the routine, or stay home from work today.
  onPayBillId?: (id: string) => void;
  onTakeOffer?: (id: string) => void;
  onWorkJob?: (id: string) => void;
  onRoutine?: (key: 'wake' | 'weekendWake' | 'bed' | 'shower', delta: number) => void;
  onCallIn?: () => void;
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
    /** A wall piece: it slides along its wall, and Take it down puts it in storage; nothing else applies. */
    wall?: boolean;
    /** Let go of but not set down yet; `fits` and `reason` say whether it can stay where it is. */
    loose: boolean;
    fits: boolean;
    reason?: string;
    canStore: boolean;
    id: string;
    name: string;
    where: string;
    canColour: boolean;
    // The looks it can wear (the stock one and the ones bought); empty when there is nothing to choose.
    looks: Array<{ id: string; name: string; active: boolean }>;
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
  /** The rooms of the floor being looked at, when it has more than one, and the one paint goes on (null: all of it). */
  shopRooms?: string[];
  shopRoom?: string | null;
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
  petFood?: number;
  pets?: Array<{ id: string; name: string; kind: 'cat' | 'dog'; coat: string; where: string; status: string; needs: Record<string, number>; litterUses: number }>;
  log: string[];
  partnerName: string;
  simName: string;
  townName: string;
  deliveryPending: boolean;
  mayaStatus: string;
  closet: OwnedCloth[];
  personas: WardrobePersona[];
  wearing: { top: string; topStyle: string; bottom: string; bottomStyle?: string; hat?: string; topGarment?: Garment; bottomGarment?: Garment };
  salon: SalonItem[];
  phone?: PhoneView;
}

const SALON_TAB = 'Salon';

// Each bottom-bar tab has its own colour and a little icon, so you know where you are at a glance.
const svg = (d: string) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// Little 16px icons for the Arrange buttons.
const ico = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ARR_ICON = {
  set: ico('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  rotate: ico('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>'),
  store: ico('<path d="M4 8h16v11H4z"/><path d="M3 4.5h18V8H3zM10 12.5h4"/>'),
  back: ico('<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>'),
  colour: ico('<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>'),
  look: ico('<path d="m12 3 2.4 5 5.6.8-4 3.9.9 5.5L12 15.5 7.1 18.2 8 12.7 4 8.8l5.6-.8z"/>'),
  hand: ico('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 6 17.5L4.5 13.5a1.5 1.5 0 0 1 2.6-1.4L9 14.5"/>'),
};

/** Dark or light text, whichever reads on a swatch of this colour. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#F2EEE8';
  const n = parseInt(m[1], 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#241B25' : '#FFFFFF';
}

const PROMO_LOCK_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

export const DOCK_TABS: Record<string, { color: string; label?: string; icon: string }> = {
  people: { color: '#4FC3C9', icon: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/><circle cx="17.2" cy="9" r="2.3"/><path d="M16.5 14.6c2.7-.3 4.6 1.3 4.8 4.2"/>') },
  shop: { color: '#F5A83B', icon: svg('<path d="M5 8.5h14l-1.2 11.5H6.2z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>') },
  arrange: { color: '#A582F0', icon: svg('<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>') },
  goals: { color: '#6FCB78', icon: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>') },
  phone: { color: '#7FD38A', icon: svg('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>') },
  do: { color: '#F2805C', label: 'Orders', icon: svg('<rect x="5.5" y="4" width="13" height="17" rx="2.5"/><path d="M9 3.5h6v3H9zM9 11h6M9 15h4"/>') },
  partner: { color: '#EC5F90', icon: svg('<path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3z"/>') },
  you: { color: '#5FA2F2', icon: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.2c1.2 1.8 5.8 1.8 7 0M9 9.5h.01M15 9.5h.01"/>') },
  studio: { color: '#E36CC1', icon: svg('<path d="M4 20 14 10M14 10l-2-5 4-1 3 3-1 4zM6.5 17.5l1.8 1.8"/><circle cx="6" cy="6" r="2.2"/><path d="M7.6 7.6 12 12"/>') },
  home: { color: '#DDA663', icon: svg('<path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5h4v5"/>') },
  log: { color: '#A2AABE', label: 'Today', icon: svg('<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>') },
};

/** The inside of one bottom-bar tab. */
export const dockTabHtml = (key: string, title: string): string => {
  const t = DOCK_TABS[key];
  return `<span class="vh-tab-ico">${t?.icon ?? ''}</span><span class="vh-tab-label">${title}</span>`;
};

const esc = (t: string): string => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const PAGE_TITLES: Record<string, string> = {
  shop: 'Shop',
  arrange: 'Arrange',
  goals: 'Goals',
  do: 'Give an order',
  phone: 'Phone',
  partner: 'Partner',
  you: 'You',
  studio: 'Design Studio',
  home: 'Household',
  log: 'Today',
};

export function createDrawer(cb: DrawerCallbacks): {
  el: HTMLElement;
  dock: HTMLElement;
  open: (pg: DrawerPage) => void;
  close: () => void;
  page: () => DrawerPage;
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
      <section data-page="phone"></section>
      <section data-page="partner"></section>
      <section data-page="you"></section>
      <section data-page="studio"></section>
      <section data-page="home"></section>
      <section data-page="log"></section>
    </div>`;

  const dock = document.createElement('nav');
  dock.className = 'vh-dock';
  // The dock is tight on a phone, so the long page titles get a short label.
  dock.innerHTML = ['shop', 'arrange', 'goals', 'do', 'phone', 'partner', 'you', 'studio', 'home', 'log']
    .map(pg => `<button data-open="${pg}" aria-pressed="false" style="--tab:${DOCK_TABS[pg].color}">${dockTabHtml(pg, DOCK_TABS[pg].label ?? PAGE_TITLES[pg])}</button>`)
    .join('');

  // The title bar with the close button. Arrange has none (the Arrange button in the bottom bar turns it on and off), so it
  // is taken out of the panel while Arrange is open and put back for every other page.
  const head = el.querySelector<HTMLElement>('.vh-drawer-head')!;
  const titleEl = el.querySelector('[data-title]')!;
  const closeBtn = el.querySelector('.vh-drawer-close')!;
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); cb.onClose(); openPage(''); });

  let currentPage: DrawerPage = '';
  // The shop tab stays where the player left it across refreshes (a purchase
  // redraws the drawer, and shouldn't bounce them back to the first tab).
  let currentTab = '';
  // The feel picked in the Sets tab's filter row; null shows every set.
  let setsTag: string | null = null;

  function openPage(pg: DrawerPage): void {
    const changed = pg !== currentPage;
    currentPage = pg;
    el.hidden = pg === '';
    el.dataset.open = pg;
    titleEl.textContent = pg ? PAGE_TITLES[pg] : '';
    if (pg === 'arrange') head.remove(); else if (!head.isConnected) el.prepend(head);
    if (pg) el.style.setProperty('--tab', DOCK_TABS[pg]?.color ?? '#E0A43A');
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
    else if (currentPage === 'phone') renderPhone(state);
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
          <div class="vh-arr-top">
          <div class="vh-arr-what"><strong>${esc(sel.name)}</strong><small>${esc(sel.where)}</small></div>
          <div class="vh-arr-acts">
            ${sel.wall ? `<button data-arr="takedown" title="Take it down: it goes to storage">${ARR_ICON.store}<span>Take it down</span></button>` : `<button data-arr="set" class="vh-arr-primary" title="Set it down (Enter)">${ARR_ICON.set}<span>Set it down</span></button>
            <button data-arr="rotate" title="Turn it (R)">${ARR_ICON.rotate}<span>Rotate</span></button>`}
            ${sel.loose ? `<button data-arr="back" title="Put it back where it was (Esc)">${ARR_ICON.back}<span>Put it back</span></button>` : ''}
            ${sel.canColour ? `<button data-arr="colour" title="Change colour (C)">${ARR_ICON.colour}<span>Colour</span></button>` : ''}
            ${sel.canStore ? `<button data-arr="store" title="Put it in storage">${ARR_ICON.store}<span>Store</span></button>` : ''}
          </div>
          </div>
          ${sel.looks.length > 1 ? `<div class="vh-arr-looks"><span>${ARR_ICON.look}Look</span>${sel.looks.map(l => `<button data-arr-look="${esc(l.id)}" aria-pressed="${l.active}">${esc(l.name)}</button>`).join('')}</div>` : ''}
          ${sel.moveTo.length ? `<div class="vh-arr-floors"><span>Carry to</span>${sel.moveTo.map(l => `<button data-arr-floor="${l}">${esc(a.floors[l])}</button>`).join('')}</div>` : ''}
          ${sel.wall ? '<p class="vh-arr-why vh-arr-ok">Drag it along the wall, up or down.</p>' : sel.loose && !sel.fits ? `<p class="vh-arr-why">${esc(sel.reason ?? "It doesn't fit there.")} Move it, or put it back.</p>` : sel.loose ? '<p class="vh-arr-why vh-arr-ok">Drag it, turn it, then tap Set it down.</p>' : ''}
        </div>`
      : `<p class="vh-arr-hint">${ARR_ICON.hand}<span>Tap a piece below, or tap one in the house, then drag it where you want it.</span></p>`;
    const order = [a.level, ...a.order.filter(l => l !== a.level)];
    const groups = order.map((level) => {
      const name = a.floors[level];
      const items = a.items.filter(i => i.level === level);
      if (!items.length) return '';
      return `<div class="vh-arr-group"><h4 class="vh-order-floor">${esc(name)}</h4><div class="vh-arr-items">${
        items.map(i => `<button class="vh-arr-item${i.id === sel?.id ? ' vh-sel' : ''}" data-arr-pick="${i.id}" aria-pressed="${i.id === sel?.id}">
          <span class="vh-arr-dot"${i.color ? ` style="background:${i.color};color:${readableOn(i.color)}"` : ''}>${esc(i.name.charAt(0).toUpperCase())}</span>
          <span class="vh-arr-name"><strong>${esc(i.name)}</strong><small>${esc(i.room)}</small></span>
        </button>`).join('')}</div></div>`;
    }).join('');
    const stash = a.stored.length
      ? `<div class="vh-arr-group"><h4 class="vh-order-floor">In storage (${a.stored.length})</h4><div class="vh-arr-items">${
        a.stored.map(i => `<button class="vh-arr-item vh-stored" data-arr-unstore="${i.id}" title="Put it in the house">
          <span class="vh-arr-dot"${i.color ? ` style="background:${i.color};color:${readableOn(i.color)}"` : ''}>${esc(i.name.charAt(0).toUpperCase())}</span>
          <span class="vh-arr-name"><strong>${esc(i.name)}</strong><small>Tap to place</small></span>
        </button>`).join('')}</div></div>` : '';
    sec.innerHTML = `<div class="vh-arr">${bar}<div class="vh-arr-list">${groups}${stash}${groups || stash ? '' : '<p class="vh-empty">Nothing here can be moved.</p>'}</div></div>`;
    const list = sec.querySelector<HTMLElement>('.vh-arr-list')!;
    list.scrollLeft = scroll[0]; list.scrollTop = scroll[1];
    // Bring the picked piece into view in the list by scrolling the list alone: scrollIntoView would also scroll the
    // panel, and push the Set it down bar out of sight.
    if (sel && sel.id !== arrangeSelected) {
      const chip = sec.querySelector<HTMLElement>('.vh-sel');
      if (chip) {
        const lr = list.getBoundingClientRect(), cr = chip.getBoundingClientRect();
        list.scrollLeft += cr.left - lr.left - (lr.width - cr.width) / 2;
        list.scrollTop += cr.top - lr.top - (lr.height - cr.height) / 2;
      }
    }
    arrangeSelected = sel?.id ?? null;
    sec.querySelectorAll<HTMLElement>('[data-arr-pick]').forEach(b => b.addEventListener('click', () => cb.onArrangePick?.(b.dataset.arrPick!)));
    sec.querySelector('[data-arr="store"]')?.addEventListener('click', () => cb.onArrangeStore?.());
    sec.querySelector('[data-arr="takedown"]')?.addEventListener('click', () => cb.onArrangeTakeDown?.());
    sec.querySelectorAll<HTMLElement>('[data-arr-unstore]').forEach(b => b.addEventListener('click', () => cb.onArrangeUnstore?.(b.dataset.arrUnstore!)));
    sec.querySelector('[data-arr="rotate"]')?.addEventListener('click', () => cb.onArrangeRotate?.());
    sec.querySelector('[data-arr="set"]')?.addEventListener('click', () => cb.onArrangeSet?.());
    sec.querySelector('[data-arr="back"]')?.addEventListener('click', () => cb.onArrangeBack?.());
    sec.querySelector('[data-arr="colour"]')?.addEventListener('click', () => cb.onArrangeColour?.());
    sec.querySelectorAll<HTMLElement>('[data-arr-look]').forEach(b => b.addEventListener('click', () => cb.onArrangeLook?.(b.dataset.arrLook ?? '')));
    sec.querySelectorAll<HTMLElement>('[data-arr-floor]').forEach(b => b.addEventListener('click', () => cb.onArrangeFloor?.(Number(b.dataset.arrFloor))));
  }

  // Pages refresh several times a second. Rebuilding identical markup would swap out the button under a
  // finger mid-tap (the tap then misses), so unchanged markup is left alone.
  const lastHtml = new WeakMap<Element, string>();
  function put(sec: Element, html: string): boolean {
    if (lastHtml.get(sec) === html) return false;
    lastHtml.set(sec, html);
    sec.innerHTML = html;
    return true;
  }
  function iconStyle(item: CatalogEntry, state: DrawerState): string {
    // A set shows its wallpaper.
    if (item.set) {
      const paper = setQuote(item, new Set()).members.find((m) => m.icon === 'paper');
      if (paper?.pattern) return `background:${paperCss(state.lookInfo?.('paper', paper.pattern) ?? null).replace(/"/g, "'")}`;
    }
    if (item.wallLamp) return 'background:radial-gradient(circle at 50% 45%,#FFF0C4 0 26%,#E9C877 28% 38%,#6B5648 40% 100%)';
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
      renderSalon(sec, tabBtns, state);
      return;
    }

    const items = itemsForTab(tab);
    const card = (item: CatalogEntry): string => {
      // A promo item they don't have: its name and a lock, nothing to see or buy until a code gives it to them.
      if (promoLocked(item, state.owned)) {
        return `<div class="vh-shop-card vh-promo-locked" data-item="${item.id}">
        <div class="vh-shop-icon vh-promo-icon" aria-hidden="true">${PROMO_LOCK_SVG}</div>
        <div class="vh-shop-info">
          <strong>${item.name}</strong>
          <span class="vh-promo-tag">Promo</span>
          <span class="vh-shop-desc">Free with a promo code. It isn't sold in the shop.</span>
        </div>
        <div class="vh-shop-actions">
          <button data-buy="${item.id}" disabled>Code only</button>
        </div>
      </div>`;
      }
      const lock = lockOf(item.id, state.day, state.bond);
      const quote = item.set ? setQuote(item, state.owned) : null;
      // Paint, wallpaper and floors bought once go on again, anywhere, for free: their button is Apply.
      const restyle = (item.icon === 'paint' || item.icon === 'paper' || item.icon === 'floor') && state.owned.has(item.id);
      const owned = quote ? quote.missing.length === 0 : state.owned.has(item.id) && !item.repeat && !restyle;
      const locked = lock?.locked;
      const price = quote ? quote.cost : item.price;
      const tooExpensive = price > state.money;
      const cls = locked ? 'vh-locked' : owned && !quote ? 'vh-owned' : tooExpensive && !owned ? 'vh-poor' : '';
      const cols = item.cols
        ? `<div class="vh-swatches">${item.cols.map(c => `<span class="vh-swatch" style="background:${c}" data-color="${c}"></span>`).join('')}</div>`
        : '';
      const lockHint = locked ? `<span class="vh-lock">${lock!.hint}</span>` : '';
      return `<div class="vh-shop-card ${cls}" data-item="${item.id}">
        <div class="vh-shop-icon" data-icon="${item.id}" style="${iconStyle(item, state)}"></div>
        <div class="vh-shop-info">
          <strong>${item.name}</strong>
          ${item.promo ? '<span class="vh-promo-tag">Promo</span>' : ''}
          ${item.desc ? `<span class="vh-shop-desc">${item.desc}</span>` : ''}
          ${quote ? `<span class="vh-shop-desc vh-set-save">${quote.missing.length ? `${quote.missing.length} of ${quote.members.length} pieces to go. Save $${quote.full - quote.cost} against buying them apart.` : 'You have all of it. Tap Apply to put it all on; Arrange can switch single pieces.'}</span>` : ''}
          ${cols}
          ${lockHint}
        </div>
        <div class="vh-shop-actions">
          ${quote && quote.missing.length && quote.full > quote.cost ? `<span class="vh-was">$${quote.full}</span>` : ''}${(quote && owned) || restyle ? '' : `<span class="vh-price">$${price}</span>`}
          <button data-buy="${item.id}" ${locked || (owned && !quote ? 'disabled' : '')}>${quote ? (owned ? 'Apply' : 'Buy') : restyle ? 'Apply' : owned ? 'Owned' : 'Buy'}</button>
        </div>
      </div>`;
    };
    // Sets: one group per theme (the set, then its finishing touches), with a row of feels to filter by.
    let cards: string;
    if (tab === 'Sets') {
      const groups = groupsWithTag(groupSets(items), setsTag);
      const chips = `<div class="vh-set-filter"><button data-settag="" class="${setsTag ? '' : 'vh-active'}">All</button><button data-settag="${PROMO_FILTER}" class="vh-set-promo ${setsTag === PROMO_FILTER ? 'vh-active' : ''}">Promo</button>${STYLE_TAGS.map(t => `<button data-settag="${t}" class="${setsTag === t ? 'vh-active' : ''}">${t}</button>`).join('')}</div>`;
      cards = chips + (groups.map(gp => `<div class="vh-set-group" data-theme="${esc(gp.theme)}"><h4 class="vh-set-theme">${esc(gp.name)}<small>${esc(gp.tags.join(' · '))}</small></h4>${[gp.set, ...gp.extras].map(card).join('')}</div>`).join('') || (setsTag === PROMO_FILTER ? '<p class="vh-empty">No promo packs right now.</p>' : '<p class="vh-empty">No sets with that feel yet.</p>'));
    } else cards = items.map(card).join('');

    const styling = tab === 'Paint' || tab === 'Wallpaper' || tab === 'Floors';
    const floorPick = styling && state.levelNames
      ? `<div class="vh-floorpick"><span>Goes on</span>${(state.shopLevels ?? [0, 1, 2]).map(l => `<button data-pickfloor="${l}" class="${state.level === l ? 'vh-active' : ''}">${esc(state.levelNames![l])}</button>`).join('')}</div>`
      : '';
    // Which room of that floor: the whole floor, or one room of it. Sets use it too (their walls and floor).
    const roomPick = (styling || tab === 'Sets') && state.shopRooms?.length
      ? `<div class="vh-floorpick vh-roompick"><span>Room</span><button data-pickroom="" class="${state.shopRoom ? '' : 'vh-active'}">Whole floor</button>${state.shopRooms.map(r => `<button data-pickroom="${esc(r)}" class="${state.shopRoom === r ? 'vh-active' : ''}">${esc(r)}</button>`).join('')}</div>`
      : '';
    const html = `<div class="vh-shop-tabs">${tabBtns}</div>${floorPick}${roomPick}<div class="vh-shop-list">${cards || '<p class="vh-empty">Nothing here yet.</p>'}</div>`;
    // Unchanged since the last refresh: leave it alone, so picture previews aren't reloaded several times a second.
    if (!put(sec, html)) return;
    sec.querySelectorAll<HTMLElement>('[data-pickfloor]').forEach(b => b.addEventListener('click', () => cb.onPickFloor?.(Number(b.dataset.pickfloor))));
    sec.querySelectorAll<HTMLElement>('[data-pickroom]').forEach(b => b.addEventListener('click', () => cb.onPickRoom?.(b.dataset.pickroom || null)));

    sec.querySelectorAll('[data-tab]').forEach(b => {
      b.addEventListener('click', () => { currentTab = (b as HTMLElement).dataset.tab!; render(state); });
    });
    sec.querySelectorAll<HTMLElement>('[data-settag]').forEach(b => {
      b.addEventListener('click', () => { setsTag = b.dataset.settag || null; render(state); });
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
    if (!put(sec, `<div class="vh-shop-tabs">${tabBtns}</div><div class="vh-shop-list">${cards || '<p class="vh-empty">The salon is restocking.</p>'}</div>`)) return;
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

    if (!put(sec, `<div class="vh-goals">
      <h4>Move-in checklist</h4>
      <ul class="vh-checklist">${settleItems}</ul>
      ${lifeGoalHtml}
    </div>`)) return;
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
    if (!put(sec, `<div class="vh-do"><p>Tell ${state.simName} what to do:</p>${html}</div>`)) return;
    sec.querySelectorAll('[data-order]').forEach(b => {
      b.addEventListener('click', () => cb.onOrder((b as HTMLElement).dataset.order!));
    });
  }

  function renderPartner(state: DrawerState): void {
    const sec = el.querySelector('[data-page="partner"]')!;
    if (!put(sec, `<div class="vh-partner">
      <div class="vh-bond-bar">
        <span>Bond</span>
        <div class="vh-bar"><i style="width:${state.bond}%"></i></div>
        <strong>${state.bond}</strong>
      </div>
      <p class="vh-status">${state.mayaStatus}</p>
      <button data-talk class="vh-talk-btn">Talk to ${state.partnerName}</button>
    </div>`)) return;
    sec.querySelector('[data-talk]')?.addEventListener('click', () => cb.onTalk());
  }

  let youWardrobeHtml = '';
  function renderYou(state: DrawerState): void {
    const sec = el.querySelector('[data-page="you"]')!;
    const w = state.wearing, same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const isWorn = (c: OwnedCloth): boolean =>
      c.recipe ? (c.slot === 'top' ? !!w.topGarment && sameCloth(c.recipe, w.topGarment) : !!w.bottomGarment && sameCloth(c.recipe, w.bottomGarment))
      : c.slot === 'top' ? c.style === w.topStyle && same(c.col, w.top)
      : c.slot === 'bottom' ? c.style === (w.bottomStyle || 'pants') && same(c.col, w.bottom)
      : c.slot === 'hat' ? c.style === w.hat : false;
    const item = (c: OwnedCloth) =>
      `<button class="vh-wardrobe-item ${isWorn(c) ? 'vh-worn' : ''}"
        data-wear="${c.id}" data-col="${c.col}" title="Wear ${c.name}">
        ${c.recipe
          ? `<canvas class="vh-cloth-preview vh-cloth-recipe" width="36" height="48" data-recipe="${c.id}"></canvas>`
          : `<canvas class="vh-cloth-preview" width="36" height="36" data-col="${c.col}" data-style="${c.style}" data-slot="${c.slot}" data-accent="${c.accent ?? ''}"></canvas>`}
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
    box.querySelectorAll<HTMLCanvasElement>('.vh-cloth-preview:not(.vh-cloth-recipe)').forEach(cv => drawSwatch(cv));
    box.querySelectorAll<HTMLCanvasElement>('.vh-cloth-recipe').forEach(cv => {
      const piece = state.closet.find(c => c.id === cv.dataset.recipe);
      if (!piece?.recipe) return;
      const plain = (slot: 'top' | 'bottom', base: string) => validateGarment({ slot, cut: slot === 'top' ? 'tee' : 'straight', fabric: 'cotton', base, name: 'x' });
      const top = piece.slot === 'top' ? piece.recipe : plain('top', state.wearing.top), bottom = piece.slot === 'bottom' ? piece.recipe : plain('bottom', state.wearing.bottom);
      createGarmentPreview(cv).draw(top, bottom, 0);
    });
    box.querySelectorAll('[data-wear]').forEach(b => {
      b.addEventListener('click', () => {
        const cloth = state.closet.find(c => c.id === (b as HTMLElement).dataset.wear && c.col === (b as HTMLElement).dataset.col);
        if (cloth) cb.onWear(cloth);
      });
    });
    box.querySelectorAll('[data-persona]').forEach(b => b.addEventListener('click', () => cb.onWearPersona((b as HTMLElement).dataset.persona!)));
  }

  // The phone keeps its tab, and the balance counts up or down when it changes.
  // Clicks are handled once, on the section, so a redraw never loses one.
  let phoneTab: PhoneTab = 'bank';
  let shownBalance: number | null = null;
  let phoneKey = '';
  let phoneState: DrawerState | null = null;
  const phoneSec = el.querySelector('[data-page="phone"]') as HTMLElement;
  phoneSec.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('button');
    if (!b || b.hasAttribute('disabled')) return;
    const d = b.dataset;
    if (d.phoneTab) { phoneTab = d.phoneTab as PhoneTab; if (phoneState) renderPhone(phoneState); }
    else if (d.pay) cb.onPayBillId?.(d.pay);
    else if (d.take) cb.onTakeOffer?.(d.take);
    else if (d.work) cb.onWorkJob?.(d.work);
    else if (d.routine) cb.onRoutine?.(d.routine as 'wake' | 'weekendWake' | 'bed' | 'shower', Number(d.delta ?? 0));
    else if ('callin' in d) cb.onCallIn?.();
  });
  function renderPhone(state: DrawerState): void {
    phoneState = state;
    const v = state.phone;
    if (!v) return;
    const key = phoneTab + phoneHtml(phoneStructure(v), phoneTab);
    if (key !== phoneKey) {
      phoneKey = key;
      phoneSec.innerHTML = phoneHtml(v, phoneTab);
    } else {
      patchPhone(phoneSec, v);
    }
    const balEl = phoneSec.querySelector<HTMLElement>('[data-balance]');
    if (balEl && shownBalance !== null && shownBalance !== v.balance) animateMoney(balEl, shownBalance, v.balance);
    if (balEl || shownBalance === null) shownBalance = v.balance;
  }

  function renderHome(state: DrawerState): void {
    const sec = el.querySelector('[data-page="home"]')!;
    const sv = state.fridgeBasic + state.fridgeFresh;
    if (!put(sec, `<div class="vh-home">
      <div class="vh-home-row"><span>Money</span><strong>$${state.money}</strong></div>
      <div class="vh-home-row"><span>Fridge</span><strong>${sv} meals</strong></div>
      <div class="vh-home-row"><span>Dishes</span><strong>${state.dishes}</strong></div>
      <div class="vh-home-row"><span>Laundry</span><strong>${Math.floor(state.laundryPile)}/6</strong></div>
      <div class="vh-home-row"><span>Power</span><strong>${state.power ? 'On' : 'OFF'}</strong></div>
      ${state.phone ? `<div class="vh-home-row"><span>Water</span><strong>${state.phone.services.water ? 'On' : 'OFF'}</strong></div>
      <div class="vh-home-row"><span>Internet</span><strong>${state.phone.services.internet ? 'On' : 'OFF'}</strong></div>` : ''}
      ${state.phone && state.phone.bills.length ? `<div class="vh-home-row vh-bill"><span>Bills to pay</span><strong>$${state.phone.bills.reduce((s, b) => s + b.total, 0)}${state.phone.bills.some(b => b.overdue) ? ' (OVERDUE)' : ''}</strong></div>` : ''}
      ${state.billAmount !== null ? `<div class="vh-home-row vh-bill"><span>Bill due</span><strong>$${state.billAmount}${state.billOverdue ? ' (OVERDUE)' : ''}</strong></div>` : ''}
      ${state.pets && state.pets.length ? `<div class="vh-home-row"><span>Pet food</span><strong>${state.petFood ?? 0} portion${state.petFood === 1 ? '' : 's'}</strong></div>` : ''}
      ${(state.pets ?? []).map(p => `<div class="vh-pet" data-pet="${p.id}">
        <div class="vh-pet-head"><span class="vh-dot" style="background:${p.coat}"></span><strong>${esc(p.name)}</strong><span class="vh-pet-where">${esc(p.where)}</span></div>
        <div class="vh-pet-status">${esc(p.status)}</div>
        <div class="vh-pet-needs">${Object.entries(p.needs).map(([k, v]) => `<span class="vh-pet-need" title="${k}"><span>${k[0].toUpperCase() + k.slice(1)}</span><span class="vh-pet-bar"><i style="width:${Math.round(v)}%" data-tone="${v < 25 ? 'low' : v < 55 ? 'mid' : 'ok'}"></i></span></span>`).join('')}${p.kind === 'cat' ? `<span class="vh-pet-need" title="litter"><span>Litter</span><span class="vh-pet-bar"><i style="width:${Math.min(100, p.litterUses * 20)}%" data-tone="${p.litterUses >= 4 ? 'low' : p.litterUses >= 3 ? 'mid' : 'ok'}"></i></span></span>` : ''}</div>
        <div class="vh-pet-acts">${[['feedPet', 'Fill bowl'], ['playPet', 'Play'], ['petPet', 'Pet'], p.kind === 'dog' ? ['walkDog', 'Walk'] : ['scoop', 'Scoop litter']].map(([a, l]) => `<button data-pact="${a}" data-pet-id="${p.id}">${l}</button>`).join('')}</div>
      </div>`).join('')}
      <div class="vh-home-actions">
        ${state.phone && state.phone.bills.length ? `<button data-openphone>Pay bills on the phone</button>` : ''}
        ${state.billAmount !== null ? `<button data-paybill>Pay bill</button>` : ''}
        <button data-groceries ${state.deliveryPending ? 'disabled' : ''}>Order groceries ($40)</button>
        <button data-takeout ${state.deliveryPending ? 'disabled' : ''}>Order takeout ($25)</button>
      </div>
    </div>`)) return;
    sec.querySelector('[data-paybill]')?.addEventListener('click', () => cb.onPayBill());
    sec.querySelector('[data-openphone]')?.addEventListener('click', () => openPage('phone'));
    sec.querySelector('[data-groceries]')?.addEventListener('click', () => cb.onOrderGroceries());
    sec.querySelector('[data-takeout]')?.addEventListener('click', () => cb.onOrderTakeout());
    sec.querySelectorAll<HTMLElement>('[data-pact]').forEach(b => b.addEventListener('click', () => cb.onPetOrder?.(b.dataset.pact!, b.dataset.petId!)));
  }

  function renderLog(state: DrawerState): void {
    const sec = el.querySelector('[data-page="log"]')!;
    const items = state.log.slice(0, 20).map(l => `<li>${l}</li>`).join('');
    if (!put(sec, `<ul class="vh-log-list">${items || '<li class="vh-empty">Nothing happening yet.</li>'}</ul>`)) return;
  }

  return {
    el,
    dock,
    open: openPage,
    close: () => openPage(''),
    /** The page that is open, '' when none. */
    page: () => currentPage,
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
