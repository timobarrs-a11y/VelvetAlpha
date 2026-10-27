import { describe, it, expect } from 'vitest';
import { ScriptEngine } from '../script/engine';
import { SCRIPTS } from '../content/scripts';
import { LINE_BOOK } from '../content/lines';
import { MARKS } from '../content/marks';
import type { Cond, FlagValue, PlaceRef, ScriptHost, ScriptRuntime, WorldCond } from '../script/types';

/**
 * Every script in the story, played headlessly against a small model of the house, with a reload and a skip tried at
 * every wait. A new scene is covered the day it is added. What it proves: no script can be left waiting on something
 * that already happened (the soft-lock), and a reload never leaves a second copy of anything.
 */
interface Obj { type: string; level: number; x: number; y: number; rot: number; contents?: string; lightOn?: boolean }

function worldHost() {
  const objs = new Map<string, Obj>();
  const flags: Record<string, FlagValue> = {};
  const walking = new Set<string>();
  const acting = new Set<string>();
  const state = { sayOpen: false, cardOpen: false, intro: false, choice: null as number | null, minutes: 540, day: 1, mode: null as string | null };
  const spot = (ref: PlaceRef) => (typeof ref !== 'string' ? ref : MARKS[ref.startsWith('mark:') ? ref.slice(5) : ref] ?? { level: 1, x: 5, y: 5 });
  const host: ScriptHost = {
    flags,
    clock: () => ({ day: state.day, minutes: state.minutes }),
    names: () => ({ player: 'Sam', partner: 'Riley', town: 'Testville', preset: 'warm', humor: 'dry', communication: 'direct', relationship: 'romantic' }),
    setMode: (m) => { state.mode = m; },
    spawn: () => {}, despawn: () => {}, carry: () => {}, face: () => {}, emote: () => {}, camera: () => {}, highlight: () => {}, outline: () => {}, unlock: () => {}, release: () => {}, hold: () => {},
    place: (w) => walking.delete(w),
    walk: (w) => walking.add(w),
    arrived: (w) => !walking.has(w),
    act: (w) => acting.add(w),
    actDone: (w) => !acting.has(w),
    say: (_w, _t, blocking) => { state.sayOpen = blocking; return 0.1; },
    sayDone: () => !state.sayOpen,
    showChoice: () => { state.choice = null; },
    choiceMade: () => state.choice,
    showCard: (_t, _b, _s, button) => { state.cardOpen = !!button; },
    cardDone: () => !state.cardOpen,
    intro: () => { state.intro = true; },
    introDone: () => !state.intro,
    dim: () => {},
    setClock: (d, m) => { if (d !== undefined) state.day = d; if (m !== undefined) state.minutes = m; },
    give: (g) => { const o = g.object; if (!o) return; const id = o.id ?? `${o.type}-${objs.size}`; if (objs.has(id)) return; const s = spot(o.at); objs.set(id, { type: o.type, level: s.level, x: s.x, y: s.y, rot: 0, ...(o.contents ? { contents: o.contents } : {}) }); },
    deliver: () => {},
    ready: () => true,
    check: (w: WorldCond) => {
      const o = objs.get(w.obj);
      if (w.exists !== undefined) return !!o === w.exists;
      if (!o) return false;
      if (w.is && o.type !== w.is) return false;
      if (w.level !== undefined && o.level !== w.level) return false;
      if (w.at) { const s = spot(w.at); if (o.level !== s.level || Math.hypot(o.x - s.x, o.y - s.y) > (w.within ?? 0.6)) return false; }
      if (w.rot !== undefined && o.rot !== w.rot) return false;
      if (w.lightOn !== undefined && !!o.lightOn !== w.lightOn) return false;
      return true;
    },
  };
  /** What the player would do: the object becomes what the condition asks for. */
  const satisfy = (w: WorldCond): void => {
    const o = objs.get(w.obj);
    if (!o) return;
    if (w.is) { o.type = w.is; delete o.contents; }
    if (w.level !== undefined) o.level = w.level;
    if (w.at) { const s = spot(w.at); Object.assign(o, { level: s.level, x: s.x, y: s.y }); }
    if (w.rot !== undefined) o.rot = w.rot;
    if (w.lightOn !== undefined) o.lightOn = w.lightOn;
  };
  return { host, objs, flags, walking, acting, state, satisfy };
}

/** Does what a player or the world would do to get past the current wait, using the state side of the condition. */
function nudge(h: ReturnType<typeof worldHost>, engine: ScriptEngine): string {
  const k = engine.blockedOn();
  if (k === 'walk' || k === 'arrive') { h.walking.clear(); return 'arrive'; }
  if (k === 'act') { h.acting.clear(); return 'act'; }
  if (k === 'say') { h.state.sayOpen = false; return 'tap'; }
  if (k === 'card') { h.state.cardOpen = false; return 'button'; }
  if (k === 'intro') { h.state.intro = false; return 'intro'; }
  if (k === 'choice') { h.state.choice = 0; return 'choice'; }
  if (k === 'until') {
    const c = engine.waitingOn()!;
    if (!settle(h, c)) throw new Error(`${engine.state()?.id}: cannot pass ${JSON.stringify(c)} without an event`);
    return 'world';
  }
  return 'none';
}

/** Makes a condition true through its flag, world or clock parts. False when only an event could. */
function settle(h: ReturnType<typeof worldHost>, c: Cond): boolean {
  if ('world' in c) { h.satisfy(c.world); return true; }
  if ('flag' in c) { h.flags[c.flag] = c.equals ?? true; return true; }
  if ('time' in c) { if (c.time.after !== undefined) h.state.minutes = c.time.after; if (c.time.day !== undefined) h.state.day = c.time.day; return true; }
  if ('all' in c) return c.all.every((x) => settle(h, x));
  if ('any' in c) return c.any.some((x) => !('event' in x) && settle(h, x));
  return false;
}

/** Plays a script to its end; returns how many waits it went through. */
function playOut(h: ReturnType<typeof worldHost>, engine: ScriptEngine, max = 400): number {
  let waits = 0;
  for (let n = 0; n < max; n++) {
    engine.tick(0.5);
    if (!engine.isActive()) return waits;
    if (engine.blockedOn()) { nudge(h, engine); waits++; }
  }
  throw new Error(`${engine.state()?.id} did not finish: stuck on ${engine.blockedOn()} ${JSON.stringify(engine.waitingOn())}`);
}

const startable = SCRIPTS.filter((d) => d.trigger.on === 'newGame' || !d.trigger.cond || !('event' in d.trigger.cond));

function fresh(id: string, rt?: ScriptRuntime) {
  const h = worldHost();
  const engine = new ScriptEngine(h.host, SCRIPTS, LINE_BOOK, rt);
  return { h, engine, def: SCRIPTS.find((d) => d.id === id)! };
}

/** Starts one script by itself: flags its trigger wants are set, everything else is marked done. */
function startAlone(t: ReturnType<typeof fresh>): void {
  for (const d of SCRIPTS) if (d.id !== t.def.id && !t.engine.rt.done.includes(d.id)) t.engine.rt.done.push(d.id);
  if (t.def.trigger.on === 'cond') settle(t.h, t.def.trigger.cond);
  else t.engine.startNewGame();
}

describe('every story script survives a reload at every wait', () => {
  for (const def of startable) {
    it(`${def.id}: plays through`, () => {
      const t = fresh(def.id);
      startAlone(t);
      playOut(t.h, t.engine);
      expect(t.engine.rt.done).toContain(def.id);
    });

    it(`${def.id}: a reload at any wait resumes and finishes without a second copy of anything`, () => {
      // How many waits a clean run has; then reload after each one.
      const clean = fresh(def.id); startAlone(clean);
      const total = playOut(clean.h, clean.engine);
      for (let at = 0; at < total; at++) {
        const first = fresh(def.id); startAlone(first);
        let seen = 0;
        while (seen <= at) { first.engine.tick(0.5); if (first.engine.blockedOn()) { if (seen === at) break; nudge(first.h, first.engine); seen++; } if (!first.engine.isActive()) break; }
        if (!first.engine.isActive()) break;
        // The thing the wait is for happens, then the page reloads before the engine runs again.
        if (first.engine.blockedOn() === 'until') settle(first.h, first.engine.waitingOn()!);
        const saved = JSON.parse(JSON.stringify(first.engine.rt)) as ScriptRuntime;
        const second = fresh(def.id, saved);
        for (const [id, o] of first.h.objs) second.h.objs.set(id, { ...o });
        Object.assign(second.h.flags, first.h.flags);
        second.engine.resume();
        expect(second.engine.isActive(), `${def.id}: nothing resumed after wait ${at}`).toBe(true);
        playOut(second.h, second.engine);
        expect(second.engine.rt.done).toContain(def.id);
        expect([...second.h.objs.keys()].sort()).toEqual([...clean.h.objs.keys()].sort());
      }
    });

  }
});
