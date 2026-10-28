import { DAYS, weekday, clockText, season } from '../state/time';
import { tickAgent, isAsleep } from '../state/agents';
import { financeTick } from '../state/finance';
import { sideJobsTick } from '../state/sideJobs';
import { rollDay, nightStart, wakeHour } from '../state/routine';
import { advanceClock } from '../engine/loop';
import { startFixedLoop } from '../engine/fixedLoop';
import { qualityManager } from '../engine/qualityTier';
import { LayerCache } from '../engine/layerCache';
import { deliveryTick, dirtTick, laundryTick, newDayReset } from '../state/household';
import { tickFitness, snackTick } from '../state/vitals';
import { SPEEDS, WALL_MODES } from '../kernel/config';
import type { Game } from '../kernel/game';

// The Sims' fast-forwards: skipping the work day, and the night while everyone sleeps.
const SKIP_SPEED = 180;
const NIGHT_SPEED = 60;

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
      g.scriptUpdate(dt);
      if (view.paused) return;
      view.t += dt;
      // In a cutscene or a guided step the day holds still; only the people a script is moving (and visitors) go on.
      if (g.s.scriptMode === 'cutscene' || g.s.scriptMode === 'guided') {
        for (const p of people) if (p.scripted || p.kind === 'npc') tickAgent(house, p, null, dt, 0, 1, world.minutes / 60, () => rng.next(), world.household);
        return;
      }
      // Like The Sims: the work day can be skipped, and the night runs fast when everyone's asleep.
      const jordanAway = people[0].away === 'work';
      const allAsleep = !jordanAway && people.slice(0, 2).every((p) => isAsleep(p));
      if (!jordanAway) g.s.skipping = false;
      const speed = g.s.skipping ? SKIP_SPEED : allAsleep ? NIGHT_SPEED : SPEEDS[view.speedIdx];
      const before = world.minutes + world.day * 1440;
      Object.assign(world, advanceClock(world.day, world.minutes, dt, speed));
      const gameMin = world.minutes + world.day * 1440 - before;
      const hourF = world.minutes / 60;
      const walkMul = Math.min(speed, 6);
      const absM = world.minutes + world.day * 1440;
      const prevDay = world.day;
      if (g.s.settleDone) {
        rollDay(world.life, world.day);
        financeTick(world.household, world.life, world.day, world.minutes, log);
        sideJobsTick(world.life, world.day, world.minutes, () => rng.next(), log);
        g.runRoutine(hourF);
      }
      deliveryTick(world.household, absM, log);
      dirtTick(world.household, gameMin);
      laundryTick(world.household, gameMin);
      if (world.day !== prevDay) { newDayReset(world.household, log); }
      tickAgent(house, people[0], people[1], dt, gameMin, walkMul, hourF, () => rng.next(), world.household,
        g.s.settleDone ? { nightStart: nightStart(world.life.routine), wakeAt: wakeHour(world.life.routine, world.day) } : undefined);
      g.tickSideJob(gameMin);
      tickAgent(house, people[1], people[0], dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      // The house's vital signs: the treadmill and the weights build fitness; time wears it; the household grazes.
      const jt = people[0].task;
      tickFitness(g.flags, gameMin, !!jt && jt.phase === 'do' && (jt.act === 'workout' || jt.act === 'lift'));
      if (snackTick(world.household, g.flags, gameMin)) log('Somebody raided the fridge for a snack.');
      g.concernsTick(gameMin);
      g.petsTick(dt, gameMin, walkMul, hourF);
      g.deliveriesTick();
      // Visitors a script has brought in (people after the two who live here).
      for (const npc of people.slice(2)) tickAgent(house, npc, null, dt, gameMin, walkMul, hourF, () => rng.next(), world.household);
      const followed = view.follow && people.find((p) => p.id === view.follow);
      if (followed && !followed.onStairs && followed.level !== view.level) g.setLevel(followed.level, true);

      // Goals tick (throttled)
      goalsTimer -= dt;
      if (goalsTimer <= 0) { goalsTimer = 0.25; g.goalsTick(); g.outfitTick(); g.overseerTick(); g.roomServiceTick(); g.candlesTick(); }
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
        pets: g.petFrames(),
        arrange: g.arrangeFrame(),
        ...g.lampFrame(),
        focus: conversationFocus(),
        // The room the shop's paint and wallpaper go on, outlined while the shop is open.
        roomHint: g.drawer.page() === 'shop' ? view.room : null,
        house: { power: world.household.power, dishes: world.household.dishes, laundryPile: world.household.laundryPile, fridge: world.household.fridge, parcel: world.household.parcel && world.household.parcel.ready !== false ? world.household.parcel : null, owned },
      });
      qualityManager.recordFrame(frameDt * 1000);

      hudTimer -= frameDt;
      if (hudTimer <= 0) {
        hudTimer = 0.25;
        el('when').textContent = `${DAYS[weekday(world.day)]} · Day ${world.day}`;
        el('clock').textContent = clockText(world.minutes);
        el('season').textContent = season(world.day);
        el('money').textContent = `$${world.household.money}`;
        g.btn('skipwork').hidden = people[0].away !== 'work' || g.s.skipping;
        g.refreshVitals();
        g.refreshPeople();
        g.refreshDrawer();
      }
    },
  );
}
