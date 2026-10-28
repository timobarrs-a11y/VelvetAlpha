// Promo codes and the player's account, when the game runs inside the Velvet app. A code redeemed in one house is the
// account's: the host records it, and tells every house the account's codes when it opens, so each one has the packs.
// Standalone (no parent page) there is no account: a code just works in the house it was typed in.
import { isAccountPromosMessage, postToParent } from './protocol';

export interface HostPromo {
  /** Tell the host a code was redeemed here, so the account has it. */
  record(code: string): void;
  /** Called with the account's codes whenever the host sends them. */
  onAccountCodes(cb: (codes: string[]) => void): void;
}

export function createHostPromo(): HostPromo | null {
  try { if (!window.parent || window.parent === window) return null; } catch { return null; }
  const listeners: Array<(codes: string[]) => void> = [];
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== window.location.origin) return;
    if (!isAccountPromosMessage(e.data)) return;
    for (const cb of listeners) cb(e.data.codes);
  });
  return {
    record: (code) => postToParent({ type: 'velvet:promo', game: 'velvet-house', code }),
    onAccountCodes: (cb) => { listeners.push(cb); },
  };
}
