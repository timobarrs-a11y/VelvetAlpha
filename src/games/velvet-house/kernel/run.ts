import { DAYS, weekday, clockText, season } from '../state/time';
import { tickAgent } from '../state/agents';
import { advanceClock } from '../engine/loop';
import { startFixedLoop } from '../engine/fixedLoop';
import { qualityManager } from '../engine/qualityTier';
import { LayerCache } from '../engine/layerCache';
import { billTick, deliveryTick, dirtTick, laundryTick, newDayReset, servings } from '../state/household';
import { SPEEDS, WALL_MODES } from '../kernel/config';
import type { Game } from '../kernel/game';

export function startGameLoop(g: Game): void {
  const { world, people, house, rng, view, owned, log, canvas, el, art } = g;
  // Rendering loop
  let hudTimer = 0;
  const layerCache = new LayerCache();

  let simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(g.toFrame) };

  let goalsTimer = 0;
  // While Maya and the player talk, the art softens everything away from her.
  const conversationFocus = () => {
    if (g.dialogue.el.hidden || people[1].level !== view.level) return null;
    const [x, y] = art.project(people[1].x, people[1].y, 0.9);
    return { x, y, r: 95 };
  };
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
      // Visitors a script has brought in (people after the two who live here).
      for (const npc of people.slice(2)) tickAgent(house, npc, null, dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      const followed = view.follow && people.find((p) => p.id === view.follow);
      if (followed && !followed.onStairs && followed.level !== view.level) g.setLevel(followed.level, true);

      // Goals tick (throttled)
      goalsTimer -= dt;
      if (goalsTimer <= 0) { goalsTimer = 0.25; g.goalsTick(); g.outfitTick(); }
    },
    (alpha, frameDt) => {
      const prevSim = simCache;
      simCache = { day: world.day, minutes: world.minutes, objs: [...world.objs], chars: people.map(g.toFrame) };
      const interpMinutes = prevSim.minutes + (simCache.minutes - prevSim.minutes) * alpha;
      const cacheKey = { level: view.level, rot: view.rot, wallMode: WALL_MODES[view.wallIdx].mode, zoomBucket: Math.floor(canvas.width / 400) };
      if (layerCache.keyChanged(cacheKey)) g.fit();
      g.applyCamera(frameDt);

      art.render({
        level: view.level, rot: view.rot, minutes: interpMinutes, day: world.day,
        t: view.t, dt: frameDt, objs: world.objs, wallMode: WALL_MODES[view.wallIdx].mode,
        chars: people.map(g.toFrame),
        arrange: g.arrangeFrame(),
        focus: conversationFocus(),
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
        const sv = servings(world.household);
        el('fridge').textContent = sv === 0 ? 'Fridge empty' : `${sv} meals`;
        g.refreshPeople();
        g.refreshDrawer();
      }
    },
  );
}
