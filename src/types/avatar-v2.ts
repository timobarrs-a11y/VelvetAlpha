export type Gender = 'male' | 'female';

export type MaleHairStyle = 'buzz' | 'short' | 'wavy' | 'sleek' | 'afro' | 'locs' | 'fade';
export type FemaleHairStyle = 'sleek' | 'wavy' | 'curly' | 'braids' | 'ponytail' | 'afro' | 'locs' | 'bun';
export type HairStyle = MaleHairStyle | FemaleHairStyle;

export type LipShape = 'natural' | 'full' | 'thin' | 'heart';
export type EyebrowShape = 'natural' | 'arched' | 'straight' | 'thick' | 'thin';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'goatee' | 'mustache';
export type Eyelashes = 'none' | 'dramatic';
export type Freckles = 'none' | 'light' | 'heavy' | 'beauty_mark';
export type Glasses = 'none' | 'round' | 'square' | 'cat-eye' | 'aviator';
export type Earrings = 'none' | 'studs' | 'hoops' | 'dangles' | 'gauges';
export type NosePiercing = 'none' | 'nostril_stud' | 'nose_ring';
export type LipPiercing = 'none' | 'labret' | 'lip_ring' | 'snake_bites';
export type Necklace = 'none' | 'chain' | 'choker' | 'pendant' | 'pearls';

export type EyeShape = 'almond' | 'round' | 'hooded' | 'wide' | 'monolid' | 'deepset' | 'upturned';
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

export const AVATAR_CONFIG_VERSION = 3 as const;
export type AvatarConfigVersion = typeof AVATAR_CONFIG_VERSION;

export interface AvatarConfigV2 {
  _version?: AvatarConfigVersion;
  gender: Gender;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
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
  { name: 'Ivory', value: '#f5d6c0' },
  { name: 'Light', value: '#f4c2a0' },
  { name: 'Beige', value: '#e8b890' },
  { name: 'Olive', value: '#d4a373' },
  { name: 'Golden', value: '#c69b6e' },
  { name: 'Tan', value: '#c68952' },
  { name: 'Bronze', value: '#b07a4e' },
  { name: 'Honey', value: '#a86f44' },
  { name: 'Caramel', value:'#9c6334' },
  { name: 'Brown', value: '#7d4a2e' },
  { name: 'Mahogany', value: '#6d4428' },
  { name: 'Espresso', value: '#4a2c1a' },
  { name: 'Ebony', value: '#3a2010' },
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

export const MALE_HAIRSTYLES: Array<{ value: MaleHairStyle; label: string }> = [
  { value: 'buzz', label: 'Buzz Cut' },
  { value: 'short', label: 'Short' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'sleek', label: 'Sleek' },
  { value: 'afro', label: 'Afro' },
  { value: 'locs', label: 'Locs' },
  { value: 'fade', label: 'Fade' },
];

export const FEMALE_HAIRSTYLES: Array<{ value: FemaleHairStyle; label: string }> = [
  { value: 'sleek', label: 'Sleek' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'curly', label: 'Curly' },
  { value: 'braids', label: 'Braids' },
  { value: 'ponytail', label: 'Ponytail' },
  { value: 'afro', label: 'Afro' },
  { value: 'locs', label: 'Locs' },
  { value: 'bun', label: 'Bun' },
];

export const EYE_SHAPES: Array<{ value: EyeShape; label: string }> = [
  { value: 'almond', label: 'Almond' },
  { value: 'round', label: 'Round' },
  { value: 'hooded', label: 'Hooded' },
  { value: 'wide', label: 'Wide' },
  { value: 'monolid', label: 'Monolid' },
  { value: 'deepset', label: 'Deep Set' },
  { value: 'upturned', label: 'Upturned' },
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
