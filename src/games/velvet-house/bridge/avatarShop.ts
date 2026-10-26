import { postToParent } from './protocol';

// The game's side of avatar items (see src/data/avatarCatalog.ts in the app).
// The host sends what the player owns when the game starts and after each
// purchase; a shop calls buyAvatarItem once the in-game money is spent, and
// the item is then the player's everywhere, in the game and out of it.

let owned = new Set<string>();

export function setOwnedAvatarItems(items: string[]): void {
  owned = new Set(items);
}

export function ownsAvatarItem(itemId: string): boolean {
  return owned.has(itemId);
}

export function buyAvatarItem(itemId: string): void {
  owned.add(itemId);
  postToParent({ type: 'velvet:avatarItemBought', game: 'velvet-house', itemId });
}
