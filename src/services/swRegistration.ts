type UpdateCallback = () => void;

let updateCallbacks: UpdateCallback[] = [];
let registration: ServiceWorkerRegistration | null = null;

// Guards against a service-worker update triggering an endless reload loop.
// `controllerchange` can fire more than once (notably on iOS Safari), so we
// only ever honor the first reload.
let refreshing = false;

export function onSWUpdate(cb: UpdateCallback) {
  updateCallbacks.push(cb);
}

export function applyUpdate() {
  if (registration?.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

/**
 * Nuke every service worker and cache, then hard-reload. This is the recovery
 * path for a device stuck on a stale deploy — e.g. iOS Safari holding an old
 * service worker whose cache points at JS/CSS chunks that no longer exist after
 * a new build. Without this, such a device serves a broken mix of old and new
 * assets and never fully loads.
 */
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

/**
 * Detects the "stale deploy" failure mode: a dynamically-imported route chunk
 * fails to load because its hashed filename changed under a cached index.html.
 * When that happens we self-heal once (clear caches + reload) instead of leaving
 * the user stuck on a spinner. A sessionStorage stamp prevents reload loops if
 * the reload doesn't fix it.
 */
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
    try {
      last = Number(sessionStorage.getItem(STAMP_KEY) || 0);
    } catch {
      /* sessionStorage may be unavailable in private mode */
    }
    if (Date.now() - last < COOLDOWN_MS) return; // already tried recently
    try {
      sessionStorage.setItem(STAMP_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
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

  // Reload exactly once when a new service worker takes control, so the page
  // isn't left running against stale assets. The `refreshing` guard prevents
  // the reload loops iOS is prone to.
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
