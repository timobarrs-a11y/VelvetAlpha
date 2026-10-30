import { TYPES } from '../state/objects';
import { checkPlacement } from '../state/arrange';
import { CATALOG } from '../state/catalog';
import { checkLamp, type WallLamp } from '../state/wallLamps';
import { ACTIVITIES } from '../state/activities';
import { isWalking, poseOf, startGoto, startChain, tickAgent } from '../state/agents';
import { bossLeave } from '../state/boss';
import { type SampleFn } from '../state/companionAI';
import { MARKS } from '../content/marks';
import type { Game } from '../kernel/game';

export function installDevHooks(g: Game): void {
  const { world, people, view, canvas, ctx, art, dialogue, storage } = g;
  // Dev hooks
  const isDev = import.meta.env.DEV;
  if (isDev) {
    (window as unknown as { __velvet?: Record<string, unknown> }).__velvet = {
      setView: (lv: number) => g.setLevel(lv),
      setRot: (r: number) => { view.rot = r; },
      // Put a piece in the house (a test for new furniture).
      addObject: (type: string, level: number, x: number, y: number, col?: string, rot = 0) => { world.objs.push({ id: `t-${type}-${world.objs.length}`, type, level, x, y, rot, ...(col ? { col } : {}) }); g.relearnLayout(world.objs[world.objs.length - 1]); },
      // Send someone somewhere (a test for the stairs).
      goto: (who: 'jordan' | 'maya', level: number, x: number, y: number) => { const p = who === 'maya' ? people[1] : people[0]; p.scripted = true; startGoto(g.house, p, { level, x, y }); },
      setMinutes: (m: number) => { world.minutes = m; },
      // Jump to a day, so each season can be looked at (a week each: spring 1-7, summer 8-14, autumn 15-21, winter 22-28).
      setDay: (d: number) => { world.day = d; },
      // Put someone on a floor (without the stairs), and start an activity chain for them: to see the office's desks used.
      placePerson: (who: 'jordan' | 'maya', level: number, x: number, y: number) => { const p = who === 'maya' ? people[1] : people[0]; p.level = level; p.x = x; p.y = y; p.task = null; p.scripted = true; },
      // Hold someone in a pose, facing a way, to look at the animation (they are made scripted so nothing else moves them).
      showPose: (who: 'jordan' | 'maya', pose: string, face: [number, number] = [0, 1]) => {
        const p = who === 'maya' ? people[1] : people[0], id = `_pose_${pose}`;
        (ACTIVITIES as Record<string, unknown>)[id] = { pose, dur: Infinity, gives: {}, verb: pose };
        p.scripted = true; p.face = face; p.task = { act: id, slot: null, phase: 'do', route: [], time: 0, dur: 1e9, next: [] } as never;
      },
      // Change the pose of the activity someone is doing right now (so a seated person can be shown on the phone).
      swapPose: (who: 'jordan' | 'maya', pose: string) => { const p = who === 'maya' ? people[1] : people[0], a = p.task && (ACTIVITIES as Record<string, { pose: string }>)[p.task.act]; if (a) a.pose = pose; },
      // The animation lab: pause the game, then move one person's task on by `sec` seconds at a time, to look at a sit, a stand or any activity frame by frame.
      stepAgent: (who: 'jordan' | 'maya', sec: number, gameMin = sec / 60) => {
        const p = who === 'maya' ? people[1] : people[0], o = who === 'maya' ? people[0] : people[1];
        p.scripted = true; view.paused = true;
        tickAgent(g.house, p, o, sec, gameMin, 1, world.minutes / 60, () => 0.5);
      },
      // The clock lab: pause the game and set the animation clock, to look at a motion at exact moments (a ball's flight, a net's reaction).
      setT: (t: number) => { view.paused = true; view.t = t; },
      getT: () => view.t,
      // The gait lab: freeze the game, put someone in a walk and move them a little at a time, so a stride can be looked at frame by frame.
      gaitStep: (who: 'jordan' | 'maya', dx: number, dy: number) => {
        const p = who === 'maya' ? people[1] : people[0];
        p.scripted = true;
        if (!view.paused) view.paused = true;
        if (!p.task || p.task.phase !== 'walk') p.task = { act: 'goto', slot: null, phase: 'walk', route: [], time: 0, dur: 1e9, next: [] } as never;
        const d = Math.hypot(dx, dy) || 1;
        p.x += dx; p.y += dy; p.face = [dx / d, dy / d];
      },
      bossLeave: (minutes = 8) => { const d = people.find((q) => q.id === 'dale'); if (d) bossLeave(g.house, d, world.day * 1440 + world.minutes, minutes); },
      startChain: (who: 'jordan' | 'maya', chain: string) => { const p = who === 'maya' ? people[1] : people[0]; p.scripted = true; return startChain(g.house, p, chain, null, () => Math.random()); },
      // The office: unlock it (it joins the floor bar), and light or clear the meeting-room sign.
      unlockOffice: () => { g.flags.officeUnlocked = true; g.setLevel(view.level); },
      setMeeting: (on: boolean) => art.setMeeting(on),
      // Set fields on a piece (a fruit tree's growth and fruit), to see its stages without waiting for them.
      patchObject: (id: string, patch: Record<string, unknown>) => { const o = world.objs.find((q) => q.id === id); if (o) Object.assign(o, patch); },
      // The game clock, as minutes since day 0 (does it run, or hold still?).
      minutes: () => world.day * 1440 + world.minutes,
      saveGame: g.doSave,
      get money() { return world.household.money; },
      set money(v: number) { world.household.money = v; },
      get bond() { return g.s.bond; },
      set bond(v: number) { g.s.bond = v; },
      setSample: (f: SampleFn) => { g.s.sample = f; },
      doVidSearch: g.doVidSearch,
      // For the end-to-end tests (e2e/velvet-sims): read what is in the house, and find a piece on screen.
      objects: () => world.objs.map(o => ({ id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot, ...(o.on ? { on: o.on, z: o.z } : {}), ...(o.skin ? { skin: o.skin } : {}), ...(o.grow !== undefined ? { grow: o.grow } : {}), ...(o.fruit !== undefined ? { fruit: o.fruit } : {}) })),
      moveObject: (id: string, x: number, y: number) => { const o = world.objs.find((q) => q.id === id); if (o) { o.x = x; o.y = y; } },
      storedCount: () => storage.length,
      settle: () => { g.s.settleDone = true; },
      resetCamera: () => g.resetCamera(),
      unfollow: () => { view.follow = null; g.syncControls(); g.resetCamera(); },
      personClientPos: (who: 'jordan' | 'maya'): [number, number] => {
        const a = who === 'maya' ? people[1] : people[0];
        const [vx, vy] = art.project(a.x, a.y, a.z + 0.7);
        const p = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return [r.left + (p.x / canvas.width) * r.width, r.top + (p.y / canvas.height) * r.height];
      },
      openChat: () => g.openChat(),
      closeChat: () => dialogue.close(),
      personLevel: (who: 'jordan' | 'maya') => (who === 'maya' ? people[1] : people[0]).level,
      level: () => view.level,
      placeCheck: (id: string) => { const o = world.objs.find((q) => q.id === id); return o ? JSON.stringify({ check: checkPlacement(world.objs, o, people), people: people.map((p) => [p.id, p.level, +p.x.toFixed(2), +p.y.toFixed(2), p.onStairs, p.task?.act ?? null]) }) : null; },
      story: () => JSON.stringify(g.flags.story ?? {}),
      openTab: (t: string) => g.drawer.open(t as never),
      closeDrawer: () => g.drawer.close(),
      advance: (m: number) => { world.minutes = Math.min(1439, world.minutes + m); },
      buy: (id: string) => { const it = CATALOG.find((c) => c.id === id); if (it) g.handleBuy(it); },
      // Give an item (and a set's pieces) as a promo code would, without the pop-up: for tests of promo packs.
      owns: (id: string) => g.owned.has(id),
      own: (id: string) => { const it = CATALOG.find((c) => c.id === id); if (!it) return; g.owned.add(it.id); for (const m of it.set?.items ?? []) g.owned.add(m); },
      parcel: () => JSON.stringify(world.household.parcel),
      scriptState: () => { const e = g.scripts as unknown as { frames: { i: number }[]; blocking: unknown }; return JSON.stringify({ rt: g.scripts.state(), mode: g.s.scriptMode, at: e.frames.map((f) => f.i), blocking: e.blocking, trace: g.scripts.trace.join(' ') }); },
      // Where a household member is and what they're doing, with their spot on screen.
      agentState: (id: string) => {
        const p = people.find(q => q.id === id);
        if (!p) return null;
        const [vx, vy] = art.project(p.x, p.y, 0.9);
        const q = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return { level: p.level, face: p.face, turning: !!p.turning, walking: isWalking(p), pose: poseOf(p), act: p.task?.act ?? null, screen: [r.left + (q.x / canvas.width) * r.width, r.top + (q.y / canvas.height) * r.height] };
      },
      // Where a story mark is on screen, so a test can drag a piece to it (its centre, as a piece of that type would sit there).
      markClientPos: (name: string, type = 'sofa', rot = 0): [number, number] | null => {
        const m = MARKS[name];
        if (!m || m.level !== view.level) return null;
        const t = TYPES[type];
        const [fw, fd] = rot % 2 ? [t.D, t.W] : [t.W, t.D];
        const [vx, vy] = art.project(m.x + fw / 2, m.y + fd / 2, (t.h || 1) / 2);
        const p = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return [r.left + (p.x / canvas.width) * r.width, r.top + (p.y / canvas.height) * r.height];
      },
      lightOn: (id: string) => art.objectLightOn(id),
      lamps: () => JSON.parse(JSON.stringify(g.flags.wallLamps ?? [])) as Array<{ id: string; level: number; p: 'B' | 'L'; u: number; z: number; style: string }>,
      lampOk: (id: string, p: 'B' | 'L', u: number, z: number) => { const ls = (g.flags.wallLamps ?? []) as WallLamp[], l = ls.find((q) => q.id === id); return !!l && checkLamp(ls, { ...l, p, u, z }, world.objs).ok; },
      wallPointAtClient: (cx: number, cy: number) => { const [sx, sy] = g.toView(cx, cy); return art.wallPointAt(view.level, sx, sy); },
      setLampStyle: (style: string) => { for (const l of (g.flags.wallLamps ?? []) as WallLamp[]) if (l.level === 0) l.style = style as WallLamp['style']; },
      lampStock: () => [...((g.flags.lampStock as string[] | undefined) ?? [])],
      wallClientPos: (p: 'B' | 'L', u: number, z: number, out = 0.12): [number, number] => {
        const [vx, vy] = art.project(p === 'B' ? u : out, p === 'B' ? out : u, z);
        const pt = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return [r.left + (pt.x / canvas.width) * r.width, r.top + (pt.y / canvas.height) * r.height];
      },
      marks: () => MARKS,
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
}
