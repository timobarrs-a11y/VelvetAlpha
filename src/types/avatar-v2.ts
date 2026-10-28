export type Gender = 'male' | 'female';

// Every style is open to everyone. Before version 4, 'sleek', 'wavy' and
// 'locs' meant a short cut on a male avatar; migrateAvatarConfig renames those.
export type HairStyle =
  | 'buzz' | 'fade' | 'short' | 'short_wavy' | 'slick_back' | 'afro' | 'locs_short'
  | 'bun' | 'ponytail' | 'sleek' | 'wavy' | 'curly' | 'braids' | 'locs'
  | 'bald' | 'cornrows' | 'twists' | 'bantu_knots' | 'high_puff' | 'long_straight'
  | 'bob' | 'pixie' | 'bangs' | 'top_knot' | 'undercut' | 'mohawk'
  | 'boho_braids' | 'goddess_locs' | 'barrel_twists';

export type LipShape = 'natural' | 'full' | 'thin' | 'heart';
export type EyebrowShape = 'natural' | 'arched' | 'straight' | 'thick' | 'thin' | 'bushy' | 'rounded';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'goatee' | 'mustache';
export type Eyelashes = 'none' | 'dramatic';
export type Freckles = 'none' | 'light' | 'heavy' | 'beauty_mark';
export type Glasses = 'none' | 'round' | 'square' | 'cat-eye' | 'aviator';
export type Earrings = 'none' | 'studs' | 'hoops' | 'dangles' | 'gauges';
export type NosePiercing = 'none' | 'nostril_stud' | 'nose_ring';
export type LipPiercing = 'none' | 'labret' | 'lip_ring' | 'snake_bites';
export type Necklace = 'none' | 'chain' | 'choker' | 'pendant' | 'pearls';

export type EyeShape = 'almond' | 'round' | 'hooded' | 'wide' | 'monolid' | 'deepset' | 'upturned' | 'downturned' | 'narrow';
export type NoseShape = 'button' | 'straight' | 'broad' | 'upturned' | 'aquiline' | 'hawk' | 'flat';
export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'diamond' | 'oblong';
export type BodyType = 'slim' | 'average' | 'athletic' | 'curvy';
export type Tattoo = 'none' | 'neck' | 'forearm' | 'collarbone';
export type Blush = 'none' | 'soft' | 'bold';

export type HairTexture = 'straight' | 'wavy' | 'coily';
export type HairLength = 'short' | 'medium' | 'long';
export type MakeupIntensity = 'none' | 'subtle' | 'glam';
export type EyeShadow = 'none' | 'smoky' | 'natural' | 'colorful';
export type Eyeliner = 'none' | 'thin' | 'winged' | 'bold';
export type SkinDetail = 'none' | 'smooth' | 'textured';

// Wardrobe. Which of these a person may wear lives in src/data/avatarItems.ts.
// The shirt (top), the pants (bottom) and the hat are three separate slots; a persona is just a preset for all three.
export type Outfit = 'tee' | 'linen' | 'suit' | 'chef' | 'labcoat' | 'pirate'
  | 'rockstar' | 'cheer' | 'cop' | 'scrubs' | 'streetwear' | 'president'
  // The signature voices' own: a varsity jacket, a tee with a long scarf, a cardigan and bow tie, a school sailor
  // uniform, an Elizabethan doublet and a sundress.
  | 'letterman' | 'hero' | 'cardigan' | 'uniform' | 'doublet' | 'sundress';
export type Bottom = 'jeans' | 'trousers' | 'breeches' | 'chef_pants' | 'leather' | 'cheer_skirt'
  | 'cop_pants' | 'scrub_pants' | 'baggy' | 'shorts' | 'skirt' | 'plaid_skirt';
export type Headwear =
  | 'none' | 'chef_hat' | 'bandana' | 'tricorn' | 'top_hat'
  | 'beanie' | 'baseball_cap' | 'cowboy_hat' | 'beret' | 'headband' | 'bucket_hat' | 'headwrap'
  | 'cop_cap' | 'nurse_cap' | 'hair_bow' | 'snapback';
export type FaceAccessory = 'none' | 'eyepatch' | 'fox_mask';

export const AVATAR_CONFIG_VERSION = 4 as const;
export type AvatarConfigVersion = typeof AVATAR_CONFIG_VERSION;

export interface AvatarConfigV2 {
  _version?: AvatarConfigVersion;
  gender: Gender;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
  // Streaks of a second colour through the hair; 'none' (or unset) for none.
  hairHighlight?: string;
  hairStyle: HairStyle;
  hairTexture: HairTexture;
  lipShape: LipShape;
  lipColor: string;
  eyebrowShape: EyebrowShape;
  eyeShape: EyeShape;
  noseShape: NoseShape;
  faceShape: FaceShape;
  bodyType: BodyType;
  facialHair: FacialHair;
  eyelashes: Eyelashes;
  freckles: Freckles;
  blush: Blush;
  glasses: Glasses;
  // The colour of the frames, as #rrggbb. Unset means the classic black.
  glassesColor?: string;
  earrings: Earrings;
  nosePiercing: NosePiercing;
  lipPiercing: LipPiercing;
  necklace: Necklace;
  necklaceColor: string;
  tattoo: Tattoo;
  hairLength?: HairLength;
  makeupIntensity?: MakeupIntensity;
  eyeShadow?: EyeShadow;
  eyeliner?: Eyeliner;
  skinDetail?: SkinDetail;
  outfit?: Outfit;
  outfitColor?: string;
  outfitAccent?: string;
  // The pants. Unset means "matches the shirt" (a chef's whites come with chef pants), so older
  // avatars keep the trousers they always had; set one to mix and match.
  bottom?: Bottom;
  bottomColor?: string;
  bottomAccent?: string;
  headwear?: Headwear;
  faceAccessory?: FaceAccessory;
  // Fine-tuning on top of the shapes above, each from -1 to 1 (0 = as drawn).
  faceTune?: FaceTune;
}

// Proportions that vary from person to person, in any combination, so any
// real face can be built. No presets by heritage: just the features.
export interface FaceTune {
  faceWidth?: number;
  jawWidth?: number;
  eyeSize?: number;
  eyeSpacing?: number;
  eyeTilt?: number;
  noseWidth?: number;
  noseLength?: number;
  noseBridge?: number;
  mouthWidth?: number;
  lipFullness?: number;
}

export const FACE_TUNE_SLIDERS: Array<{ key: keyof FaceTune; label: string; low: string; high: string }> = [
  { key: 'faceWidth', label: 'Face width', low: 'Narrow', high: 'Wide' },
  { key: 'jawWidth', label: 'Jaw', low: 'Tapered', high: 'Broad' },
  { key: 'eyeSize', label: 'Eye size', low: 'Smaller', high: 'Larger' },
  { key: 'eyeSpacing', label: 'Eye spacing', low: 'Close', high: 'Wide-set' },
  { key: 'eyeTilt', label: 'Eye tilt', low: 'Down-turned', high: 'Up-turned' },
  { key: 'noseWidth', label: 'Nose width', low: 'Narrow', high: 'Wide' },
  { key: 'noseLength', label: 'Nose length', low: 'Short', high: 'Long' },
  { key: 'noseBridge', label: 'Nose bridge', low: 'Low', high: 'High' },
  { key: 'mouthWidth', label: 'Mouth width', low: 'Narrow', high: 'Wide' },
  { key: 'lipFullness', label: 'Lip fullness', low: 'Thinner', high: 'Fuller' },
];

// A slider's value, kept within -1..1 whatever was stored.
export function tuneOf(t: FaceTune | undefined, key: keyof FaceTune): number {
  const v = Number(t?.[key] ?? 0);
  return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}

const V3_REQUIRED: Pick<AvatarConfigV2, 'hairTexture'> = { hairTexture: 'straight' };

export const DEFAULT_MALE_AVATAR_V2: AvatarConfigV2 = {
  ...V3_REQUIRED,
  gender: 'male',
  skinTone: '#f4c2a0',
  eyeColor: '#6b4423',
  hairColor: '#2a1f1a',
  hairStyle: 'short',
  lipShape: 'natural',
  lipColor: '#c4917c',
  eyebrowShape: 'natural',
  eyeShape: 'almond',
  noseShape: 'straight',
  faceShape: 'oval',
  bodyType: 'average',
  facialHair: 'none',
  eyelashes: 'none',
  freckles: 'none',
  blush: 'none',
  glasses: 'none',
  earrings: 'none',
  nosePiercing: 'none',
  lipPiercing: 'none',
  necklace: 'none',
  necklaceColor: '#C0C0C0',
  tattoo: 'none',
};

export const DEFAULT_FEMALE_AVATAR_V2: AvatarConfigV2 = {
  ...V3_REQUIRED,
  gender: 'female',
  skinTone: '#f4c2a0',
  eyeColor: '#6b4423',
  hairColor: '#2a1f1a',
  hairStyle: 'sleek',
  lipShape: 'natural',
  lipColor: '#d88e89',
  eyebrowShape: 'arched',
  eyeShape: 'almond',
  noseShape: 'button',
  faceShape: 'oval',
  bodyType: 'average',
  facialHair: 'none',
  eyelashes: 'none',
  freckles: 'none',
  blush: 'soft',
  glasses: 'none',
  earrings: 'none',
  nosePiercing: 'none',
  lipPiercing: 'none',
  necklace: 'none',
  necklaceColor: '#C0C0C0',
  tattoo: 'none',
};

interface Swatch { name: string; value: string; }

export const SKIN_TONES: Swatch[] = [
  { name: 'Porcelain', value: '#fde8d7' },
  { name: 'Rosy', value: '#f2cbbb' },
  { name: 'Ivory', value: '#f5d6c0' },
  { name: 'Light', value: '#f4c2a0' },
  { name: 'Beige', value: '#e8b890' },
  { name: 'Sand', value: '#dcb48e' },
  { name: 'Olive', value: '#d4a373' },
  { name: 'Golden', value: '#c69b6e' },
  { name: 'Tan', value: '#c68952' },
  { name: 'Deep Olive', value: '#a88451' },
  { name: 'Bronze', value: '#b07a4e' },
  { name: 'Honey', value: '#a86f44' },
  { name: 'Caramel', value:'#9c6334' },
  { name: 'Chestnut', value: '#875330' },
  { name: 'Brown', value: '#7d4a2e' },
  { name: 'Mahogany', value: '#6d4428' },
  { name: 'Cocoa', value: '#5a3521' },
  { name: 'Espresso', value: '#4a2c1a' },
  { name: 'Ebony', value: '#3a2010' },
  { name: 'Deep Ebony', value: '#2a170d' },
];

export const SKIN_UNDERTONES: Record<string, 'warm' | 'cool' | 'neutral'> = {
  '#fde8d7': 'cool',
  '#f5d6c0': 'cool',
  '#f4c2a0': 'warm',
  '#e8b890': 'warm',
  '#d4a373': 'neutral',
  '#c69b6e': 'warm',
  '#c68952': 'warm',
  '#b07a4e': 'warm',
  '#a86f44': 'warm',
  '#9c6334': 'warm',
  '#7d4a2e': 'cool',
  '#6d4428': 'cool',
  '#4a2c1a': 'cool',
  '#3a2010': 'cool',
  '#f2cbbb': 'cool',
  '#dcb48e': 'neutral',
  '#a88451': 'neutral',
  '#875330': 'warm',
  '#5a3521': 'neutral',
  '#2a170d': 'cool',
};

export function getSkinUndertone(tone: string): 'warm' | 'cool' | 'neutral' {
  return SKIN_UNDERTONES[tone] ?? 'neutral';
}

export const EYE_COLORS: Swatch[] = [
  { name: 'Brown', value: '#6b4423' },
  { name: 'Blue', value: '#4a8ccc' },
  { name: 'Green', value: '#5c9964' },
  { name: 'Hazel', value: '#9c7a4b' },
  { name: 'Gray', value: '#708090' },
  { name: 'Amber', value: '#cc8800' },
  { name: 'Dark Brown', value: '#3b2416' },
  { name: 'Near Black', value: '#22160f' },
  { name: 'Light Brown', value: '#8a5a2b' },
  { name: 'Blue-Gray', value: '#7b93a8' },
  { name: 'Deep Blue', value: '#2c5a9e' },
];

export const HAIR_COLORS: Swatch[] = [
  { name: 'Black', value: '#2a1f1a' },
  { name: 'Dark Brown', value: '#3d2817' },
  { name: 'Brown', value: '#5c3a21' },
  { name: 'Light Brown', value: '#825a2c' },
  { name: 'Blonde', value: '#d4b08c' },
  { name: 'Platinum', value: '#e8dcc0' },
  { name: 'Red', value: '#8b3a3a' },
  { name: 'Auburn', value: '#a0522d' },
  { name: 'Gray', value: '#8e8e8e' },
  { name: 'White', value: '#e0e0e0' },
];

// Dyed colours, for the whole head or as highlights.
export const HAIR_FASHION_COLORS: Swatch[] = [
  { name: 'Rose Pink', value: '#e07a9f' },
  { name: 'Hot Pink', value: '#d63c86' },
  { name: 'Lavender', value: '#a98bd6' },
  { name: 'Violet', value: '#6a3fa0' },
  { name: 'Electric Blue', value: '#2f6fd6' },
  { name: 'Teal', value: '#1f9a96' },
  { name: 'Mint', value: '#7fcfae' },
  { name: 'Copper', value: '#c4642d' },
  { name: 'Honey', value: '#c9933e' },
  { name: 'Cherry', value: '#9e1f35' },
];

// The hairstyle picker, in groups so a long list is easy to scan.
export const HAIRSTYLE_GROUPS: Array<{ label: string; styles: HairStyle[] }> = [
  { label: 'Short & shaved', styles: ['bald', 'buzz', 'fade', 'undercut', 'mohawk', 'short', 'short_wavy', 'slick_back', 'pixie'] },
  { label: 'Natural & protective', styles: ['afro', 'high_puff', 'curly', 'cornrows', 'bantu_knots', 'twists', 'barrel_twists', 'braids', 'boho_braids', 'locs_short', 'locs', 'goddess_locs'] },
  { label: 'Medium & long', styles: ['bob', 'sleek', 'long_straight', 'bangs', 'wavy'] },
  { label: 'Tied up', styles: ['bun', 'top_knot', 'ponytail'] },
];

export const LIP_COLORS: Swatch[] = [
  { name: 'Warm Nude', value: '#c4917c' },
  { name: 'Tan Nude', value: '#b07a5e' },
  { name: 'Dusty Rose', value: '#c8857a' },
  { name: 'Natural Pink', value: '#d88e89' },
  { name: 'Mauve', value: '#b0726a' },
  { name: 'Sienna', value: '#a0604a' },
  { name: 'Light Nude', value: '#e5b8a8' },
  { name: 'Pink', value: '#f4a6b8' },
  { name: 'Rose', value: '#e88ba3' },
  { name: 'Berry', value: '#c75f7e' },
  { name: 'Plum', value: '#8b4876' },
  { name: 'Red', value: '#c73e3a' },
];

export const DEFAULT_GLASSES_COLOR = '#1a1a1a';

export const GLASSES_COLORS: Swatch[] = [
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Tortoiseshell', value: '#7b4a2d' },
  { name: 'Gold', value: '#d4af37' },
  { name: 'Silver', value: '#c0c0c0' },
  { name: 'Rose Gold', value: '#e0bfb8' },
  { name: 'White', value: '#f5f5f5' },
  { name: 'Red', value: '#c73e3a' },
  { name: 'Pink', value: '#e07a9f' },
  { name: 'Purple', value: '#6a3fa0' },
  { name: 'Blue', value: '#2f6fd6' },
  { name: 'Teal', value: '#1f9a96' },
  { name: 'Green', value: '#3f7a52' },
];

export const NECKLACE_COLORS: Swatch[] = [
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Rose Gold', value: '#E0BFB8' },
  { name: 'Black', value: '#1a1a1a' },
  { name: 'White', value: '#f5f5f5' },
  { name: 'Bronze', value: '#CD7F32' },
];

export const HAIR_TEXTURES: Array<{ value: HairTexture; label: string }> = [
  { value: 'straight', label: 'Straight' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'coily', label: 'Coily' },
];

export const HAIRSTYLES: Array<{ value: HairStyle; label: string }> = [
  { value: 'buzz', label: 'Buzz Cut' },
  { value: 'fade', label: 'Fade' },
  { value: 'short', label: 'Short' },
  { value: 'short_wavy', label: 'Short Wavy' },
  { value: 'slick_back', label: 'Slicked Back' },
  { value: 'afro', label: 'Afro' },
  { value: 'locs_short', label: 'Short Locs' },
  { value: 'bun', label: 'Bun' },
  { value: 'ponytail', label: 'Ponytail' },
  { value: 'sleek', label: 'Long Straight' },
  { value: 'wavy', label: 'Long Wavy' },
  { value: 'curly', label: 'Curly' },
  { value: 'braids', label: 'Braids' },
  { value: 'locs', label: 'Long Locs' },
  { value: 'bald', label: 'Bald' },
  { value: 'cornrows', label: 'Cornrows' },
  { value: 'twists', label: 'Twists' },
  { value: 'bantu_knots', label: 'Bantu Knots' },
  { value: 'high_puff', label: 'High Puff' },
  { value: 'long_straight', label: 'Long, Side Part' },
  { value: 'bob', label: 'Bob' },
  { value: 'pixie', label: 'Pixie' },
  { value: 'bangs', label: 'Long with Bangs' },
  { value: 'top_knot', label: 'Top Knot' },
  { value: 'undercut', label: 'Undercut' },
  { value: 'mohawk', label: 'Mohawk' },
  { value: 'boho_braids', label: 'Boho Braids' },
  { value: 'goddess_locs', label: 'Goddess Locs' },
  { value: 'barrel_twists', label: 'Barrel Twists' },
];

export const EYE_SHAPES: Array<{ value: EyeShape; label: string }> = [
  { value: 'almond', label: 'Almond' },
  { value: 'round', label: 'Round' },
  { value: 'hooded', label: 'Hooded' },
  { value: 'wide', label: 'Wide' },
  { value: 'monolid', label: 'Monolid' },
  { value: 'deepset', label: 'Deep Set' },
  { value: 'upturned', label: 'Upturned' },
  { value: 'downturned', label: 'Downturned' },
  { value: 'narrow', label: 'Narrow' },
];

export const NOSE_SHAPES: Array<{ value: NoseShape; label: string }> = [
  { value: 'button', label: 'Button' },
  { value: 'straight', label: 'Straight' },
  { value: 'broad', label: 'Broad' },
  { value: 'upturned', label: 'Upturned' },
  { value: 'aquiline', label: 'Aquiline' },
  { value: 'hawk', label: 'Hawk' },
  { value: 'flat', label: 'Flat' },
];

export const FACE_SHAPES: Array<{ value: FaceShape; label: string }> = [
  { value: 'oval', label: 'Oval' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'heart', label: 'Heart' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'oblong', label: 'Oblong' },
];
