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
import { createFrame } from './view/frame';
import { installDevHooks } from './dev/hooks';
import { createHostBridge } from './bridge/hostBridge';

/**
 * Starts the game. The data and the page come from `createGame`; each module below adds the part it owns to the
 * same `g` object and reaches the others through it (see kernel/game.ts).
 */
function boot(): void {
  const app = document.getElementById('app');
  if (!app) return;
  const g = createGame(app);
  if (!g) return;

  Object.assign(g, createCamera(g));
  Object.assign(g, createGameDrawer(g));
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
  installDevHooks(g);
  startGameLoop(g);
  Object.assign(g, createHostBridge(g));

  // Open the page the player left the drawer on (every module exists by now).
  try { g.s.drawerPage = localStorage.getItem('velvet-drawer') as DrawerPage || ''; } catch { /* no storage */ }
  if (g.s.drawerPage) g.drawer.open(g.s.drawerPage);
}

boot();
