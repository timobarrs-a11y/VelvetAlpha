type UpdateCallback = () => void;

let updateCallbacks: UpdateCallback[] = [];
let registration: ServiceWorkerRegistration | null = null;

export function onSWUpdate(cb: UpdateCallback) {
  updateCallbacks.push(cb);
}

export function applyUpdate() {
  if (registration?.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) return;

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

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    if (registration.waiting && navigator.serviceWorker.controller) {
      updateCallbacks.forEach((cb) => cb());
    }
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
  }
}
