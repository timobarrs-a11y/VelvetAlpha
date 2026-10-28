// Friends' houses when the game runs inside the Velvet app: it asks the host page, which holds the account, and waits
// for the answer. Standalone (no parent page) there are no friends to visit.
import { isHousesResultMessage, postToParent, type FriendHouse, type HouseOp } from './protocol';

const TIMEOUT_MS = 8_000;

export interface HostHouses {
  /** The friends whose houses are open to the player, newest played first; null when the host could not say. */
  friends(): Promise<FriendHouse[] | null>;
  /** Whether friends can visit the player's house; null when the host could not say. */
  isOpen(): Promise<boolean | null>;
  /** Opens or closes the player's house to friends; the answer, or null when it did not go through. */
  setOpen(open: boolean): Promise<boolean | null>;
  /** Goes to a friend's house (the host opens it). */
  visit(ownerId: string): void;
}

export function createHostHouses(): HostHouses | null {
  try { if (!window.parent || window.parent === window) return null; } catch { return null; }
  let seq = 0;
  const pending = new Map<number, (ok: boolean, data: unknown) => void>();

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== window.location.origin) return;
    if (!isHousesResultMessage(e.data)) return;
    const done = pending.get(e.data.seq);
    if (!done) return;
    pending.delete(e.data.seq);
    done(e.data.ok, e.data.data);
  });

  const ask = (op: HouseOp, open?: boolean) => new Promise<{ ok: boolean; data: unknown }>((resolve) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, data: null }); }, TIMEOUT_MS);
    pending.set(id, (ok, data) => { clearTimeout(timer); resolve({ ok, data }); });
    postToParent({ type: 'velvet:houses', game: 'velvet-house', seq: id, op, ...(open === undefined ? {} : { open }) });
  });
  const isHouse = (h: unknown): h is FriendHouse => !!h && typeof h === 'object' && typeof (h as FriendHouse).ownerId === 'string' && typeof (h as FriendHouse).name === 'string';

  return {
    async friends() { const r = await ask('friends'); return r.ok && Array.isArray(r.data) ? r.data.filter(isHouse) : null; },
    async isOpen() { const r = await ask('open'); return r.ok && typeof r.data === 'boolean' ? r.data : null; },
    async setOpen(open) { const r = await ask('setOpen', open); return r.ok && typeof r.data === 'boolean' ? r.data : null; },
    visit(ownerId) { postToParent({ type: 'velvet:visit', game: 'velvet-house', owner: ownerId }); },
  };
}
