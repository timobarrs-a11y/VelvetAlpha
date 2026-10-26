// The game's way to ask for an AI reply when it runs inside the Velvet app:
// it posts the prompt to the host page, which holds the account and calls the
// backend, and waits for the answer. Standalone (no parent page) there is none.
import { isSampleResultMessage, postToParent } from './protocol';
import type { SampleFn } from '../state/companionAI';

const TIMEOUT_MS = 60_000;

export function createHostSample(): SampleFn | null {
  try { if (!window.parent || window.parent === window) return null; } catch { return null; }
  let seq = 0;
  const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void; done: () => void }>();

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== window.location.origin) return;
    if (!isSampleResultMessage(e.data)) return;
    const p = pending.get(e.data.seq);
    if (!p) return;
    p.done();
    if (typeof e.data.text === 'string') p.resolve(e.data.text);
    else p.reject(new Error(e.data.error ?? 'unavailable'));
  });

  return (input, opts) => new Promise<string>((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('unavailable')); }, TIMEOUT_MS);
    const onAbort = () => {
      if (!pending.delete(id)) return;
      clearTimeout(timer);
      postToParent({ type: 'velvet:sampleCancel', game: 'velvet-house', seq: id });
      reject(new Error('cancelled'));
    };
    const done = () => { clearTimeout(timer); pending.delete(id); opts?.signal?.removeEventListener('abort', onAbort); };
    pending.set(id, { resolve, reject, done });
    opts?.signal?.addEventListener('abort', onAbort);
    postToParent({ type: 'velvet:sample', game: 'velvet-house', seq: id, input });
  });
}
