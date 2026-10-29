import { SAVE_KEY } from '../kernel/config';
import { loadSave } from '../state/save';
import { isCurrentContent, CONTENT_VERSION } from '../state/saveMigration';
import { applyPlayerQuality } from '../engine/qualityTier';
import { fpsOn, setFpsOn } from '../engine/fpsMeter';
import { postToParent } from '../bridge/protocol';
import { clockText, DAYS, weekday } from '../state/time';
import { hasChoice, anyHouse, askWho, listenForCompanions, onCompanionsChanged } from '../bridge/companions';

/**
 * The title screen: what the player sees before the house. Continue picks up the saved house, New Game starts the
 * move-in (after a warning when it would replace a house), Settings holds what is not part of the game itself. The
 * game starts once one of the first two is chosen.
 */
import { unlockFor, codeWord } from '../state/unlockCodes';
import { parseFund } from '../state/devMoney';
import { enqueue, readQueue } from '../state/codeQueue';
import { CODE_QUEUE_KEY } from '../systems/codeQueue';

export type LaunchChoice = 'continue' | 'new' | 'demo';

const QUALITY = [['Auto', 'auto'], ['High', 'high'], ['Medium', 'medium'], ['Low', 'low'], ['Ultra', 'ultra']] as const;
const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface SaveSummary { day: number; when: string; money: number; names: string }

/** What the saved house looks like from the menu, or null when there is no house to continue. */
export function saveSummary(): SaveSummary | null {
  const s = loadSave(SAVE_KEY);
  if (!s || !isCurrentContent(s)) return null;
  const raw = s as unknown as Record<string, unknown>;
  const day = typeof raw.day === 'number' ? raw.day : 1;
  const minutes = typeof raw.minutes === 'number' ? raw.minutes : 0;
  const names = [(raw.player as { name?: string } | undefined)?.name ?? raw.simName, (raw.partner as { name?: string } | undefined)?.name ?? raw.partnerName]
    .filter((n): n is string => typeof n === 'string' && n.length > 0).join(' & ');
  return { day, when: `${DAYS[weekday(day)]} ${clockText(minutes)}`, money: typeof raw.money === 'number' ? raw.money : 0, names };
}

export function showMainMenu(): Promise<LaunchChoice> {
  listenForCompanions();
  return new Promise((resolve) => {
    let onHome = false;
    const summary = saveSummary();
    const root = document.createElement('div');
    root.className = 'vh-menu';
    const done = (choice: LaunchChoice): void => { root.classList.add('vh-menu-out'); setTimeout(() => resolve(choice), 320); };

    const home = (): void => {
      onHome = true;
      // With several companions, someone else's house may be the one to go back to.
      const canContinue = !!summary || (hasChoice() && anyHouse());
      root.innerHTML = `
        <div class="vh-menu-card">
          <h1 class="vh-menu-title">Velvet House</h1>
          <p class="vh-menu-sub">${canContinue ? 'Welcome home.' : 'A cozy life, together.'}</p>
          ${canContinue ? `<button class="vh-menu-btn vh-menu-primary" data-m="continue"><span>Continue</span><small>${summary ? `${esc(summary.names ? summary.names + ' · ' : '')}Day ${summary.day} · ${esc(summary.when)} · $${summary.money}` : 'Choose whose house'}</small></button>` : ''}
          <button class="vh-menu-btn ${canContinue ? '' : 'vh-menu-primary'}" data-m="new"><span>${canContinue ? 'New Game' : 'Start'}</span></button>
          <button class="vh-menu-btn" data-m="cheats"><span>Cheats</span></button>
          <button class="vh-menu-btn" data-m="demo"><span>Demo</span></button>
          <button class="vh-menu-btn" data-m="settings"><span>Settings</span></button>
          <p class="vh-menu-build">Build ${esc(typeof __VELVET_BUILD__ === 'string' ? __VELVET_BUILD__ : 'dev')} · story ${CONTENT_VERSION}</p>
        </div>`;
      root.querySelector('[data-m=continue]')?.addEventListener('click', () => { void beginContinue(); });
      root.querySelector('[data-m=new]')?.addEventListener('click', () => { void beginNew(); });
      root.querySelector('[data-m=cheats]')?.addEventListener('click', cheats);
      root.querySelector('[data-m=demo]')?.addEventListener('click', () => done('demo'));
      root.querySelector('[data-m=settings]')?.addEventListener('click', settings);
    };

    // Codes: there is no house yet, so a code typed here is checked and saved, and redeemed once the player is in it.
    const cheats = (): void => {
      onHome = false;
      const waiting = readQueue(localStorage, CODE_QUEUE_KEY).length;
      root.innerHTML = `
        <div class="vh-menu-card vh-menu-panel">
          <h2 class="vh-menu-h">Cheats</h2>
          <p class="vh-menu-sub">Have a code? Enter it here and it is yours once you are in your house.</p>
          <form class="vh-menu-code" autocomplete="off">
            <input name="code" placeholder="Enter a code" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Code" />
            <button type="submit" class="vh-menu-btn vh-menu-primary"><span>Redeem</span></button>
          </form>
          <p class="vh-menu-codemsg" role="status" aria-live="polite">${waiting ? `${waiting} saved, waiting for your house.` : ''}</p>
          <button class="vh-menu-btn" data-m="back"><span>Back</span></button>
        </div>`;
      const msg = root.querySelector('.vh-menu-codemsg')!, input = root.querySelector<HTMLInputElement>('.vh-menu-code input')!;
      root.querySelector('.vh-menu-code')!.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const promo = unlockFor(text);
        if (promo || parseFund(text) !== null) {
          enqueue(localStorage, CODE_QUEUE_KEY, text);
          // A promo code is the account's from now on (inside the app the host records it), so whichever house they
          // go into has it, even if it isn't the one this menu opened with.
          if (promo) postToParent({ type: 'velvet:promo', game: 'velvet-house', code: codeWord(promo) });
          msg.textContent = 'Code accepted. It is yours once you are in your house.';
          msg.setAttribute('data-ok', 'true');
        } else {
          msg.textContent = 'That is not a code.';
          msg.removeAttribute('data-ok');
        }
        input.value = '';
        input.focus();
      });
      root.querySelector('[data-m=back]')?.addEventListener('click', home);
      input.focus();
    };

    // With more than one companion to choose from, the host asks who first: whose house to go back to, or who is moving in.
    const asking = (title: string, text: string): void => {
      onHome = false;
      root.innerHTML = `
        <div class="vh-menu-card">
          <h2 class="vh-menu-h">${title}</h2>
          <p class="vh-menu-sub">${text}</p>
        </div>`;
    };
    const beginContinue = async (): Promise<void> => {
      if (hasChoice()) {
        asking('Whose house?', 'Pick the house to go back to.');
        if ((await askWho('continue')) === 'cancel') { home(); return; }
      }
      done('continue');
    };
    const beginNew = async (): Promise<void> => {
      if (hasChoice()) {
        asking("Who's moving in?", "Pick who you'll share the house with.");
        if ((await askWho('new')) === 'cancel') { home(); return; }
      }
      if (summary) confirmNew(); else start();
    };

    const start = (): void => {
      // A fresh house replaces whatever the account kept; the host backs the old one up (see useVelvetHouseCloudSave).
      if (summary) {
        try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
        postToParent({ type: 'velvet:restarted', game: 'velvet-house', day: 1 });
      }
      done('new');
    };

    const confirmNew = (): void => {
      root.innerHTML = `
        <div class="vh-menu-card">
          <h2 class="vh-menu-h">Start over?</h2>
          <p class="vh-menu-sub">This begins a new house and the move-in again. Your current house is put away and no longer the one you play.</p>
          <button class="vh-menu-btn vh-menu-danger" data-m="yes"><span>Start a new game</span></button>
          <button class="vh-menu-btn vh-menu-primary" data-m="no"><span>Keep my house</span></button>
        </div>`;
      root.querySelector('[data-m=yes]')?.addEventListener('click', start);
      root.querySelector('[data-m=no]')?.addEventListener('click', home);
    };

    const settings = (): void => {
      let idx = 0;
      try { idx = Math.max(0, Math.min(4, Number(localStorage.getItem('velvet-quality')) || 0)); } catch { /* none */ }
      root.innerHTML = `
        <div class="vh-menu-card">
          <h2 class="vh-menu-h">Settings</h2>
          <div class="vh-menu-row"><span>Graphics</span><div class="vh-menu-seg">${QUALITY.map(([label], i) => `<button data-q="${i}" aria-pressed="${i === idx}">${label}</button>`).join('')}</div></div>
          <p class="vh-menu-sub">Auto lowers the detail by itself if the game runs slowly. Pick Low on an older phone.</p>
          <div class="vh-menu-row"><span>Frame rate</span><div class="vh-menu-seg"><button data-fps="0" aria-pressed="${!fpsOn()}">Hide</button><button data-fps="1" aria-pressed="${fpsOn()}">Show</button></div></div>
          <button class="vh-menu-btn vh-menu-primary" data-m="back"><span>Back</span></button>
        </div>`;
      root.querySelectorAll<HTMLButtonElement>('[data-q]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.q);
        try { localStorage.setItem('velvet-quality', String(i)); } catch { /* none */ }
        applyPlayerQuality(QUALITY[i][1]);
        root.querySelectorAll('[data-q]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
      root.querySelectorAll<HTMLButtonElement>('[data-fps]').forEach((b) => b.addEventListener('click', () => {
        setFpsOn(b.dataset.fps === '1');
        root.querySelectorAll('[data-fps]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
      root.querySelector('[data-m=back]')?.addEventListener('click', home);
    };

    onCompanionsChanged(() => { if (onHome) home(); });
    home();
    document.body.appendChild(root);
    (root.querySelector('.vh-menu-primary') as HTMLElement | null)?.focus();
  });
}
