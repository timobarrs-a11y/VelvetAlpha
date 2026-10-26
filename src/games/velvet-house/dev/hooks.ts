import { TYPES } from '../state/objects';
import { type SampleFn } from '../state/companionAI';
import type { Game } from '../kernel/game';

export function installDevHooks(g: Game): void {
  const { world, people, view, canvas, ctx, art, dialogue, storage } = g;
  // Dev hooks
  const isDev = import.meta.env.DEV;
  if (isDev) {
    (window as unknown as { __velvet?: Record<string, unknown> }).__velvet = {
      setView: (lv: number) => g.setLevel(lv),
      setMinutes: (m: number) => { world.minutes = m; },
      saveGame: g.doSave,
      get money() { return world.household.money; },
      set money(v: number) { world.household.money = v; },
      get bond() { return g.s.bond; },
      set bond(v: number) { g.s.bond = v; },
      setSample: (f: SampleFn) => { g.s.sample = f; },
      doVidSearch: g.doVidSearch,
      // For the end-to-end tests (e2e/velvet-sims): read what is in the house, and find a piece on screen.
      objects: () => world.objs.map(o => ({ id: o.id, type: o.type, level: o.level, x: o.x, y: o.y, rot: o.rot })),
      storedCount: () => storage.length,
      resetCamera: () => g.resetCamera(),
      personClientPos: (who: 'jordan' | 'maya'): [number, number] => {
        const a = who === 'maya' ? people[1] : people[0];
        const [vx, vy] = art.project(a.x, a.y, a.z + 0.7);
        const p = ctx.getTransform().transformPoint(new DOMPoint(vx, vy));
        const r = canvas.getBoundingClientRect();
        return [r.left + (p.x / canvas.width) * r.width, r.top + (p.y / canvas.height) * r.height];
      },
      closeChat: () => dialogue.close(),
      personLevel: (who: 'jordan' | 'maya') => (who === 'maya' ? people[1] : people[0]).level,
      level: () => view.level,
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
