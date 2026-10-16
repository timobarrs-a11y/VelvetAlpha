/**
 * Velvet House game entry point.
 * This is the Vite-built replacement for the static HTML file.
 * Currently a minimal stub — the full game code migrates here in Phase 1.
 */
import { RNG } from './state/rng';
import { migrateSave } from './state/saveMigration';
import { postToParent, isProfileMessage, isValidOrigin } from './bridge/protocol';

const VELVET_COMPANION_ID = (() => {
  try {
    return new URLSearchParams(location.search).get('companion') || '';
  } catch {
    return '';
  }
})();

const SAVE_KEY = VELVET_COMPANION_ID
  ? `velvet-house-v1:${VELVET_COMPANION_ID}`
  : 'velvet-house-v1';

const _rng = new RNG(Date.now() >>> 0);
void _rng;

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;

  // Load existing save
  let loaded = false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const migrated = migrateSave(JSON.parse(raw));
      if (migrated) loaded = true;
    }
  } catch {
    // ignore
  }

  // Minimal UI: a placeholder canvas
  app.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#1a1a22;color:#888;font-family:Inter,sans-serif;">
      <div style="text-align:center">
        <p style="font-size:1.2rem;margin-bottom:.5rem">Velvet House</p>
        <p style="font-size:.85rem;opacity:.6">${loaded ? 'Save loaded' : 'New game'} · companion: ${VELVET_COMPANION_ID || 'none'}</p>
      </div>
    </div>
  `;

  // Bridge: announce ready
  postToParent({ type: 'velvet:ready', game: 'velvet-house', day: 1, needsProfile: true });

  // Listen for profile messages
  const allowedOrigins: string[] = (() => {
    try {
      const origin = new URL(document.referrer).origin;
      return origin ? [origin] : [];
    } catch {
      return [];
    }
  })();

  window.addEventListener('message', (e: MessageEvent) => {
    if (!isValidOrigin(e.origin, allowedOrigins)) return;
    if (!isProfileMessage(e.data)) return;
    // Profile received — full handling comes with the game code migration
    postToParent({
      type: 'velvet:profileApplied',
      game: 'velvet-house',
      day: 1,
      player: (e.data as { player?: { name?: string } }).player?.name || '',
      companion: (e.data as { companion?: { name?: string } }).companion?.name || '',
    });
  });
}

boot();
