import { parseConcerns, evaluateConcerns, moodOf, hardPassOf, worstConcern, bondDrift, type ConcernsState, type ConcernKind, type ConcernLevel, type Mood } from '../state/concerns';
import type { Game } from '../kernel/game';

/**
 * Connects the concerns (state/concerns.ts) to the running house: reads the fridge, the bills, the sink and the
 * laundry, raises and clears concerns as events the story scripts answer (she comes over, the chat opens), moves the
 * bond, and keeps her face honest. Nothing here speaks; the lines come from the banks through the scripts and the chat.
 */
export interface ConcernContext { kind: ConcernKind; level: ConcernLevel; hours: number; mood: Mood }

export function createConcerns(g: Game): Partial<Game> {
  const { world, people, flags, art } = g;
  const state: ConcernsState = parseConcerns(flags.concerns);
  flags.concerns = state;
  let clock = 0;

  function concernsTick(gameMin: number): void {
    if (gameMin <= 0) return;
    g.s.bond = bondDrift(g.s.bond, state, gameMin);
    clock += gameMin;
    if (clock < 1) return;
    clock = 0;
    const h = world.household;
    const absMin = world.day * 1440 + world.minutes;
    const signals = {
      servings: h.fridge.basic + h.fridge.fresh,
      starving: people.slice(0, 2).some((p) => p.needs.food < 15),
      overdue: world.life.bills.some((b) => b.overdue),
      dishes: h.dishes,
      laundry: h.laundryPile,
    };
    // The tutorial teaches these systems one by one; she only starts holding the house against the player after it.
    const ev = evaluateConcerns(state, signals, absMin, world.day, g.s.settleDone);
    for (const r of ev.raised) g.scriptEmit({ type: 'concern.raised', kind: r.kind, level: r.level });
    for (const kind of ev.cleared) g.scriptEmit({ type: 'concern.cleared', kind });
    // Her expression: the bond, pulled down by how she feels about the house.
    const mood = moodOf(state);
    art.setMood(Math.min(g.s.bond / 100, mood === 'upset' ? 0.15 : mood === 'worried' ? 0.35 : mood === 'unsettled' ? 0.55 : 1));
  }

  const concernMood = (): Mood => moodOf(state);
  const hardPass = (): ConcernKind | null => hardPassOf(state);
  function concernContext(): ConcernContext | null {
    const w = worstConcern(state, world.day * 1440 + world.minutes);
    return w ? { ...w, mood: moodOf(state) } : null;
  }

  /** A concern was raised: she opens the chat with her line, or closes the door (the hard pass). */
  function openConcernChat(id: string): void {
    const [kind, level] = id.split('.') as [ConcernKind, string];
    const text = g.scripts.text({ bank: 'humor', slot: `concern.${kind}.${level}` });
    if (Number(level) >= 3) { g.openChat(); return; }
    // Her line is hers: it goes into the conversation as something she said, and the chat carries on from it.
    g.s.chatTurns = [...g.s.chatTurns, { role: 'assistant' as const, content: text }].slice(-16);
    g.openChat();
  }

  return { concernsTick, concernMood, hardPass, concernContext, openConcernChat };
}
