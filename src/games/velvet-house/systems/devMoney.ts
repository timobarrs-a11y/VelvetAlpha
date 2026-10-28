import { parseFund } from '../state/devMoney';
import { deposit } from '../state/finance';
import type { Game } from '../kernel/game';

/** The developer's money phrase (state/devMoney.ts) applied to the house. */
export function createDevMoney(g: Game): Partial<Game> {
  const { world, flags, log } = g;

  /** True if `text` was the phrase (and the money has been added), so chat should not handle it. */
  function tryDevMoney(text: string): boolean {
    const amount = parseFund(text);
    if (amount === null) return false;
    deposit(world.household, world.life, world.day, world.minutes, 'Found money', amount);
    // The same mark the console's money leaves: the Salon (whose items stay with the player's account) won't take it.
    flags.cheated = true;
    log(`+$${amount}`);
    g.refreshDrawer();
    return true;
  }
  return { tryDevMoney };
}
