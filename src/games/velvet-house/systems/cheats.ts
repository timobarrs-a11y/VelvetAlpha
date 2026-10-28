import { runCheat as run, setNames, type CheatHost } from '../state/cheats';
import { deposit } from '../state/finance';
import { NEED_KEYS } from '../state/needs';
import { catalogById, setQuote } from '../state/catalog';
import { isPaintable } from '../state/scenes';
import type { Game } from '../kernel/game';

/** The typed cheat codes (state/cheats.ts) applied to the house. */
export function createCheats(g: Game): Partial<Game> {
  const { world, people, view, owned, flags, log } = g;

  const host: CheatHost = {
    // Only for playing around once the story's opening is done, and never over a cutscene or a lesson.
    blocked: () => (!g.s.settleDone ? 'Finish the move-in first.' : g.s.scriptMode ? 'Not right now.' : null),
    addMoney(amount) {
      deposit(world.household, world.life, world.day, world.minutes, 'Found money', amount);
      flags.cheated = true;
      g.refreshDrawer();
    },
    fillNeeds() { for (const p of people.slice(0, 2)) for (const k of NEED_KEYS) p.needs[k] = 100; },
    addBond(amount) { g.s.bond = Math.min(100, g.s.bond + amount); return g.s.bond; },
    stockFridge() {
      const f = world.household.fridge;
      f.basic = Math.max(f.basic, 8); f.fresh = Math.max(f.fresh, 8);
      g.refreshDrawer();
    },
    decorate(theme) {
      const set = catalogById(`set-${theme}`);
      // A secret set is only ever given by its own code.
      if (!set?.set || set.secret) return `There's no "${theme}" set. Try ${setNames().join(', ')}.`;
      if (!isPaintable(view.level)) return 'Pick a floor of the house first (Basement, Main floor or Upstairs): the set\'s walls and floor go inside.';
      for (const m of setQuote(set, new Set()).members) g.handleBuy(m, undefined, true);
      owned.add(set.id);
      return `${set.name} is in.`;
    },
  };

  function runCheat(input: string): string {
    const said = run(input, host);
    log(said.split('\n')[0]);
    return said;
  }
  return { runCheat, cheatsBlocked: () => host.blocked() };
}
