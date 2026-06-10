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

export interface AvatarConfig {
  gender: Gender;
  skinTone: string;
  eyeColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  lipShape: LipShape;
  lipColor: string;
  eyebrowShape: EyebrowShape;
  facialHair: FacialHair;
  eyelashes: Eyelashes;
  freckles: Freckles;
  glasses: Glasses;
  earrings: Earrings;
  nosePiercing: NosePiercing;
  lipPiercing: LipPiercing;
  necklace: Necklace;
  necklaceColor: string;
}

export const DEFAULT_MALE_AVATAR: AvatarConfig = {
  gender: 'male',
  skinTone: '#f4c2a0',
  eyeColor: '#6b4423',
  hairColor: '#2a1f1a',
  hairStyle: 'short',
  lipShape: 'natural',
  lipColor: '#d88e89',
  eyebrowShape: 'natural',
  facialHair: 'none',
  eyelashes: 'none',
  freckles: 'none',
  glasses: 'none',
  earrings: 'none',
  nosePiercing: 'none',
  lipPiercing: 'none',
  necklace: 'none',
  necklaceColor: '#C0C0C0'
};

export const DEFAULT_FEMALE_AVATAR: AvatarConfig = {
  gender: 'female',
  skinTone: '#f4c2a0',
  eyeColor: '#6b4423',
  hairColor: '#2a1f1a',
  hairStyle: 'sleek',
  lipShape: 'natural',
  lipColor: '#d88e89',
  eyebrowShape: 'arched',
  facialHair: 'none',
  eyelashes: 'none',
  freckles: 'none',
  glasses: 'none',
  earrings: 'none',
  nosePiercing: 'none',
  lipPiercing: 'none',
  necklace: 'none',
  necklaceColor: '#C0C0C0'
};

export const SKIN_TONES = [
  { name: 'Fair', value: '#fde8d7' },
  { name: 'Light', value: '#f4c2a0' },
  { name: 'Medium', value: '#d4a373' },
  { name: 'Tan', value: '#c68952' },
  { name: 'Brown', value: '#a86f44' },
  { name: 'Dark', value: '#6d4428' }
];

export const EYE_COLORS = [
  { name: 'Brown', value: '#6b4423' },
  { name: 'Blue', value: '#4a8ccc' },
  { name: 'Green', value: '#5c9964' },
  { name: 'Hazel', value: '#9c7a4b' },
  { name: 'Gray', value: '#708090' },
  { name: 'Amber', value: '#cc8800' }
];

export const HAIR_COLORS = [
  { name: 'Black', value: '#2a1f1a' },
  { name: 'Dark Brown', value: '#3d2817' },
  { name: 'Brown', value: '#5c3a21' },
  { name: 'Light Brown', value: '#825a2c' },
  { name: 'Blonde', value: '#d4b08c' },
  { name: 'Platinum', value: '#e8dcc0' },
  { name: 'Red', value: '#8b3a3a' },
  { name: 'Auburn', value: '#a0522d' },
  { name: 'Gray', value: '#8e8e8e' },
  { name: 'White', value: '#e0e0e0' }
];

export const LIP_COLORS = [
  { name: 'Natural', value: '#d88e89' },
  { name: 'Pink', value: '#f4a6b8' },
  { name: 'Rose', value: '#e88ba3' },
  { name: 'Berry', value: '#c75f7e' },
  { name: 'Plum', value: '#8b4876' },
  { name: 'Red', value: '#c73e3a' },
  { name: 'Nude', value: '#e5b8a8' }
];

export const NECKLACE_COLORS = [
  { name: 'Silver', value: '#C0C0C0' },
  { name: 'Gold', value: '#D4AF37' },
  { name: 'Rose Gold', value: '#E0BFB8' },
  { name: 'Black', value: '#1a1a1a' },
  { name: 'White', value: '#f5f5f5' },
  { name: 'Bronze', value: '#CD7F32' }
];

export const MALE_HAIRSTYLES: Array<{ value: MaleHairStyle; label: string }> = [
  { value: 'buzz', label: 'Buzz Cut' },
  { value: 'short', label: 'Short' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'sleek', label: 'Sleek' },
  { value: 'afro', label: 'Afro' },
  { value: 'locs', label: 'Locs' },
  { value: 'fade', label: 'Fade' }
];

export const FEMALE_HAIRSTYLES: Array<{ value: FemaleHairStyle; label: string }> = [
  { value: 'sleek', label: 'Sleek' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'curly', label: 'Curly' },
  { value: 'braids', label: 'Braids' },
  { value: 'ponytail', label: 'Ponytail' },
  { value: 'afro', label: 'Afro' },
  { value: 'locs', label: 'Locs' },
  { value: 'bun', label: 'Bun' }
];
