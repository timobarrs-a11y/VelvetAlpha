import { renderToStaticMarkup } from 'react-dom/server';
import type { Companion } from '../../services/companionService';
import { migrateAvatarConfig } from '../../utils/avatarConfig';
import type { AvatarConfigV2, HairStyle } from '../../types/avatar-v2';
import { AvatarV2 } from '../../components/AvatarV2';
import { outfitItem, type AvatarUnlocks } from '../../data/avatarItems';
import { resolveLookForDisplay } from '../../data/avatarCatalog';

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

// The avatar's outfit as a game top and trousers: the character's signature look.
const SIGNATURE_STYLE: Record<string, string> = {
  tee: 'tee', linen: 'linen', suit: 'blazer', chef: 'chef', labcoat: 'labcoat', pirate: 'pirate',
};
const SIGNATURE_BOTTOM: Record<string, string> = {
  tee: '#3D5B8A', linen: '#6B5A45', chef: '#2B2B30', labcoat: '#3A4250', pirate: '#4A3A2A',
};

export function signatureOutfit(config: AvatarConfigV2) {
  const item = outfitItem(config.outfit);
  const color = config.outfitColor ?? item.color;
  const accent = config.outfitAccent ?? item.accent;
  // A pirate is a linen shirt under a vest: the vest colour becomes the accent.
  const top = item.id === 'pirate' ? '#EFE6D2' : color;
  const second = item.id === 'pirate' ? color : accent;
  const bottom = item.id === 'suit' ? color : SIGNATURE_BOTTOM[item.id] ?? '#3D5B8A';
  const style = SIGNATURE_STYLE[item.id] ?? 'tee';
  return { style, color: top, accent: second, bottom, key: [style, top, second, bottom].join('|') };
}

// The full look for the rebuilt game: real head and signature outfit, with
// anything the person can't currently wear swapped out as it is everywhere else.
function simLook(raw: Record<string, unknown> | null | undefined, favoriteColor: string | null | undefined, unlocks: AvatarUnlocks) {
  const base = toGameLook(raw, favoriteColor);
  if (!base || !raw) return base;
  const config = resolveLookForDisplay(migrateAvatarConfig(raw), unlocks);
  const { top: _favorite, ...rest } = base;
  return { ...rest, sprites: buildHeadSprites(config), outfit: signatureOutfit(config) };
}

// `avatar`: send the real avatar (heads and signature outfit), for the rebuilt game.
export function buildProfile(player: PlayerProfile | null, companion: Companion, includeLooks: boolean, avatar?: AvatarUnlocks) {
  const look = (raw: Record<string, unknown> | null | undefined, color: string | null | undefined) =>
    avatar ? simLook(raw, color, avatar) : toGameLook(raw, color);
  const personality = [companion.communication_style, companion.humor_style, companion.signature_voice]
    .filter(Boolean)
    .join('. ');
  const likes = [...(companion.hobbies || []), companion.interest_text, companion.favorite_color]
    .filter(Boolean) as string[];

  return {
    type: 'velvet:profile',
    player: {
      name: (player?.nickname || player?.name || '').trim().slice(0, 16),
      look: includeLooks ? look(player?.avatar_config, player?.favorite_color) : undefined,
    },
    companion: {
      name: companion.custom_name,
      pronoun: companion.gender === 'male' ? 'he' : companion.gender === 'female' ? 'she' : 'they',
      gender: companion.gender,
      personality: personality || 'warm, curious, playful',
      look: includeLooks
        ? look(companion.avatar_config as Record<string, unknown> | undefined, companion.favorite_color)
        : undefined,
      memories: [],
      likes,
      dislikes: [],
    },
  };
}

