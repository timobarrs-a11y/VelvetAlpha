import { postToParent } from '../bridge/protocol';
import { absMin } from '../state/time';
import { payBill, orderGroceries, orderTakeout } from '../state/household';
import { payBill as payOneBill } from '../state/finance';
import { takeOffer, SIDE_JOBS } from '../state/sideJobs';
import { clampRoutine } from '../state/routine';
import { createDrawer, dockTabHtml, DOCK_TABS } from '../ui/drawer';
import { gardenAction, treeAction } from '../systems/garden';
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
  // Picking something from a page (an order, a purchase, an outfit, a job) puts the page away, so the house is in
  // view while it happens. Arrange and the Design Studio are workbenches, and the steppers on the phone are settings:
  // those stay open until the player closes them.
  const CLOSE_AFTER = ['onBuyAvatarItem', 'onOrder', 'onPayBill', 'onPayBillId', 'onTakeOffer', 'onWorkJob', 'onCallIn',
    'onOrderGroceries', 'onOrderTakeout', 'onTalk', 'onPickLifeGoal', 'onWear', 'onWearPersona'] as const;
  const closing = (cbs: Parameters<typeof createDrawer>[0]): Parameters<typeof createDrawer>[0] => {
    const out = { ...cbs } as Record<string, unknown>;
    for (const k of CLOSE_AFTER) {
      const f = out[k] as ((...a: unknown[]) => void) | undefined;
      if (f) out[k] = (...a: unknown[]) => { f(...a); drawer.close(); };
    }
    return out as unknown as Parameters<typeof createDrawer>[0];
  };
  const drawer = createDrawer(closing({
    onClose: () => { g.s.drawerPage = ''; try { localStorage.removeItem('velvet-drawer'); } catch {} },
    onPage: (pg) => { g.scriptEmit({ type: 'tab.opened', tab: pg }); if (pg === 'arrange') g.enterArrange(); else if (g.isArranging()) g.exitArrange(); g.studioPage?.(pg); },
    onArrangePick: (id) => { const o = world.objs.find(q => q.id === id); if (o) g.selectObject(o); else if (id.startsWith('wall-')) g.selectWall(id); },
    onArrangeRotate: () => g.rotateSelected(),
    onArrangeSet: () => g.setDown(),
    onArrangeBack: () => g.putBack(),
    onArrangeColour: () => g.recolourHeld(),
    onArrangeClose: () => drawer.close(),
    onArrangeLook: (id) => g.useLook(id),
    onArrangeFloor: (lv) => g.carryTo(lv),
    onArrangeStore: () => g.storeSelected(),
    onArrangeUnstore: (id) => { if (id.startsWith('wall-')) g.rehangWall(id); else g.unstore(id); },
    onArrangeTakeDown: () => g.takeDownWall(),
    onPickFloor: (lv) => g.setLevel(lv),
    onPickRoom: (room) => { g.view.room = room; g.refreshDrawer(); },
    // Furniture goes straight into Arrange, so the player can place it; anything else (paint, seeds) puts the page away.
    onBuy: (item, color) => { g.handleBuy(item, color); if (item.icon === 'obj') drawer.open('arrange'); else drawer.close(); },
    onPetOrder: (act, id) => g.petOrder(act, id),
    onTree: (id, action) => { treeAction(world.objs, id, action, world.household.fridge, g.flags, log, (t, n) => g.art.shakeTree(t.id, n)); g.refreshDrawer(); },
    onGarden: (action, crop, bedId) => { gardenAction(world.objs, g.flags, world.household.fridge, action, crop, log, bedId); g.refreshDrawer(); },
    onBuyAvatarItem: (id) => g.handleBuyAvatarItem(id),
    onOrder: (chain) => g.handleOrder(chain),
    onPayBill: () => { payBill(world.household, absMin(world.day, world.minutes), log); },
    onPayBillId: (id) => { payOneBill(world.household, world.life, id, world.day, world.minutes, log); g.refreshDrawer(); },
    onTakeOffer: (id) => {
      const t = takeOffer(world.life, id);
      if (t) log(`Took the job: ${SIDE_JOBS[t.job].title.toLowerCase()} for ${t.client}.`);
      else log('Finish a job first: three can wait at once.');
      g.refreshDrawer();
    },
    onWorkJob: (id) => g.workOnJob(id),
    onRoutine: (key, delta) => {
      const r = world.life.routine;
      if (key === 'shower') r.shower = !r.shower;
      else world.life.routine = clampRoutine({ ...r, [key]: r[key] + delta });
      g.refreshDrawer();
    },
    onCallIn: () => {
      world.life.today.calledIn = true;
      log(`${people[0].name} is staying home today. No pay for today.`);
      g.refreshDrawer();
    },
    onOrderGroceries: () => {
      if (g.spendOn('Groceries', 40)) { orderGroceries(world.household, absMin(world.day, world.minutes), 6, false); log('Groceries ordered. Delivery in 30 min.'); g.scriptEmit({ type: 'groceries.ordered' }); }
      else log('Not enough money for groceries.');
    },
    onOrderTakeout: () => {
      if (g.spendOn('Takeout', 25)) { orderTakeout(world.household, absMin(world.day, world.minutes)); log('Takeout ordered. Delivery in 35 min.'); }
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
      g.wearOutfitPiece(cloth);
      // New clothes show on the player's avatar outside the game too (a designed garment is the game's own).
      if (cloth.recipe) return;
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
      g.cameraBeat('closeup', 'jordan');
      log(`Changed into the ${p.label} look.`);
      g.refreshDrawer();
      g.tellHostLook(top, bottom, hat.style);
    },
  }));
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
  // Following someone from the list puts the list away too.
  peopleEl.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.vh-person')) return;
    peopleEl.hidden = true;
    peopleBtn.setAttribute('aria-pressed', 'false');
  });
  drawer.dock.prepend(peopleBtn);
  // The town name is a label on the picture, so it lives in the picture's band, not over the bars.
  app.querySelector<HTMLElement>('.vh-view')!.appendChild(townSign);

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
