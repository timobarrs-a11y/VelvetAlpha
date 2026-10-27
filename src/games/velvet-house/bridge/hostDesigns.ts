// The game's way to share garment designs when it runs inside the Velvet app: it asks the host page, which holds the
// account, and waits for the answer. Standalone (no parent page) there is nothing to share with.
import { isDesignsResultMessage, postToParent, type DesignOp } from './protocol';

const TIMEOUT_MS = 20_000;

export interface DesignsAnswer<T = unknown> { ok: boolean; data?: T; error?: string }
export type DesignsClient = <T = unknown>(op: DesignOp, args?: Record<string, string | number | boolean>) => Promise<DesignsAnswer<T>>;

export function createHostDesigns(): DesignsClient | null {
  try { if (!window.parent || window.parent === window) return null; } catch { return null; }
  let seq = 0;
  const pending = new Map<number, (a: DesignsAnswer) => void>();

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== window.location.origin) return;
    if (!isDesignsResultMessage(e.data)) return;
    const done = pending.get(e.data.seq);
    if (!done) return;
    pending.delete(e.data.seq);
    done({ ok: e.data.ok, data: e.data.data, error: e.data.error });
  });

  return <T>(op: DesignOp, args?: Record<string, string | number | boolean>) => new Promise<DesignsAnswer<T>>((resolve) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: 'unavailable' }); }, TIMEOUT_MS);
    pending.set(id, (a) => { clearTimeout(timer); resolve(a as DesignsAnswer<T>); });
    postToParent({ type: 'velvet:designs', game: 'velvet-house', seq: id, op, ...(args ? { args } : {}) });
  });
}
