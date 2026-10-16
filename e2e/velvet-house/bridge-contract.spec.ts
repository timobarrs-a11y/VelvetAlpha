import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GAME_URL = 'file://' + join(process.cwd(), 'public/games/velvet-house/index.html');

const initScript = readFileSync(join(process.cwd(), 'e2e/velvet-house/deterministic.ts'), 'utf-8')
  .replace(/^\/\*\*[\s\S]*?\*\//, '')
  .replace(/^import.*$/gm, '');

// Record all bridge message types by running the game in an iframe context
// and intercepting postMessage calls.

test.describe('Bridge message contract — full recording', () => {
  test.setTimeout(60_000);

  test('capture all 7 message types', async ({ page }) => {
    const gamePath = join(process.cwd(), 'public/games/velvet-house/index.html');
    const gameContent = readFileSync(gamePath, 'utf-8');

    await page.addInitScript(initScript);
    await page.route('**/velvet-house/index.html*', (route) => {
      // Inject a bridge logger that patches postMessage to capture all velvet: messages
      const modified = gameContent.replace(
        '<script>',
        `<script>
          window.__bridgeLog = [];
          const __origPM = window.postMessage.bind(window);
          window.postMessage = function(msg, origin) {
            if (msg && typeof msg === 'object' && typeof msg.type === 'string' && msg.type.startsWith('velvet:')) {
              window.__bridgeLog.push({ direction: 'outbound', type: msg.type, fields: Object.keys(msg) });
            }
            return __origPM(msg, origin);
          };
          // Intercept inbound messages too
          window.addEventListener('message', (e) => {
            if (e.data && typeof e.data === 'object' && typeof e.data.type === 'string' && e.data.type.startsWith('velvet:')) {
              window.__bridgeLog.push({ direction: 'inbound', type: e.data.type, fields: Object.keys(e.data) });
            }
          });
        </script>\n<script>`,
      );
      route.fulfill({ body: modified, contentType: 'text/html' });
    });

    await page.goto(`${GAME_URL}?companion=test-bridge`);
    await page.waitForFunction(() => !!(window as any).__velvet, { timeout: 15_000 });

    // Send a profile message to trigger profileApplied
    await page.evaluate(() => {
      window.postMessage({
        type: 'velvet:profile',
        player: { name: 'Test', look: { skin: '#F2EEE8', hair: 'short', hairColor: '#3A2A1A', gender: 'male' } },
        companion: {
          name: 'Maya', pronoun: 'she', gender: 'female',
          personality: 'Warm, funny, curious',
          look: { skin: '#E8D5C5', hair: 'long', hairColor: '#6B4A2A', gender: 'female' },
          memories: [], likes: ['plants'], dislikes: ['mornings'],
        },
      }, '*');
    });
    await page.waitForTimeout(1000);

    // Trigger a vidSearch by calling the game's search function if available
    await page.evaluate(() => {
      window.postMessage({ type: 'velvet:vidSearch', game: 'velvet-house', query: 'test', seq: 1 }, '*');
    });
    await page.waitForTimeout(500);

    // Send vidResults back
    await page.evaluate(() => {
      window.postMessage({ type: 'velvet:vidResults', seq: 1, videos: [] }, '*');
    });
    await page.waitForTimeout(300);

    // Trigger a restart message
    await page.evaluate(() => {
      window.postMessage({ type: 'velvet:restarted', game: 'velvet-house', day: 1 }, '*');
    });
    await page.waitForTimeout(300);

    const log = await page.evaluate(() => (window as any).__bridgeLog || []);

    // Record the full contract
    const dir = join(process.cwd(), 'e2e/velvet-house');
    mkdirSync(dir, { recursive: true });
    const contract = {
      outbound: log.filter((m: any) => m.direction === 'outbound'),
      inbound: log.filter((m: any) => m.direction === 'inbound'),
      allTypes: [...new Set(log.map((m: any) => m.type))],
      fieldSchema: log.reduce((acc: any, m: any) => {
        if (!acc[m.type]) acc[m.type] = m.fields;
        return acc;
      }, {}),
    };
    writeFileSync(join(dir, 'bridge-contract.json'), JSON.stringify(contract, null, 2));

    // Verify we captured at least the ready message (always sent on boot)
    const types = log.map((m: any) => m.type);
    expect(types).toContain('velvet:ready');
    expect(log.length).toBeGreaterThanOrEqual(1);
  });
});
