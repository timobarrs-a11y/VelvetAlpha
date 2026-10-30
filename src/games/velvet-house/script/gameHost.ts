import type { Game } from '../kernel/game';
import { startGoto, placeAgent, startChain, createNpc, buildWorld, type Agent } from '../state/agents';
import { deposit } from '../state/finance';
import { TYPES, kindOf, type ObjectInstance } from '../state/objects';
import { relocate } from '../state/arrange';
import { npcDef, NPC_IDS } from '../content/characters';
import { MARKS, type Spot } from '../content/marks';
import { SCRIPTS } from '../content/scripts';
import { LINE_BOOK } from '../content/lines';
import { validateContent } from './validate';
import { ScriptEngine } from './engine';
import { NEW_RUNTIME, type Cond, type FlagValue, type Mode, type GameEvent, type PlaceRef, type ScriptHost, type ScriptRuntime, type UiTarget, type WorldCond } from './types';
import { run, IS_DEMO } from '../kernel/config';
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
    // A person is a place: next to them.
    const who = actor(ref);
    if (who) return { level: who.level, x: who.x + 0.6, y: who.y + 0.2 };
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
  /** What the partner says if Set it down is pressed with the piece somewhere else (from the card step). */
  let misplacedLine: { who: string; text: string } | null = null;
  /** The mode the script asked for, and the wait the card on screen asks the player to finish (see `applyLock`). */
  let declared: Mode | null = null;
  let cardWait: Cond | null = null;
  const host: ScriptHost = {
    flags: story,
    clock: () => ({ day: world.day, minutes: world.minutes }),
    names: () => ({ player: g.simName, partner: g.partnerName, town: g.townName, preset: g.companionCfg.preset, humor: g.s.voice.humor, communication: g.s.voice.communication, relationship: g.s.voice.relationship, gender: g.s.voice.gender }),

    setMode(mode, allow) {
      declared = mode;
      g.s.scriptAllow = allow;
      ui.spotlight([...spot, ...allow.filter((a) => !a.startsWith('obj'))]);
      art.spotlight(allow.filter((a) => a.startsWith('obj:')).map((a) => a.slice(4)));
      if (!mode) { camFocus = null; }
      applyLock();
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
      // Several things at once (the partner and the lamp): frame them all, as close as fits.
      if (Array.isArray(focus)) {
        camFocus = null;
        const pts: Array<[number, number]> = [];
        for (const f of focus) {
          const a = typeof f === 'string' ? actor(f) : undefined;
          const s = a ? { x: a.x, y: a.y, level: a.level } : resolve(f);
          if (s && s.level === view.level) pts.push(art.project(s.x, s.y, 0.7));
        }
        if (pts.length) g.frameView(pts, zoom ?? 1.8, 0.6);
        return;
      }
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
    showCard(title, body, spotlight, button, misplaced) {
      ui.card(title, body, button);
      // What the card asks for: the wait that follows it. Once that is done, the card and its objective bar go.
      cardWait = engine.upcomingWait();
      // A new objective that is not about moving a piece (tap the lamp, open a box) closes Arrange once, so the tap
      // reaches the house instead of picking the piece up. Carrying to another floor or into an outline keeps it open.
      if (cardWait && !asksToMove(cardWait) && g.isArranging()) g.drawer.close();
      misplacedLine = misplaced ?? null;
      spot = spotlight && !spotlight.startsWith('obj') ? [spotlight] : [];
      ui.spotlight([...spot, ...(g.s.scriptAllow ?? []).filter((a) => !a.startsWith('obj'))]);
      if (spotlight?.startsWith('obj:')) art.spotlight([spotlight.slice(4)]);
    },
    cardDone: () => ui.cardDone(),
    highlight(target) {
      if (!target) misplacedLine = null;
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
          const inst: ObjectInstance = { id: o.id ?? `${o.type}-${Date.now() & 0xffff}`, type: o.type, level: at.level, x: at.x, y: at.y, rot: 0, ...(o.contents ? { contents: o.contents } : {}), ...(o.col ? { col: o.col } : {}), ...(o.skin ? { skin: o.skin } : {}) };
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
          const o = (flags.dezOrders as Record<string, { type: string; col?: string; skin?: string }> | undefined)?.[id ?? ''];
          if (o) host.give({ object: { type: 'pbox', at: 'mark:entry.drop', id: `box.${id}`, contents: o.type, ...(o.col ? { col: o.col } : {}), ...(o.skin ? { skin: o.skin } : {}) } });
          break;
        }
        case 'concernChat': g.openConcernChat(id ?? ''); break;
        case 'lifeGoal': g.s.lifeGoal ??= 'a cozy life together'; break;
        case 'settle': g.s.settleDone = true; break;
        default: g.log(`A delivery arrives (${category}${id ? ' ' + id : ''}).`);
      }
    },
    release(who) { for (const id of who) { const a = actor(id); if (a && a.kind !== 'npc') a.scripted = false; } },
    hold(who) { for (const id of who) { const a = actor(id); if (a && a.kind !== 'npc') { a.scripted = true; a.task = null; } } },
    ready: (what) => g.s.hostReady[what],
    // Is the house the way a beat needs it?
    check(w: WorldCond) {
      const o = world.objs.find((q) => q.id === w.obj);
      if (w.exists !== undefined) return !!o === w.exists;
      if (!o) return false;
      // A piece in hand, or let go of but not set down, is nowhere yet.
      if (g.inHand() === o.id) return false;
      // Any model of a piece is that piece: a chest freezer is the fridge.
      if (w.is && o.type !== w.is && kindOf(o.type) !== w.is) return false;
      if (w.level !== undefined && o.level !== w.level) return false;
      if (w.at) {
        const s = resolve(w.at);
        if (!s || o.level !== s.level || Math.hypot(o.x - s.x, o.y - s.y) > (w.within ?? 0.6)) return false;
      }
      if (w.rot !== undefined && o.rot !== w.rot) return false;
      if (w.lightOn !== undefined && art.objectLightOn(o.id) !== w.lightOn) return false;
      return true;
    },
  };

  const problems = validateContent(SCRIPTS, LINE_BOOK, NPC_IDS);
  if (problems.length && import.meta.env.DEV) console.warn('Story content problems:\n' + problems.join('\n'));

  const engine = new ScriptEngine(host, SCRIPTS, LINE_BOOK, rt);
  /** Whether a condition asks for a piece to be somewhere: a mark, or another floor. */
  const asksToMove = (c: Cond): boolean => ('world' in c ? !!c.world.at || c.world.level !== undefined : 'all' in c ? c.all.some(asksToMove) : 'any' in c ? c.any.some(asksToMove) : 'not' in c ? asksToMove(c.not) : false);
  const sameCond = (a: Cond | null, b: Cond | null): boolean => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
  /** Whether the objective the card asked for is still open. */
  const objectiveOpen = (): boolean => !!cardWait && sameCond(engine.waitingOn(), cardWait);
  // Got it: the card folds into the objective bar while its objective is open. A card's own button (when a card has
  // one) is the same as the Arrange bar's Set it down.
  ui.onCardDismissed((own) => {
    if (own && g.isArranging()) g.setDown();
    if (objectiveOpen()) ui.showObjective();
  });

  /**
   * The one rule for what the player can touch, like a handheld RPG: while the story is telling something (a line to
   * tap through, a choice, the drive-up, or a cutscene moving people about) only that can be tapped and the clock holds
   * still. The rest of the time, a lesson waiting on an objective included, the whole game is the player's: every
   * button, every piece, the clock. Nothing waits on a button to be pressed; the objective moves the story on when it
   * is done, and if it never is, nothing else is held up.
   */
  function applyLock(): void {
    let mode: Mode | null = null;
    if (engine.isActive() && declared) {
      const k = engine.blockedOn();
      const telling = k === 'choice' || k === 'intro' || (k === 'say' && !ui.sayDone()) || (declared === 'cutscene' && k !== 'until' && k !== 'card');
      mode = telling ? 'cutscene' : 'beat';
    }
    if (mode !== g.s.scriptMode) {
      // The story takes the stage: Arrange closes, and a card still up folds away (its bar stays while it is open).
      if (mode === 'cutscene') {
        if (g.isArranging()) g.drawer.close();
        if (ui.cardOpen()) { if (objectiveOpen()) ui.showObjective(); else ui.hideCard(); }
      }
      g.s.scriptMode = mode;
      ui.setMode(mode);
    }
    g.s.storyCard = ui.cardOpen();
  }

  // A new game opens with the story. A save from before scripts existed never sees the move-in. A save in the middle of
  // a script picks up where it was.
  // The demo is a sandbox: no opening, no Dez, no lessons. Every script counts as done.
  const noScript = run.attract || run.visit || IS_DEMO || (import.meta.env.DEV && new URLSearchParams(location.search).has('noscript'));
  const isNew = world.save === null;
  if (isNew && !noScript) {
    // The first day's furniture arrives in boxes, so the house starts without it.
    const boxed = new Set(['sofa', 'plant1', 'lamp1', 'bed', 'fridge', 'dining', 'tread']);
    const gone = world.objs.filter((o) => boxed.has(o.id));
    for (const o of gone) world.objs.splice(world.objs.indexOf(o), 1);
    Object.assign(house, buildWorld(world.objs));
    // Nothing to eat yet: the first order is a lesson.
    world.household.fridge.basic = 0; world.household.fridge.fresh = 0;
  }
  if (noScript) engine.markDone(IS_DEMO ? [''] : ['opening.', 'tutorial.']);
  else if (!hadRt) {
    if (isNew) engine.startNewGame();
    else engine.markDone(['opening.', 'tutorial.']);
  } else engine.resume();


  function update(dt: number): void {
    // What they are to the player, for scripts that branch on it (a friend moving in is a roommate).
    story.rel = g.s.voice.relationship;
    engine.tick(dt);
    // The objective is done (or the scene stepped aside): its card and bar go. A card with its own button waits for it.
    if (cardWait && engine.blockedOn() !== 'card' && !objectiveOpen()) { cardWait = null; ui.hideCard(); }
    applyLock();
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
      // A piece set down somewhere other than where the lesson asks: the partner says so, in her own way, and the
      // lesson stays open (the wait on the world is still there).
      if (ev.type === 'obj.placed' && misplacedLine) {
        const w = engine.pendingWait();
        if (w && !engine.eval(w, 0)) { host.say(misplacedLine.who, misplacedLine.text, false); story['did.lesson.misplaced'] = true; }
      }
      // What the player has already done stays done: a chapter that waits for it moves on at once.
      story[`did.${ev.type}`] = true;
      if (ev.type === 'obj.placed') story[`did.placed.${ev.objType}`] = true;
      if (ev.type === 'tab.opened') story[`did.tab.${ev.tab}`] = true;
      if (ev.type === 'level.visited') story[`did.level.${ev.level}`] = true;
      engine.emit(ev);
    },
  };
}
