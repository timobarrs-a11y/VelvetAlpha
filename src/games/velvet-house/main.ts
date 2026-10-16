import { migrateSave } from './state/saveMigration';
import { postToParent, isProfileMessage, isValidOrigin } from './bridge/protocol';
import { INITIAL_OBJS, type ObjectInstance } from './state/objects';
import { DAYS, weekday, clockText, season } from './state/time';
import { LEVEL_NAMES } from './state/house';
import { NEED_KEYS, NEED_LABELS } from './state/needs';
import { RNG } from './state/rng';
import {
  buildWorld, createAgent, tickAgent, poseOf, isWalking, statusText, SITTING_POSES,
  type Agent, type AgentId, type AgentLook,
} from './state/agents';
import type { CharacterLook, CharacterNeeds } from './state/types';
import { createHouseArt, type WallMode, type PersonFrame } from './art/houseArt.js';
import { startLoop, advanceClock } from './engine/loop';
import { startFixedLoop } from './engine/fixedLoop';
import { qualityManager } from './engine/qualityTier';
import { LayerCache } from './engine/layerCache';
import {
  createHousehold, billTick, deliveryTick, dirtTick, laundryTick, newDayReset,
  servings, type HouseholdState,
} from './state/household';

const VIEW_W = 640;
const VIEW_H = 440;

const VELVET_COMPANION_ID = (() => {
  try {
    return new URLSearchParams(location.search).get('companion') || '';
  } catch {
    return '';
  }
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

interface SavedPerson {
  needs?: Partial<CharacterNeeds>;
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
  } catch {
    // unreadable save: start fresh
  }
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
  }
  return { day, minutes, objs, save, household };
}

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

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;

  const world = loadWorld();
  const save = world.save;
  const people: Agent[] = [
    createAgent('jordan', nameFrom(save?.simName, 'Jordan'), (save?.jordan as SavedPerson | undefined)?.needs, lookFrom(save?.look, DEFAULT_LOOKS.jordan)),
    createAgent('maya', nameFrom(save?.partnerName, 'Maya'), (save?.maya as SavedPerson | undefined)?.needs, lookFrom(save?.mayaLook, DEFAULT_LOOKS.maya)),
  ];
  const house = buildWorld(world.objs);
  const rng = new RNG(typeof save?.rngSeed === 'number' ? save.rngSeed : Date.now() & 0xffffffff);
  const logEl = document.createElement('ul');
  logEl.className = 'vh-log';
  const log = (msg: string): void => {
    if (!msg) return;
    const li = document.createElement('li');
    li.textContent = msg;
    logEl.prepend(li);
    while (logEl.children.length > 8) logEl.lastChild!.remove();
  };

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
        </div>
      </div>
    </div>`;

  const canvas = app.querySelector<HTMLCanvasElement>('.vh-canvas')!;
  app.querySelector('.vh-log')!.replaceWith(logEl);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    app.textContent = 'Your browser could not start the game display.';
    return;
  }
  const el = (name: string) => app.querySelector<HTMLElement>(`[data-el="${name}"]`)!;
  const btn = (act: string) => app.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;
  const personEl = (id: AgentId) => app.querySelector<HTMLButtonElement>(`[data-person="${id}"]`)!;

  const art = createHouseArt(ctx);
  art.applySave(save);
  const savedMode = (save as { wallMode?: string } | null)?.wallMode;
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
      // Phone framing: fit to room height, let width overflow (pan follows action)
      h = Math.max(1, Math.round(box.height * ratio));
      w = Math.max(1, Math.round((h * VIEW_W) / VIEW_H));
    } else {
      // Desktop: fit to width
      w = Math.max(1, Math.round(box.width * ratio));
      h = Math.max(1, Math.round((w * VIEW_H) / VIEW_W));
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    // Pan offset centers the view on phone; 0 on desktop (canvas matches viewport)
    const panX = isNarrow ? (w - Math.round(box.width * ratio)) / 2 : 0;
    ctx.setTransform(w / VIEW_W, 0, 0, h / VIEW_H, -panX * (w / VIEW_W) / w, 0);
  };
  let panTarget = 0;
  const updatePan = (): void => {
    const box = canvas.getBoundingClientRect();
    if (box.width >= 560) return;
    // Pan toward the followed character's x position
    const followed = view.follow && people.find((p) => p.id === view.follow);
    if (followed) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const screenW = box.width * ratio;
      const gameW = (box.height * ratio * VIEW_W) / VIEW_H;
      const maxPan = Math.max(0, gameW - screenW);
      panTarget = Math.max(0, Math.min(maxPan, (followed.x / 100) * maxPan));
    }
  };
  new ResizeObserver(fit).observe(canvas);
  fit();

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
  const rotate = (): void => {
    view.rot = (view.rot + 1) % 4;
  };
  const cycleWalls = (): void => {
    view.wallIdx = (view.wallIdx + 1) % WALL_MODES.length;
    syncControls();
  };
  const togglePause = (): void => {
    view.paused = !view.paused;
    syncControls();
  };
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
  btn('speed').addEventListener('click', () => {
    view.speedIdx = (view.speedIdx + 1) % SPEEDS.length;
    syncControls();
  });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key >= '1' && e.key <= '4') setLevel(Number(e.key) - 1);
    else if (e.key === 'r' || e.key === 'R') rotate();
    else if (e.key === 'w' || e.key === 'W') cycleWalls();
    else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    }
  });
  syncControls();

  const seeds: Record<AgentId, number> = { jordan: 0.3, maya: 2.1 };
  const toFrame = (p: Agent): PersonFrame => {
    const pose = poseOf(p);
    return {
      level: p.level, x: p.x, y: p.y, z: p.z, face: p.face, pose,
      walking: isWalking(p), sit: SITTING_POSES.has(pose) && p.z > 0.05, hidden: p.onStairs,
      seed: seeds[p.id], look: p.look,
    };
  };

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

  // Dev-only test hooks — not exposed in production builds
  const isDev = import.meta.env.DEV;
  if (isDev) {
    (window as unknown as { __velvet?: Record<string, unknown> }).__velvet = {
      setView: (lv: number) => setLevel(lv),
      setMinutes: (m: number) => { world.minutes = m; },
      get minutes() { return world.minutes; },
      set minutes(v: number) { world.minutes = v; },
      get day() { return world.day; },
      set day(v: number) { world.day = v; },
      saveGame: () => {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify({ ...world.save, day: world.day, minutes: world.minutes, v: 2 }));
        } catch { /* non-fatal */ }
      },
      get money() { return world.household.money; },
      set money(v: number) { world.household.money = v; },
    };
  }

  let hudTimer = 0;
  const layerCache = new LayerCache();
  let simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(toFrame) };

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
      const absMin = world.minutes + world.day * 1440;
      const prevDay = world.day;
      billTick(world.household, absMin, log);
      deliveryTick(world.household, absMin, log);
      dirtTick(world.household, gameMin);
      laundryTick(world.household, gameMin);
      if (world.day !== prevDay) newDayReset(world.household, log);
      tickAgent(house, people[0], people[1], dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      tickAgent(house, people[1], people[0], dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      const followed = view.follow && people.find((p) => p.id === view.follow);
      if (followed && !followed.onStairs && followed.level !== view.level) setLevel(followed.level, true);
    },
    (alpha, frameDt) => {
      // Store previous state for interpolation
      const prevSim = simCache;
      simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(toFrame) };

      // Interpolate minutes for smooth time display
      const interpMinutes = prevSim.minutes + (simCache.minutes - prevSim.minutes) * alpha;

      // Check if static layers need redraw
      const cacheKey = { level: view.level, rot: view.rot, wallMode: WALL_MODES[view.wallIdx].mode, zoomBucket: Math.floor(canvas.width / 400) };
      if (layerCache.keyChanged(cacheKey)) {
        fit();
      }

      art.render({
        level: view.level,
        rot: view.rot,
        minutes: interpMinutes,
        day: world.day,
        t: view.t,
        dt: frameDt,
        objs: world.objs,
        wallMode: WALL_MODES[view.wallIdx].mode,
        chars: people.map(toFrame),
      });

      qualityManager.recordFrame(frameDt * 1000);

      hudTimer -= frameDt;
      if (hudTimer <= 0) {
        hudTimer = 0.25;
        el('when').textContent = `${DAYS[weekday(world.day)]} · Day ${world.day}`;
        el('clock').textContent = clockText(world.minutes);
        el('season').textContent = season(world.day);
        el('money').textContent = `${world.household.money}`;
        const sv = servings(world.household);
        el('fridge').textContent = sv === 0 ? 'Fridge empty' : `${sv} meals`;
        refreshPeople();
        updatePan();
      }
    },
  );

  postToParent({ type: 'velvet:ready', game: 'velvet-house', day: world.day, needsProfile: true });

  const allowedOrigins: string[] = (() => {
    try {
      const origin = new URL(document.referrer).origin;
      return origin ? [origin] : [];
    } catch {
      return [];
    }
  })();

  window.addEventListener('message', (e: MessageEvent) => {
    if (!isValidOrigin(e.origin, allowedOrigins)) return;
    if (!isProfileMessage(e.data)) return;
    postToParent({
      type: 'velvet:profileApplied',
      game: 'velvet-house',
      day: world.day,
      player: (e.data as { player?: { name?: string } }).player?.name || '',
      companion: (e.data as { companion?: { name?: string } }).companion?.name || '',
    });
  });
}

boot();
