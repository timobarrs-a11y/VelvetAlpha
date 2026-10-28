import { renderToStaticMarkup } from 'react-dom/server';
import type { Companion } from '../../services/companionService';
import { migrateAvatarConfig } from '../../utils/avatarConfig';
import type { AvatarConfigV2, HairStyle } from '../../types/avatar-v2';
import { AvatarV2 } from '../../components/AvatarV2';
import { handSvg, HAND_POSES } from '../../renderers/handRenderer';
import { OUTFITS, BOTTOMS, HEADWEAR, PERSONAS, outfitItem, resolveBottom, type AvatarUnlocks } from '../../data/avatarItems';
import type { Wardrobe, WardrobePiece } from '../../games/velvet-house/state/clothing';
import { attireUnlocks } from '../../config/voiceAttire';
import { resolveLookForDisplay, canUse, itemId, lookUnlock } from '../../data/avatarCatalog';

// What Velvet Sims needs to know about the player and their companion: names,
// personality, and how they look. Shared by both versions of the game.

export type GameLook = { skin?: string; hair?: string; hairColor?: string; top?: string; eyeColor?: string; facialHair?: string; glasses?: string; gender?: 'male' | 'female' };
type GameGender = 'male' | 'female';

export interface PlayerProfile {
  name: string | null;
  nickname: string | null;
  avatar_config: Record<string, unknown> | null;
  favorite_color: string | null;
}

const COLOR_HEX: Record<string, string> = {
  red: '#A63A2C', burgundy: '#8A2D54', maroon: '#8A2D54', pink: '#D97A9B', orange: '#D9763A',
  yellow: '#E0A43A', gold: '#E0A43A', green: '#4F7A4A', teal: '#3D6B73', blue: '#4A5DA8',
  navy: '#2E3D6B', purple: '#6B4A8A', lavender: '#9A86B8', brown: '#7A4E31', black: '#2B2B30',
  white: '#F2EEE8', gray: '#6B6F86', grey: '#6B6F86',
};

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function colorToHex(color: string | null | undefined): string | undefined {
  if (!color) return undefined;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const key = color.toLowerCase().split(/\W+/).find((w: string) => COLOR_HEX[w]);
  return key ? COLOR_HEX[key] : undefined;
}

const GAME_HAIR: Partial<Record<HairStyle, string>> = {
  afro: 'afro', bun: 'bun', ponytail: 'ponytail', braids: 'braids',
  locs: 'locs', locs_short: 'locs', wavy: 'wavy', short_wavy: 'wavy',
  buzz: 'buzz', fade: 'fade', sleek: 'long', curly: 'long',
  bald: 'buzz', cornrows: 'braids', twists: 'locs', bantu_knots: 'bun', high_puff: 'afro',
  long_straight: 'long', bangs: 'long', top_knot: 'bun', undercut: 'fade', mohawk: 'fade',
  boho_braids: 'braids', goddess_locs: 'locs', barrel_twists: 'locs',
};

export function toGameLook(raw: Record<string, unknown> | null | undefined, favoriteColor?: string | null): GameLook | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const avatar = migrateAvatarConfig(raw);
  const gender: GameGender = avatar.gender === 'female' ? 'female' : 'male';
  return {
    skin: isHex(avatar.skinTone) ? avatar.skinTone : undefined,
    hairColor: isHex(avatar.hairColor) ? avatar.hairColor : undefined,
    hair: GAME_HAIR[avatar.hairStyle] ?? 'short',
    top: colorToHex(favoriteColor),
    eyeColor: isHex(avatar.eyeColor) ? avatar.eyeColor : undefined,
    facialHair: typeof avatar.facialHair === 'string' ? avatar.facialHair : undefined,
    glasses: typeof avatar.glasses === 'string' ? avatar.glasses : undefined,
    gender,
  };
}

// The real avatar head as SVG frames for the game (see the game's headSprites.ts).
export function buildHeadSprites(config: AvatarConfigV2): Record<string, string> {
  // A standalone SVG image needs its namespace, which inline React SVG leaves out.
  const frame = (props: Partial<React.ComponentProps<typeof AvatarV2>>) =>
    renderToStaticMarkup(<AvatarV2 config={config} part="head" {...props} />)
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return {
    neutral: frame({}),
    smile: frame({ mood: 'smile' }),
    sad: frame({ mood: 'sad' }),
    talk: frame({ mood: 'grin' }),
    blink: frame({ eyesClosed: true }),
    blinkSmile: frame({ eyesClosed: true, mood: 'smile' }),
    back: frame({ view: 'back' }),
  };
}

// The avatar's hands as SVG pieces in their skin tone (see the game's bodySprites.ts).
export function buildBodySprites(config: AvatarConfigV2): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pose of HAND_POSES) {
    out[pose] = renderToStaticMarkup(handSvg(pose, config.skinTone, `hand-${pose}`))
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  }
  return out;
}

// The avatar's outfit as a game top and trousers: the character's signature look.
const SIGNATURE_STYLE: Record<string, string> = {
  tee: 'tee', linen: 'linen', suit: 'blazer', chef: 'chef', labcoat: 'labcoat', pirate: 'pirate',
  rockstar: 'rockstar', cheer: 'cheer', cop: 'cop', scrubs: 'scrubs', streetwear: 'streetwear', president: 'president',
  letterman: 'letterman', hero: 'hero', cardigan: 'cardigan', uniform: 'uniform', doublet: 'doublet', sundress: 'sundress',
};

// The sim draws a plaid skirt as its plain skirt.
const simBottom = (id: string): string => (id === 'plaid_skirt' ? 'skirt' : id);

export function signatureOutfit(config: AvatarConfigV2) {
  const item = outfitItem(config.outfit);
  const color = config.outfitColor ?? item.color;
  const accent = config.outfitAccent ?? item.accent;
  // A pirate is a linen shirt under a vest: the vest colour becomes the accent.
  const top = item.id === 'pirate' ? '#EFE6D2' : color;
  const second = item.id === 'pirate' ? color : accent;
  const pants = resolveBottom(config);
  const style = SIGNATURE_STYLE[item.id] ?? 'tee';
  // The game draws the pants by their cut, in their colour and trim.
  return {
    style, color: top, accent: second, bottom: pants.color, bottomStyle: simBottom(pants.id), bottomAccent: pants.accent,
    key: [style, top, second, pants.color, simBottom(pants.id), pants.accent].join('|'),
  };
}

// Everything in the avatar wardrobe this person may wear, for the game's closet, and the personas that
// bundle it: a locked piece or persona is left out. Pieces are dressed in their own colours.
export function buildWardrobe(unlocks: AvatarUnlocks, hat: string = 'none'): Wardrobe {
  const pieces: WardrobePiece[] = [];
  for (const o of OUTFITS) {
    if (!canUse(itemId('outfit', o.id), unlocks).ok) continue;
    const sig = signatureOutfit(migrateAvatarConfig({ outfit: o.id, outfitColor: o.color, outfitAccent: o.accent }));
    pieces.push({ id: `w-top-${o.id}`, slot: 'top', style: sig.style, col: sig.color, accent: sig.accent, name: o.label });
  }
  for (const b of BOTTOMS) {
    if (canUse(itemId('bottom', b.id), unlocks).ok) pieces.push({ id: `w-bottom-${b.id}`, slot: 'bottom', style: simBottom(b.id), col: b.color, accent: b.accent, name: b.label });
  }
  for (const h of HEADWEAR) {
    if (canUse(itemId('headwear', h.id), unlocks).ok) pieces.push({ id: `w-hat-${h.id}`, slot: 'hat', style: h.id, col: '#8E9C96', name: h.id === 'none' ? 'No hat' : h.label });
  }
  const have = new Set(pieces.map(p => p.id));
  const personas = PERSONAS
    .filter(p => lookUnlock(p.look, unlocks).ok && have.has(`w-top-${p.top}`) && have.has(`w-bottom-${p.bottom}`) && have.has(`w-hat-${p.hat}`))
    .map(p => ({
      id: p.id, label: p.label, icon: p.icon, top: `w-top-${p.top}`, bottom: `w-bottom-${p.bottom}`, hat: `w-hat-${p.hat}`,
      ...(p.look.bottomColor && p.look.bottomColor !== bottomDefault(p.bottom) ? { bottomCol: p.look.bottomColor } : {}),
    }));
  return { pieces, personas, hat };
}

function bottomDefault(id: string): string | undefined {
  return BOTTOMS.find(b => b.id === id)?.color;
}

// What changing clothes in the game does to the avatar. The game's shirts that the avatar has no match for
// (a hoodie, a flannel) come across as a tee in the same colour; the shop's plain pants as jeans.
const OUTFIT_FROM_GAME: Record<string, string> = Object.fromEntries([
  ...Object.entries(SIGNATURE_STYLE).map(([outfit, style]) => [style, outfit]),
]);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const hexOr = (v: unknown): string | undefined => (typeof v === 'string' && HEX_COLOR.test(v) ? v : undefined);

export function avatarFromGameLook(change: {
  top?: { style: string; color: string; accent?: string };
  bottom?: { style: string; color: string; accent?: string };
  hat?: string;
}): Partial<AvatarConfigV2> {
  const out: Partial<AvatarConfigV2> = {};
  if (change.top && hexOr(change.top.color)) {
    const outfit = (OUTFIT_FROM_GAME[change.top.style] ?? 'tee') as AvatarConfigV2['outfit'];
    const accent = hexOr(change.top.accent);
    out.outfit = outfit;
    // A pirate's vest colour travels as the game accent, over a cream shirt.
    if (outfit === 'pirate') { if (accent) out.outfitColor = accent; } else { out.outfitColor = change.top.color; if (accent) out.outfitAccent = accent; }
  }
  if (change.bottom && hexOr(change.bottom.color)) {
    const id = BOTTOMS.find(b => b.id === change.bottom!.style)?.id ?? (change.bottom.style === 'pants' ? 'jeans' : undefined);
    if (id) {
      out.bottom = id;
      out.bottomColor = change.bottom.color;
      out.bottomAccent = hexOr(change.bottom.accent) ?? BOTTOMS.find(b => b.id === id)!.accent;
    }
  }
  if (typeof change.hat === 'string' && HEADWEAR.some(h => h.id === change.hat)) out.headwear = change.hat as AvatarConfigV2['headwear'];
  return out;
}

// The head and hands the game redraws after a change that alters them (a new hat).
export function buildAvatarLook(config: AvatarConfigV2) {
  return { type: 'velvet:avatarLook', who: 'player', sprites: buildHeadSprites(config), body: buildBodySprites(config) };
}

// The full look for the rebuilt game: real head and signature outfit, with
// anything the person can't currently wear swapped out as it is everywhere else.
function simLook(raw: Record<string, unknown> | null | undefined, favoriteColor: string | null | undefined, unlocks: AvatarUnlocks) {
  const base = toGameLook(raw, favoriteColor);
  if (!base || !raw) return base;
  const config = resolveLookForDisplay(migrateAvatarConfig(raw), unlocks);
  const { top: _favorite, ...rest } = base;
  return { ...rest, sprites: buildHeadSprites(config), body: buildBodySprites(config), outfit: signatureOutfit(config) };
}

// `avatar`: send the real avatar (heads and signature outfit), for the rebuilt game.
export function buildProfile(player: PlayerProfile | null, companion: Companion, includeLooks: boolean, avatar?: AvatarUnlocks) {
  // A companion wears their signature voice's attire whatever the player's membership.
  const look = (raw: Record<string, unknown> | null | undefined, color: string | null | undefined, voice?: string | null) =>
    avatar ? simLook(raw, color, voice ? attireUnlocks(avatar, voice) : avatar) : toGameLook(raw, color);
  const personality = [companion.communication_style, companion.humor_style, companion.signature_voice]
    .filter(Boolean)
    .join('. ');
  const likes = [...(companion.hobbies || []), companion.interest_text, companion.favorite_color]
    .filter(Boolean) as string[];

  const playerLook = includeLooks ? look(player?.avatar_config, player?.favorite_color) : undefined;
  return {
    type: 'velvet:profile',
    player: {
      name: (player?.nickname || player?.name || '').trim().slice(0, 16),
      // The player can change into anything in the wardrobe they may wear; their companion just wears their own.
      look: playerLook && avatar
        ? { ...playerLook, wardrobe: buildWardrobe(avatar, resolveLookForDisplay(migrateAvatarConfig(player?.avatar_config), avatar).headwear ?? 'none') }
        : playerLook,
    },
    companion: {
      name: companion.custom_name,
      pronoun: companion.gender === 'male' ? 'he' : companion.gender === 'female' ? 'she' : 'they',
      gender: companion.gender,
      personality: personality || 'warm, curious, playful',
      humor: companion.humor_style ?? undefined,
      communication: companion.communication_style ?? undefined,
      relationship: companion.relationship_type,
      look: includeLooks
        ? look(companion.avatar_config as Record<string, unknown> | undefined, companion.favorite_color, companion.signature_voice)
        : undefined,
      memories: [],
      likes,
      dislikes: [],
    },
  };
}

