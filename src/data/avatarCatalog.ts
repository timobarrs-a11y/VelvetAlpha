import type { AvatarConfigV2 } from '../types/avatar-v2';
import { HAIR_COLORS, HAIR_FASHION_COLORS, HAIRSTYLES } from '../types/avatar-v2';
import { OUTFITS, BOTTOMS, HEADWEAR, FACE_ACCESSORIES, resolveAvatarForDisplay, type AvatarUnlocks, type UnlockResult } from './avatarItems';

// Everything a person can own for their avatar, and how each thing is got.
//
// An item is one choice in one slot, written `slot:value`: `hairStyle:bantu_knots`,
// `hairColor:#e07a9f`, `outfit:pirate`. Owning one (bought in the Velvet Sims
// shop, won as a reward, granted with a medal) is recorded in the
// avatar_inventory table, and an owned item is usable everywhere: the avatar
// creator, the toolbar, chats, and back in the game.
//
// Who a person is never goes in here: skin, face, eyes, nose, lips, body and
// natural hair colours are always free and can never be locked. Only things
// a person wears or styles can be earned.

export type ItemSlot =
  | 'hairStyle' | 'hairColor' | 'hairHighlight'
  | 'outfit' | 'outfitColor' | 'bottom' | 'bottomColor' | 'headwear' | 'faceAccessory'
  | 'glasses' | 'earrings' | 'necklace';

export const ITEM_SLOTS: ItemSlot[] = [
  'hairStyle', 'hairColor', 'hairHighlight', 'outfit', 'outfitColor', 'bottom', 'bottomColor', 'headwear', 'faceAccessory', 'glasses', 'earrings', 'necklace',
];

export type ItemId = `${ItemSlot}:${string}`;

export function itemId(slot: ItemSlot, value: string): ItemId {
  return `${slot}:${value}`;
}

// A well-formed item id, or null. Also the shape the database accepts.
export const ITEM_ID_PATTERN = /^(hairStyle|hairColor|hairHighlight|outfit|outfitColor|bottom|bottomColor|headwear|faceAccessory|glasses|earrings|necklace):[#a-zA-Z0-9_-]{1,40}$/;

export function parseItemId(id: string): { slot: ItemSlot; value: string } | null {
  if (!ITEM_ID_PATTERN.test(id)) return null;
  const i = id.indexOf(':');
  return { slot: id.slice(0, i) as ItemSlot, value: id.slice(i + 1) };
}

// How an item is got.
export type HowToGet =
  | { how: 'free' }
  | { how: 'member' }
  | { how: 'medal'; medal: string }
  | { how: 'sims'; price: number }
  | { how: 'reward'; reward: string };

// The switch for earning. While it is off, shop and reward items are open to
// everyone (as today), and anything bought or won is still recorded, so
// nobody loses what they own when it goes on.
export const EARNING_LIVE = false;

// What is earned, and how. Anything not listed is free. The wardrobe's
// member and medal items come from avatarItems.ts; shop prices and rewards
// are set here.
const RULES: Partial<Record<ItemId, HowToGet>> = {
  // The Velvet Sims salon. Prices are in Sims dollars; a first stock, easy to change.
  'hairStyle:bantu_knots': { how: 'sims', price: 150 },
  'hairStyle:mohawk': { how: 'sims', price: 120 },
  'hairStyle:top_knot': { how: 'sims', price: 90 },
  'hairHighlight:#c9933e': { how: 'sims', price: 60 },
  'hairHighlight:#e07a9f': { how: 'sims', price: 60 },
  'hairHighlight:#2f6fd6': { how: 'sims', price: 60 },
  // Dyed colours for the whole head: a reward, once earning goes live.
  ...Object.fromEntries(HAIR_FASHION_COLORS.map(c => [itemId('hairColor', c.value), { how: 'reward', reward: 'dyed-hair' }])),
  ...Object.fromEntries(
    [...OUTFITS.map(o => ['outfit', o] as const), ...BOTTOMS.map(b => ['bottom', b] as const), ...HEADWEAR.map(h => ['headwear', h] as const), ...FACE_ACCESSORIES.map(f => ['faceAccessory', f] as const)]
      .filter(([, item]) => item.tier !== 'starter')
      .map(([slot, item]) => [itemId(slot as ItemSlot, item.id), item.tier === 'member' ? { how: 'member' } : { how: 'medal', medal: item.medal ?? '' }]),
  ),
};

export function howToGet(id: ItemId): HowToGet {
  return RULES[id] ?? { how: 'free' };
}

// Every item that can be bought in the Velvet Sims shop, with its price.
export function simsShopItems(): Array<{ id: ItemId; price: number }> {
  return (Object.entries(RULES) as Array<[ItemId, HowToGet]>)
    .filter(([, r]) => r.how === 'sims')
    .map(([id, r]) => ({ id, price: (r as { price: number }).price }));
}

// A name for an item, for shops and messages: "Bantu Knots", "Honey highlights".
export function itemLabel(id: ItemId): string {
  const parsed = parseItemId(id);
  if (!parsed) return id;
  const { slot, value } = parsed;
  const colour = [...HAIR_COLORS, ...HAIR_FASHION_COLORS].find(c => c.value === value)?.name;
  switch (slot) {
    case 'hairStyle': return HAIRSTYLES.find(h => h.value === value)?.label ?? value;
    case 'hairHighlight': return `${colour ?? value} highlights`;
    case 'hairColor': return `${colour ?? value} hair`;
    case 'outfit': return OUTFITS.find(o => o.id === value)?.label ?? value;
    case 'bottom': return BOTTOMS.find(b => b.id === value)?.label ?? value;
    case 'headwear': return HEADWEAR.find(h => h.id === value)?.label ?? value;
    case 'faceAccessory': return FACE_ACCESSORIES.find(f => f.id === value)?.label ?? value;
    default: return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

// May this person use this item?
export function canUse(id: ItemId, unlocks: AvatarUnlocks): UnlockResult {
  if (unlocks.owned?.includes(id)) return { ok: true };
  const rule = howToGet(id);
  switch (rule.how) {
    case 'free': return { ok: true };
    case 'member': return unlocks.member ? { ok: true } : { ok: false, need: 'membership' };
    case 'medal': return unlocks.earned.includes(rule.medal) ? { ok: true } : { ok: false, need: rule.medal };
    case 'sims': return EARNING_LIVE ? { ok: false, need: 'sims' } : { ok: true };
    case 'reward': return EARNING_LIVE ? { ok: false, need: 'reward' } : { ok: true };
  }
}

// The items a saved look is wearing, for checking them all at once.
export function lookItems(config: Partial<AvatarConfigV2>): ItemId[] {
  const out: ItemId[] = [];
  const add = (slot: ItemSlot, v: unknown) => { if (typeof v === 'string' && v && v !== 'none') out.push(itemId(slot, v)); };
  add('hairStyle', config.hairStyle);
  add('hairColor', config.hairColor);
  add('hairHighlight', config.hairHighlight);
  add('outfit', config.outfit);
  add('outfitColor', config.outfitColor);
  add('bottom', config.bottom);
  add('bottomColor', config.bottomColor);
  add('headwear', config.headwear);
  add('faceAccessory', config.faceAccessory);
  add('glasses', config.glasses);
  add('earrings', config.earrings);
  add('necklace', config.necklace);
  return out;
}

// Hair this person may not use falls back to something they can: a cut
// everyone has, their natural colour, no highlights.
export function resolveHairForDisplay(config: AvatarConfigV2, unlocks: AvatarUnlocks): AvatarConfigV2 {
  const next = { ...config };
  if (!canUse(itemId('hairStyle', config.hairStyle), unlocks).ok) next.hairStyle = 'short';
  if (!canUse(itemId('hairColor', config.hairColor), unlocks).ok) next.hairColor = HAIR_COLORS[0].value;
  if (config.hairHighlight && config.hairHighlight !== 'none' && !canUse(itemId('hairHighlight', config.hairHighlight), unlocks).ok) next.hairHighlight = 'none';
  return next;
}

// What other people see: the saved look with anything this person can't use
// (wardrobe or hair) swapped for something they can. The saved look itself is
// never changed, so earning the item back restores it.
export function resolveLookForDisplay(config: AvatarConfigV2, unlocks: AvatarUnlocks): AvatarConfigV2 {
  return resolveHairForDisplay(resolveAvatarForDisplay(config, unlocks), unlocks);
}

// A whole look is as locked as its most locked item.
export function lookUnlock(look: Partial<AvatarConfigV2>, unlocks: AvatarUnlocks): UnlockResult {
  return lookItems(look).map(id => canUse(id, unlocks)).find(u => !u.ok) ?? { ok: true };
}
