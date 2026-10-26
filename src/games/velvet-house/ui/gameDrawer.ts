import { postToParent } from '../bridge/protocol';
import { absMin } from '../state/time';
import { spend, payBill, orderGroceries, orderTakeout } from '../state/household';
import { createDrawer, dockTabHtml, DOCK_TABS } from '../ui/drawer';
import { AVATAR_HATS } from '../state/clothing';
import { createDialogue, createTray, createTownSign } from '../ui/dialogue';
import { SAVE_KEY } from '../kernel/config';
import type { Game } from '../kernel/game';

export function createGameDrawer(g: Game): Partial<Game> {
  const { app, world, townName, people, closet, log, stage } = g;
  // Town sign
  const townSign = createTownSign();
  townSign.textContent = townName;

  // UI: Drawer
  const drawer = createDrawer({
    onClose: () => { g.s.drawerPage = ''; try { localStorage.removeItem('velvet-drawer'); } catch {} },
    onPage: (pg) => { if (pg === 'arrange') g.enterArrange(); else if (g.isArranging()) g.exitArrange(); },
    onArrangePick: (id) => { const o = world.objs.find(q => q.id === id); if (o) g.selectObject(o); },
    onArrangeRotate: () => g.rotateSelected(),
    onArrangeColour: () => g.recolourHeld(),
    onArrangeFloor: (lv) => g.carryTo(lv),
    onArrangeStore: () => g.storeSelected(),
    onArrangeUnstore: (id) => g.unstore(id),
    onPickFloor: (lv) => g.setLevel(lv),
    onBuy: (item, color) => g.handleBuy(item, color),
    onBuyAvatarItem: (id) => g.handleBuyAvatarItem(id),
    onOrder: (chain) => g.handleOrder(chain),
    onPayBill: () => { payBill(world.household, absMin(world.day, world.minutes), log); },
    onOrderGroceries: () => {
      if (spend(world.household, 40)) { orderGroceries(world.household, absMin(world.day, world.minutes), 6, false); log('Groceries ordered. Delivery in 30 min.'); }
      else log('Not enough money for groceries.');
    },
    onOrderTakeout: () => {
      if (spend(world.household, 25)) { orderTakeout(world.household, absMin(world.day, world.minutes)); log('Takeout ordered. Delivery in 35 min.'); }
      else log('Not enough money for takeout.');
    },
    onTalk: () => g.openChat(),
    onRestart: () => {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      postToParent({ type: 'velvet:restarted', game: 'velvet-house', day: 1 });
      location.reload();
    },
    onPickLifeGoal: (goal) => { g.s.lifeGoal = goal; log(`Life goal: ${goal}`); },
    onWear: (cloth) => {
      g.wearPiece(cloth);
      log(`Changed into the ${cloth.name}.`);
      g.refreshDrawer();
      // New clothes show on the player's avatar outside the game too.
      if (cloth.slot === 'top') g.tellHostLook(cloth);
      else if (cloth.slot === 'bottom') g.tellHostLook(undefined, cloth);
      else if (cloth.slot === 'hat' && AVATAR_HATS.has(cloth.style)) g.tellHostLook(undefined, undefined, cloth.style);
    },
    onWearPersona: (id) => {
      const p = g.s.wardrobe?.personas.find(x => x.id === id);
      const top = p && closet.find(c => c.id === p.top), base = p && closet.find(c => c.id === p.bottom), hat = p && closet.find(c => c.id === p.hat);
      if (!p || !top || !base || !hat) return;
      const bottom = p.bottomCol ? { ...base, col: p.bottomCol } : base;
      g.wearPiece(top); g.wearPiece(bottom); g.wearPiece(hat);
      log(`Changed into the ${p.label} look.`);
      g.refreshDrawer();
      g.tellHostLook(top, bottom, hat.style);
    },
  });
  stage.appendChild(drawer.el);
  stage.appendChild(drawer.dock);

  // Who's home (needs and what they're doing) lives behind a People tab in the
  // bottom bar instead of covering the house; it opens above the bar.
  const peopleEl = app.querySelector<HTMLElement>('.vh-people')!;
  peopleEl.hidden = true;
  const peopleBtn = document.createElement('button');
  peopleBtn.type = 'button';
  peopleBtn.dataset.people = '';
  peopleBtn.innerHTML = dockTabHtml('people', 'People');
  peopleBtn.style.setProperty('--tab', DOCK_TABS.people.color);
  peopleBtn.setAttribute('aria-pressed', 'false');
  peopleBtn.addEventListener('click', () => {
    const show = peopleEl.hidden;
    peopleEl.hidden = !show;
    peopleBtn.setAttribute('aria-pressed', String(show));
  });
  drawer.dock.prepend(peopleBtn);
  stage.appendChild(townSign);

  // UI: Dialogue
  const dialogue = createDialogue({
    onSend: (text) => g.handleTalk(text),
    onClose: () => g.handleCloseChat(),
  });
  stage.appendChild(dialogue.el);
  dialogue.setPortraitLook({ skin: people[1].look.skin, hair: people[1].look.hair, longHair: people[1].look.longHair });
  dialogue.setPortraitTalking(false);

  // UI: Tray
  const tray = createTray();
  stage.appendChild(tray.el);
  return { drawer, dialogue, tray, townSign };
}
