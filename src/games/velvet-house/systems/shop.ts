import { ownsAvatarItem, buyAvatarItem } from '../bridge/avatarShop';
import { simsShopItems, itemLabel } from '../../../data/avatarCatalog';
import { relocate } from '../state/arrange';
import { ATTIC_STAIR_OBJS, type ObjectInstance } from '../state/objects';
import { LEVEL_NAMES, ATTIC } from '../state/house';
import { buildWorld } from '../state/agents';
import { spend } from '../state/household';
import { type CatalogEntry } from '../state/catalog';
import { tasteOf } from '../state/taste';
import { clothByKey } from '../state/clothing';
import type { Game } from '../kernel/game';

export function createShop(g: Game): Partial<Game> {
  const { world, partnerName, house, view, owned, closet, flags, style, tasteNorm, log, art, hasAttic, storage } = g;
  // The salon: spend Sims money on an avatar item, and it's the player's
  // everywhere (the app records it to their account).
  function handleBuyAvatarItem(id: string): void {
    const item = simsShopItems().find(i => i.id === id);
    if (!item || ownsAvatarItem(id)) return;
    if (!spend(world.household, item.price)) { log('Not enough money.'); return; }
    buyAvatarItem(id);
    log(`Bought ${itemLabel(item.id)} for $${item.price}. It's yours in Velvet too.`);
    g.refreshDrawer();
  }

  function handleBuy(item: CatalogEntry, color?: string): void {
    const price = item.price;
    if (item.icon === 'upgrade' && item.id === 'upgrade-attic' && hasAttic()) { log('The attic is already built.'); return; }
    if ((item.icon === 'paint' || item.icon === 'paper' || item.icon === 'floor') && view.level === 3) {
      log('Pick a floor of the house first (Basement, Main floor or Upstairs): walls and floors go inside.');
      return;
    }
    if (!spend(world.household, price)) { log('Not enough money.'); return; }
    owned.add(item.id);
    log(`Bought ${item.name} for $${price}.`);

    if (item.icon === 'upgrade' && item.id === 'upgrade-attic') {
      world.objs.push(...ATTIC_STAIR_OBJS.map(o => ({ ...o })));
      Object.assign(house, buildWorld(world.objs));
      log('The attic is built! New stairs lead up from the Upstairs hall.');
      g.setLevel(ATTIC);
    }

    // Apply paint/wallpaper/floor
    if (item.icon === 'paint' && (color || item.color)) {
      art.applyPaint(view.level, color || item.color!);
      flags.styled = true;
      if (!(flags.styledSet as number[])?.includes(view.level)) (flags.styledSet as number[]).push(view.level);
      log(`${LEVEL_NAMES[view.level]} painted ${(color || item.color)!}.`);
    }
    if (item.icon === 'paper' && item.pattern) {
      art.applyWallpaper(view.level, item.pattern);
      flags.styled = true;
    }
    if (item.icon === 'floor' && item.floor) {
      art.applyFloor(view.level, item.floor);
      flags.styled = true;
    }
    // Furniture: add to world
    if (item.type && item.icon === 'obj') {
      // Attic finds go in the attic once it's built; everything else where you're looking.
      const level = item.tab === 'Attic' && hasAttic() ? ATTIC : view.level;
      const newObj: ObjectInstance = {
        id: `${item.type}-${Date.now() & 0xffff}`,
        type: item.type, level, x: 5, y: 5, rot: 0,
        col: color || item.cols?.[0],
      };
      world.objs.push(newObj);
      flags.furniture = ((flags.furniture as number) ?? 0) + 1;
      // Set it down on free floor; if the floor is full it waits in storage.
      if (relocate(world.objs, newObj, level, g.peopleOnFloor())) {
        g.relearnLayout(newObj);
        art.objectPlaced(newObj.id);
        log(`${item.name} is in the ${LEVEL_NAMES[level].toLowerCase()}. Use Arrange to move it.`);
      } else {
        world.objs.pop();
        storage.push(newObj);
        log(`No room for the ${item.name.toLowerCase()} on the ${LEVEL_NAMES[level].toLowerCase()}, so it's in storage (Arrange).`);
      }
    }
    // Clothing: add to the closet (same piece + color only once)
    if (item.icon === 'cloth' && item.cloth) {
      const key = item.id.slice(2);
      const def = clothByKey(key);
      if (def) {
        const col = color || def.colors[0];
        const name = col === def.colors[0] ? def.name : `${def.name} (${col.trim()})`;
        if (!closet.some(c => c.id === item.id && c.col === col)) {
          closet.push({ slot: def.slot, style: def.style, col, name, id: item.id });
          log(`Added ${name} to your closet.`);
        }
      }
    }
    // Bond boost from buying liked items
    if (item.tags) {
      const taste = tasteOf({ id: item.id, name: item.name, tags: item.tags }, style, tasteNorm);
      if (taste > 0) { g.s.bond = Math.min(100, g.s.bond + taste); log(`${partnerName} ${taste > 1 ? 'loves' : 'likes'} the ${item.name}.`); }
    }
    g.refreshDrawer();
  }
  return { handleBuy, handleBuyAvatarItem };
}
