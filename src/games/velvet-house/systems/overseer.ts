import { overseerMonologue, type OverseerTrigger } from '../content/overseer';
import type { ObjectInstance } from '../state/objects';
import type { Game } from '../kernel/game';

/** How long a line stays up: a beat to read it, plus time for its length. */
export const lineSecs = (text: string): number => 1.6 + text.length * 0.055;

/**
 * The Overseer talks. One push is one monologue, line after line in its own bubble, with no reply asked for. It also
 * speaks up when the player walks in, wakes up or cooks within earshot. Its lines are written (content/overseer.ts);
 * it never goes through the companion chat and never touches story flags.
 */
export function createOverseer(g: Game): Partial<Game> {
  const { world, people, view, art } = g;
  const HEAR = 4.5;
  const busyUntil = new Map<string, number>();
  const recent = new Map<string, string[]>();
  let near = new Set<string>();
  let lastTask = '';
  let wasAsleep = false;
  let quietUntil = 0;

  const overseers = (): ObjectInstance[] => world.objs.filter((o) => o.type === 'overseer');
  const distTo = (o: ObjectInstance, x: number, y: number) => Math.hypot(o.x + 0.3 - x, o.y + 0.3 - y);

  function speak(obj: ObjectInstance, trigger: OverseerTrigger, force = false): void {
    if (!force && (view.t < (busyUntil.get(obj.id) ?? 0) || view.t < quietUntil)) return;
    const lines = overseerMonologue(trigger, Math.random, trigger === 'enter' ? 3 : 4, recent.get(obj.id));
    recent.set(obj.id, lines);
    art.objectSay(obj.id, lines);
    busyUntil.set(obj.id, view.t + lines.reduce((s, l) => s + lineSecs(l), 0));
    // A moment of peace between monologues it starts on its own.
    if (!force) quietUntil = view.t + 45;
  }

  function overseerAction(obj: ObjectInstance, act: string): void {
    const trigger: OverseerTrigger = act === 'overseerCake' ? 'cake' : act === 'overseerUnplug' ? 'unplug' : 'idle';
    speak(obj, trigger, true);
  }

  // What the player is doing near it: walking in, waking up, cooking.
  function overseerTick(): void {
    if (g.s.scriptMode === 'cutscene' || g.s.scriptMode === 'guided') return;
    const me = people[0];
    const here = overseers().filter((o) => o.level === me.level && !me.away && distTo(o, me.x, me.y) < HEAR);
    const nowNear = new Set(here.map((o) => o.id));
    const task = me.task?.phase === 'do' ? me.task.act : '';
    const asleep = task === 'sleep' || task === 'nap';
    for (const o of here) {
      if (!near.has(o.id)) speak(o, 'enter');
      else if (wasAsleep && !asleep) speak(o, 'sleep');
      else if (task === 'cook' && lastTask !== 'cook') speak(o, 'cook');
    }
    near = nowNear;
    lastTask = task;
    wasAsleep = asleep;
  }

  return { overseerAction, overseerTick };
}
