import { TYPES } from '../state/objects';
import { checkPlacement } from '../state/arrange';
import { CATALOG } from '../state/catalog';
import { isWalking, poseOf, startGoto } from '../state/agents';
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
      // Put a piece in the house (a test for new furniture).
      addObject: (type: string, level: number, x: number, y: number, col?: string) => { world.objs.push({ id: `t-${type}-${world.objs.length}`, type, level, x, y, rot: 0, ...(col ? { col } : {}) }); },
      // Send someone somewhere (a test for the stairs).
      goto: (who: 'jordan' | 'maya', level: number, x: number, y: number) => { const p = who === 'maya' ? people[1] : people[0]; p.scripted = true; startGoto(g.house, p, { level, x, y }); },
      setMinutes: (m: number) => { world.minutes = m; },
      saveGame: g.doSave,
      get money() { return world.household.money; },
      set money(v: number) { world.household.money = v; },
      get bond() { return g.s.bond; },
      set bond(v: number) { g.s.bond = v; },
      setSample: (f: SampleFn) => { g.s.sample = f; },
      doVidSearch: g.doVidSearch,
      // For the end-to-end tests (e2e/velvet-sims): read what is in the house, and find a piece on screen.
      objects: () => world.objs.map(o => ({ id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot, ...(o.on ? { on: o.on, z: o.z } : {}), ...(o.skin ? { skin: o.skin } : {}) })),
      moveObject: (id: string, x: number, y: number) => { const o = world.objs.find((q) => q.id === id); if (o) { o.x = x; o.y = y; } },
      storedCount: () => storage.length,
      settle: () => { g.s.settleDone = true; },
      resetCamera: () => g.resetCamera(),
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
