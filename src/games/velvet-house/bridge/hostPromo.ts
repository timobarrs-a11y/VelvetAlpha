// Claiming a promo code for the account when the game runs inside the Velvet app: it asks the host page, which holds
// the account, and waits for the answer. Standalone (no parent page) there is no account to claim it for.
import { isPromoResultMessage, postToParent } from './protocol';

const TIMEOUT_MS = 5_000;

/** 'ok': theirs (first use on the account, or again for this same house). 'used': already used in another house. */
export type PromoAnswer = 'ok' | 'used';
export type PromoClaim = (code: string) => Promise<PromoAnswer>;

export function createHostPromo(): PromoClaim | null {
  try { if (!window.parent || window.parent === window) return null; } catch { return null; }
  let seq = 0;
  const pending = new Map<number, (a: PromoAnswer) => void>();

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== window.location.origin) return;
    if (!isPromoResultMessage(e.data)) return;
    const done = pending.get(e.data.seq);
    if (!done) return;
    pending.delete(e.data.seq);
    done(e.data.status === 'used' ? 'used' : 'ok');
  });

  // No answer (offline, or the host is busy): during the alpha the code still works rather than being lost.
  return (code: string) => new Promise<PromoAnswer>((resolve) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); resolve('ok'); }, TIMEOUT_MS);
    pending.set(id, (a) => { clearTimeout(timer); resolve(a); });
    postToParent({ type: 'velvet:promo', game: 'velvet-house', seq: id, code });
  });
}
