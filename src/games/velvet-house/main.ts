import { migrateSave } from './state/saveMigration';
import { postToParent, isProfileMessage, isValidOrigin } from './bridge/protocol';
import { INITIAL_OBJS, type ObjectInstance } from './state/objects';
import { DAYS, weekday, clockText, season } from './state/time';
import { LEVEL_NAMES } from './state/house';
import { createHouseArt, type WallMode } from './art/houseArt.js';
import { startLoop, advanceClock } from './engine/loop';

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

interface World {
  day: number;
  minutes: number;
  objs: ObjectInstance[];
  save: unknown;
}

function loadWorld(): World {
  let day = 1;
  let minutes = 6 * 60 + 20;
  let objs: ObjectInstance[] = INITIAL_OBJS.map((o) => ({ ...o }));
  let save: unknown = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? migrateSave(JSON.parse(raw)) : null;
    if (s) {
      save = s;
      if (typeof s.day === 'number') day = s.day;
      if (typeof s.minutes === 'number') minutes = s.minutes;
      if (Array.isArray(s.objs) && s.objs.length) objs = s.objs as unknown as ObjectInstance[];
    }
  } catch {
    // unreadable save: start fresh
  }
  return { day, minutes, objs, save };
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="vh-stage">
      <canvas class="vh-canvas" aria-label="Your house"></canvas>
      <div class="vh-hud">
        <div class="vh-chip"><span data-el="when"></span><strong data-el="clock"></strong></div>
        <div class="vh-chip vh-season" data-el="season"></div>
      </div>
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
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    app.textContent = 'Your browser could not start the game display.';
    return;
  }
  const el = (name: string) => app.querySelector<HTMLElement>(`[data-el="${name}"]`)!;
  const btn = (act: string) => app.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;

  const world = loadWorld();
  const art = createHouseArt(ctx);
  art.applySave(world.save);
  const savedMode = (world.save as { wallMode?: string } | null)?.wallMode;
  const view = {
    level: 1,
    rot: 0,
    wallIdx: Math.max(0, WALL_MODES.findIndex((w) => w.mode === savedMode)),
    speedIdx: 0,
    paused: false,
    t: 0,
  };

  const fit = (): void => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(box.width * ratio));
    const h = Math.max(1, Math.round((w * VIEW_H) / VIEW_W));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(w / VIEW_W, 0, 0, h / VIEW_H, 0, 0);
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
  };

  const setLevel = (lv: number): void => {
    view.level = lv;
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

  app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
    b.addEventListener('click', () => setLevel(Number(b.dataset.level)));
  });
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

  let hudTimer = 0;
  startLoop((dt) => {
    view.t += dt;
    if (!view.paused) Object.assign(world, advanceClock(world.day, world.minutes, dt, SPEEDS[view.speedIdx]));
    art.render({
      level: view.level,
      rot: view.rot,
      minutes: world.minutes,
      day: world.day,
      t: view.t,
      dt,
      objs: world.objs,
      wallMode: WALL_MODES[view.wallIdx].mode,
    });
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.25;
      el('when').textContent = `${DAYS[weekday(world.day)]} · Day ${world.day}`;
      el('clock').textContent = clockText(world.minutes);
      el('season').textContent = season(world.day);
    }
  });

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
