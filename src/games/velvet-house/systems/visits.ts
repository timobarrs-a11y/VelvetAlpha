import { createHostHouses } from '../bridge/hostHouses';
import type { FriendHouse } from '../bridge/protocol';
import type { Game } from '../kernel/game';

/** What the Household page shows of friends' houses: the list (null until it comes), and whether the player's is open. */
export interface VisitsView {
  /** False when the game runs on its own, with no account to find friends with. */
  online: boolean;
  friends: FriendHouse[] | null;
  /** Whether friends can visit the player's house; null until known. */
  open: boolean | null;
  /** The host could not be reached the last time. */
  failed: boolean;
}

/**
 * Friends' houses, from the Household page: the friends whose houses are open, a Visit for each (the host opens the
 * house; see ui/visit.ts), and whether friends can visit the player's own.
 */
export function createVisits(g: Game): Partial<Game> {
  const host = createHostHouses();
  const view: VisitsView = { online: !!host, friends: null, open: null, failed: false };
  let loading = false;

  async function loadHouses(): Promise<void> {
    if (!host || loading) return;
    loading = true;
    const [friends, open] = await Promise.all([host.friends(), host.isOpen()]);
    loading = false;
    view.failed = friends === null;
    view.friends = friends ?? [];
    view.open = open;
    g.refreshDrawer();
  }
  function visitHouse(ownerId: string): void {
    if (!host || !view.friends?.some((f) => f.ownerId === ownerId)) return;
    // The house is saved before going, so coming home finds it as it was left.
    g.doSave();
    host.visit(ownerId);
  }
  async function setHouseOpen(open: boolean): Promise<void> {
    if (!host) return;
    const now = await host.setOpen(open);
    if (now === null) { g.log('That did not go through. Try again in a moment.'); return; }
    view.open = now;
    g.log(now ? 'Friends can visit your house.' : 'Your house is closed to visitors.');
    g.refreshDrawer();
  }
  return { visits: view, loadHouses, visitHouse, setHouseOpen };
}
