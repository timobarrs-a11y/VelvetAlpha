import type { AvatarConfigV2, Outfit, Bottom, Headwear, FaceAccessory } from '../types/avatar-v2';

// The wardrobe, and who may wear what. Same three tiers as the Velvet World
// houses (src/features/velvet-world/art/streetArt.js):
//   starter: everyone
//   member:  paid members; locked while a plan has lapsed, and kept for when they return
//   earned:  one medal each, never for sale, never locked by a lapsed plan
// A locked item is shown as its fallback, which is always a starter item.

export type ItemTier = 'starter' | 'member' | 'earned';
export type ItemSlot = 'outfit' | 'bottom' | 'headwear' | 'faceAccessory';

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
  // The pants this shirt comes with when none are picked ('outfit': same colour as the shirt, for a suit).
  matchBottom: Bottom;
  matchBottomColor?: string;
}
export interface BottomItem extends ItemBase<Bottom> {
  color: string;
  accent: string;
  colorLabel: string;
  accentLabel: string;
}
export type HeadwearItem = ItemBase<Headwear>;
export type FaceAccessoryItem = ItemBase<FaceAccessory>;

export const OUTFITS: OutfitItem[] = [
  { id: 'tee', label: 'Tee', tier: 'starter', fallback: 'tee', color: '#1e293b', accent: '#2d3748', colorLabel: 'Shirt', accentLabel: 'Neckline', matchBottom: 'jeans', matchBottomColor: '#3D5B8A' },
  { id: 'linen', label: 'Linen shirt', tier: 'starter', fallback: 'linen', color: '#efe6d2', accent: '#8a6a4a', colorLabel: 'Shirt', accentLabel: 'Laces', matchBottom: 'trousers', matchBottomColor: '#6B5A45' },
  { id: 'suit', label: 'Suit & tie', tier: 'starter', fallback: 'suit', color: '#1f2a44', accent: '#8a2d3b', colorLabel: 'Jacket', accentLabel: 'Tie', matchBottom: 'trousers', matchBottomColor: 'outfit' },
  { id: 'chef', label: 'Chef whites', tier: 'starter', fallback: 'chef', color: '#f4f1ea', accent: '#1f2937', colorLabel: 'Jacket', accentLabel: 'Buttons', matchBottom: 'chef_pants' },
  { id: 'labcoat', label: 'Lab coat', tier: 'starter', fallback: 'labcoat', color: '#f7f7f5', accent: '#9cc3e6', colorLabel: 'Coat', accentLabel: 'Shirt', matchBottom: 'trousers', matchBottomColor: '#3A4250' },
  { id: 'pirate', label: 'Pirate garb', tier: 'member', fallback: 'linen', color: '#5a1f2b', accent: '#c9a24a', colorLabel: 'Vest', accentLabel: 'Trim', matchBottom: 'breeches' },
  { id: 'cheer', label: 'Cheer top', tier: 'starter', fallback: 'tee', color: '#c2262e', accent: '#f4f1ea', colorLabel: 'Top', accentLabel: 'Trim', matchBottom: 'cheer_skirt' },
  { id: 'cop', label: 'Police shirt', tier: 'starter', fallback: 'tee', color: '#2c4a7a', accent: '#c9a24a', colorLabel: 'Shirt', accentLabel: 'Badge', matchBottom: 'cop_pants' },
  { id: 'scrubs', label: 'Scrubs', tier: 'starter', fallback: 'tee', color: '#4fa3a5', accent: '#e8f3f3', colorLabel: 'Scrubs', accentLabel: 'Trim', matchBottom: 'scrub_pants' },
  { id: 'rockstar', label: 'Rockstar jacket', tier: 'member', fallback: 'tee', color: '#17171b', accent: '#b8bcc4', colorLabel: 'Jacket', accentLabel: 'Studs', matchBottom: 'leather' },
  { id: 'streetwear', label: 'Streetwear hoodie', tier: 'member', fallback: 'tee', color: '#e0a43a', accent: '#17171b', colorLabel: 'Hoodie', accentLabel: 'Logo', matchBottom: 'baggy' },
  { id: 'president', label: 'Presidential suit', tier: 'member', fallback: 'suit', color: '#14213d', accent: '#b3202f', colorLabel: 'Jacket', accentLabel: 'Tie', matchBottom: 'trousers', matchBottomColor: 'outfit' },
];

export const BOTTOMS: BottomItem[] = [
  { id: 'jeans', label: 'Jeans', tier: 'starter', fallback: 'jeans', color: '#3D5B8A', accent: '#2E3F63', colorLabel: 'Denim', accentLabel: 'Stitching' },
  { id: 'trousers', label: 'Trousers', tier: 'starter', fallback: 'trousers', color: '#2b2f3a', accent: '#1c1f27', colorLabel: 'Trousers', accentLabel: 'Belt' },
  { id: 'shorts', label: 'Shorts', tier: 'starter', fallback: 'shorts', color: '#c9b79c', accent: '#8a7a60', colorLabel: 'Shorts', accentLabel: 'Hem' },
  { id: 'skirt', label: 'Skirt', tier: 'starter', fallback: 'skirt', color: '#2b2b30', accent: '#8a7a60', colorLabel: 'Skirt', accentLabel: 'Hem' },
  { id: 'chef_pants', label: 'Chef pants', tier: 'starter', fallback: 'chef_pants', color: '#2B2B30', accent: '#f4f1ea', colorLabel: 'Pants', accentLabel: 'Check' },
  { id: 'cheer_skirt', label: 'Cheer skirt', tier: 'starter', fallback: 'cheer_skirt', color: '#c2262e', accent: '#f4f1ea', colorLabel: 'Skirt', accentLabel: 'Trim' },
  { id: 'cop_pants', label: 'Uniform trousers', tier: 'starter', fallback: 'cop_pants', color: '#1f2f4f', accent: '#17171b', colorLabel: 'Trousers', accentLabel: 'Belt' },
  { id: 'scrub_pants', label: 'Scrub pants', tier: 'starter', fallback: 'scrub_pants', color: '#4fa3a5', accent: '#e8f3f3', colorLabel: 'Pants', accentLabel: 'Drawstring' },
  { id: 'breeches', label: 'Breeches', tier: 'member', fallback: 'trousers', color: '#4A3A2A', accent: '#2b1d12', colorLabel: 'Breeches', accentLabel: 'Boots' },
  { id: 'leather', label: 'Leather pants', tier: 'member', fallback: 'jeans', color: '#16161a', accent: '#b8bcc4', colorLabel: 'Leather', accentLabel: 'Studs' },
  { id: 'baggy', label: 'Baggy jeans', tier: 'member', fallback: 'jeans', color: '#5a7aa6', accent: '#2E3F63', colorLabel: 'Denim', accentLabel: 'Stitching' },
];

export const HEADWEAR: HeadwearItem[] = [
  { id: 'none', label: 'None', tier: 'starter', fallback: 'none' },
  { id: 'chef_hat', label: "Chef's hat", tier: 'starter', fallback: 'none' },
  { id: 'bandana', label: 'Bandana', tier: 'member', fallback: 'none' },
  { id: 'tricorn', label: 'Tricorn', tier: 'member', fallback: 'none' },
  { id: 'top_hat', label: 'Top hat', tier: 'earned', medal: 'hat-trick', fallback: 'none' },
  // Everyday hats are free for everyone. Keep new starter items out of the
  // member/earned lists in sanitize_avatar_config unless the database changes with them.
  { id: 'beanie', label: 'Beanie', tier: 'starter', fallback: 'none' },
  { id: 'baseball_cap', label: 'Baseball cap', tier: 'starter', fallback: 'none' },
  { id: 'bucket_hat', label: 'Bucket hat', tier: 'starter', fallback: 'none' },
  { id: 'headband', label: 'Headband', tier: 'starter', fallback: 'none' },
  { id: 'headwrap', label: 'Head wrap', tier: 'starter', fallback: 'none' },
  { id: 'beret', label: 'Beret', tier: 'starter', fallback: 'none' },
  { id: 'cowboy_hat', label: 'Cowboy hat', tier: 'starter', fallback: 'none' },
  { id: 'cop_cap', label: 'Police cap', tier: 'starter', fallback: 'none' },
  { id: 'nurse_cap', label: 'Nurse cap', tier: 'starter', fallback: 'none' },
  { id: 'hair_bow', label: 'Hair bow', tier: 'starter', fallback: 'none' },
  { id: 'snapback', label: 'Snapback cap', tier: 'member', fallback: 'none' },
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
  { name: 'Black', value: '#17171b' },
  { name: 'Red', value: '#c2262e' },
  { name: 'Aqua', value: '#4fa3a5' },
  { name: 'Denim', value: '#3d5b8a' },
  { name: 'Khaki', value: '#c9b79c' },
  { name: 'Purple', value: '#7a2f9b' },
];

export interface AvatarUnlocks {
  member: boolean;
  earned: string[];
  // Items this person owns (avatar_inventory): bought in Velvet Sims, won, or granted.
  owned?: string[];
}

export const STARTER_ONLY: AvatarUnlocks = { member: false, earned: [], owned: [] };

export interface UnlockResult {
  ok: boolean;
  // 'membership', a medal slug, 'sims' (the Velvet Sims shop) or 'reward'.
  need?: 'membership' | 'sims' | 'reward' | string;
}

export function itemUnlock(item: { tier: ItemTier; medal?: string }, unlocks: AvatarUnlocks): UnlockResult {
  if (item.tier === 'starter') return { ok: true };
  if (item.tier === 'member') return unlocks.member ? { ok: true } : { ok: false, need: 'membership' };
  return item.medal && unlocks.earned.includes(item.medal) ? { ok: true } : { ok: false, need: item.medal };
}

export function outfitItem(id: Outfit | undefined): OutfitItem {
  return OUTFITS.find((o) => o.id === id) ?? OUTFITS[0];
}
export function bottomItem(id: Bottom | undefined): BottomItem {
  return BOTTOMS.find((b) => b.id === id) ?? BOTTOMS[0];
}

/**
 * The pants someone is wearing. With none picked they match the shirt (a chef's whites come with
 * chef pants), which is also how every avatar saved before pants existed keeps the trousers it had.
 */
export function resolveBottom(config: Partial<AvatarConfigV2>): { id: Bottom; color: string; accent: string; matched: boolean } {
  if (!config.bottom) {
    const top = outfitItem(config.outfit);
    const b = bottomItem(top.matchBottom);
    const color = top.matchBottomColor === 'outfit' ? (config.outfitColor ?? top.color) : (top.matchBottomColor ?? b.color);
    return { id: b.id, color, accent: b.accent, matched: true };
  }
  const b = bottomItem(config.bottom);
  return { id: b.id, color: config.bottomColor ?? b.color, accent: config.bottomAccent ?? b.accent, matched: false };
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
  const bottom = config.bottom ? bottomItem(config.bottom) : null;
  const headwear = headwearItem(config.headwear);
  const face = faceAccessoryItem(config.faceAccessory);
  // Owning an item outright (a gift, a reward) counts whatever its tier.
  const owns = (slot: string, id: string) => !!unlocks.owned?.includes(`${slot}:${id}`);
  const outfitOk = owns('outfit', outfit.id) || itemUnlock(outfit, unlocks).ok;
  const bottomOk = !bottom || owns('bottom', bottom.id) || itemUnlock(bottom, unlocks).ok;
  const headwearOk = owns('headwear', headwear.id) || itemUnlock(headwear, unlocks).ok;
  const faceOk = owns('faceAccessory', face.id) || itemUnlock(face, unlocks).ok;
  if (outfitOk && bottomOk && headwearOk && faceOk) return config;

  const next = { ...config };
  if (!outfitOk) {
    // The fallback wears its own colours: a burgundy vest colour makes no sense on a linen shirt.
    const fb = outfitItem(outfit.fallback);
    next.outfit = fb.id;
    next.outfitColor = fb.color;
    next.outfitAccent = fb.accent;
  }
  if (!bottomOk && bottom) {
    const fb = bottomItem(bottom.fallback);
    next.bottom = fb.id;
    next.bottomColor = fb.color;
    next.bottomAccent = fb.accent;
  }
  if (!headwearOk) next.headwear = headwear.fallback;
  if (!faceOk) next.faceAccessory = face.fallback;
  return next;
}

// A persona: a whole look in one tap, made of a shirt, pants and a hat (plus the odd extra, like a
// chain or shades). Each piece is its own slot, so anyone can wear a chef's whites with a rockstar's
// leather pants. A persona is as locked as its most locked piece.
export interface AvatarPersona {
  id: string;
  label: string;
  description: string;
  icon: string;
  top: Outfit;
  bottom: Bottom;
  hat: Headwear;
  // Everything it sets, ready to apply to an avatar.
  look: Partial<AvatarConfigV2>;
}

function persona(
  id: string, label: string, description: string, icon: string,
  pieces: { top: Outfit; bottom: Bottom; hat: Headwear },
  extras: Partial<AvatarConfigV2> = {},
): AvatarPersona {
  const top = outfitItem(pieces.top), bottom = bottomItem(pieces.bottom);
  return {
    id, label, description, icon, ...pieces,
    look: {
      outfit: top.id, outfitColor: top.color, outfitAccent: top.accent,
      bottom: bottom.id, bottomColor: bottom.color, bottomAccent: bottom.accent,
      headwear: pieces.hat, faceAccessory: 'none',
      ...extras,
    },
  };
}

export const PERSONAS: AvatarPersona[] = [
  persona('lawyer', 'Lawyer', 'Sharp suit, silk tie', '⚖️', { top: 'suit', bottom: 'trousers', hat: 'none' }, { bottomColor: '#1f2a44' }),
  persona('chef', 'Chef', 'Whites and a proper toque', '👨‍🍳', { top: 'chef', bottom: 'chef_pants', hat: 'chef_hat' }),
  persona('doctor', 'Doctor', 'Lab coat and stethoscope', '🩺', { top: 'labcoat', bottom: 'trousers', hat: 'none' }, { bottomColor: '#3A4250' }),
  persona('cop', 'Cop', 'Uniform, badge and cap', '👮', { top: 'cop', bottom: 'cop_pants', hat: 'cop_cap' }),
  persona('nurse', 'Nurse', 'Scrubs and a nurse cap', '💉', { top: 'scrubs', bottom: 'scrub_pants', hat: 'nurse_cap' }),
  persona('cheerleader', 'Cheerleader', 'Team top, pleated skirt, hair bow', '📣', { top: 'cheer', bottom: 'cheer_skirt', hat: 'hair_bow' }),
  persona('pirate', 'Pirate', 'Tricorn, eyepatch, gold hoops', '🏴‍☠️', { top: 'pirate', bottom: 'breeches', hat: 'tricorn' }, { faceAccessory: 'eyepatch', earrings: 'hoops' }),
  persona('rockstar', 'Rockstar', 'Studded leather, bandana, shades', '🎸', { top: 'rockstar', bottom: 'leather', hat: 'bandana' }, { glasses: 'aviator' }),
  persona('rapper', 'Rapper', 'Hoodie, baggy jeans, snapback, chain', '🎤', { top: 'streetwear', bottom: 'baggy', hat: 'snapback' }, { necklace: 'chain', necklaceColor: '#c9a24a' }),
  persona('president', 'President', 'Dark suit, red tie, flag pin', '🇺🇸', { top: 'president', bottom: 'trousers', hat: 'none' }, { bottomColor: '#14213d' }),
];

// The old name for personas, kept so nothing that reads kits breaks.
export type AvatarKit = AvatarPersona;
export const AVATAR_KITS = PERSONAS;

export function kitItems(kit: AvatarKit): Array<{ tier: ItemTier; medal?: string }> {
  const items: Array<{ tier: ItemTier; medal?: string }> = [];
  if (kit.look.outfit) items.push(outfitItem(kit.look.outfit));
  if (kit.look.bottom) items.push(bottomItem(kit.look.bottom));
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

/** Which persona a look is wearing, when its shirt, pants and hat all belong to the same one (colours aside). */
export function personaOf(config: Partial<AvatarConfigV2>): AvatarPersona | null {
  const top = outfitItem(config.outfit).id, bottom = resolveBottom(config).id, hat = config.headwear ?? 'none';
  return PERSONAS.find((p) => p.top === top && p.bottom === bottom && p.hat === hat) ?? null;
}

/** Just one piece of a persona (its shirt, pants or hat), with its own colours, to mix into any look. */
export function personaPiece(p: AvatarPersona, piece: 'top' | 'bottom' | 'hat'): Partial<AvatarConfigV2> {
  const l = p.look;
  if (piece === 'top') return { outfit: l.outfit, outfitColor: l.outfitColor, outfitAccent: l.outfitAccent };
  if (piece === 'bottom') return { bottom: l.bottom, bottomColor: l.bottomColor, bottomAccent: l.bottomAccent };
  return { headwear: l.headwear };
}
