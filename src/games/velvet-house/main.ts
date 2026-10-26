import { migrateSave } from './state/saveMigration';
import { postToParent, isProfileMessage, isValidOrigin, isVidResultsMessage, isAvatarInventoryMessage, isAvatarLookMessage } from './bridge/protocol';
import { setOwnedAvatarItems, ownsAvatarItem, buyAvatarItem } from './bridge/avatarShop';
import { simsShopItems, itemLabel } from '../../data/avatarCatalog';
import { checkPlacement, isMovable, centreAt, rotateAboutCentre, nextColour, otherFloors, relocate, canStore, type PlacementCheck } from './state/arrange';
import { INITIAL_OBJS, ATTIC_STAIR_OBJS, TYPES, type ObjectInstance } from './state/objects';
import { DAYS, weekday, clockText, season, absMin } from './state/time';
import { LEVEL_NAMES, FLOOR_ORDER, ATTIC, LEVELS, roomName } from './state/house';
import { NEED_KEYS, NEED_LABELS } from './state/needs';
import { RNG } from './state/rng';
import {
  buildWorld, createAgent, tickAgent, poseOf, isWalking, statusText,
  SITTING_POSES, startChain, startSequence, isAsleep, type Agent, type AgentId, type AgentLook,
} from './state/agents';
import type { CharacterLook, CharacterNeeds } from './state/types';
import { createHouseArt, type WallMode, type PersonFrame } from './art/houseArt.js';
import { expressionFor } from './art/poseAnim.js';
import { createGpuLights } from './engine/gpuLights.js';
import { createGBuffer } from './engine/gbuffer';
import { createDeferredLights } from './engine/deferredLights';
import { advanceClock } from './engine/loop';
import { startFixedLoop } from './engine/fixedLoop';
import { qualityManager } from './engine/qualityTier';
import { LayerCache } from './engine/layerCache';
import {
  createHousehold, deliveryTick, dirtTick, laundryTick, newDayReset,
  servings, payBill, orderGroceries, orderTakeout,
  type HouseholdState,
} from './state/household';
import { CATALOG, type CatalogEntry } from './state/catalog';
import { SETTLE, settleComplete, type GoalContext } from './state/goals';
import { rollStyle, tasteOf, computeTasteNorm, type StyleProfile, type CatalogItem } from './state/taste';
import {
  talk, rememberChat, remember, cannedFor,
  type ChatTurn, type CompanionConfig, type PersonaContext, type SampleFn,
} from './state/companionAI';
import { snapshot } from './state/save';
import { parseLife, type LifeState } from './state/life';
import { financeTick, payBill as payOneBill, withdraw, deposit } from './state/finance';
import { sideJobsTick, takeOffer, blockedBy, startWork, addWork, finishJob, workRate, SIDE_JOBS, SIDE_ACTS } from './state/sideJobs';
import { routineStep, rollDay, morningActs, nightStart, wakeHour, dayPay, clampRoutine, isWorkday, CORNER_MARKET } from './state/routine';
import { phoneView } from './ui/phone';
import { createHostSample } from './bridge/hostSample';
import { PICTURE_WALLS } from './state/pictureWalls';
import { createDrawer, dockTabHtml, DOCK_TABS, type ArrangeState, type DrawerPage, type DrawerState } from './ui/drawer';
import { clothByKey, clothId, wearOnAgent, validOutfit, validWardrobe, closetFromWardrobe, AVATAR_HATS, BOTTOM_STYLES, type OwnedCloth, type Wardrobe } from './state/clothing';
import { validHeadSvgs, loadHeadImages } from './state/headSprites';
import { validBodySvgs, loadBodyImages } from './state/bodySprites';
import { createDialogue, createTray, showDiscoveryCard, createTownSign, type TrayAction } from './ui/dialogue';

const VIEW_W = 640;
const VIEW_H = 440;

const VELVET_COMPANION_ID = (() => {
  try { return new URLSearchParams(location.search).get('companion') || ''; } catch { return ''; }
})();

// The live game keeps its own save slot. The legacy game uses `velvet-house-v1:<id>`, and sharing it meant
// each could overwrite the other's progress.
const SAVE_KEY = VELVET_COMPANION_ID ? `velvet-sims:${VELVET_COMPANION_ID}` : 'velvet-sims';
const LEGACY_SAVE_KEY = VELVET_COMPANION_ID ? `velvet-house-v1:${VELVET_COMPANION_ID}` : 'velvet-house-v1';
const SPEEDS = [1, 3, 10];
// The Sims' fast-forwards: skipping the work day, and the night while everyone sleeps.
const SKIP_SPEED = 180;
const NIGHT_SPEED = 60;
const WALL_MODES: { mode: WallMode; label: string }[] = [
  { mode: 'cut', label: 'Cutaway' },
  { mode: 'up', label: 'Walls up' },
  { mode: 'down', label: 'Walls down' },
];

const DEFAULT_LOOKS: Record<AgentId, AgentLook> = {
  jordan: { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', topStyle: 'tee', bottom: '#2F3542', longHair: false },
  maya: { skin: '#8D5A3B', hair: '#1E1412', top: '#B5523B', topStyle: 'tee', bottom: '#3B3140', longHair: true },
};

const HEX = /^#[0-9a-f]{6}$/i;

function lookFrom(saved: unknown, fallback: AgentLook): AgentLook {
  const l = (saved && typeof saved === 'object' ? saved : {}) as Partial<CharacterLook>;
  return {
    skin: HEX.test(l.skin ?? '') ? l.skin! : fallback.skin,
    hair: HEX.test(l.hairColor ?? '') ? l.hairColor! : fallback.hair,
    top: HEX.test(l.top ?? '') ? l.top! : fallback.top,
    topStyle: typeof (l as { topStyle?: unknown }).topStyle === 'string' ? (l as { topStyle: string }).topStyle : fallback.topStyle,
    bottom: HEX.test((l as { bottom?: string }).bottom ?? '') ? (l as { bottom: string }).bottom : fallback.bottom,
    accent: HEX.test((l as { accent?: string }).accent ?? '') ? (l as { accent: string }).accent : undefined,
    bottomStyle: BOTTOM_STYLES.has((l as { bottomStyle?: string }).bottomStyle ?? '') ? (l as { bottomStyle: string }).bottomStyle : undefined,
    bottomAccent: HEX.test((l as { bottomAccent?: string }).bottomAccent ?? '') ? (l as { bottomAccent: string }).bottomAccent : undefined,
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
  life: LifeState;
}

function loadWorld(): World {
  let day = 1;
  let minutes = 6 * 60 + 20;
  let objs: ObjectInstance[] = INITIAL_OBJS.map((o) => ({ ...o }));
  let save: Record<string, unknown> | null = null;
  try {
    // First run on the new slot: carry the house over from the old one (migrated, so the old copy stays as it was).
    if (localStorage.getItem(SAVE_KEY) === null) {
      const old = migrateSave(JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) ?? 'null'));
      if (old) localStorage.setItem(SAVE_KEY, JSON.stringify(old));
    }
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
  // Bills are separate now (state/finance.ts): the old single bill is retired.
  household.bill = null;
  household.nextBillAt = null;
  const life = parseLife(save?.life, day);
  return { day, minutes, objs, save, household, life };
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
  // Closet: default pieces plus anything bought from the Clothes tab
  const closet: OwnedCloth[] = Array.isArray(save?.closet)
    ? (save!.closet as OwnedCloth[]).filter(c => c.id.startsWith('sig-') || clothByKey(c.id.slice(2)))
    : [
      { slot: 'top', style: 'tee', col: people[0].look.top, name: 'Old tee', id: clothId('tee') },
      { slot: 'top', style: 'tee', col: people[1].look.top, name: 'Shared tee', id: clothId('tee') },
      { slot: 'bottom', style: 'pants', col: people[0].look.bottom, name: 'Old jeans', id: clothId('jeans') },
    ];
  if (!closet.some(c => c.slot === 'bottom')) closet.push({ slot: 'bottom', style: 'pants', col: people[0].look.bottom, name: 'Old jeans', id: clothId('jeans') });
  // What the avatar wardrobe lets the player wear (sent by the host), and the avatar hat they have on.
  let wardrobe: Wardrobe | null = null;
  let wornHat = 'none';
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
          ${FLOOR_ORDER.map((i) => `<button role="tab" data-level="${i}"${i === ATTIC ? ' hidden' : ''}>${LEVEL_NAMES[i]}</button>`).join('')}
        </div>
        <div class="vh-tools">
          <button data-act="rotate" title="Turn the house (R)" aria-label="Turn the house">&#8635;</button>
          <button data-act="walls" title="Change how walls show (W)">Cutaway</button>
          <button data-act="speed" title="Game speed">1x</button>
          <button data-act="skipwork" title="Skip ahead to when he's home" hidden>Skip to 5 PM</button>
          <button data-act="quality" title="Graphics quality">Auto</button>
          <button data-act="pause" title="Pause (Space)" aria-pressed="false">Pause</button>
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
  const gbuffer = createGBuffer();
  const deferredLights = createDeferredLights();
  const art = createHouseArt(ctx, {
    gpuLights: () => gpuLights,
    gbuffer: () => gbuffer,
    deferredLights: () => deferredLights,
    quality: () => qualityManager.getTier(),
  });
  art.registerPictures(PICTURE_WALLS);
  const pictureThumbs: Record<string, string> = Object.fromEntries(PICTURE_WALLS.filter(w => w.thumb).map(w => [w.id, w.thumb]));
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

  // Arrange mode: tap a piece to select it (it gets an outline), then drag it.
  let arranging = false;
  let selectedObj: ObjectInstance | null = null;
  let heldObj: ObjectInstance | null = null; // the piece being dragged right now
  let heldOrig: { x: number; y: number; rot: number } | null = null;
  let heldGrab: [number, number] = [0, 0]; // where on the piece it was grabbed, so it doesn't jump under the finger
  let dragCandidate: { id: number; obj: ObjectInstance; x: number; y: number } | null = null;
  let wasPaused = false;

  // The attic exists once its stairs have been built.
  const hasAttic = (): boolean => world.objs.some(o => o.id === ATTIC_STAIR_OBJS[0].id);

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
    basePan = isNarrow ? -((w - Math.round(box.width * ratio)) / 2) * (w / VIEW_W) / w : 0;
    applyCamera(0);
  };

  // Camera: zoom and focus on top of the fitted view. Following someone frames
  // them in a close-up (a two-shot when they're with the other person);
  // otherwise scroll or pinch to zoom, drag to pan, double-tap to reset.
  let basePan = 0;
  const cam = { z: 1, fx: VIEW_W / 2, fy: VIEW_H / 2, tz: 1, tfx: VIEW_W / 2, tfy: VIEW_H / 2 };
  const CAM_MAX = 2.6;
  function clampFocus(z: number, fx: number, fy: number): [number, number] {
    const hw = VIEW_W / (2 * z), hh = VIEW_H / (2 * z);
    return [Math.max(hw, Math.min(VIEW_W - hw, fx)), Math.max(hh, Math.min(VIEW_H - hh, fy))];
  }
  function cameraShot(): void {
    const followed = view.follow && people.find((p) => p.id === view.follow);
    if (!followed || followed.level !== view.level) return;
    const other = people.find((p) => p.id !== followed.id);
    const together = other && other.level === followed.level && followed.task && SOCIAL_ACTS.has(followed.task.act);
    const [ax, ay] = art.project(followed.x, followed.y, 0.7);
    if (together && other) {
      const [bx, by] = art.project(other.x, other.y, 0.7);
      cam.tz = 1.7; cam.tfx = (ax + bx) / 2; cam.tfy = (ay + by) / 2;
    } else {
      cam.tz = 2.1; cam.tfx = ax; cam.tfy = ay;
    }
  }
  function applyCamera(frameDt: number): void {
    cameraShot();
    const k = frameDt > 0 ? Math.min(1, frameDt * 6) : 1;
    cam.z += (cam.tz - cam.z) * k;
    [cam.tfx, cam.tfy] = clampFocus(cam.tz, cam.tfx, cam.tfy);
    cam.fx += (cam.tfx - cam.fx) * k; cam.fy += (cam.tfy - cam.fy) * k;
    [cam.fx, cam.fy] = clampFocus(cam.z, cam.fx, cam.fy);
    const w = canvas.width, h = canvas.height, sx = (w / VIEW_W) * cam.z, sy = (h / VIEW_H) * cam.z;
    ctx!.setTransform(sx, 0, 0, sy, w / 2 - sx * cam.fx + basePan, h / 2 - sy * cam.fy);
  }
  /** A pointer position in game view coordinates, whatever the zoom. */
  function toView(clientX: number, clientY: number): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width, py = ((clientY - rect.top) / rect.height) * canvas.height;
    const p = ctx!.getTransform().inverse().transformPoint(new DOMPoint(px, py));
    return [p.x, p.y];
  }
  function zoomAt(clientX: number, clientY: number, factor: number): void {
    if (view.follow) toggleFollow(view.follow); // taking the camera back from a follow
    const [px, py] = toView(clientX, clientY);
    const nz = Math.max(1, Math.min(CAM_MAX, cam.tz * factor));
    // Keep the spot under the finger or cursor where it is.
    cam.tfx = px - (px - cam.tfx) * (cam.tz / nz);
    cam.tfy = py - (py - cam.tfy) * (cam.tz / nz);
    cam.tz = nz;
  }
  function resetCamera(): void { cam.tz = 1; cam.tfx = VIEW_W / 2; cam.tfy = VIEW_H / 2; }
  new ResizeObserver(fit).observe(canvas);
  fit();

  // UI: Drawer
  let drawerPage: DrawerPage = '';
  const drawer = createDrawer({
    onClose: () => { drawerPage = ''; try { localStorage.removeItem('velvet-drawer'); } catch {} },
    onPage: (pg) => { if (pg === 'arrange') enterArrange(); else if (arranging) exitArrange(); },
    onArrangePick: (id) => { const o = world.objs.find(q => q.id === id); if (o) selectObject(o); },
    onArrangeRotate: () => rotateSelected(),
    onArrangeColour: () => recolourHeld(),
    onArrangeFloor: (lv) => carryTo(lv),
    onArrangeStore: () => storeSelected(),
    onArrangeUnstore: (id) => unstore(id),
    onPickFloor: (lv) => setLevel(lv),
    onBuy: (item, color) => handleBuy(item, color),
    onBuyAvatarItem: (id) => handleBuyAvatarItem(id),
    onOrder: (chain) => handleOrder(chain),
    onPayBill: () => { payBill(world.household, absMin(world.day, world.minutes), log); },
    onPayBillId: (id) => { payOneBill(world.household, world.life, id, world.day, world.minutes, log); refreshDrawer(); },
    onTakeOffer: (id) => {
      const t = takeOffer(world.life, id);
      if (t) log(`Took the job: ${SIDE_JOBS[t.job].title.toLowerCase()} for ${t.client}.`);
      else log('Finish a job first: three can wait at once.');
      refreshDrawer();
    },
    onWorkJob: (id) => workOnJob(id),
    onRoutine: (key, delta) => {
      const r = world.life.routine;
      if (key === 'shower') r.shower = !r.shower;
      else world.life.routine = clampRoutine({ ...r, [key]: r[key] + delta });
      refreshDrawer();
    },
    onCallIn: () => {
      world.life.today.calledIn = true;
      log(`${people[0].name} is staying home today. No pay for today.`);
      refreshDrawer();
    },
    onOrderGroceries: () => {
      if (spendOn('Groceries', 40)) { orderGroceries(world.household, absMin(world.day, world.minutes), 6, false); log('Groceries ordered. Delivery in 30 min.'); }
      else log('Not enough money for groceries.');
    },
    onOrderTakeout: () => {
      if (spendOn('Takeout', 25)) { orderTakeout(world.household, absMin(world.day, world.minutes)); log('Takeout ordered. Delivery in 35 min.'); }
      else log('Not enough money for takeout.');
    },
    onTalk: () => openChat(),
    onRestart: () => {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      postToParent({ type: 'velvet:restarted', game: 'velvet-house', day: 1 });
      location.reload();
    },
    onPickLifeGoal: (g) => { lifeGoal = g; log(`Life goal: ${g}`); },
    onWear: (cloth) => {
      wearPiece(cloth);
      log(`Changed into the ${cloth.name}.`);
      refreshDrawer();
      // New clothes show on the player's avatar outside the game too.
      if (cloth.slot === 'top') tellHostLook(cloth);
      else if (cloth.slot === 'bottom') tellHostLook(undefined, cloth);
      else if (cloth.slot === 'hat' && AVATAR_HATS.has(cloth.style)) tellHostLook(undefined, undefined, cloth.style);
    },
    onWearPersona: (id) => {
      const p = wardrobe?.personas.find(x => x.id === id);
      const top = p && closet.find(c => c.id === p.top), base = p && closet.find(c => c.id === p.bottom), hat = p && closet.find(c => c.id === p.hat);
      if (!p || !top || !base || !hat) return;
      const bottom = p.bottomCol ? { ...base, col: p.bottomCol } : base;
      wearPiece(top); wearPiece(bottom); wearPiece(hat);
      log(`Changed into the ${p.label} look.`);
      refreshDrawer();
      tellHostLook(top, bottom, hat.style);
    },
  });
  stage.appendChild(drawer.el);
  stage.appendChild(drawer.dock);

  // Who's home (needs and what they're doing) lives behind a People tab in the
  // bottom bar instead of covering the house; it opens above the bar.
  const peopleEl = app.querySelector<HTMLElement>('.vh-people')!;
  peopleEl.hidden = true;
  const peopleBtn = document.createElement('button');
  peopleBtn.type = 'button';
  peopleBtn.dataset.people = '';
  peopleBtn.innerHTML = dockTabHtml('people', 'People');
  peopleBtn.style.setProperty('--tab', DOCK_TABS.people.color);
  peopleBtn.setAttribute('aria-pressed', 'false');
  peopleBtn.addEventListener('click', () => {
    const show = peopleEl.hidden;
    peopleEl.hidden = !show;
    peopleBtn.setAttribute('aria-pressed', String(show));
  });
  drawer.dock.prepend(peopleBtn);
  stage.appendChild(townSign);

  // UI: Dialogue
  const dialogue = createDialogue({
    onSend: (text) => handleTalk(text),
    onClose: () => handleCloseChat(),
  });
  stage.appendChild(dialogue.el);
  dialogue.setPortraitLook({ skin: people[1].look.skin, hair: people[1].look.hair, longHair: people[1].look.longHair });
  dialogue.setPortraitTalking(false);

  // UI: Tray
  const tray = createTray();
  stage.appendChild(tray.el);

  // Restore drawer page
  try { drawerPage = localStorage.getItem('velvet-drawer') as DrawerPage || ''; } catch {}
  if (drawerPage) drawer.open(drawerPage);

  // Controls
  const QUALITY_CHOICES = [null, 'high', 'medium', 'low'] as const;
  const QUALITY_LABELS = ['Auto', 'High', 'Medium', 'Low'];
  let qualityIdx = 0;
  try { qualityIdx = Math.max(0, Math.min(3, Number(localStorage.getItem('velvet-quality')) || 0)); } catch {}
  const applyQuality = (): void => qualityManager.setPlayerOverride(QUALITY_CHOICES[qualityIdx]);
  applyQuality();
  fit();
  const syncControls = (): void => {
    app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
      b.setAttribute('aria-selected', String(Number(b.dataset.level) === view.level));
      if (Number(b.dataset.level) === ATTIC) b.hidden = !hasAttic();
    });
    btn('walls').textContent = WALL_MODES[view.wallIdx].label;
    btn('speed').textContent = `${SPEEDS[view.speedIdx]}x`;
    btn('quality').textContent = QUALITY_LABELS[qualityIdx];
    btn('pause').setAttribute('aria-pressed', String(view.paused));
    btn('pause').textContent = view.paused ? 'Play' : 'Pause';
    people.forEach((p) => personEl(p.id).setAttribute('aria-pressed', String(view.follow === p.id)));
  };
  // Changing floors or turning the view crossfades instead of snapping.
  const softCut = (): void => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    canvas.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  };
  const setLevel = (lv: number, keepFollow = false): void => {
    if (lv !== view.level) softCut();
    if (selectedObj && selectedObj.level !== lv) { cancelHold(); selectedObj = null; }
    view.level = lv;
    if (!keepFollow) view.follow = null;
    syncControls();
  };
  const rotate = (): void => { softCut(); view.rot = (view.rot + 1) % 4; };
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
  btn('quality').addEventListener('click', () => {
    qualityIdx = (qualityIdx + 1) % QUALITY_CHOICES.length;
    applyQuality();
    try { localStorage.setItem('velvet-quality', String(qualityIdx)); } catch {}
    fit();
    syncControls();
  });
  btn('pause').addEventListener('click', togglePause);
  btn('speed').addEventListener('click', () => { view.speedIdx = (view.speedIdx + 1) % SPEEDS.length; syncControls(); });
  btn('skipwork').addEventListener('click', () => { if (people[0].away) { skipping = true; btn('skipwork').hidden = true; } });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key >= '1' && e.key <= '5' && (Number(e.key) - 1 !== ATTIC || hasAttic())) setLevel(Number(e.key) - 1);
    else if (e.key === 'r' || e.key === 'R') { if (arranging) { rotateSelected(); e.preventDefault(); } else rotate(); }
    else if (e.key === 'w' || e.key === 'W') cycleWalls();
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'a' || e.key === 'A') { toggleArrange(); }
    if (arranging) {
      if (e.key === 'c' || e.key === 'C') { recolourHeld(); }
      if (e.key === 'Escape') { if (heldObj) cancelHold(); else selectedObj = null; }
    }
  });
  syncControls();

  // Arrange mode
  const toggleArrange = (): void => { if (arranging) drawer.close(); else drawer.open('arrange'); };
  function enterArrange(): void {
    if (arranging) return;
    arranging = true;
    stage.classList.add('vh-arranging');
    selectedObj = null;
    heldObj = null;
    wasPaused = view.paused;
    view.paused = true;
    syncControls();
  }
  function exitArrange(): void {
    if (!arranging) return;
    cancelHold();
    arranging = false;
    selectedObj = null;
    dragCandidate = null;
    hoverObj = null;
    canvas.style.cursor = '';
    resetCamera();
    stage.classList.remove('vh-arranging');
    view.paused = wasPaused;
    syncControls();
  }
  // Whether the carried piece fits where it is, and why not.
  let heldCheck: PlacementCheck = { ok: true };
  let hoverObj: ObjectInstance | null = null;
  const peopleOnFloor = () => people.filter(p => !p.onStairs);
  const nameOf = (o: ObjectInstance) => (TYPES[o.type]?.name ?? 'furniture').toLowerCase();
  function recheck(): void {
    if (heldObj) heldCheck = checkPlacement(world.objs, heldObj, peopleOnFloor());
  }
  const movableHere = (): string[] => world.objs.filter(o => o.level === view.level && isMovable(o)).map(o => o.id);
  // Select a piece: jump to its floor, outline it, and bring it into frame.
  function selectObject(o: ObjectInstance | null): void {
    cancelHold();
    selectedObj = o;
    if (!o) return;
    if (o.level !== view.level) { selectedObj = null; setLevel(o.level); selectedObj = o; }
    // On a phone held upright the whole house is small: close in on the piece so it's easy to drag.
    if (canvas.getBoundingClientRect().width < 560 && cam.tz < 1.6) cam.tz = 1.8;
    if (cam.tz > 1.05) {
      const [fw, fd] = [TYPES[o.type].W, TYPES[o.type].D];
      const [px, py] = art.project(o.x + fw / 2, o.y + fd / 2, (TYPES[o.type].h ?? 1) / 2);
      cam.tfx = px; cam.tfy = py;
    }
  }
  // Set a piece down for good: the house learns where it is now.
  function commitMove(o: ObjectInstance, verb = 'Moved'): void {
    log(`${verb} the ${nameOf(o)}.`);
    art.objectPlaced(o.id);
    relearnLayout(o);
  }
  // Turn the selected piece a quarter, skipping turns that don't fit.
  function rotateSelected(): void {
    const o = heldObj ?? selectedObj;
    if (!o) return;
    const orig = { x: o.x, y: o.y, rot: o.rot };
    if (o === heldObj) { rotateAboutCentre(o); recheck(); return; }
    for (let i = 0; i < 3; i++) {
      rotateAboutCentre(o);
      if (checkPlacement(world.objs, o, peopleOnFloor()).ok) { commitMove(o, 'Turned'); return; }
    }
    Object.assign(o, orig);
    log(`There's no room to turn the ${nameOf(o)} here.`);
  }
  function recolourHeld(): void {
    const o = heldObj ?? selectedObj ?? hoverObj;
    const col = o && nextColour(o);
    if (!o || !col) return;
    o.col = col;
    log(`Changed the ${nameOf(o)}'s colour.`);
  }
  // Put a dragged piece back where it was picked up.
  function cancelHold(): void {
    if (heldObj && heldOrig) { heldObj.x = heldOrig.x; heldObj.y = heldOrig.y; heldObj.rot = heldOrig.rot; }
    heldObj = null;
    heldOrig = null;
    dragCandidate = null;
  }
  // Carry the selected piece up or down the stairs to another floor.
  function carryTo(level: number): void {
    const o = selectedObj;
    if (!o || !otherFloors(o).includes(level) || (level === ATTIC && !hasAttic())) return;
    const from = o.level;
    if (!relocate(world.objs, o, level, peopleOnFloor())) { log(`There's no room for the ${nameOf(o)} on the ${LEVEL_NAMES[level].toLowerCase()}.`); return; }
    selectedObj = null;
    setLevel(level);
    selectedObj = o;
    log(`Carried the ${nameOf(o)} ${level > from ? 'up' : 'down'} to the ${LEVEL_NAMES[level].toLowerCase()}. Drag it where you want it.`);
    commitMove(o, 'Set down');
  }
  // Storage: pieces put away leave the house but stay yours, and are saved.
  const storage: ObjectInstance[] = Array.isArray((save as { storage?: unknown } | null)?.storage)
    ? ((save as { storage: ObjectInstance[] }).storage).filter(o => o && TYPES[o.type]).map(o => ({ ...o }))
    : [];
  function storeSelected(): void {
    const o = selectedObj;
    if (!o || !canStore(o)) return;
    cancelHold();
    const i = world.objs.indexOf(o);
    if (i < 0) return;
    world.objs.splice(i, 1);
    storage.push(o);
    selectedObj = null;
    relearnLayout(o);
    log(`Put the ${nameOf(o)} in storage.`);
  }
  function unstore(id: string): void {
    const i = storage.findIndex(o => o.id === id);
    if (i < 0) return;
    const [o] = storage.splice(i, 1);
    world.objs.push(o);
    if (!relocate(world.objs, o, view.level, peopleOnFloor())) {
      world.objs.pop();
      storage.splice(i, 0, o);
      log(`There's no room for the ${nameOf(o)} on the ${LEVEL_NAMES[view.level].toLowerCase()}.`);
      return;
    }
    selectedObj = o;
    log(`Took the ${nameOf(o)} out of storage. Drag it where you want it.`);
    commitMove(o, 'Set down');
  }
  // After a move, the household learns the new layout: the spots to stand at,
  // the walkable floor, and anyone heading to (or using) the moved piece
  // starts over, so they walk to where it is now.
  function relearnLayout(moved: ObjectInstance): void {
    Object.assign(house, buildWorld(world.objs));
    for (const p of people) {
      if (p.task?.slot?.id.startsWith(moved.id + ':')) {
        if (p.task.phase === 'do' && p.task.slot.pos) { [p.x, p.y] = p.task.slot.stand; p.z = 0; }
        p.task = null;
        p.idle = 0.2;
      }
    }
  }
  // What arrange mode tells the art to draw.
  function arrangeFrame() {
    if (!arranging) return null;
    return {
      movable: movableHere(),
      held: heldObj?.id ?? null, selected: selectedObj?.id ?? null,
      valid: heldCheck.ok, hover: hoverObj?.id ?? null,
    };
  }
  // The Arrange list: everything that can move, wherever it is in the house.
  function arrangeState(): ArrangeState {
    const items = world.objs.filter(isMovable).map((o) => {
      const t = TYPES[o.type];
      const [fw, fd] = t.W && o.rot % 2 ? [t.D, t.W] : [t.W, t.D];
      return { id: o.id, name: t.name ?? o.type, room: roomName(o.level, o.x + fw / 2, o.y + fd / 2), level: o.level, color: o.col };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.room.localeCompare(b.room));
    const o = selectedObj;
    return {
      floors: [...LEVEL_NAMES],
      order: FLOOR_ORDER.filter(l => l !== ATTIC || hasAttic()),
      stored: storage.map(o => ({ id: o.id, name: TYPES[o.type]?.name ?? o.type, color: o.col })),
      level: view.level,
      items,
      selected: o ? {
        id: o.id, name: TYPES[o.type]?.name ?? o.type,
        where: `${LEVEL_NAMES[o.level]} · ${items.find(i => i.id === o.id)?.room ?? ''}`,
        canColour: !!nextColour(o),
        canStore: canStore(o),
        moveTo: otherFloors(o).filter(l => l !== ATTIC || hasAttic()),
      } : null,
    };
  }
  const worldAt = (sx: number, sy: number): [number, number] => art.unproject(sx, sy);
  const movableAt = (sx: number, sy: number): ObjectInstance | null => {
    const o = art.hitObject(view.level, sx, sy, movableHere());
    return o && isMovable(o) ? o : null;
  };

  // Canvas click → interaction or arrange
  canvas.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const [sx, sy] = toView(e.clientX, e.clientY);

    if (arranging) {
      // Arrange mode: pointer events do the work (select on press, drag to
      // move). A tap on empty floor lets go of the selection.
      if (!movableAt(sx, sy)) selectObject(null);
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
    // Try clicking on objects. Touch one and it comes alive: the TV flickers
    // on, the washer spins, the fridge swings open. This comes before the
    // room's lights, so tapping the TV doesn't switch on the lamp beside it.
    // Then, as before, you can ask Jordan to use it.
    const obj = findObjectAt(sx, sy);
    const reaction = obj ? art.poke(obj, counterPartAt(obj, sx, sy)) : null;
    if (obj && reaction) {
      log(reaction);
      showObjectActions(obj, e.clientX, e.clientY, true);
      return;
    }
    const lightState = art.toggleLightAt(view.level, sx, sy);
    if (lightState !== null) { log(`Light turned ${lightState ? 'on' : 'off'}.`); return; }
    if (obj && TYPES[obj.type]?.light) {
      const on = art.toggleObjectLight(obj.id);
      log(`${TYPES[obj.type]?.name ?? 'Light'} turned ${on ? 'on' : 'off'}.`);
      return;
    }
    if (obj) { showObjectActions(obj, e.clientX, e.clientY); return; }
  });

  // Which part of the kitchen counter was tapped: the sink, the stove or the coffee machine.
  function counterPartAt(obj: ObjectInstance, sx: number, sy: number): string {
    if (obj.type !== 'counter') return '';
    const wx = ((sx - 288) / 32 + (sy - 128) / 16) / 2, wy = ((sy - 128) / 16 - (sx - 288) / 32) / 2;
    const along = obj.rot % 2 ? wy - obj.y : wx - obj.x;
    const parts: [string, number][] = [['sink', 0.65], ['stove', 1.65], ['coffee', 2.45]];
    return parts.reduce((best, p) => Math.abs(p[1] - along) < Math.abs(best[1] - along) ? p : best)[0];
  }

  // Arrange mode: press a piece to select it and drag to carry it (mouse or
  // finger). With a mouse, whatever's under the pointer is highlighted.
  const DRAG_SLOP = 6;
  canvas.addEventListener('pointerdown', (e) => {
    if (!arranging || !e.isPrimary || e.button > 0) return;
    const [sx, sy] = toView(e.clientX, e.clientY);
    const o = movableAt(sx, sy);
    if (!o) return;
    selectObject(o);
    const [wx, wy] = worldAt(sx, sy), [fw, fd] = [TYPES[o.type].W, TYPES[o.type].D];
    const [cw, cd] = o.rot % 2 ? [fd, fw] : [fw, fd];
    heldGrab = [wx - (o.x + cw / 2), wy - (o.y + cd / 2)];
    dragCandidate = { id: e.pointerId, obj: o, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable: drag still works while over the canvas */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!arranging) return;
    const [sx, sy] = toView(e.clientX, e.clientY);
    if (dragCandidate && dragCandidate.id === e.pointerId) {
      if (!heldObj) {
        if (Math.hypot(e.clientX - dragCandidate.x, e.clientY - dragCandidate.y) < DRAG_SLOP) return;
        heldObj = dragCandidate.obj;
        heldOrig = { x: heldObj.x, y: heldObj.y, rot: heldObj.rot };
        suppressClick = true;
      }
      const [wx, wy] = worldAt(sx, sy);
      centreAt(heldObj, wx - heldGrab[0], wy - heldGrab[1]);
      recheck();
    } else if (!heldObj && e.pointerType === 'mouse') {
      const o = movableAt(sx, sy);
      hoverObj = o;
      canvas.style.cursor = o ? (o === selectedObj ? 'grab' : 'pointer') : '';
    }
  });
  // Let go: it stays where it fits, or goes back to where it was.
  const dropHeld = (e: PointerEvent): void => {
    if (!dragCandidate || dragCandidate.id !== e.pointerId) return;
    const o = heldObj;
    dragCandidate = null;
    if (!o) return;
    recheck();
    if (heldCheck.ok) {
      heldObj = null; heldOrig = null;
      commitMove(o);
    } else {
      log(`${heldCheck.reason ?? "It doesn't fit there."} Back it goes.`);
      cancelHold();
    }
    heldCheck = { ok: true };
  };
  canvas.addEventListener('pointerup', dropHeld);
  canvas.addEventListener('pointercancel', (e) => { if (dragCandidate?.id === e.pointerId) { cancelHold(); heldCheck = { ok: true }; } });

  // Zoom and pan: wheel, pinch, drag (when zoomed), double-tap to reset.
  let suppressClick = false;
  const touches = new Map<number, { x: number; y: number }>();
  let dragFrom: { x: number; y: number; fx: number; fy: number } | null = null;
  let pinchFrom = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (view.follow) toggleFollow(view.follow); resetCamera(); });
  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) dragFrom = arranging && movableAt(...toView(e.clientX, e.clientY)) ? null : { x: e.clientX, y: e.clientY, fx: cam.tfx, fy: cam.tfy };
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchFrom = Math.hypot(a.x - b.x, a.y - b.y); dragFrom = null; if (heldObj) { cancelHold(); heldCheck = { ok: true }; } dragCandidate = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinchFrom > 0) {
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchFrom);
      pinchFrom = d; suppressClick = true;
    } else if (dragFrom && cam.tz > 1.01) {
      const dx = e.clientX - dragFrom.x, dy = e.clientY - dragFrom.y;
      if (Math.hypot(dx, dy) > 6) {
        const rect = canvas.getBoundingClientRect(), k = VIEW_W / rect.width / cam.tz;
        if (view.follow) toggleFollow(view.follow);
        cam.tfx = dragFrom.fx - dx * k; cam.tfy = dragFrom.fy - dy * k;
        suppressClick = true;
      }
    }
  });
  const lift = (e: PointerEvent) => { touches.delete(e.pointerId); if (touches.size < 2) pinchFrom = 0; if (touches.size === 0) dragFrom = null; };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

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

  function showObjectActions(obj: ObjectInstance, x: number, y: number, poked = false): void {
    const spots = TYPES[obj.type]?.spots;
    const isLight = Boolean(TYPES[obj.type]?.light);
    const acts: TrayAction[] = [];
    if (isLight) acts.push({ act: 'toggleLight', label: 'Turn light on/off', icon: '' });
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
    // A tap that brought the object to life shouldn't also send Jordan over:
    // offer the action instead of doing it.
    if (acts.length === 1 && !poked) { handleObjectAction(obj, acts[0].act); return; }
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

  // Skipping ahead through the work day ("Skip to 5 PM").
  let skipping = false;

  // Every purchase goes through the bank, so it shows in the transactions.
  function spendOn(label: string, amount: number): boolean {
    return withdraw(world.household, world.life, world.day, world.minutes, label, amount);
  }

  // Start (or go back to) a side job: Jordan walks to the desk or the stove and works until it's done.
  function workOnJob(id: string): void {
    const jordan = people[0];
    const t = world.life.taken.find(x => x.id === id);
    if (!t) return;
    if (jordan.away) { log(`${jordan.name} is at work. Side jobs wait for the evening.`); return; }
    const blocked = blockedBy(world.household, world.life, t);
    if (blocked) { log(blocked); return; }
    if (!startChain(house, jordan, SIDE_JOBS[t.job].act, people[1], () => rng.next())) {
      log(SIDE_JOBS[t.job].act === 'sideBake' ? 'The stove is busy.' : 'The desk is busy.');
      return;
    }
    startWork(world.household, world.life, t);
    log(`${jordan.name} is working on: ${SIDE_JOBS[t.job].title.toLowerCase()}.`);
    view.follow = 'jordan';
    if (jordan.level !== view.level) setLevel(jordan.level, true);
    refreshDrawer();
  }

  // The day's routine: wake up, get ready, go to work, come home (state/routine.ts).
  function runRoutine(hourF: number): void {
    const jordan = people[0];
    const step = routineStep(world.life, world.day, hourF, { asleep: isAsleep(jordan), away: !!jordan.away });
    if (step === 'wake') {
      world.life.today.woke = true;
      jordan.task = null;
      const work = isWorkday(world.day) && !world.life.today.calledIn && hourF < CORNER_MARKET.start;
      const acts = work ? morningActs(world.life.routine, servings(world.household) > 0) : ['mirror'];
      startSequence(house, jordan, acts.filter(a => a !== 'shower' || world.life.water), people[1], () => rng.next());
      log(`${jordan.name} is up.`);
    } else if (step === 'leave') {
      world.life.today.left = true;
      world.life.today.woke = true;
      world.life.working = null;
      jordan.task = null;
      jordan.away = 'work';
      log(`${jordan.name} left for work at the ${CORNER_MARKET.place}.`);
    } else if (step === 'return') {
      world.life.today.returned = true;
      world.life.wagesOwed += dayPay();
      jordan.away = null;
      jordan.level = 1;
      [jordan.x, jordan.y] = LEVELS[1].anchor;
      jordan.idle = 0.5;
      skipping = false;
      log(`${jordan.name} is home from work. +$${dayPay()} toward Friday's paycheck.`);
    }
  }

  // Side-job work: the bar fills while he's at it; it stops if he's worn out or the power, water or internet goes.
  function tickSideJob(gameMin: number): void {
    const jordan = people[0];
    const t = world.life.working ? world.life.taken.find(x => x.id === world.life.working) : null;
    if (!t) return;
    const task = jordan.task;
    if (!task || !SIDE_ACTS.has(task.act)) { world.life.working = null; return; }
    if (task.phase !== 'do') return;
    const blocked = blockedBy(world.household, world.life, { ...t, started: true });
    const worn = Math.min(jordan.needs.energy, jordan.needs.food, jordan.needs.hygiene) < 15;
    if (blocked || worn) {
      jordan.task = null;
      jordan.idle = 0.5;
      world.life.working = null;
      log(blocked ? `Work stopped: ${blocked}` : `${jordan.name} needs a break. The work is saved.`);
      return;
    }
    if (addWork(t, gameMin, workRate(jordan.needs))) {
      jordan.task = null;
      jordan.idle = 1;
      finishJob(world.household, world.life, t, world.day, world.minutes, log);
    }
  }

  function handleObjectAction(obj: ObjectInstance, tag: string): void {
    if (tag === 'toggleLight') {
      const on = art.toggleObjectLight(obj.id);
      log(`${TYPES[obj.type]?.name ?? 'Light'} turned ${on ? 'on' : 'off'}.`);
      return;
    }
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
    if (jordan.away) { log(`${jordan.name} is at work until ${CORNER_MARKET.end - 12} PM.`); return; }
    world.life.working = null;
    startChain(house, jordan, chain, people[1], () => rng.next());
    view.follow = 'jordan';
    if (jordan.level !== view.level) setLevel(jordan.level, true);
    syncControls();
  }

  // The salon: spend Sims money on an avatar item, and it's the player's
  // everywhere (the app records it to their account).
  function handleBuyAvatarItem(id: string): void {
    const item = simsShopItems().find(i => i.id === id);
    if (!item || ownsAvatarItem(id)) return;
    if (!spendOn(`Salon: ${itemLabel(item.id)}`, item.price)) { log('Not enough money.'); return; }
    buyAvatarItem(id);
    log(`Bought ${itemLabel(item.id)} for $${item.price}. It's yours in Velvet too.`);
    refreshDrawer();
  }

  function handleBuy(item: CatalogEntry, color?: string): void {
    const price = item.price;
    if (item.icon === 'upgrade' && item.id === 'upgrade-attic' && hasAttic()) { log('The attic is already built.'); return; }
    if ((item.icon === 'paint' || item.icon === 'paper' || item.icon === 'floor') && view.level === 3) {
      log('Pick a floor of the house first (Basement, Main floor or Upstairs): walls and floors go inside.');
      return;
    }
    if (!spendOn(`Shop: ${item.name}`, price)) { log('Not enough money.'); return; }
    owned.add(item.id);
    log(`Bought ${item.name} for $${price}.`);

    if (item.icon === 'upgrade' && item.id === 'upgrade-attic') {
      world.objs.push(...ATTIC_STAIR_OBJS.map(o => ({ ...o })));
      Object.assign(house, buildWorld(world.objs));
      log('The attic is built! New stairs lead up from the Upstairs hall.');
      setLevel(ATTIC);
    }

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
      // Attic finds go in the attic once it's built; everything else where you're looking.
      const level = item.tab === 'Attic' && hasAttic() ? ATTIC : view.level;
      const newObj: ObjectInstance = {
        id: `${item.type}-${Date.now() & 0xffff}`,
        type: item.type, level, x: 5, y: 5, rot: 0,
        col: color || item.cols?.[0],
      };
      world.objs.push(newObj);
      flags.furniture = ((flags.furniture as number) ?? 0) + 1;
      // Set it down on free floor; if the floor is full it waits in storage.
      if (relocate(world.objs, newObj, level, peopleOnFloor())) {
        relearnLayout(newObj);
        art.objectPlaced(newObj.id);
        log(`${item.name} is in the ${LEVEL_NAMES[level].toLowerCase()}. Use Arrange to move it.`);
      } else {
        world.objs.pop();
        storage.push(newObj);
        log(`No room for the ${item.name.toLowerCase()} on the ${LEVEL_NAMES[level].toLowerCase()}, so it's in storage (Arrange).`);
      }
    }
    // Clothing: add to the closet (same piece + color only once)
    if (item.icon === 'cloth' && item.cloth) {
      const key = item.id.slice(2);
      const def = clothByKey(key);
      if (def) {
        const col = color || def.colors[0];
        const name = col === def.colors[0] ? def.name : `${def.name} (${col.trim()})`;
        if (!closet.some(c => c.id === item.id && c.col === col)) {
          closet.push({ slot: def.slot, style: def.style, col, name, id: item.id });
          log(`Added ${name} to your closet.`);
        }
      }
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

  let chatBudgetDay = -1;
  async function handleTalk(text: string): Promise<void> {
    if (!sample) { dialogue.showInput(); return; }
    dialogue.busy(true);
    dialogue.showAI('...', true);
    art.setTalking(true);
    dialogue.setPortraitTalking(true);

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

    // Out of replies for today: don't ask the network again until tomorrow.
    let streamed = '';
    const result = chatBudgetDay === world.day
      ? { text: cannedFor('budget', companionCfg.preset), tag: null, turns: chatTurns }
      : await talk(text, chatTurns, ctx, sample, (chunk) => {
      streamed += chunk;
      dialogue.showAI(streamed, true);
    });
    if ('failed' in result && result.failed === 'budget') chatBudgetDay = world.day;
    chatTurns = result.turns;
    dialogue.showAI(result.text, true);
    dialogue.busy(false);
    art.setTalking(false);
    dialogue.setPortraitTalking(false);

    // Apply mood tag
    if (result.tag) {
      bond = Math.max(0, Math.min(100, bond + result.tag.bond * 1.5));
      art.setMood(bond / 100);
      if (result.tag.act !== 'none') {
        // Could trigger autonomous acts — for now just log
      }
    }

    // Leave the reply up while the box comes back, so it can be read as the player answers.
    setTimeout(() => dialogue.showInput(true), 600);
  }

  let saveRev = typeof (world.save as { rev?: unknown } | null)?.rev === 'number' ? (world.save as { rev: number }).rev : 0;
  // Save: one serializer (state/save.ts). What the game models comes from live state; the rest is carried over from the loaded save.
  function doSave(): void {
    try {
      const data = snapshot({
        rev: ++saveRev, day: world.day, minutes: world.minutes,
        money: world.household.money, earnedToday: world.household.earnedToday, spentToday: world.household.spentToday,
        power: world.household.power, fridge: world.household.fridge, dishes: world.household.dishes, laundryPile: world.household.laundryPile,
        bill: world.household.bill, nextBillAt: world.household.nextBillAt,
        objs: world.objs, storage, owned: [...owned], closet: closet.filter(c => !c.id.startsWith('w-')), bond, flags,
        simName, partnerName, look: people[0].look, mayaLook: people[1].look,
        needs: { jordan: people[0].needs, maya: people[1].needs },
        memories, coreMem, pastMem, townName, turns: chatTurns, rngSeed,
        lifeGoal, settleDone, freeWill, style, companion: companionCfg as unknown as Record<string, unknown>,
        wallMode: WALL_MODES[view.wallIdx].mode,
        looks: art.exportLooks(),
        life: world.life,
      }, world.save);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
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
      arrange: arranging ? arrangeState() : null,
      level: view.level, levelNames: [...LEVEL_NAMES], shopLevels: FLOOR_ORDER.filter(l => l !== 3 && (l !== ATTIC || hasAttic())), lookInfo: art.lookInfo, pictureThumbs,
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
      closet,
      personas: wardrobe?.personas ?? [],
      wearing: { top: people[0].look.top, topStyle: people[0].look.topStyle, bottom: people[0].look.bottom, bottomStyle: people[0].look.bottomStyle, hat: wornHat },
      phone: phoneView(world.household, world.life, world.day, world.minutes, !!people[0].away),
      salon: simsShopItems().map(i => ({
        id: i.id, name: itemLabel(i.id), price: i.price, owned: ownsAvatarItem(i.id),
        swatch: i.id.startsWith('hairHighlight:') || i.id.startsWith('hairColor:') ? i.id.split(':')[1] : undefined,
      })),
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
          deposit(world.household, world.life, world.day, world.minutes, 'Life goal reward', result.reward);
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
        deposit(world.household, world.life, world.day, world.minutes, `Welcome basket from ${townName}`, 100);
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
      // For the end-to-end tests (e2e/velvet-sims): read what is in the house, and find a piece on screen.
      objects: () => world.objs.map(o => ({ id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot })),
      storedCount: () => storage.length,
      resetCamera: () => resetCamera(),
      level: () => view.level,
      // Where a household member is and what they're doing, with their spot on screen.
      agentState: (id: string) => {
        const p = people.find(q => q.id === id);
        if (!p) return null;
        const [vx, vy] = art.project(p.x, p.y, 0.9);
        const q = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return { level: p.level, face: p.face, turning: !!p.turning, walking: isWalking(p), pose: poseOf(p), act: p.task?.act ?? null, screen: [r.left + (q.x / canvas.width) * r.width, r.top + (q.y / canvas.height) * r.height] };
      },
      clientPosOf: (id: string): [number, number] | null => {
        const o = world.objs.find(q => q.id === id);
        if (!o) return null;
        const t = TYPES[o.type];
        const [fw, fd] = o.rot % 2 ? [t.D, t.W] : [t.W, t.D];
        const [vx, vy] = art.project(o.x + fw / 2, o.y + fd / 2, (t.h || 1) / 2);
        const p = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return [r.left + (p.x / canvas.width) * r.width, r.top + (p.y / canvas.height) * r.height];
      },
    };
  }

  // Rendering loop
  let hudTimer = 0;
  const layerCache = new LayerCache();

  const seeds: Record<AgentId, number> = { jordan: 0.3, maya: 2.1 };
  // Talking, hanging out or dancing together: look at the other person.
  const SOCIAL_ACTS = new Set(['chat', 'hangout', 'gChat', 'danceTogether', 'fireJoin', 'snowmanHelp']);
  function lookTargetOf(p: Agent): [number, number] | null {
    const other = people.find(o => o.id !== p.id);
    if (!other || other.level !== p.level || !p.task || !SOCIAL_ACTS.has(p.task.act)) return null;
    return [other.x, other.y];
  }

  function toFrame(p: Agent): PersonFrame {
    const pose = poseOf(p);
    return {
      level: p.level, x: p.x, y: p.y, z: p.z, face: p.face, pose,
      walking: isWalking(p), sit: SITTING_POSES.has(pose) && p.z > 0.05, hidden: p.onStairs || !!p.away,
      seed: seeds[p.id], look: p.look,
      act: p.task && p.task.phase === 'do' ? p.task.act : null,
      actMin: p.task && p.task.phase === 'do' ? p.task.time : 0,
      slot: p.task && p.task.phase === 'do' ? p.task.slot?.id ?? null : null,
      expr: expressionFor(p.needs),
      lookAt: lookTargetOf(p),
    };
  }

  let simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(toFrame) };

  let goalsTimer = 0;
  startFixedLoop(
    (dt) => {
      if (view.paused) return;
      view.t += dt;
      // Like The Sims: the work day can be skipped, and the night runs fast when everyone's asleep.
      const jordanAway = !!people[0].away;
      const allAsleep = !jordanAway && people.every(p => isAsleep(p));
      if (!jordanAway) skipping = false;
      const speed = skipping ? SKIP_SPEED : allAsleep ? NIGHT_SPEED : SPEEDS[view.speedIdx];
      const before = world.minutes + world.day * 1440;
      Object.assign(world, advanceClock(world.day, world.minutes, dt, speed));
      const gameMin = world.minutes + world.day * 1440 - before;
      const hourF = world.minutes / 60;
      const walkMul = Math.min(speed, 6);
      const absM = world.minutes + world.day * 1440;
      const prevDay = world.day;
      if (settleDone) {
        rollDay(world.life, world.day);
        financeTick(world.household, world.life, world.day, world.minutes, log);
        sideJobsTick(world.life, world.day, world.minutes, () => rng.next(), log);
        runRoutine(hourF);
      }
      deliveryTick(world.household, absM, log);
      dirtTick(world.household, gameMin);
      laundryTick(world.household, gameMin);
      if (world.day !== prevDay) { newDayReset(world.household, log); }
      tickAgent(house, people[0], people[1], dt, gameMin, walkMul, hourF, () => rng.next(), world.household,
        settleDone ? { nightStart: nightStart(world.life.routine), wakeAt: wakeHour(world.life.routine, world.day) } : undefined);
      tickSideJob(gameMin);
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
      applyCamera(frameDt);

      art.render({
        level: view.level, rot: view.rot, minutes: interpMinutes, day: world.day,
        t: view.t, dt: frameDt, objs: world.objs, wallMode: WALL_MODES[view.wallIdx].mode,
        chars: people.map(toFrame),
        arrange: arrangeFrame(),
        house: { power: world.household.power, dishes: world.household.dishes, laundryPile: world.household.laundryPile, fridge: world.household.fridge, owned },
      });
      qualityManager.recordFrame(frameDt * 1000);

      hudTimer -= frameDt;
      if (hudTimer <= 0) {
        hudTimer = 0.25;
        el('when').textContent = `${DAYS[weekday(world.day)]} · Day ${world.day}`;
        el('clock').textContent = clockText(world.minutes);
        el('season').textContent = season(world.day);
        el('money').textContent = `$${world.household.money}`;
        btn('skipwork').hidden = !people[0].away || skipping;
        const sv = servings(world.household);
        el('fridge').textContent = sv === 0 ? 'Fridge empty' : `${sv} meals`;
        refreshPeople();
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
    if (isAvatarLookMessage(e.data)) {
      // A new hat changes the head: the host redrew it.
      const svgs = validHeadSvgs(e.data.sprites);
      if (svgs) loadHeadImages(svgs).then((imgs) => { if (imgs.neutral) people[0].look.heads = imgs; }).catch(() => {});
      const hands = validBodySvgs(e.data.body);
      if (hands) loadBodyImages(hands).then((imgs) => { if (imgs.relaxed) people[0].look.body = imgs; }).catch(() => {});
      return;
    }
    if (isAvatarInventoryMessage(e.data)) {
      setOwnedAvatarItems(e.data.owned);
      return;
    }
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
        if (cl.top && !cl.outfit) people[1].look.top = cl.top;
        applyAvatar(people[1], cl, 'maya');
      }
      if (d.player?.look) {
        const pl = d.player.look;
        if (pl.skin) people[0].look.skin = pl.skin;
        if (pl.hairColor) people[0].look.hair = pl.hairColor;
        if (pl.top && !pl.outfit) people[0].look.top = pl.top;
        applyAvatar(people[0], pl, 'jordan');
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

  // The real avatar: its head frames, and its outfit as the signature look.
  // The signature goes on when it's new or changed; otherwise whatever they
  // last wore stays on. The player's is always in the closet to switch back to.
  function applyAvatar(person: Agent, look: { sprites?: unknown; body?: unknown; outfit?: unknown }, who: AgentId): void {
    const hands = validBodySvgs(look.body);
    if (hands) loadBodyImages(hands).then((imgs) => { if (imgs.relaxed) person.look.body = imgs; }).catch(() => {});
    const svgs = validHeadSvgs(look.sprites);
    if (svgs) {
      loadHeadImages(svgs).then((imgs) => {
        if (!imgs.neutral) return;
        person.look.heads = imgs;
        if (person === people[1]) dialogue.setPortraitImages(imgs);
      }).catch(() => {});
    }
    // The player's wardrobe: every piece they may wear joins the closet, and personas become buttons.
    const wardrobeIn = who === 'jordan' ? validWardrobe((look as { wardrobe?: unknown }).wardrobe) : null;
    if (wardrobeIn) {
      wardrobe = wardrobeIn;
      wornHat = wardrobeIn.hat ?? 'none';
      for (let i = closet.length - 1; i >= 0; i--) if (closet[i].id.startsWith('w-')) closet.splice(i, 1);
      closet.push(...closetFromWardrobe(wardrobeIn));
    }
    const outfit = validOutfit(look.outfit);
    if (!outfit) return;
    if (who === 'jordan') {
      for (let i = closet.length - 1; i >= 0; i--) if (closet[i].id.startsWith('sig-')) closet.splice(i, 1);
      closet.unshift(
        { slot: 'top', style: outfit.style, col: outfit.color, accent: outfit.accent, name: 'Signature look', id: 'sig-top' },
        { slot: 'bottom', style: outfit.bottomStyle, col: outfit.bottom, accent: outfit.bottomAccent, name: 'Signature bottoms', id: 'sig-bottom' },
      );
    }
    const keys = (flags.signature ?? (flags.signature = {})) as Record<string, string>;
    if (keys[who] !== outfit.key) {
      Object.assign(person.look, {
        topStyle: outfit.style, top: outfit.color, accent: outfit.accent,
        bottom: outfit.bottom, bottomStyle: outfit.bottomStyle, bottomAccent: outfit.bottomAccent,
      });
      keys[who] = outfit.key;
    }
  }

  // Putting a closet piece on the player. A hat is on the avatar's head, so it waits for the host's new head frames.
  function wearPiece(piece: OwnedCloth): void {
    if (piece.slot === 'hat') { if (AVATAR_HATS.has(piece.style)) wornHat = piece.style; return; }
    wearOnAgent(people[0].look, piece);
  }

  // Tell the host what the player changed into, so their avatar outside the game matches.
  function tellHostLook(top?: OwnedCloth, bottom?: OwnedCloth, hat?: string): void {
    postToParent({
      type: 'velvet:lookChanged', game: 'velvet-house', who: 'player',
      ...(top ? { top: { style: top.style, color: top.col, accent: top.accent } } : {}),
      ...(bottom ? { bottom: { style: bottom.style, color: bottom.col, accent: bottom.accent } } : {}),
      ...(hat !== undefined ? { hat } : {}),
    } as never);
  }

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

  // Inside the Velvet app the host page answers AI turns; the older artifact-style provider still wins if present.
  sample = createHostSample();
  // Try to get sample function from parent
  try {
    const w = window as unknown as { claude?: { use?: (name: string) => Promise<SampleFn> } };
    if (w.claude?.use) {
      w.claude.use('sample').then((f) => { sample = f; }).catch(() => {});
    }
  } catch {}
}

boot();
