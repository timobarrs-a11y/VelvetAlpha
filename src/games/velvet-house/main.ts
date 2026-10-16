import { migrateSave } from './state/saveMigration';
import { postToParent, isProfileMessage, isValidOrigin, isVidResultsMessage } from './bridge/protocol';
import { INITIAL_OBJS, TYPES, type ObjectInstance } from './state/objects';
import { DAYS, weekday, clockText, season, absMin } from './state/time';
import { LEVEL_NAMES } from './state/house';
import { NEED_KEYS, NEED_LABELS } from './state/needs';
import { RNG } from './state/rng';
import {
  buildWorld, createAgent, tickAgent, poseOf, isWalking, statusText,
  SITTING_POSES, startChain, type Agent, type AgentId, type AgentLook,
} from './state/agents';
import type { CharacterLook, CharacterNeeds } from './state/types';
import { createHouseArt, type WallMode, type PersonFrame } from './art/houseArt.js';
import { advanceClock } from './engine/loop';
import { startFixedLoop } from './engine/fixedLoop';
import { qualityManager } from './engine/qualityTier';
import { LayerCache } from './engine/layerCache';
import { createGpuLights } from './engine/gpuLights';
import {
  createHousehold, billTick, deliveryTick, dirtTick, laundryTick, newDayReset,
  servings, spend, earn, payBill, orderGroceries, orderTakeout,
  type HouseholdState,
} from './state/household';
import { CATALOG, type CatalogEntry } from './state/catalog';
import { SETTLE, settleComplete, type GoalContext } from './state/goals';
import { rollStyle, tasteOf, computeTasteNorm, type StyleProfile, type CatalogItem } from './state/taste';
import {
  talk, rememberChat, remember,
  type ChatTurn, type CompanionConfig, type PersonaContext, type SampleFn,
} from './state/companionAI';
import { createDrawer, type DrawerPage, type DrawerState } from './ui/drawer';
import { createDialogue, createTray, showDiscoveryCard, createTownSign, type TrayAction } from './ui/dialogue';

const VIEW_W = 640;
const VIEW_H = 440;

const VELVET_COMPANION_ID = (() => {
  try { return new URLSearchParams(location.search).get('companion') || ''; } catch { return ''; }
})();

const SAVE_KEY = VELVET_COMPANION_ID ? `velvet-house-v1:${VELVET_COMPANION_ID}` : 'velvet-house-v1';
const SPEEDS = [1, 3, 10];
const WALL_MODES: { mode: WallMode; label: string }[] = [
  { mode: 'cut', label: 'Cutaway' },
  { mode: 'up', label: 'Walls up' },
  { mode: 'down', label: 'Walls down' },
];

const DEFAULT_LOOKS: Record<AgentId, AgentLook> = {
  jordan: { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', bottom: '#2F3542', longHair: false },
  maya: { skin: '#8D5A3B', hair: '#1E1412', top: '#B5523B', bottom: '#3B3140', longHair: true },
};

const HEX = /^#[0-9a-f]{6}$/i;

function lookFrom(saved: unknown, fallback: AgentLook): AgentLook {
  const l = (saved && typeof saved === 'object' ? saved : {}) as Partial<CharacterLook>;
  return {
    skin: HEX.test(l.skin ?? '') ? l.skin! : fallback.skin,
    hair: HEX.test(l.hairColor ?? '') ? l.hairColor! : fallback.hair,
    top: HEX.test(l.top ?? '') ? l.top! : fallback.top,
    bottom: fallback.bottom,
    longHair: typeof l.hair === 'string' ? /long|wav|curl|bun|pony|braid|loc/i.test(l.hair) : fallback.longHair,
  };
}

function nameFrom(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 16) : fallback;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

interface World {
  day: number;
  minutes: number;
  objs: ObjectInstance[];
  save: Record<string, unknown> | null;
  household: HouseholdState;
}

function loadWorld(): World {
  let day = 1;
  let minutes = 6 * 60 + 20;
  let objs: ObjectInstance[] = INITIAL_OBJS.map((o) => ({ ...o }));
  let save: Record<string, unknown> | null = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? migrateSave(JSON.parse(raw)) : null;
    if (s) {
      save = s as unknown as Record<string, unknown>;
      if (typeof s.day === 'number') day = s.day;
      if (typeof s.minutes === 'number') minutes = s.minutes;
      if (Array.isArray(s.objs) && s.objs.length) objs = s.objs as unknown as ObjectInstance[];
    }
  } catch { /* start fresh */ }
  const household = createHousehold();
  if (save) {
    if (typeof save.money === 'number') household.money = save.money;
    if (typeof save.power === 'boolean') household.power = save.power;
    if (typeof save.dishes === 'number') household.dishes = save.dishes;
    if (typeof save.laundryPile === 'number') household.laundryPile = save.laundryPile;
    if (save.fridge && typeof save.fridge === 'object') {
      const f = save.fridge as { basic?: number; fresh?: number };
      if (typeof f.basic === 'number') household.fridge.basic = f.basic;
      if (typeof f.fresh === 'number') household.fridge.fresh = f.fresh;
    }
    if (save.bill && typeof save.bill === 'object') {
      household.bill = save.bill as HouseholdState['bill'];
    }
    if (typeof save.nextBillAt === 'number') household.nextBillAt = save.nextBillAt;
  }
  return { day, minutes, objs, save, household };
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const world = loadWorld();
  const save = world.save;

  // Names and looks from save or defaults
  const simName = nameFrom(save?.simName, 'Jordan');
  const partnerName = nameFrom(save?.partnerName, 'Maya');
  const townName = nameFrom(save?.townName, 'Honeysuckle Hollow');

  const people: Agent[] = [
    createAgent('jordan', simName, (save?.jordan as { needs?: Partial<CharacterNeeds> })?.needs, lookFrom(save?.look, DEFAULT_LOOKS.jordan)),
    createAgent('maya', partnerName, (save?.maya as { needs?: Partial<CharacterNeeds> })?.needs, lookFrom(save?.mayaLook, DEFAULT_LOOKS.maya)),
  ];
  const house = buildWorld(world.objs);
  const rngSeed = typeof save?.rngSeed === 'number' ? save.rngSeed : Date.now() & 0xffffffff;
  const rng = new RNG(rngSeed);

  // Game state
  let bond = typeof save?.bond === 'number' ? save.bond : 58;
  let freeWill = typeof save?.freeWill === 'boolean' ? save.freeWill : true;
  const owned = new Set<string>(Array.isArray(save?.owned) ? save!.owned as string[] : []);
  let lifeGoal: string | null = typeof save?.lifeGoal === 'string' ? save!.lifeGoal : null;
  let settleDone = typeof save?.settleDone === 'boolean' ? save!.settleDone : false;
  const flags: Record<string, unknown> = (save?.flags as Record<string, unknown>) ?? {};
  if (!flags.settleSeen) flags.settleSeen = [];
  if (!flags.styledSet) flags.styledSet = [];
  if (!flags.lifeStep) flags.lifeStep = 0;

  // Style and taste
  const savedStyle = save?.style as Record<string, number> | undefined;
  const style: StyleProfile = savedStyle
    ? { ...savedStyle } as StyleProfile
    : rollStyle(() => rng.next());
  const tasteNorm = computeTasteNorm(CATALOG as unknown as CatalogItem[], style);

  // Memories
  const coreMem: string[] = Array.isArray(save?.coreMem) ? [...save!.coreMem as string[]] : [];
  const memories: string[] = Array.isArray(save?.memories) ? [...save!.memories as string[]] : [];
  const pastMem: string[] = Array.isArray(save?.pastMem) ? [...save!.pastMem as string[]] : [];

  // Chat
  let chatTurns: ChatTurn[] = Array.isArray(save?.turns) ? [...save!.turns as ChatTurn[]] : [];
  let sample: SampleFn | null = null;


  // Companion config
  const companionCfg: CompanionConfig = {
    name: partnerName,
    pronoun: (save?.companion as { pronoun?: 'she' | 'he' | 'they' })?.pronoun ?? 'she',
    preset: (save?.companion as { preset?: 'warm' | 'calm' | 'bubbly' | 'dry' })?.preset ?? 'warm',
    bio: (save?.companion as { bio?: string })?.bio ?? '',
    source: (save?.companion as { source?: 'game' | 'velvet' })?.source ?? 'game',
  };

  // Log
  const logEl = document.createElement('ul');
  logEl.className = 'vh-log';
  const logEntries: string[] = [];
  const log = (msg: string): void => {
    if (!msg) return;
    logEntries.unshift(msg);
    if (logEntries.length > 30) logEntries.pop();
    const li = document.createElement('li');
    li.textContent = msg;
    logEl.prepend(li);
    while (logEl.children.length > 8) logEl.lastChild!.remove();
  };

  // Town sign
  const townSign = createTownSign();
  townSign.textContent = townName;

  // Build UI
  const card = (p: Agent): string => `
    <button class="vh-person" data-person="${p.id}" aria-pressed="false" title="Follow ${escapeHtml(p.name)}">
      <span class="vh-person-head">
        <span class="vh-dot" style="background:${p.look.top}"></span>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="vh-where" data-where></span>
      </span>
      <span class="vh-status" data-status></span>
      <span class="vh-needs">
        ${NEED_KEYS.map((k) => `<span class="vh-need" title="${NEED_LABELS[k]}"><span class="vh-need-label">${NEED_LABELS[k]}</span><span class="vh-bar"><i data-need="${k}"></i></span></span>`).join('')}
      </span>
    </button>`;

  app.innerHTML = `
    <div class="vh-stage">
      <canvas class="vh-canvas" aria-label="Your house"></canvas>
      <div class="vh-hud">
        <div class="vh-chip"><span data-el="when"></span><strong data-el="clock"></strong></div>
        <div class="vh-chip vh-season" data-el="season"></div>
        <div class="vh-chip vh-money" data-el="money"></div>
        <div class="vh-chip vh-fridge" data-el="fridge"></div>
      </div>
      <div class="vh-people" aria-label="Who is home">${people.map(card).join('')}</div>
      <ul class="vh-log" aria-live="polite"></ul>
      <div class="vh-controls">
        <div class="vh-floors" role="tablist" aria-label="Floors">
          ${LEVEL_NAMES.map((n, i) => `<button role="tab" data-level="${i}">${n}</button>`).join('')}
        </div>
        <div class="vh-tools">
          <button data-act="rotate" title="Turn the house (R)" aria-label="Turn the house">&#8635;</button>
          <button data-act="walls" title="Change how walls show (W)">Cutaway</button>
          <button data-act="speed" title="Game speed">1x</button>
          <button data-act="pause" title="Pause (Space)" aria-pressed="false">Pause</button>
          <button data-act="arrange" title="Arrange furniture (A)" aria-pressed="false">Arrange</button>
        </div>
      </div>
    </div>`;

  const canvas = app.querySelector<HTMLCanvasElement>('.vh-canvas')!;
  app.querySelector('.vh-log')!.replaceWith(logEl);
  const stage = app.querySelector('.vh-stage')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) { app.textContent = 'Your browser could not start the game display.'; return; }

  const el = (name: string) => app.querySelector<HTMLElement>(`[data-el="${name}"]`)!;
  const btn = (act: string) => app.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;
  const personEl = (id: AgentId) => app.querySelector<HTMLButtonElement>(`[data-person="${id}"]`)!;

  const gpuLights = createGpuLights();
  const art = createHouseArt(ctx, {
    gpuLights: () => (gpuLights && qualityManager.getTier() !== 'low' ? gpuLights : null),
  });
  art.applySave(save);
  const savedMode = (save as { wallMode?: string })?.wallMode;
  const view = {
    level: 1,
    rot: 0,
    wallIdx: Math.max(0, WALL_MODES.findIndex((w) => w.mode === savedMode)),
    speedIdx: 0,
    paused: false,
    t: 0,
    follow: null as AgentId | null,
  };

  const fit = (): void => {
    const ratio = qualityManager.resolveDpr(window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    const isNarrow = box.width < 560;
    let w: number, h: number;
    if (isNarrow) {
      h = Math.max(1, Math.round(box.height * ratio));
      w = Math.max(1, Math.round((h * VIEW_W) / VIEW_H));
    } else {
      w = Math.max(1, Math.round(box.width * ratio));
      h = Math.max(1, Math.round((w * VIEW_H) / VIEW_W));
    }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const panX = isNarrow ? (w - Math.round(box.width * ratio)) / 2 : 0;
    ctx.setTransform(w / VIEW_W, 0, 0, h / VIEW_H, -panX * (w / VIEW_W) / w, 0);
  };
  const updatePan = (): void => {
    const box = canvas.getBoundingClientRect();
    if (box.width >= 560) return;
    const followed = view.follow && people.find((p) => p.id === view.follow);
    if (followed) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const screenW = box.width * dpr;
      const gameW = (box.height * dpr * VIEW_W) / VIEW_H;
      const maxPan = Math.max(0, gameW - screenW);
      const target = Math.max(0, Math.min(maxPan, (followed.x / 100) * maxPan));
      const w = canvas.width, h = canvas.height;
      ctx.setTransform(w / VIEW_W, 0, 0, h / VIEW_H, -target * (w / VIEW_W) / w, 0);
    }
  };
  new ResizeObserver(fit).observe(canvas);
  fit();

  // UI: Drawer
  const drawer = createDrawer({
    onBuy: (item, color) => handleBuy(item, color),
    onOrder: (chain) => handleOrder(chain),
    onPayBill: () => { payBill(world.household, absMin(world.day, world.minutes), log); },
    onOrderGroceries: () => {
      if (spend(world.household, 40)) { orderGroceries(world.household, absMin(world.day, world.minutes), 6, false); log('Groceries ordered. Delivery in 30 min.'); }
      else log('Not enough money for groceries.');
    },
    onOrderTakeout: () => {
      if (spend(world.household, 25)) { orderTakeout(world.household, absMin(world.day, world.minutes)); log('Takeout ordered. Delivery in 35 min.'); }
      else log('Not enough money for takeout.');
    },
    onTalk: () => openChat(),
    onRestart: () => {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      postToParent({ type: 'velvet:restarted', game: 'velvet-house', day: 1 });
      location.reload();
    },
    onPickLifeGoal: (g) => { lifeGoal = g; log(`Life goal: ${g}`); },
  });
  stage.appendChild(drawer.el);
  stage.appendChild(drawer.dock);
  stage.appendChild(townSign);

  // UI: Dialogue
  const dialogue = createDialogue({
    onSend: (text) => handleTalk(text),
    onClose: () => handleCloseChat(),
  });
  stage.appendChild(dialogue.el);

  // UI: Tray
  const tray = createTray();
  stage.appendChild(tray.el);

  // Restore drawer page
  let drawerPage: DrawerPage = '';
  try { drawerPage = localStorage.getItem('velvet-drawer') as DrawerPage || ''; } catch {}
  if (drawerPage) drawer.open(drawerPage);

  // Controls
  const syncControls = (): void => {
    app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
      b.setAttribute('aria-selected', String(Number(b.dataset.level) === view.level));
    });
    btn('walls').textContent = WALL_MODES[view.wallIdx].label;
    btn('speed').textContent = `${SPEEDS[view.speedIdx]}x`;
    btn('pause').setAttribute('aria-pressed', String(view.paused));
    btn('pause').textContent = view.paused ? 'Play' : 'Pause';
    people.forEach((p) => personEl(p.id).setAttribute('aria-pressed', String(view.follow === p.id)));
  };
  const setLevel = (lv: number, keepFollow = false): void => {
    view.level = lv;
    if (!keepFollow) view.follow = null;
    syncControls();
  };
  const rotate = (): void => { view.rot = (view.rot + 1) % 4; };
  const cycleWalls = (): void => { view.wallIdx = (view.wallIdx + 1) % WALL_MODES.length; syncControls(); };
  const togglePause = (): void => { view.paused = !view.paused; syncControls(); };
  const toggleFollow = (id: AgentId): void => {
    view.follow = view.follow === id ? null : id;
    const p = people.find((x) => x.id === id)!;
    if (view.follow) setLevel(p.level, true);
    else syncControls();
  };

  app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
    b.addEventListener('click', () => setLevel(Number(b.dataset.level)));
  });
  people.forEach((p) => personEl(p.id).addEventListener('click', () => toggleFollow(p.id)));
  btn('rotate').addEventListener('click', rotate);
  btn('walls').addEventListener('click', cycleWalls);
  btn('pause').addEventListener('click', togglePause);
  btn('speed').addEventListener('click', () => { view.speedIdx = (view.speedIdx + 1) % SPEEDS.length; syncControls(); });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key >= '1' && e.key <= '4') setLevel(Number(e.key) - 1);
    else if (e.key === 'r' || e.key === 'R') rotate();
    else if (e.key === 'w' || e.key === 'W') cycleWalls();
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'a' || e.key === 'A') { toggleArrange(); }
    if (arranging) {
      if (e.key === 'r' || e.key === 'R') { rotateHeld(); e.preventDefault(); }
      if (e.key === 'Escape') { cancelHold(); }
    }
  });
  syncControls();

  // Arrange mode
  let arranging = false;
  let heldObj: ObjectInstance | null = null;
  let heldOrig: { x: number; y: number; rot: number } | null = null;
  let wasPaused = false;
  function toggleArrange(): void {
    arranging = !arranging;
    const ab = btn('arrange');
    ab.setAttribute('aria-pressed', String(arranging));
    ab.textContent = arranging ? 'Done' : 'Arrange';
    if (arranging) {
      heldObj = null;
      wasPaused = view.paused;
      view.paused = true;
      syncControls();
    } else {
      cancelHold();
      view.paused = wasPaused;
      syncControls();
    }
  }
  function rotateHeld(): void {
    if (!heldObj) return;
    heldObj.rot = (heldObj.rot + 1) % 4;
  }
  function cancelHold(): void {
    if (heldObj && heldOrig) { heldObj.x = heldOrig.x; heldObj.y = heldOrig.y; heldObj.rot = heldOrig.rot; }
    heldObj = null;
    heldOrig = null;
  }
  btn('arrange').addEventListener('click', toggleArrange);

  // Canvas click → interaction or arrange
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;

    if (arranging) {
      // Click in arrange mode: pick up or place furniture
      if (heldObj) {
        // Place: convert screen coords back to world coords
        const wx = Math.round(((sx - 288) / 32 + (sy - 128) / 16) / 2 * 4) / 4;
        const wy = Math.round(((sy - 128) / 16 - (sx - 288) / 32) / 2 * 4) / 4;
        heldObj.x = Math.max(0, Math.min(10, wx));
        heldObj.y = Math.max(0, Math.min(8, wy));
        log(`Moved the ${TYPES[heldObj.type]?.name ?? 'furniture'}.`);
        heldObj = null;
        heldOrig = null;
        return;
      }
      const obj = findObjectAt(sx, sy);
      if (obj && !TYPES[obj.type]?.fixed) {
        heldObj = obj;
        heldOrig = { x: obj.x, y: obj.y, rot: obj.rot };
      }
      return;
    }

    // Try clicking on Maya → open chat
    const maya = people[1];
    if (maya.level === view.level) {
      const mx = 288 + (maya.x - maya.y) * 32;
      const my = 128 + (maya.x + maya.y) * 16 - maya.z * 34;
      if (Math.hypot(sx - mx, sy - my) < 30) { openChat(); return; }
    }
    // Try clicking on Jordan → follow
    const jordan = people[0];
    if (jordan.level === view.level) {
      const jx = 288 + (jordan.x - jordan.y) * 32;
      const jy = 128 + (jordan.x + jordan.y) * 16 - jordan.z * 34;
      if (Math.hypot(sx - jx, sy - jy) < 30) { toggleFollow('jordan'); return; }
    }
    // Try clicking on objects
    const obj = findObjectAt(sx, sy);
    if (obj) { showObjectActions(obj, e.clientX, e.clientY); return; }
  });

  // Mouse move in arrange mode: drag held object
  canvas.addEventListener('mousemove', (e) => {
    if (!arranging || !heldObj) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const sy = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const wx = Math.round(((sx - 288) / 32 + (sy - 128) / 16) / 2 * 4) / 4;
    const wy = Math.round(((sy - 128) / 16 - (sx - 288) / 32) / 2 * 4) / 4;
    heldObj.x = Math.max(0, Math.min(10, wx));
    heldObj.y = Math.max(0, Math.min(8, wy));
  });

  function findObjectAt(sx: number, sy: number): ObjectInstance | null {
    // Simple hit test: find the nearest object on the current level
    let best: ObjectInstance | null = null;
    let bestDist = Infinity;
    for (const o of world.objs) {
      if (o.level !== view.level) continue;
      const t = TYPES[o.type];
      if (!t) continue;
      const cx = 288 + (o.x + t.W / 2 - o.y - t.D / 2) * 32;
      const cy = 128 + (o.x + t.W / 2 + o.y + t.D / 2) * 16 - t.h * 17;
      const d = Math.hypot(sx - cx, sy - cy);
      const radius = Math.max(t.W, t.D) * 24;
      if (d < radius && d < bestDist) { bestDist = d; best = o; }
    }
    return best;
  }

  function showObjectActions(obj: ObjectInstance, x: number, y: number): void {
    const spots = TYPES[obj.type]?.spots;
    const acts: TrayAction[] = [];
    if (spots) {
      const tags = Object.values(spots).map(s => s.tag);
      const seen = new Set<string>();
      for (const tag of tags) {
        if (seen.has(tag)) continue;
        seen.add(tag);
        const label = actionLabel(tag);
        if (label) acts.push({ act: tag, label, icon: '' });
      }
    }
    if (acts.length === 0) return;
    if (acts.length === 1) { handleObjectAction(obj, acts[0].act); return; }
    tray.show(acts, x, y, (a) => handleObjectAction(obj, a.act));
  }

  function actionLabel(tag: string): string | null {
    const labels: Record<string, string> = {
      seat: 'Sit', bedA: 'Sleep', bedB: 'Sleep', dine1: 'Eat', dine2: 'Eat',
      stove: 'Cook', coffee: 'Make coffee', sink: 'Wash dishes', window: 'Look out',
      shower: 'Shower', tub: 'Bathe', tread: 'Run', lift: 'Lift weights', stretch: 'Stretch',
      records: 'Play records', arcade: 'Play arcade', water: 'Water plants',
      tv: 'Watch TV', desk: 'Work', phone: 'Check phone', read: 'Read',
      piano: 'Play piano', easel: 'Paint', guitar: 'Play guitar',
      stars: 'Stargaze', boxbag: 'Box', bike: 'Ride bike', massage: 'Massage chair',
      hammock: 'Rest in hammock', jukebox: 'Play jukebox', fireside: 'Sit by fire',
      swim: 'Swim', grill: 'Grill', birds: 'Watch birds', garden: 'Tend garden',
      sprinkler: 'Sprinkler', bowl: 'Fill pet bowl', petbed: 'Pet bed',
      litter: 'Scoop litter', rummage: 'Rummage', washer: 'Do laundry',
    };
    return labels[tag] ?? null;
  }

  function handleObjectAction(_obj: ObjectInstance, tag: string): void {
    const chainMap: Record<string, string> = {
      stove: 'cookeat', coffee: 'coffee', shower: 'shower', tub: 'bath',
      seat: 'tv', bedA: 'sleep', bedB: 'sleep', dine1: 'cookeat', dine2: 'cookeat',
      tread: 'workout', lift: 'workout', stretch: 'stretch',
      records: 'records', arcade: 'arcade', water: 'plants',
      tv: 'tv', desk: 'freelance', phone: 'phone', read: 'read',
      piano: 'piano', easel: 'easel', guitar: 'guitar',
      stars: 'stargaze', boxbag: 'boxing', bike: 'bike',
      massage: 'massage', hammock: 'hammock', jukebox: 'jukebox',
      fireside: 'fire', swim: 'swim', grill: 'grill', birds: 'birds',
      garden: 'tend', sprinkler: 'sprinkle', bowl: 'feedPet',
      petbed: 'petPet', litter: 'scoop', rummage: 'rummage', washer: 'laundry',
    };
    const chain = chainMap[tag];
    if (chain) handleOrder(chain);
  }

  function handleOrder(chain: string): void {
    const jordan = people[0];
    startChain(house, jordan, chain, people[1], () => rng.next());
    view.follow = 'jordan';
    if (jordan.level !== view.level) setLevel(jordan.level, true);
    syncControls();
  }

  function handleBuy(item: CatalogEntry, color?: string): void {
    const price = item.price;
    if (!spend(world.household, price)) { log('Not enough money.'); return; }
    owned.add(item.id);
    log(`Bought ${item.name} for $${price}.`);

    // Apply paint/wallpaper/floor
    if (item.icon === 'paint' && (color || item.color)) {
      art.applyPaint(view.level, color || item.color!);
      flags.styled = true;
      if (!(flags.styledSet as number[])?.includes(view.level)) (flags.styledSet as number[]).push(view.level);
      log(`${LEVEL_NAMES[view.level]} painted ${(color || item.color)!}.`);
    }
    if (item.icon === 'paper' && item.pattern) {
      art.applyWallpaper(view.level, item.pattern);
      flags.styled = true;
    }
    if (item.icon === 'floor' && item.floor) {
      art.applyFloor(view.level, item.floor);
      flags.styled = true;
    }
    // Furniture: add to world
    if (item.type && item.icon === 'obj') {
      const newObj: ObjectInstance = {
        id: `${item.type}-${Date.now() & 0xffff}`,
        type: item.type, level: view.level, x: 5, y: 5, rot: 0,
        col: color || item.cols?.[0],
      };
      world.objs.push(newObj);
      flags.furniture = ((flags.furniture as number) ?? 0) + 1;
      log(`${item.name} will be delivered.`);
    }
    // Bond boost from buying liked items
    if (item.tags) {
      const taste = tasteOf({ id: item.id, name: item.name, tags: item.tags }, style, tasteNorm);
      if (taste > 0) { bond = Math.min(100, bond + taste); log(`${partnerName} ${taste > 1 ? 'loves' : 'likes'} the ${item.name}.`); }
    }
    refreshDrawer();
  }

  // Chat
  function openChat(): void {
    if (!sample) { log(`${partnerName} is not available right now.`); return; }
    dialogue.open();
    flags.talked = true;
    if (!(flags.settleSeen as string[])?.includes('talk')) (flags.settleSeen as string[]).push('talk');
    // Show a greeting or the last exchange
    if (chatTurns.length > 0) {
      const last = chatTurns[chatTurns.length - 1];
      if (last.role === 'assistant') dialogue.showAI(last.content);
      else dialogue.showInput();
    } else {
      dialogue.showInput();
    }
  }

  function handleCloseChat(): void {
    // Save memories from chat
    if (chatTurns.length > 2 && sample) {
      rememberChat(chatTurns, sample).then(mems => {
        for (const m of mems) remember(m.line, m.important, coreMem, memories);
      }).catch(() => {});
    }
  }

  async function handleTalk(text: string): Promise<void> {
    if (!sample) { dialogue.showInput(); return; }
    dialogue.busy(true);
    dialogue.showAI('...', true);

    const ctx: PersonaContext = {
      partnerName, simName, townName,
      companion: companionCfg,
      style, bond,
      day: world.day, minutes: world.minutes,
      money: world.household.money,
      fridgeBasic: world.household.fridge.basic,
      fridgeFresh: world.household.fridge.fresh,
      dishes: world.household.dishes,
      laundryPile: world.household.laundryPile,
      power: world.household.power,
      mayaStatus: statusText(people[1]),
      jordanStatus: statusText(people[0]),
      mayaWhere: LEVEL_NAMES[people[1].level],
      jordanWhere: LEVEL_NAMES[people[0].level],
      recentLog: logEntries.slice(0, 5).reverse(),
      coreMem, memories, pastMem,
    };

    let streamed = '';
    const result = await talk(text, chatTurns, ctx, sample, (chunk) => {
      streamed += chunk;
      dialogue.showAI(streamed, true);
    });
    chatTurns = result.turns;
    dialogue.showAI(result.text, true);
    dialogue.busy(false);

    // Apply mood tag
    if (result.tag) {
      bond = Math.max(0, Math.min(100, bond + result.tag.bond * 1.5));
      if (result.tag.act !== 'none') {
        // Could trigger autonomous acts — for now just log
      }
    }

    setTimeout(() => dialogue.showInput(), 1500);
  }

  // Save
  function doSave(): void {
    try {
      const saveData = {
        v: 2, setupDone: true, partnerName, lifeGoal, settleDone,
        flags, career: { level: 0, perf: 0 }, mcareer: { level: 0, perf: 0 },
        pboxes: false, wallMode: WALL_MODES[view.wallIdx].mode,
        yard: { t: [], rainAt: 0, rainUntil: 0, rainCheck: 0 },
        laundryPile: world.household.laundryPile, savedAt: Date.now(),
        minutes: world.minutes, day: world.day,
        money: world.household.money,
        earnedToday: world.household.earnedToday,
        spentToday: world.household.spentToday,
        power: world.household.power, fridge: world.household.fridge,
        bill: world.household.bill, nextBillAt: world.household.nextBillAt,
        owned: [...owned], bond, memories, coreMem, pastMem,
        townName, simName, rngSeed,
        freeWill, autonomy: 'on', mayaCap: 500,
        mayaSpent: { day: world.day, amt: 0 },
        style, companion: companionCfg,
        changes: [], pets: [], dirt: [],
        LOOKS: [], ROOMLOOK: [{},{},{},{}], WALLOBJS: [],
        support: 0, together: 0,
        dishes: world.household.dishes, petFood: 6, petSeq: 0,
        dirtId: 0, changeSeq: 0, projectAt: null,
        objs: world.objs.map(o => ({
          id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot,
          col: o.col ?? null, pot: o.pot, pet: o.pet, grow: o.grow, wet: o.wet, art: o.art,
        })),
        jordan: { needs: people[0].needs, skills: { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 }, mood: { happy: 50, sad: 0, angry: 0, tired: 0, playful: 30, affectionate: 40 }, workedDay: false, friendsDay: false },
        maya: { needs: people[1].needs, skills: { cooking: 0, fitness: 0, logic: 0, creativity: 0, charisma: 0 }, mood: { happy: 50, sad: 0, angry: 0, tired: 0, playful: 30, affectionate: 40 }, workedDay: false, friendsDay: false },
        turns: chatTurns,
        look: { skin: people[0].look.skin, hair: '', hairColor: people[0].look.hair, top: people[0].look.top, eyeColor: '', facialHair: '', glasses: '', gender: 'male' },
        mayaLook: { skin: people[1].look.skin, hair: '', hairColor: people[1].look.hair, top: people[1].look.top, eyeColor: '', facialHair: '', glasses: '', gender: 'female' },
        TASTE: style, CHANGES: [], ext: {},
        player: { name: simName, look: {} },
        partner: { name: partnerName, look: {} },
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch { /* non-fatal */ }
  }

  // Auto-save
  setInterval(doSave, 15000);
  window.addEventListener('pagehide', doSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });

  // Drawer refresh
  function refreshDrawer(): void {
    const goalCtx: GoalContext = {
      flags: flags as never,
      career: { level: 0, perf: 0 } as never,
      bond,
      hasSofaOnLevel1: world.objs.some(o => o.type === 'sofa' && o.level === 1),
      hasPackedBoxes: world.objs.some(o => o.type === 'pbox'),
      lawnLabel: 'Lush', lawnWeeds: 0,
    };
    const drawerState: DrawerState = {
      page: drawerPage, shopTab: 'Today',
      money: world.household.money, bond, day: world.day,
      minutes: world.minutes, owned, careerLevel: 0, careerPerf: 0,
      lifeGoal, settleSeen: flags.settleSeen as string[] ?? [],
      goalCtx, dishes: world.household.dishes,
      laundryPile: world.household.laundryPile,
      fridgeBasic: world.household.fridge.basic,
      fridgeFresh: world.household.fridge.fresh,
      power: world.household.power,
      billAmount: world.household.bill?.amount ?? null,
      billOverdue: world.household.bill?.overdue ?? false,
      petCount: 0, log: logEntries,
      partnerName, simName, townName,
      deliveryPending: !!world.household.delivery,
      mayaStatus: statusText(people[1]),
    };
    drawer.render(drawerState);
  }

  // Goals tick
  function goalsTick(): void {
    if (settleDone) {
      // Check life goal progress
      if (lifeGoal) {
        const goalCtx: GoalContext = {
          flags: flags as never,
          career: { level: 0, perf: 0 } as never,
          bond,
          hasSofaOnLevel1: true, hasPackedBoxes: false,
          lawnLabel: 'Lush', lawnWeeds: 0,
        };
        const result = checkLifeGoalSimple(lifeGoal, goalCtx);
        if (result) {
          flags.lifeStep = (flags.lifeStep as number) + 1;
          earn(world.household, result.reward);
          log(`Life goal step complete: ${result.stepText} (+$${result.reward})`);
        }
      }
      return;
    }
    const goalCtx: GoalContext = {
      flags: flags as never,
      career: { level: 0, perf: 0 } as never,
      bond,
      hasSofaOnLevel1: world.objs.some(o => o.type === 'sofa' && o.level === 1),
      hasPackedBoxes: world.objs.some(o => o.type === 'pbox'),
      lawnLabel: 'Lush', lawnWeeds: 0,
    };
    const seen = flags.settleSeen as string[];
    const next = SETTLE.find(g => !seen.includes(g.id));
    if (next && next.done(goalCtx)) {
      seen.push(next.id);
      bond = Math.min(100, bond + 2);
      log(`Goal complete: ${next.text}`);
      if (settleComplete(goalCtx)) {
        settleDone = true;
        freeWill = true;
        earn(world.household, 100);
        showDiscoveryCard('Welcome home!', `${townName} gave you a $100 welcome basket. The tutorial is over — make it yours.`);
        log('Settled in! +$100 welcome bonus. Free will is on.');
      }
    }
  }

  function checkLifeGoalSimple(goalId: string, ctx: GoalContext): { stepText: string; reward: number } | null {
    const LIFE_GOALS: Record<string, { text: string; done: (ctx: GoalContext) => boolean; reward: number }[]> = {
      career: [
        { text: 'Get promoted', done: c => c.career.level >= 1, reward: 75 },
      ],
      romance: [
        { text: 'Dance with partner', done: c => c.flags.danced, reward: 40 },
        { text: 'Reach bond 80', done: c => c.bond >= 80, reward: 150 },
      ],
      homebody: [
        { text: 'Unpack everything', done: c => !c.hasPackedBoxes, reward: 50 },
        { text: 'Buy 5 furniture', done: c => c.flags.furniture >= 5, reward: 150 },
      ],
      green: [
        { text: 'Mow the lawn', done: c => c.flags.mowed, reward: 30 },
        { text: 'Harvest 5 times', done: c => c.flags.harvests >= 5, reward: 150 },
      ],
    };
    const path = LIFE_GOALS[goalId];
    if (!path) return null;
    const step = path[flags.lifeStep as number];
    if (!step || !step.done(ctx)) return null;
    return { stepText: step.text, reward: step.reward };
  }

  // People refresh
  const refreshPeople = (): void => {
    people.forEach((p) => {
      const root = personEl(p.id);
      root.querySelector<HTMLElement>('[data-status]')!.textContent = statusText(p);
      root.querySelector<HTMLElement>('[data-where]')!.textContent = LEVEL_NAMES[p.level];
      NEED_KEYS.forEach((k) => {
        const bar = root.querySelector<HTMLElement>(`[data-need="${k}"]`)!;
        const v = p.needs[k];
        bar.style.width = `${Math.round(v)}%`;
        bar.dataset.tone = v < 25 ? 'low' : v < 55 ? 'mid' : 'ok';
      });
    });
  };

  // Dev hooks
  const isDev = import.meta.env.DEV;
  if (isDev) {
    (window as unknown as { __velvet?: Record<string, unknown> }).__velvet = {
      setView: (lv: number) => setLevel(lv),
      setMinutes: (m: number) => { world.minutes = m; },
      saveGame: doSave,
      get money() { return world.household.money; },
      set money(v: number) { world.household.money = v; },
      get bond() { return bond; },
      set bond(v: number) { bond = v; },
      setSample: (f: SampleFn) => { sample = f; },
      doVidSearch,
    };
  }

  // Rendering loop
  let hudTimer = 0;
  const layerCache = new LayerCache();

  const seeds: Record<AgentId, number> = { jordan: 0.3, maya: 2.1 };
  function toFrame(p: Agent): PersonFrame {
    const pose = poseOf(p);
    return {
      level: p.level, x: p.x, y: p.y, z: p.z, face: p.face, pose,
      walking: isWalking(p), sit: SITTING_POSES.has(pose) && p.z > 0.05, hidden: p.onStairs,
      seed: seeds[p.id], look: p.look,
    };
  }

  let simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(toFrame) };

  let goalsTimer = 0;
  startFixedLoop(
    (dt) => {
      if (view.paused) return;
      view.t += dt;
      const speed = SPEEDS[view.speedIdx];
      const before = world.minutes + world.day * 1440;
      Object.assign(world, advanceClock(world.day, world.minutes, dt, speed));
      const gameMin = world.minutes + world.day * 1440 - before;
      const hourF = world.minutes / 60;
      const walkMul = Math.min(speed, 6);
      const absM = world.minutes + world.day * 1440;
      const prevDay = world.day;
      billTick(world.household, absM, log);
      deliveryTick(world.household, absM, log);
      dirtTick(world.household, gameMin);
      laundryTick(world.household, gameMin);
      if (world.day !== prevDay) { newDayReset(world.household, log); }
      tickAgent(house, people[0], people[1], dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      tickAgent(house, people[1], people[0], dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      const followed = view.follow && people.find((p) => p.id === view.follow);
      if (followed && !followed.onStairs && followed.level !== view.level) setLevel(followed.level, true);

      // Goals tick (throttled)
      goalsTimer -= dt;
      if (goalsTimer <= 0) { goalsTimer = 0.25; goalsTick(); }
    },
    (alpha, frameDt) => {
      const prevSim = simCache;
      simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(toFrame) };
      const interpMinutes = prevSim.minutes + (simCache.minutes - prevSim.minutes) * alpha;
      const cacheKey = { level: view.level, rot: view.rot, wallMode: WALL_MODES[view.wallIdx].mode, zoomBucket: Math.floor(canvas.width / 400) };
      if (layerCache.keyChanged(cacheKey)) fit();

      art.render({
        level: view.level, rot: view.rot, minutes: interpMinutes, day: world.day,
        t: view.t, dt: frameDt, objs: world.objs, wallMode: WALL_MODES[view.wallIdx].mode,
        chars: people.map(toFrame),
      });
      qualityManager.recordFrame(frameDt * 1000);

      hudTimer -= frameDt;
      if (hudTimer <= 0) {
        hudTimer = 0.25;
        el('when').textContent = `${DAYS[weekday(world.day)]} · Day ${world.day}`;
        el('clock').textContent = clockText(world.minutes);
        el('season').textContent = season(world.day);
        el('money').textContent = `$${world.household.money}`;
        const sv = servings(world.household);
        el('fridge').textContent = sv === 0 ? 'Fridge empty' : `${sv} meals`;
        refreshPeople();
        updatePan();
        refreshDrawer();
      }
    },
  );

  // Bridge: ready
  postToParent({ type: 'velvet:ready', game: 'velvet-house', day: world.day, needsProfile: true });

  // Bridge: incoming messages
  const allowedOrigins: string[] = (() => {
    try { const origin = new URL(document.referrer).origin; return origin ? [origin] : []; } catch { return []; }
  })();

  window.addEventListener('message', (e: MessageEvent) => {
    if (!isValidOrigin(e.origin, allowedOrigins)) return;
    if (isProfileMessage(e.data)) {
      const d = e.data;
      // Apply profile
      const pName = d.player?.name;
      const cName = d.companion?.name;
      if (pName) people[0].name = pName.slice(0, 16);
      if (cName) people[1].name = cName.slice(0, 16);
      if (d.companion?.pronoun) companionCfg.pronoun = d.companion.pronoun;
      if (d.companion?.personality) companionCfg.preset = d.companion.personality as 'warm' | 'calm' | 'bubbly' | 'dry';
      if (d.companion?.look) {
        const cl = d.companion.look;
        if (cl.skin) people[1].look.skin = cl.skin;
        if (cl.hairColor) people[1].look.hair = cl.hairColor;
        if (cl.top) people[1].look.top = cl.top;
      }
      if (d.player?.look) {
        const pl = d.player.look;
        if (pl.skin) people[0].look.skin = pl.skin;
        if (pl.hairColor) people[0].look.hair = pl.hairColor;
        if (pl.top) people[0].look.top = pl.top;
      }
      const wasFromGame = companionCfg.source === 'game';
      companionCfg.source = 'velvet';
      postToParent({
        type: 'velvet:profileApplied', game: 'velvet-house', day: world.day,
        player: people[0].name, companion: people[1].name,
      });
      if (wasFromGame) {
        postToParent({
          type: 'velvet:companionCreated' as never, game: 'velvet-house',
          player: { name: people[0].name, look: { skin: people[0].look.skin, hairColor: people[0].look.hair, top: people[0].look.top } },
          companion: { name: people[1].name, pronoun: companionCfg.pronoun, personality: companionCfg.preset, look: { skin: people[1].look.skin, hairColor: people[1].look.hair, top: people[1].look.top } },
        } as never);
      }
    }
    if (isVidResultsMessage(e.data)) {
      const d = e.data;
      if (d.seq === vidSearchSeq && vidSearchCb) vidSearchCb(d.videos as { id: string; title: string; channelTitle: string; thumbnail: string }[]);
    }
  });

  // Video search: game sends vidSearch to parent, parent responds with vidResults
  let vidSearchSeq = 0;
  let vidSearchCb: ((videos: { id: string; title: string; channelTitle: string; thumbnail: string }[]) => void) | null = null;
  function doVidSearch(query: string, cb: (videos: { id: string; title: string; channelTitle: string; thumbnail: string }[]) => void): void {
    vidSearchSeq++;
    const seq = vidSearchSeq;
    vidSearchCb = cb;
    postToParent({ type: 'velvet:vidSearch' as never, game: 'velvet-house', query, seq } as never);
    setTimeout(() => { if (vidSearchSeq === seq && vidSearchCb) { vidSearchCb = null; cb([]); } }, 12000);
  }

  // Try to get sample function from parent
  try {
    const w = window as unknown as { claude?: { use?: (name: string) => Promise<SampleFn> } };
    if (w.claude?.use) {
      w.claude.use('sample').then((f) => { sample = f; }).catch(() => {});
    }
  } catch {}
}

boot();
