type UpdateCallback = () => void;

let updateCallbacks: UpdateCallback[] = [];
let registration: ServiceWorkerRegistration | null = null;

let refreshing = false;

export function onSWUpdate(cb: UpdateCallback) {
  updateCallbacks.push(cb);
}

export function applyUpdate() {
  if (registration?.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

export async function clearAllCachesAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (err) {
    console.warn('[SW] cache clear failed:', err);
  } finally {
    window.location.reload();
  }
}

export function installChunkErrorRecovery(): void {
  const STAMP_KEY = 'velvet_chunk_recovery_at';
  const COOLDOWN_MS = 60_000;

  const isChunkError = (msg?: string | null): boolean =>
    !!msg &&
    /(Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Importing a module script failed|Unable to preload CSS|Loading chunk [\d]+ failed)/i.test(
      msg
    );

  const recover = () => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(STAMP_KEY) || 0); } catch {}
    if (Date.now() - last < COOLDOWN_MS) return;
    try { sessionStorage.setItem(STAMP_KEY, String(Date.now())); } catch {}
    clearAllCachesAndReload();
  };

  window.addEventListener('error', (event) => {
    const msg = event?.message || (event?.error && event.error.message);
    if (isChunkError(msg)) recover();
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message;
    if (isChunkError(msg)) recover();
  });
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    registration.addEventListener('updatefound', () => {
      const newWorker = registration!.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updateCallbacks.forEach((cb) => cb());
        }
      });
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
      updateCallbacks.forEach((cb) => cb());
    }
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
  }
}
