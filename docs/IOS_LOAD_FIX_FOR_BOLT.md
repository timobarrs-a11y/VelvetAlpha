# iOS load fix — instructions for Bolt

**Symptom:** After today's deploy the app loads very slowly on iOS and never
finishes — only the background, floating shapes, the "Project Velvet" logo and
"Sign In" appear, and nothing is tappable. Android works fine.

**Root cause (in priority order):**

1. **Stale service-worker cache after deploy (the regression).** Today's deploy
   bumped `CACHE_VERSION` in `public/sw.js` (`v3` → `v4`) and shipped new hashed
   JS/CSS chunk filenames. iOS Safari clings to the old service worker, which
   serves a stale `index.html` / old chunks, so a lazy-loaded route chunk fails
   to import. React's `<Suspense>` then spins forever. The registration code
   also reloads on `controllerchange` with no guard, which can loop on iOS.
   Android updated its service worker cleanly (or visited fresh), so it was
   unaffected. **This is why it worked yesterday and broke today with no change
   to the page itself.**
2. **`crypto.randomUUID()` runs at startup.** It's `undefined` on iOS Safari
   < 15.4 and in non-secure contexts, and it's called in a module-level
   singleton before React mounts → white screen on those devices.
3. **Splash page is very GPU-heavy on mobile** (giant `blur()` radii, 55 looped
   particles, stacked `backdrop-filter`). Not the regression, but it makes iOS
   fragile; worth lightening.

Apply all three. #1 is the one that fixes today's breakage and, crucially,
**auto-recovers devices that are currently stuck.**

---

## 1) Service worker: self-heal + no reload loop  ← primary fix

### 1a. `src/services/swRegistration.ts`

Add a reload guard, a cache-clearing recovery helper, and a chunk-error
listener. Replace the file's contents with:

```ts
type UpdateCallback = () => void;

let updateCallbacks: UpdateCallback[] = [];
let registration: ServiceWorkerRegistration | null = null;

// Prevents a service-worker update from causing an endless reload loop.
// controllerchange can fire more than once (notably on iOS Safari).
let refreshing = false;

export function onSWUpdate(cb: UpdateCallback) {
  updateCallbacks.push(cb);
}

export function applyUpdate() {
  if (registration?.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

// Recovery path for a device stuck on a stale deploy (e.g. iOS holding an old
// service worker whose cache points at chunks that no longer exist).
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

// Detects a failed dynamic route-chunk import (stale deploy) and self-heals once.
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
    if (Date.now() - last < COOLDOWN_MS) return; // avoid reload loops
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
```

### 1b. `src/main.tsx`

Import and call the recovery installer before `registerSW()`:

```ts
import { registerSW, installChunkErrorRecovery } from './services/swRegistration';

// ...existing error listeners...

installChunkErrorRecovery();
registerSW();
```

### 1c. `public/sw.js`

Bump the cache version once more so every client picks up the corrected update
flow and drops the broken caches:

```js
const CACHE_VERSION = 'v5';
```

---

## 2) Guard `crypto.randomUUID()` at startup

### 2a. New file `src/utils/uuid.ts`

```ts
export function safeRandomUUID(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;

  if (c && typeof c.randomUUID === 'function') {
    try { return c.randomUUID(); } catch {}
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex: string[] = [];
    for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));
    return (
      hex[bytes[0]] + hex[bytes[1]] + hex[bytes[2]] + hex[bytes[3]] + '-' +
      hex[bytes[4]] + hex[bytes[5]] + '-' +
      hex[bytes[6]] + hex[bytes[7]] + '-' +
      hex[bytes[8]] + hex[bytes[9]] + '-' +
      hex[bytes[10]] + hex[bytes[11]] + hex[bytes[12]] +
      hex[bytes[13]] + hex[bytes[14]] + hex[bytes[15]]
    );
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

### 2b. Replace every `crypto.randomUUID()` call with `safeRandomUUID()`

Add `import { safeRandomUUID } from '<relative path>/utils/uuid';` and swap the
calls in at least these files (the startup ones are the critical path):

- `src/services/monitoringService.ts` (**startup singleton — most important**);
  also wrap its `sessionStorage` access in `try/catch`.
- `src/services/analyticsService.ts`
- `src/App.tsx`
- `src/components/NaviOnboardingModal.tsx`
- `src/components/CalendarNaviPanel.tsx`

(The insight generators already guard it — leave those.)

For `monitoringService.ts`, make `initSessionId` fully defensive:

```ts
private initSessionId(): string {
  try {
    const existing = sessionStorage.getItem('velvet_session_id');
    if (existing) return existing;
    const id = safeRandomUUID();
    sessionStorage.setItem('velvet_session_id', id);
    return id;
  } catch {
    return safeRandomUUID();
  }
}
```

---

## 3) Lighten the Splash page on touch devices (defensive)

In `src/pages/SplashPage.tsx`, add a "lite" flag and use it to cut GPU cost and
guarantee content paints even if animations stall.

```ts
import { useMemo } from 'react'; // add to existing react import

const lite = useMemo(
  () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches,
  []
);
const orbBlur = (b: number) => (lite ? Math.min(b, 36) : b);
const enter = (from: Record<string, number>) => (lite ? false : from);
```

Then, when `lite` is true:

- **Orbs:** use `blur(${orbBlur(ORBS[i].blur)}px)` and set the animated orbs'
  `animate={lite ? undefined : {...}}`.
- **Particles:** render them only when `!lite` — `{!lite && PARTICLES.map(...)}`.
- **backdrop-filter:** set to `lite ? undefined : 'blur(...)'` on the top bar,
  sign-in button, the "Now in Early Access" pill, and the feature cards (bump
  the top-bar background to `rgba(7,9,15,0.92)` when lite so it stays legible).
- **Headline:** glow layer `filter: lite ? 'blur(24px)' : 'blur(60px)'`; the
  animated gradient span `animate={lite ? undefined : {...}}`; the pill shimmer
  `animate={lite ? undefined : {...}}`.
- **Entrance animations:** change every hero/divider/card `initial={{ opacity: 0, ... }}`
  to `initial={enter({ opacity: 0, ... })}`. For the feature cards also use
  `animate={(lite || isVisible) ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}`.
  `initial={false}` makes framer-motion render the element in its final visible
  state, so content shows immediately even if the animation loop is starved.

(Optionally apply the same lite treatment to `src/pages/WelcomePage.tsx`, which
uses the identical heavy pattern and is what a *logged-in* iOS user lands on.)

---

## How to verify on iOS

1. Deploy.
2. On a broken iPhone, load the site once — the chunk-recovery will clear the
   stale cache and reload automatically; the second load should be correct.
   (To simulate a clean device: Settings → Safari → Advanced → Website Data →
   remove the site, or use a Private tab.)
3. Confirm the hero, "Create Account" / "Enter Project Velvet" buttons and the
   feature cards render and are tappable.
