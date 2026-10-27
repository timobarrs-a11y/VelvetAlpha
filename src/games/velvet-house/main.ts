import type { DrawerPage } from './ui/drawer';
import { createGame } from './kernel/game';
import { startGameLoop } from './kernel/run';
import { createCamera } from './engine/camera';
import { createGameDrawer } from './ui/gameDrawer';
import { createControls } from './ui/controls';
import { createHud } from './ui/hud';
import { createArrange } from './systems/arrange';
import { createInteract } from './systems/interact';
import { createInput } from './systems/input';
import { createShop } from './systems/shop';
import { createChat } from './systems/chat';
import { createPersist } from './systems/persist';
import { createGoals } from './systems/goals';
import { createAvatar } from './systems/avatar';
import { createOutfit } from './systems/outfit';
import { createStudio } from './ui/studio';
import { createLifeSim } from './systems/lifeSim';
import { createDeliveries } from './systems/deliveries';
import { createScripts } from './script/gameHost';
import { createFrame } from './view/frame';
import { installDevHooks } from './dev/hooks';
import { createHostBridge } from './bridge/hostBridge';
import { showMainMenu } from './ui/mainMenu';
import { startAttract } from './ui/attract';
import { run, SAVE_KEY } from './kernel/config';
import { postToParent } from './bridge/protocol';

/**
 * Starts the game. The data and the page come from `createGame`; each module below adds the part it owns to the
 * same `g` object and reaches the others through it (see kernel/game.ts).
 */
function boot(attract: boolean): void {
  const app = document.getElementById('app');
  if (!app) return;
  const g = createGame(app);
  if (!g) return;

  Object.assign(g, createCamera(g));
  Object.assign(g, createGameDrawer(g));
  Object.assign(g, createOutfit(g));
  Object.assign(g, createControls(g));
  Object.assign(g, createArrange(g));
  Object.assign(g, createInteract(g));
  createInput(g);
  Object.assign(g, createShop(g));
  Object.assign(g, createChat(g));
  Object.assign(g, createPersist(g));
  Object.assign(g, createHud(g));
  Object.assign(g, createGoals(g));
  Object.assign(g, createAvatar(g));
  Object.assign(g, createFrame(g));
  Object.assign(g, createStudio(g));
  Object.assign(g, createLifeSim(g));
  Object.assign(g, createDeliveries(g));
  Object.assign(g, createScripts(g));
  if (!attract) installDevHooks(g);
  startGameLoop(g);
  if (attract) { startAttract(g); return; }
  Object.assign(g, createHostBridge(g));

  // Open the page the player left the drawer on (every module exists by now).
  try { g.s.drawerPage = localStorage.getItem('velvet-drawer') as DrawerPage || ''; } catch { /* no storage */ }
  if (g.s.drawerPage) g.drawer.open(g.s.drawerPage);
}

/**
 * The title screen comes first: the house plays behind it as a throwaway backdrop, and choosing Continue or New Game
 * reloads the page into the real game (the `#launch` mark says the menu has been done). The tests start the game
 * directly with ?nomenu.
 */
async function launch(): Promise<void> {
  const skip = import.meta.env.DEV && new URLSearchParams(location.search).has('nomenu');
  const launched = location.hash === '#launch';
  if (launched) history.replaceState(null, '', location.pathname + location.search);
  // The host picked a different companion to move in with: start a new house for them, with no title screen. The
  // parameter is dropped at once so a reload of this page never starts over again.
  const params = new URLSearchParams(location.search);
  if (params.get('start') === 'new') {
    params.delete('start');
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : ''));
    try {
      if (localStorage.getItem(SAVE_KEY) !== null) { localStorage.removeItem(SAVE_KEY); postToParent({ type: 'velvet:restarted', game: 'velvet-house', day: 1 }); }
    } catch { /* storage blocked */ }
    boot(false);
    return;
  }
  if (skip || launched) { boot(false); return; }
  run.attract = true;
  boot(true);
  await showMainMenu();
  location.hash = 'launch';
  location.reload();
}

void launch();
