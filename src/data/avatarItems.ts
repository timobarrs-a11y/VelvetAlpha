import type { AvatarConfigV2, Outfit, Headwear, FaceAccessory } from '../types/avatar-v2';

// The wardrobe, and who may wear what. Same three tiers as the Velvet World
// houses (src/features/velvet-world/art/streetArt.js):
//   starter: everyone
//   member:  paid members; locked while a plan has lapsed, and kept for when they return
//   earned:  one medal each, never for sale, never locked by a lapsed plan
// A locked item is shown as its fallback, which is always a starter item.

export type ItemTier = 'starter' | 'member' | 'earned';
export type ItemSlot = 'outfit' | 'headwear' | 'faceAccessory';

interface ItemBase<T extends string> {
  id: T;
  label: string;
  tier: ItemTier;
  medal?: string;
  fallback: T;
}

export interface OutfitItem extends ItemBase<Outfit> {
  color: string;
  accent: string;
  colorLabel: string;
  accentLabel: string;
}
export type HeadwearItem = ItemBase<Headwear>;
export type FaceAccessoryItem = ItemBase<FaceAccessory>;

export const OUTFITS: OutfitItem[] = [
  { id: 'tee', label: 'Tee', tier: 'starter', fallback: 'tee', color: '#1e293b', accent: '#2d3748', colorLabel: 'Shirt', accentLabel: 'Neckline' },
  { id: 'linen', label: 'Linen shirt', tier: 'starter', fallback: 'linen', color: '#efe6d2', accent: '#8a6a4a', colorLabel: 'Shirt', accentLabel: 'Laces' },
  { id: 'suit', label: 'Suit & tie', tier: 'starter', fallback: 'suit', color: '#1f2a44', accent: '#8a2d3b', colorLabel: 'Jacket', accentLabel: 'Tie' },
  { id: 'chef', label: 'Chef whites', tier: 'starter', fallback: 'chef', color: '#f4f1ea', accent: '#1f2937', colorLabel: 'Jacket', accentLabel: 'Buttons' },
  { id: 'labcoat', label: 'Lab coat', tier: 'starter', fallback: 'labcoat', color: '#f7f7f5', accent: '#9cc3e6', colorLabel: 'Coat', accentLabel: 'Shirt' },
  { id: 'pirate', label: 'Pirate garb', tier: 'member', fallback: 'linen', color: '#5a1f2b', accent: '#c9a24a', colorLabel: 'Vest', accentLabel: 'Trim' },
];

export const HEADWEAR: HeadwearItem[] = [
  { id: 'none', label: 'None', tier: 'starter', fallback: 'none' },
  { id: 'chef_hat', label: "Chef's hat", tier: 'starter', fallback: 'none' },
  { id: 'bandana', label: 'Bandana', tier: 'member', fallback: 'none' },
  { id: 'tricorn', label: 'Tricorn', tier: 'member', fallback: 'none' },
  { id: 'top_hat', label: 'Top hat', tier: 'earned', medal: 'hat-trick', fallback: 'none' },
];

export const FACE_ACCESSORIES: FaceAccessoryItem[] = [
  { id: 'none', label: 'None', tier: 'starter', fallback: 'none' },
  { id: 'eyepatch', label: 'Eyepatch', tier: 'member', fallback: 'none' },
];

export const OUTFIT_COLORS: Array<{ name: string; value: string }> = [
  { name: 'Navy', value: '#1f2a44' },
  { name: 'Slate', value: '#1e293b' },
  { name: 'Charcoal', value: '#2b2b30' },
  { name: 'White', value: '#f4f1ea' },
  { name: 'Cream', value: '#efe6d2' },
  { name: 'Sky', value: '#9cc3e6' },
  { name: 'Teal', value: '#3d6b73' },
  { name: 'Forest', value: '#3f5b4c' },
  { name: 'Burgundy', value: '#5a1f2b' },
  { name: 'Wine', value: '#8a2d3b' },
  { name: 'Rose', value: '#d97a9b' },
  { name: 'Mustard', value: '#e0a43a' },
  { name: 'Gold', value: '#c9a24a' },
  { name: 'Leather', value: '#6b4a32' },
];

export interface AvatarUnlocks {
  member: boolean;
  earned: string[];
}

export const STARTER_ONLY: AvatarUnlocks = { member: false, earned: [] };

export interface UnlockResult {
  ok: boolean;
  need?: 'membership' | string;
}

export function itemUnlock(item: { tier: ItemTier; medal?: string }, unlocks: AvatarUnlocks): UnlockResult {
  if (item.tier === 'starter') return { ok: true };
  if (item.tier === 'member') return unlocks.member ? { ok: true } : { ok: false, need: 'membership' };
  return item.medal && unlocks.earned.includes(item.medal) ? { ok: true } : { ok: false, need: item.medal };
}

export function outfitItem(id: Outfit | undefined): OutfitItem {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}
export function headwearItem(id: Headwear | undefined): HeadwearItem {
  return HEADWEAR.find((h) => h.id === id) ?? HEADWEAR[0];
}
export function faceAccessoryItem(id: FaceAccessory | undefined): FaceAccessoryItem {
  return FACE_ACCESSORIES.find((f) => f.id === id) ?? FACE_ACCESSORIES[0];
}

// What other people see: the saved look with anything locked swapped for its
// fallback. The saved look itself is never changed, so rejoining restores it.
export function resolveAvatarForDisplay(config: AvatarConfigV2, unlocks: AvatarUnlocks): AvatarConfigV2 {
  const outfit = outfitItem(config.outfit);
  const headwear = headwearItem(config.headwear);
  const face = faceAccessoryItem(config.faceAccessory);
  const outfitOk = itemUnlock(outfit, unlocks).ok;
  const headwearOk = itemUnlock(headwear, unlocks).ok;
  const faceOk = itemUnlock(face, unlocks).ok;
  if (outfitOk && headwearOk && faceOk) return config;

  const next = { ...config };
  if (!outfitOk) {
    // The fallback wears its own colours: a burgundy vest colour makes no sense on a linen shirt.
    const fb = outfitItem(outfit.fallback);
    next.outfit = fb.id;
    next.outfitColor = fb.color;
    next.outfitAccent = fb.accent;
  }
  if (!headwearOk) next.headwear = headwear.fallback;
  if (!faceOk) next.faceAccessory = face.fallback;
  return next;
}

// A whole look in one tap. A kit is as locked as its most locked item.
export interface AvatarKit {
  id: string;
  label: string;
  description: string;
  icon: string;
  look: Partial<AvatarConfigV2>;
}

export const AVATAR_KITS: AvatarKit[] = [
  {
    id: 'lawyer', label: 'Lawyer', description: 'Sharp suit, silk tie', icon: '⚖️',
    look: { outfit: 'suit', outfitColor: '#1f2a44', outfitAccent: '#8a2d3b', headwear: 'none', faceAccessory: 'none' },
  },
  {
    id: 'chef', label: 'Chef', description: 'Whites and a proper toque', icon: '👨‍🍳',
    look: { outfit: 'chef', outfitColor: '#f4f1ea', outfitAccent: '#1f2937', headwear: 'chef_hat', faceAccessory: 'none' },
  },
  {
    id: 'doctor', label: 'Doctor', description: 'Lab coat and stethoscope', icon: '🩺',
    look: { outfit: 'labcoat', outfitColor: '#f7f7f5', outfitAccent: '#9cc3e6', headwear: 'none', faceAccessory: 'none' },
  },
  {
    id: 'pirate', label: 'Pirate', description: 'Tricorn, eyepatch, gold hoops', icon: '🏴‍☠️',
    look: { outfit: 'pirate', outfitColor: '#5a1f2b', outfitAccent: '#c9a24a', headwear: 'tricorn', faceAccessory: 'eyepatch', earrings: 'hoops' },
  },
];

export function kitItems(kit: AvatarKit): Array<{ tier: ItemTier; medal?: string }> {
  const items: Array<{ tier: ItemTier; medal?: string }> = [];
  if (kit.look.outfit) items.push(outfitItem(kit.look.outfit));
  if (kit.look.headwear) items.push(headwearItem(kit.look.headwear));
  if (kit.look.faceAccessory) items.push(faceAccessoryItem(kit.look.faceAccessory));
  return items;
}

export function kitUnlock(kit: AvatarKit, unlocks: AvatarUnlocks): UnlockResult {
  for (const item of kitItems(kit)) {
    const u = itemUnlock(item, unlocks);
    if (!u.ok) return u;
  }
  return { ok: true };
}

export function kitTier(kit: AvatarKit): ItemTier {
  const tiers = kitItems(kit).map((i) => i.tier);
  if (tiers.includes('earned')) return 'earned';
  if (tiers.includes('member')) return 'member';
  return 'starter';
}
