import type { Game } from '../kernel/game';
import { startGoto, placeAgent, startChain, createNpc, buildWorld, type Agent } from '../state/agents';
import { deposit } from '../state/finance';
import { TYPES, type ObjectInstance } from '../state/objects';
import { relocate } from '../state/arrange';
import { npcDef, NPC_IDS } from '../content/characters';
import { MARKS, type Spot } from '../content/marks';
import { SCRIPTS } from '../content/scripts';
import { LINE_BOOK } from '../content/lines';
import { validateContent } from './validate';
import { ScriptEngine } from './engine';
import { NEW_RUNTIME, type FlagValue, type GameEvent, type PlaceRef, type ScriptHost, type ScriptRuntime, type UiTarget } from './types';
import { run } from '../kernel/config';
import { createScriptUi } from '../ui/scriptUi';
import { playArrival, type Arrival } from '../ui/arrivalIntro';
import { season as seasonOf } from '../state/time';

/**
 * Connects the script engine to the running game: who a name means, where a place is, and what each step does to the
 * house and the screen. The story itself is data (content/scripts); nothing here knows about Dez or the couch.
 */
const EMOTES: Record<string, string> = { alert: '!', laugh: 'ha ha!', wave: 'hi!', heart: '♥', think: '…' };

export function createScripts(g: Game): Partial<Game> {
  const { world, people, house, rng, view, flags, art, stage, log } = g;
  const ui = createScriptUi(stage);
  const story = (flags.story ??= {}) as Record<string, FlagValue>;
  const hadRt = !!flags.scriptRt;
  const rt = ((flags.scriptRt as ScriptRuntime | undefined) ?? NEW_RUNTIME());
  flags.scriptRt = rt;

  // -- who and where ----------------------------------------------------------------------------------------------
  const actor = (who: string): Agent | undefined => (who === 'jordan' ? people[0] : who === 'maya' ? people[1] : people.find((p) => p.id === who));
  const nameOf = (who: string): string => (who === 'jordan' ? g.simName : who === 'maya' ? g.partnerName : actor(who)?.name ?? who);

  /** A place a script names, as a spot on a floor. */
  function resolve(ref: PlaceRef): Spot | null {
    if (typeof ref !== 'string') return ref;
    const key = ref.startsWith('mark:') ? ref.slice(5) : ref;
    if (MARKS[key]) return MARKS[key];
    const m = /^(obj|objType):(.+)$/.exec(ref);
    if (m) {
      const o = m[1] === 'obj' ? world.objs.find((q) => q.id === m[2]) : world.objs.find((q) => q.type === m[2]);
      if (!o) return null;
      const t = TYPES[o.type];
      return { level: o.level, x: o.x + (t?.W ?? 1) / 2, y: o.y + (t?.D ?? 1) + 0.7 };
    }
    return null;
  }
  const standNear = (s: Spot): Spot => s;

  // -- the host the engine drives ---------------------------------------------------------------------------------
  let camFocus: { who: string; zoom: number } | null = null;
  let spot: UiTarget[] = [];

  let arrival: Arrival | null = null;
  const host: ScriptHost = {
    flags: story,
    clock: () => ({ day: world.day, minutes: world.minutes }),
    names: () => ({ player: g.simName, partner: g.partnerName, town: g.townName, preset: g.companionCfg.preset, humor: g.s.voice.humor, communication: g.s.voice.communication, relationship: g.s.voice.relationship }),

    setMode(mode, allow) {
      g.s.scriptMode = mode;
      g.s.scriptAllow = allow;
      ui.setMode(mode, engine.skippable());
      ui.spotlight([...spot, ...allow.filter((a) => !a.startsWith('obj'))]);
      art.spotlight(allow.filter((a) => a.startsWith('obj:')).map((a) => a.slice(4)));
      if (mode === 'cutscene') g.drawer.close();
      if (!mode) { camFocus = null; }
    },
    spawn(npc, at, carrying) {
      const def = npcDef(npc);
      const s = resolve(at);
      if (!def || !s || people.some((p) => p.id === npc)) return;
      const a = createNpc(def.id, def.name, { ...def.look }, s);
      a.face = [1, 0];
      if (carrying) a.carrying = carrying;
      people.push(a);
    },
    despawn(npc) {
      const i = people.findIndex((p) => p.id === npc && p.kind === 'npc');
      if (i >= 0) people.splice(i, 1);
    },
    carry(who, carrying) { const a = actor(who); if (a) a.carrying = carrying ?? undefined; },
    place(who, at, face) {
      const a = actor(who), s = resolve(at);
      if (!a || !s) return;
      a.scripted = true;
      const f = face ? (resolve(face) ?? (typeof face === 'string' ? actor(face) : undefined) ?? null) : null;
      const dir: [number, number] | undefined = f ? (() => { const dx = f.x - s.x, dy = f.y - s.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d] as [number, number]; })() : undefined;
      placeAgent(a, s, dir);
    },
    walk(who, to) {
      const a = actor(who), s = resolve(to);
      if (!a || !s) return;
      a.scripted = true;
      startGoto(house, a, standNear(s));
    },
    arrived: (who) => { const a = actor(who); return !a || !a.task; },
    face(who, toward) {
      const a = actor(who);
      const t = (typeof toward === 'string' ? actor(toward) : undefined) ?? resolve(toward);
      if (!a || !t) return;
      const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 1;
      a.face = [dx / d, dy / d];
    },
    act(who, act, _at) {
      const a = actor(who);
      if (!a) return;
      a.scripted = true;
      const other = people.find((p) => p !== a && p.kind !== 'npc') ?? null;
      startChain(house, a, act, other, () => rng.next());
    },
    actDone: (who) => { const a = actor(who); return !a || !a.task; },
    emote(who, e) { const a = actor(who); if (a) a.bubble = { text: EMOTES[e] ?? '!', at: view.t }; },
    camera(focus, zoom, level) {
      if (level !== undefined) g.setLevel(level, true);
      if (focus === 'wide') { camFocus = null; g.resetCamera(); return; }
      const who = typeof focus === 'string' && actor(focus) ? focus : null;
      if (who) { camFocus = { who, zoom: zoom ?? 1.8 }; return; }
      const s = resolve(focus);
      if (s) { camFocus = null; const [px, py] = art.project(s.x, s.y, 0.7); g.cam.tz = zoom ?? 1.6; g.cam.tfx = px; g.cam.tfy = py; }
    },
    say(who, text, blocking) {
      if (blocking) { ui.say(nameOf(who), text); return 0; }
      const a = actor(who);
      if (a) a.bubble = { text, at: view.t };
      log(`${nameOf(who)}: ${text}`);
      return Math.max(2.4, text.length / 14);
    },
    sayDone: () => ui.sayDone(),
    showChoice: (labels) => ui.choose(labels),
    choiceMade: () => ui.choiceMade(),
    showCard(title, body, spotlight, button) {
      ui.card(title, body, button);
      spot = spotlight && !spotlight.startsWith('obj') ? [spotlight] : [];
      ui.spotlight([...spot, ...(g.s.scriptAllow ?? []).filter((a) => !a.startsWith('obj'))]);
      if (spotlight?.startsWith('obj:')) art.spotlight([spotlight.slice(4)]);
      // A card with no button goes away by itself after a while.
      if (!button) setTimeout(() => { if (!engine.isActive() || ui.cardDone()) ui.hideCard(); }, 9000);
    },
    cardDone: () => ui.cardDone(),
    highlight(target) {
      spot = target ? [target] : [];
      ui.spotlight([...spot, ...(g.s.scriptAllow ?? []).filter((a) => !a.startsWith('obj'))]);
      if (!target) { art.spotlight([]); ui.hideCard(); }
    },
    outline(s) {
      if (!s) { art.setGhost(null); g.setGhostTarget(null); return; }
      const at = resolve(s.at);
      if (at) g.setGhostTarget({ type: s.objType, level: at.level, x: at.x, y: at.y, rot: s.rot });
      // A coloured outline is a placement lesson: bring up Arrange with that piece in hand, framed with its outline.
      if (s.color) {
        const o = world.objs.find((q) => q.type === s.objType && (!at || q.level === at.level));
        if (o) { if (!g.isArranging()) g.drawer.open('arrange'); g.selectObject(o); }
      }
      if (at) art.setGhost({ type: s.objType, level: at.level, x: at.x, y: at.y, rot: s.rot, color: s.color });
    },
    give(step) {
      if (step.money) { deposit(world.household, world.life, world.day, world.minutes, 'Welcome check from Dez', step.money); log(`+$${step.money}`); }
      for (const item of step.items ?? []) g.owned.add(item);
      const o = step.object;
      if (o) {
        const at = resolve(o.at);
        if (at) {
          const inst: ObjectInstance = { id: o.id ?? `${o.type}-${Date.now() & 0xffff}`, type: o.type, level: at.level, x: at.x, y: at.y, rot: 0, ...(o.contents ? { contents: o.contents } : {}), ...(o.col ? { col: o.col } : {}) };
          if (!world.objs.some((q) => q.id === inst.id)) {
            world.objs.push(inst);
            if (!relocate(world.objs, inst, at.level, [], [at.x, at.y])) { world.objs.pop(); engine.trace.push('give-fail:' + inst.id + JSON.stringify(people.map((p) => [p.id, p.level, +p.x.toFixed(1), +p.y.toFixed(1)]))); return; }
            g.relearnLayout(inst);
            if (inst.type === 'pbox') art.drop(inst.id); else art.objectPlaced(inst.id);
          }
        }
      }
    },
    unlock(what) {
      (flags.unlocked ??= {} as Record<string, boolean>);
      (flags.unlocked as Record<string, boolean>)[what] = true;
      if (what === 'freeWill') g.s.freeWill = true;
    },
    intro() {
      arrival?.cancel();
      arrival = playArrival(stage, {
        plot: g.s.plot, season: seasonOf(world.day), town: g.townName,
        reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      });
    },
    dim(amount) { art.setDim(amount); },
    introDone: () => !arrival || arrival.done(),
    setClock(day, minutes) {
      if (day !== undefined) world.day = day;
      if (minutes !== undefined) world.minutes = minutes;
    },
    deliver(category, id) {
      switch (category) {
        case 'mayaUnpack': g.log(`${g.partnerName} unpacks a few boxes.`); break;
        case 'chatLine': {
          const e = id ? LINE_BOOK.lines[id] : undefined;
          const text = typeof e === 'string' ? e : e ? e[g.companionCfg.preset as keyof typeof e] ?? Object.values(e)[0] : undefined;
          if (text) g.s.chatTurns.push({ role: 'assistant', content: text });
          break;
        }
        case 'food': case 'takeout': { const p = world.household.parcel; if (p) p.ready = true; break; }
        case 'furniture': case 'decor': {
          const o = (flags.dezOrders as Record<string, { type: string; col?: string }> | undefined)?.[id ?? ''];
          if (o) host.give({ object: { type: 'pbox', at: 'mark:entry.drop', id: `box.${id}`, contents: o.type, ...(o.col ? { col: o.col } : {}) } });
          break;
        }
        case 'lifeGoal': g.s.lifeGoal ??= 'a cozy life together'; break;
        case 'settle': g.s.settleDone = true; break;
        default: g.log(`A delivery arrives (${category}${id ? ' ' + id : ''}).`);
      }
    },
    release(who) { for (const id of who) { const a = actor(id); if (a && a.kind !== 'npc') a.scripted = false; } },
  };

  const problems = validateContent(SCRIPTS, LINE_BOOK, NPC_IDS);
  if (problems.length && import.meta.env.DEV) console.warn('Story content problems:\n' + problems.join('\n'));

  const engine = new ScriptEngine(host, SCRIPTS, LINE_BOOK, rt);
  ui.onSkip(() => engine.skip());
  // "Set it down" ends the placing: the piece stays where it is and Arrange closes.
  ui.onCardButton(() => { if (g.isArranging()) { g.snapSelectedToOutline(); g.drawer.close(); } });

  // A new game opens with the story. A save from before scripts existed never sees the move-in. A save in the middle of
  // a script picks up where it was.
  const noScript = run.attract || (import.meta.env.DEV && new URLSearchParams(location.search).has('noscript'));
  const isNew = world.save === null;
  if (isNew && !noScript) {
    // The first day's furniture arrives in boxes, so the house starts without it.
    const gone = world.objs.filter((o) => o.id === 'sofa' || o.id === 'plant1' || o.id === 'lamp1');
    for (const o of gone) world.objs.splice(world.objs.indexOf(o), 1);
    Object.assign(house, buildWorld(world.objs));
  }
  if (noScript) engine.markDone(['opening.', 'tutorial.']);
  else if (!hadRt) {
    if (isNew) engine.startNewGame();
    else engine.markDone(['opening.', 'tutorial.']);
  } else engine.resume();

  function update(dt: number): void {
    // What they are to the player, for scripts that branch on it (a friend moving in is a roommate).
    story.rel = g.s.voice.relationship;
    engine.tick(dt);
    // Skipping the opening ends the drive-up too.
    if (arrival && !engine.isActive()) { arrival.cancel(); arrival = null; }
    if (camFocus) {
      const a = actor(camFocus.who);
      if (a && !view.follow) {
        if (a.level !== view.level) g.setLevel(a.level, true);
        const [px, py] = art.project(a.x, a.y, 0.8);
        g.cam.tz = camFocus.zoom; g.cam.tfx = px; g.cam.tfy = py;
      }
    }
  }

  return {
    scripts: engine,
    scriptUpdate: update,
    scriptEmit(ev: GameEvent) {
      // What the player has already done stays done: a chapter that waits for it moves on at once.
      story[`did.${ev.type}`] = true;
      if (ev.type === 'obj.placed') story[`did.placed.${ev.objType}`] = true;
      if (ev.type === 'tab.opened') story[`did.tab.${ev.tab}`] = true;
      if (ev.type === 'level.visited') story[`did.level.${ev.level}`] = true;
      engine.emit(ev);
    },
  };
}
