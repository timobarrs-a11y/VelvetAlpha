import { weekday } from '../state/time';
import {
  NEW_RUNTIME,
  type Actor, type ChoiceOption, type Cond, type FlagValue, type GameEvent, type LineBook, type LineRef, type Mode, type PathItem,
  type ScriptDef, type ScriptHost, type ScriptRuntime, type Step, type UiTarget,
} from './types';

/**
 * Runs scripts. One script is active at a time; others wait in a queue by priority. Steps run in order and stop at the
 * ones that take time (a walk, a line the player must tap through, a wait). `tick(dt)` is called every frame with real
 * seconds, so a cutscene plays while the game clock is stopped. Events from the game (`emit`) end waits and start
 * scripts. Everything the world does goes through the host.
 */
interface Frame { steps: Step[]; i: number; branch?: PathItem['branch']; script?: string }

type Blocking =
  | { k: 'time'; left: number }
  | { k: 'until'; cond: Cond; since: number }
  | { k: 'walk'; who: Actor }
  | { k: 'act'; who: Actor }
  | { k: 'say'; hold: number | null }
  | { k: 'choice'; options: ChoiceOption[] }
  | { k: 'card' }
  | { k: 'intro' };

const MAX_STEPS_PER_TICK = 400;
const EFFECT_STEPS = new Set(['set', 'give', 'deliver', 'unlock', 'despawn', 'place', 'clock', 'carry']);

export const isEffectStep = (s: Step): boolean => EFFECT_STEPS.has(s.do);

export class ScriptEngine {
  private defs = new Map<string, ScriptDef>();
  private frames: Frame[] = [];
  private cur: ScriptDef | null = null;
  private vars: Record<string, FlagValue> = {};
  private blocking: Blocking | null = null;
  private seq = 0;
  private log: { seq: number; ev: GameEvent }[] = [];
  private touched = new Set<string>();
  private resumeSince: number | null = null;
  private mode: Mode | null = null;
  private allow: UiTarget[] = [];

  constructor(private host: ScriptHost, defs: ScriptDef[], private book: LineBook, public rt: ScriptRuntime = NEW_RUNTIME()) {
    for (const d of defs) this.defs.set(d.id, d);
  }

  // -- what the game asks ---------------------------------------------------------------------------------------

  /** The script playing now, and how much of the screen it lets the player use. */
  state(): { id: string; mode: Mode; allow: UiTarget[] } | null {
    return this.cur && this.mode ? { id: this.cur.id, mode: this.mode, allow: this.allow } : null;
  }

  isActive(): boolean { return !!this.cur; }

  /** Whether the player may skip what is playing. */
  skippable(): boolean { return !!this.cur?.skippable; }

  /** Starts what should start on a brand new game. */
  startNewGame(): void {
    for (const d of this.defs.values()) if (d.trigger.on === 'newGame') this.enqueue(d.id, {});
  }

  /** Marks scripts finished without playing them (a saved game from before scripts existed). */
  markDone(prefixes: string[]): void {
    for (const d of this.defs.values()) if (prefixes.some((p) => d.id.startsWith(p)) && !this.rt.done.includes(d.id)) this.rt.done.push(d.id);
  }

  /** Picks up where a saved game left off. */
  resume(): void {
    const a = this.rt.active;
    if (!a) return;
    const def = this.defs.get(a.id);
    this.rt.active = null;
    if (!def) return;
    this.begin(def, a.vars, a.path);
  }

  emit(ev: GameEvent): void {
    this.log.push({ seq: ++this.seq, ev });
    if (this.log.length > 60) this.log.shift();
    for (const d of this.defs.values()) {
      if (d.trigger.on !== 'cond' || !this.canStart(d)) continue;
      if (!hasEvent(d.trigger.cond)) continue;
      if (this.eval(d.trigger.cond, this.seq - 1)) this.enqueue(d.id, this.varsFrom(d, ev));
    }
  }

  tick(dt: number): void {
    if (!this.cur) {
      this.checkTriggers();
      this.startNext();
    } else {
      this.checkTriggers();
      this.interruptIfUrgent();
    }
    if (!this.cur) return;
    if (this.blocking && !this.cleared(dt)) return;
    this.blocking = null;
    this.run();
    if (this.cur && !this.frames.length) this.finish();
  }

  /** The player skips: the script's end state is set without the scenes. */
  skip(): void {
    const d = this.cur;
    if (!d || !d.skippable) return;
    for (const s of d.onSkip ?? []) this.exec(this.sub(s) as Step, true);
    // Scripts it was in the middle of running are done too.
    for (const f of this.frames) if (f.script) this.childDone(f.script);
    this.finish();
  }

  // -- starting and ending ----------------------------------------------------------------------------------------

  private canStart(d: ScriptDef): boolean {
    if (this.cur?.id === d.id || this.rt.queue.some((q) => q.id === d.id)) return false;
    return d.once === false || !this.rt.done.includes(d.id);
  }

  private enqueue(id: string, vars: Record<string, FlagValue>): void {
    const d = this.defs.get(id);
    if (!d || !this.canStart(d)) return;
    this.rt.queue.push({ id, vars });
  }

  private checkTriggers(): void {
    for (const d of this.defs.values()) {
      if (d.trigger.on !== 'cond' || hasEvent(d.trigger.cond) || !this.canStart(d)) continue;
      if (this.eval(d.trigger.cond, 0)) this.enqueue(d.id, {});
    }
  }

  private startNext(): void {
    if (!this.rt.queue.length) return;
    let best = 0;
    this.rt.queue.forEach((q, i) => { if ((this.defs.get(q.id)?.priority ?? 0) > (this.defs.get(this.rt.queue[best].id)?.priority ?? 0)) best = i; });
    const [next] = this.rt.queue.splice(best, 1);
    const def = this.defs.get(next.id);
    if (def) { this.begin(def, next.vars, next.path, next.redo); this.resumeSince = next.since ?? null; }
  }

  private begin(def: ScriptDef, vars: Record<string, FlagValue>, path?: PathItem[], redo = false): void {
    this.cur = def;
    this.vars = vars;
    this.blocking = null;
    this.touched.clear();
    this.frames = [{ steps: def.steps, i: 0 }];
    this.setMode(def.mode, []);
    if (path?.length) this.restore(path, redo);
    this.rt.active = { id: def.id, path: path ?? [], vars };
  }

  private restore(path: PathItem[], redo: boolean): void {
    const last = path.length - 1;
    const frames: Frame[] = [{ steps: this.cur!.steps, i: path[0].i + (last === 0 && redo ? 0 : 1) }];
    for (let k = 1; k < path.length; k++) {
      const parent = frames[k - 1].steps[path[k - 1].i];
      const it = path[k];
      let steps: Step[] | undefined;
      if (parent?.do === 'if') steps = it.branch === 'else' ? parent.else : parent.then;
      else if (parent?.do === 'choice' && typeof it.branch === 'number') steps = parent.options[it.branch]?.steps;
      else if (parent?.do === 'run' && it.script) steps = this.defs.get(it.script)?.steps;
      if (!steps) break;
      frames.push({ steps, i: it.i + (k === last && redo ? 0 : 1), branch: it.branch, script: it.script });
    }
    this.frames = frames;
  }

  private finish(): void {
    const d = this.cur;
    if (!d) return;
    if (d.once !== false && !this.rt.done.includes(d.id)) this.rt.done.push(d.id);
    // Sub-scripts that ran inside are done as well.
    this.host.release([...this.touched]);
    this.host.highlight(null);
    this.host.outline(null);
    this.cur = null;
    this.frames = [];
    this.blocking = null;
    this.rt.active = null;
    this.setMode(null, []);
  }

  /**
   * A story beat that is only waiting for the player to do something steps aside for a more urgent script (a delivery
   * at the door) and picks up again, at the same wait, afterwards. A cutscene is never interrupted.
   */
  private interruptIfUrgent(): void {
    const d = this.cur;
    if (!d || d.mode === 'cutscene' || this.blocking?.k !== 'until' || !this.rt.queue.length) return;
    const urgent = this.rt.queue.some((q) => (this.defs.get(q.id)?.priority ?? 0) > (d.priority ?? 0));
    if (!urgent) return;
    const path = this.pathNow();
    this.host.release([...this.touched]);
    this.host.highlight(null);
    this.host.outline(null);
    this.rt.queue.push({ id: d.id, vars: this.vars, path, redo: true, since: (this.blocking as { since: number }).since });
    this.cur = null; this.frames = []; this.blocking = null; this.rt.active = null;
    this.setMode(null, []);
    this.startNext();
  }

  private setMode(mode: Mode | null, allow: UiTarget[]): void {
    this.mode = mode;
    this.allow = allow;
    this.host.setMode(mode, allow);
  }

  // -- running steps ----------------------------------------------------------------------------------------------

  private cleared(dt: number): boolean {
    const b = this.blocking!;
    switch (b.k) {
      case 'time': b.left -= dt; return b.left <= 0;
      case 'until': return this.eval(b.cond, b.since);
      case 'walk': return this.host.arrived(b.who);
      case 'act': return this.host.actDone(b.who);
      case 'say':
        if (b.hold !== null) { b.hold -= dt; return b.hold <= 0; }
        return this.host.sayDone();
      case 'card': return this.host.cardDone();
      case 'intro': return this.host.introDone?.() ?? true;
      case 'choice': {
        const n = this.host.choiceMade();
        if (n === null) return false;
        const opt = b.options[n] ?? b.options.find((o) => o.default) ?? b.options[0];
        for (const [k, v] of Object.entries(opt.set ?? {})) this.host.flags[k] = v;
        if (opt.steps?.length) this.frames.push({ steps: opt.steps, i: 0, branch: b.options.indexOf(opt) });
        return true;
      }
    }
  }

  private run(): void {
    for (let n = 0; n < MAX_STEPS_PER_TICK && this.cur; n++) {
      const f = this.frames[this.frames.length - 1];
      if (!f) return;
      if (f.i >= f.steps.length) {
        this.frames.pop();
        if (f.script) this.childDone(f.script);
        if (!this.frames.length) return;
        continue;
      }
      const step = this.sub(f.steps[f.i++]) as Step;
      if (this.exec(step, false)) return;
    }
  }

  private childDone(id: string): void {
    const d = this.defs.get(id);
    if (d && d.once !== false && !this.rt.done.includes(id)) this.rt.done.push(id);
  }

  /** Runs one step. Returns true when it has to wait (the engine stops until the wait is over). */
  /** The last few steps that ran, for finding out what a story did. */
  readonly trace: string[] = [];

  private exec(s: Step, skipping: boolean): boolean {
    this.trace.push(`${this.cur?.id}:${s.do}${skipping ? '*' : ''}`);
    if (this.trace.length > 40) this.trace.shift();
    const h = this.host;
    const block = (b: Blocking): true => { this.blocking = b; return true; };
    switch (s.do) {
      case 'mode': this.setMode(s.mode, s.allow ?? []); return false;
      case 'spawn': h.spawn(s.npc, s.at, s.carrying); this.touched.add(s.npc); return false;
      case 'despawn': h.despawn(s.npc); this.touched.delete(s.npc); return false;
      case 'carry': h.carry(s.who, s.carrying); return false;
      case 'place': h.place(s.who, s.at, s.face); this.touched.add(s.who); return false;
      case 'walk':
        h.walk(s.who, s.to); this.touched.add(s.who);
        return s.wait === false || skipping ? false : block({ k: 'walk', who: s.who });
      case 'face': h.face(s.who, s.toward); return false;
      case 'act':
        h.act(s.who, s.act, s.at); this.touched.add(s.who);
        return s.wait === false || skipping ? false : block({ k: 'act', who: s.who });
      case 'emote': h.emote(s.who, s.emote); return false;
      case 'camera': h.camera(s.focus, s.zoom, s.level); return false;
      case 'say': {
        const text = this.text(s.line);
        const blocking = this.mode !== 'beat';
        const hold = h.say(s.who, text, blocking);
        return block({ k: 'say', hold: blocking ? null : hold });
      }
      case 'choice': {
        h.showChoice(s.options.map((o) => o.label));
        return block({ k: 'choice', options: s.options });
      }
      case 'card':
        h.showCard(s.title, s.body, s.spotlight, s.button);
        return s.button ? block({ k: 'card' }) : false;
      case 'intro':
        if (skipping || !h.intro) return false;
        h.intro(s.kind);
        return block({ k: 'intro' });
      case 'dim': h.dim?.(s.amount); return false;
      case 'highlight': h.highlight(s.target); return false;
      case 'outline': h.outline({ objType: s.objType, at: s.at, rot: s.rot, color: s.color }); return false;
      case 'set': h.flags[s.flag] = s.value; return false;
      case 'give': h.give(s); return false;
      case 'deliver': h.deliver(s.category, s.id); return false;
      case 'unlock': h.unlock(s.what); return false;
      case 'clock': h.setClock(s.day, s.minutes); return false;
      case 'wait':
        if (s.until) {
          // Picking up an interrupted wait: what happened meanwhile still counts.
          const since = this.resumeSince ?? this.seq;
          this.resumeSince = null;
          return this.eval(s.until, since) ? false : block({ k: 'until', cond: s.until, since });
        }
        return (s.seconds ?? 0) > 0 ? block({ k: 'time', left: s.seconds! }) : false;
      case 'if': {
        const yes = this.eval(s.cond, 0);
        const branch = yes ? s.then : s.else;
        if (branch?.length) this.frames.push({ steps: branch, i: 0, branch: yes ? 'then' : 'else' });
        return false;
      }
      case 'run': {
        const child = this.defs.get(s.script);
        if (child) {
          this.frames.push({ steps: child.steps, i: 0, branch: 'run', script: child.id });
          this.setMode(child.mode, []);
        }
        return false;
      }
      case 'checkpoint':
        this.rt.active = { id: this.cur!.id, path: this.pathNow(), vars: this.vars };
        return false;
    }
  }

  /** Where the next step to run sits, through the nested blocks, for saving. */
  private pathNow(): PathItem[] {
    return this.frames.map((f) => ({ i: f.i - 1, ...(f.branch !== undefined ? { branch: f.branch } : {}), ...(f.script ? { script: f.script } : {}) }));
  }

  // -- conditions, lines, variables ---------------------------------------------------------------------------------

  /** `since`: only events after this sequence number count for `event` conditions. */
  eval(c: Cond, since: number): boolean {
    if ('all' in c) return c.all.every((x) => this.eval(x, since));
    if ('any' in c) return c.any.some((x) => this.eval(x, since));
    if ('not' in c) return !this.eval(c.not, since);
    if ('flag' in c) {
      const v = this.host.flags[c.flag];
      if (c.exists !== undefined) return (v !== undefined) === c.exists;
      return c.equals !== undefined ? v === c.equals : !!v;
    }
    if ('event' in c) {
      return this.log.some((e) => e.seq > since && e.ev.type === c.event && Object.entries(c.match ?? {}).every(([k, v]) => e.ev[k] === v));
    }
    if ('scriptDone' in c) return this.rt.done.includes(c.scriptDone);
    const { day, minutes } = this.host.clock();
    const t = c.time;
    if (t.day !== undefined && day !== t.day) return false;
    if (t.weekday !== undefined && weekday(day) !== t.weekday) return false;
    if (t.after !== undefined && minutes < t.after) return false;
    if (t.before !== undefined && minutes >= t.before) return false;
    return true;
  }

  private varsFrom(d: ScriptDef, ev: GameEvent): Record<string, FlagValue> {
    const out: Record<string, FlagValue> = {};
    for (const [k, v] of Object.entries(d.vars ?? {})) {
      const m = /^\$event\.(\w+)$/.exec(v);
      const val = m ? ev[m[1]] : v;
      if (val !== undefined) out[k] = val;
    }
    return out;
  }

  /** Replaces `$name` in every string of a step with the script's variables. */
  private sub<T>(v: T): T {
    if (!Object.keys(this.vars).length) return v;
    const walk = (x: unknown): unknown => {
      if (typeof x === 'string') return x.replace(/\$(\w+)/g, (m, k) => (k in this.vars ? String(this.vars[k]) : m));
      if (Array.isArray(x)) return x.map(walk);
      if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, walk(y)]));
      return x;
    };
    return walk(v) as T;
  }

  /** The words of a line, for whoever is playing: the right voice for the partner, names filled in. */
  text(ref: LineRef): string {
    const { player, partner, town, preset, humor, communication, relationship } = this.host.names();
    let raw: string;
    if (typeof ref === 'string') {
      // A friend who moves in gets their own version of a line where there is one ("line.friend").
      const entry = (relationship === 'friend' ? this.book.lines[ref + '.friend'] : undefined) ?? this.book.lines[ref];
      raw = typeof entry === 'string' ? entry : entry ? entry[preset] ?? entry.warm ?? Object.values(entry)[0] ?? ref : ref;
    } else if ('byPreset' in ref) raw = ref.byPreset[preset];
    else if ('bank' in ref) {
      // The companion's own style, then the plainest style in the bank, so a missing slot never goes silent.
      const styles = this.book.banks?.[ref.bank];
      const mine = ref.bank === 'humor' ? humor : communication;
      raw = (mine && styles?.[mine]?.[ref.slot]) ?? Object.values(styles ?? {}).find((s) => s[ref.slot])?.[ref.slot] ?? ref.slot;
    }
    else raw = this.fromPool(ref.pool);
    return raw.replace(/\{player\}/g, player).replace(/\{partner\}/g, partner).replace(/\{town\}/g, town);
  }

  private fromPool(name: string): string {
    const pool = this.book.pools[name] ?? [];
    if (!pool.length) return name;
    let used = this.rt.pools[name] ?? [];
    if (used.length >= pool.length) used = [];
    const free = pool.map((_, i) => i).filter((i) => !used.includes(i));
    const pick = free[(used.length * 7 + name.length) % free.length];
    this.rt.pools[name] = [...used, pick];
    return pool[pick];
  }
}

function hasEvent(c: Cond): boolean {
  if ('all' in c) return c.all.some(hasEvent);
  if ('any' in c) return c.any.some(hasEvent);
  if ('not' in c) return hasEvent(c.not);
  return 'event' in c;
}
