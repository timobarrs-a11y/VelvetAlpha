import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GAME_PATH = join(process.cwd(), 'public/games/velvet-house/index.html');
const initScript = readFileSync(join(process.cwd(), 'e2e/velvet-house/deterministic.ts'), 'utf-8')
  .replace(/^\/\*\*[\s\S]*?\*\//, '')
  .replace(/^import.*$/gm, '');

// The old game only calls window.parent.postMessage when window.parent !== window.
// Serve both host and game from the same origin so postMessage works.
// Captures all 7 bridge message types including companionCreated.

test.describe('Bridge message contract — full recording', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'desktop-only');
  test.setTimeout(60_000);

  test('capture all 7 message types', async ({ page }) => {
    const gameContent = readFileSync(GAME_PATH, 'utf-8');
    const modifiedGame = gameContent.replace('<script>', `<script>${initScript}</script>\n<script>`);

    // Serve host page
    await page.route('https://localhost/bridge-host.html', (route) => {
      const html = `<!DOCTYPE html><html><head><title>Bridge Host</title></head><body>
<script>
window.__bridgeLog = [];
window.addEventListener('message', (e) => {
  if (e.data && typeof e.data === 'object' && typeof e.data.type === 'string' && e.data.type.startsWith('velvet:')) {
    window.__bridgeLog.push({ direction: 'outbound', type: e.data.type, fields: Object.keys(e.data) });
  }
});
window.__sendToGame = function(msg) {
  window.__bridgeLog.push({ direction: 'inbound', type: msg.type, fields: Object.keys(msg) });
  var iframe = document.getElementById('gameFrame');
  if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
};
</script>
<iframe id="gameFrame" src="https://localhost/velvet-house/index.html?companion=test-bridge" style="width:1280px;height:800px;border:0;"></iframe>
</body></html>`;
      route.fulfill({ body: html, contentType: 'text/html' });
    });

    // Serve game from same origin
    await page.route('https://localhost/velvet-house/index.html**', (route) => {
      route.fulfill({ body: modifiedGame, contentType: 'text/html' });
    });

    await page.goto('https://localhost/bridge-host.html');
    // Wait for the game iframe to boot and send ready
    await page.waitForFunction(() => (window as any).__bridgeLog?.some((m: any) => m.type === 'velvet:ready'), { timeout: 15_000 });

    // Step 1: Submit the setup form to trigger companionCreated.
    // This only fires when companion.source !== 'velvet', so we must NOT send
    // a velvet:profile message first — the game starts with companion.source = 'game'.
    await page.evaluate(() => {
      const iframe = document.getElementById('gameFrame') as HTMLIFrameElement;
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return;
      const form = iframeDoc.getElementById('setupForm') as HTMLFormElement;
      const suName = iframeDoc.getElementById('suName') as HTMLInputElement;
      const suPartner = iframeDoc.getElementById('suPartner') as HTMLInputElement;
      if (suName) suName.value = 'Sam';
      if (suPartner) suPartner.value = 'Riley';
      if (form) form.requestSubmit();
    });
    await page.waitForTimeout(2000);

    // Step 2: Now send a profile message to trigger profileApplied
    await page.evaluate(() => {
      (window as any).__sendToGame({
        type: 'velvet:profile',
        player: { name: 'Test', look: { skin: '#F2EEE8', hair: 'short', hairColor: '#3A2A1A', gender: 'male' } },
        companion: {
          name: 'Maya', pronoun: 'she', gender: 'female',
          personality: 'Warm, funny, curious',
          look: { skin: '#E8D5C5', hair: 'long', hairColor: '#6B4A2A', gender: 'female' },
          memories: [], likes: ['plants'], dislikes: ['mornings'],
        },
      });
    });
    await page.waitForTimeout(1500);

    // Step 3: Trigger a vidSearch
    await page.evaluate(() => {
      (window as any).__sendToGame({ type: 'velvet:vidSearch', game: 'velvet-house', query: 'test', seq: 1 });
    });
    await page.waitForTimeout(500);

    // Step 4: Send vidResults back
    await page.evaluate(() => {
      (window as any).__sendToGame({ type: 'velvet:vidResults', seq: 1, videos: [] });
    });
    await page.waitForTimeout(300);

    // Step 5: Trigger a restart message
    await page.evaluate(() => {
      (window as any).__sendToGame({ type: 'velvet:restarted', game: 'velvet-house', day: 1 });
    });
    await page.waitForTimeout(500);

    const log = await page.evaluate(() => (window as any).__bridgeLog || []);

    // Record the full contract
    const dir = join(process.cwd(), 'e2e/velvet-house');
    mkdirSync(dir, { recursive: true });
    const contract = {
      captured: log.length,
      allTypes: [...new Set(log.map((m: any) => m.type))],
      outbound: log.filter((m: any) => m.direction === 'outbound'),
      inbound: log.filter((m: any) => m.direction === 'inbound'),
      fieldSchema: log.reduce((acc: any, m: any) => {
        if (!acc[m.type]) acc[m.type] = m.fields;
        return acc;
      }, {}),
    };
    writeFileSync(join(dir, 'bridge-contract.json'), JSON.stringify(contract, null, 2));

    // Verify all 7 message types were captured
    const types = log.map((m: any) => m.type);
    expect(types).toContain('velvet:ready');
    expect(types).toContain('velvet:companionCreated');
    expect(types).toContain('velvet:profileApplied');
    expect(types).toContain('velvet:profile');
    expect(types).toContain('velvet:vidSearch');
    expect(types).toContain('velvet:vidResults');
    expect(types).toContain('velvet:restarted');
    expect(log.length).toBeGreaterThanOrEqual(7);
  });
});
