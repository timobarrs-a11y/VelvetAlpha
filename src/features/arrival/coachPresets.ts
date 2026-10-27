import { DEFAULT_FEMALE_AVATAR_V2, DEFAULT_MALE_AVATAR_V2, type AvatarConfigV2, type Gender } from '../../types/avatar-v2';

/**
 * Ready-made coaches and assistants. Nobody designs their helper: the goal picks the person, and
 * Atlas introduces them by name. Every coach has a fixed face, outfit and name that fit what they
 * teach; the catch-all faces below cover every other goal. Only starter wardrobe is used, so a
 * lapsed plan never changes how a helper looks.
 */

export interface HelperPreset {
  id: string;
  name: string;
  gender: Gender;
  avatar: AvatarConfigV2;
}

type Look = Partial<AvatarConfigV2>;

function make(id: string, name: string, gender: Gender, look: Look): HelperPreset {
  const base = gender === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2;
  return { id, name, gender, avatar: { ...base, ...look, gender } };
}

const SKIN = {
  porcelain: '#fde8d7', ivory: '#f5d6c0', light: '#f4c2a0', beige: '#e8b890', olive: '#d4a373',
  golden: '#c69b6e', tan: '#c68952', honey: '#a86f44', caramel: '#9c6334', brown: '#7d4a2e',
  mahogany: '#6d4428', espresso: '#4a2c1a', ebony: '#3a2010',
} as const;
const HAIR = {
  black: '#2a1f1a', darkBrown: '#3d2817', brown: '#5c3a21', lightBrown: '#825a2c',
  blonde: '#d4b08c', red: '#8b3a3a', auburn: '#a0522d', gray: '#8e8e8e', white: '#e0e0e0',
} as const;

/** Keyed by the curated coach ids in src/config/signatureExperts.ts. */
export const COACH_PRESETS: Record<string, HelperPreset> = {
  fitness_hype: make('fitness_hype', 'Marcus', 'male', { skinTone: SKIN.brown, hairStyle: 'fade', hairTexture: 'coily', hairColor: HAIR.black, bodyType: 'athletic', facialHair: 'stubble', outfit: 'tee', outfitColor: '#e0662b', headwear: 'none' }),
  fitness_drill: make('fitness_drill', 'Dana', 'female', { skinTone: SKIN.olive, hairStyle: 'ponytail', hairTexture: 'straight', hairColor: HAIR.darkBrown, bodyType: 'athletic', outfit: 'tee', outfitColor: '#1f2937', headwear: 'none' }),
  wellness_guide: make('wellness_guide', 'Iris', 'female', { skinTone: SKIN.beige, hairStyle: 'wavy', hairTexture: 'wavy', hairColor: HAIR.lightBrown, eyeColor: '#5c9964', outfit: 'linen', headwear: 'none' }),
  sleep_coach: make('sleep_coach', 'Theo', 'male', { skinTone: SKIN.ivory, hairStyle: 'short_wavy', hairTexture: 'wavy', hairColor: HAIR.brown, glasses: 'round', outfit: 'linen', outfitColor: '#c9d3e0', headwear: 'none' }),
  interview_coach: make('interview_coach', 'Priya', 'female', { skinTone: SKIN.caramel, hairStyle: 'bob', hairTexture: 'straight', hairColor: HAIR.black, outfit: 'suit', outfitColor: '#2a3550', headwear: 'none' }),
  finance_mentor: make('finance_mentor', 'Victor', 'male', { skinTone: SKIN.tan, hairStyle: 'short', hairTexture: 'straight', hairColor: HAIR.gray, facialHair: 'goatee', glasses: 'square', outfit: 'suit', headwear: 'none' }),
  finance_tough: make('finance_tough', 'Nadia', 'female', { skinTone: SKIN.mahogany, hairStyle: 'bun', hairTexture: 'coily', hairColor: HAIR.black, outfit: 'suit', outfitColor: '#1c1c22', headwear: 'none' }),
  career_advisor: make('career_advisor', 'Andre', 'male', { skinTone: SKIN.espresso, hairStyle: 'fade', hairTexture: 'coily', hairColor: HAIR.black, outfit: 'suit', outfitColor: '#34506b', headwear: 'none' }),
  communication_coach: make('communication_coach', 'Sofia', 'female', { skinTone: SKIN.golden, hairStyle: 'long_straight', hairTexture: 'straight', hairColor: HAIR.darkBrown, outfit: 'linen', outfitColor: '#f0e6d6', headwear: 'none' }),
  creative_muse: make('creative_muse', 'Zara', 'female', { skinTone: SKIN.honey, hairStyle: 'twists', hairTexture: 'coily', hairColor: HAIR.black, outfit: 'tee', outfitColor: '#7c3aed', headwear: 'beret' }),
  writing_collaborator: make('writing_collaborator', 'Elena', 'female', { skinTone: SKIN.porcelain, hairStyle: 'bangs', hairTexture: 'wavy', hairColor: HAIR.auburn, glasses: 'cat-eye', outfit: 'linen', outfitColor: '#dcc9a8', headwear: 'none' }),
  brainstorm_partner: make('brainstorm_partner', 'Kai', 'male', { skinTone: SKIN.beige, hairStyle: 'undercut', hairTexture: 'straight', hairColor: HAIR.black, outfit: 'tee', outfitColor: '#2f9e8f', headwear: 'beanie' }),
  study_partner: make('study_partner', 'Sam', 'male', { skinTone: SKIN.light, hairStyle: 'short', hairTexture: 'straight', hairColor: HAIR.lightBrown, glasses: 'round', outfit: 'tee', outfitColor: '#3b6ea5', headwear: 'none' }),
  language_tutor: make('language_tutor', 'Liv', 'female', { skinTone: SKIN.ivory, hairStyle: 'ponytail', hairTexture: 'straight', hairColor: HAIR.blonde, eyeColor: '#4a8ccc', outfit: 'tee', outfitColor: '#d9534f', headwear: 'none' }),
  essay_architect: make('essay_architect', 'Nora', 'female', { skinTone: SKIN.tan, hairStyle: 'sleek', hairTexture: 'straight', hairColor: HAIR.black, glasses: 'square', outfit: 'linen', outfitColor: '#8a6a4a', headwear: 'none' }),
  stem_tutor: make('stem_tutor', 'Ezra', 'male', { skinTone: SKIN.olive, hairStyle: 'short', hairTexture: 'straight', hairColor: HAIR.darkBrown, glasses: 'round', outfit: 'labcoat', headwear: 'none' }),
  code_mentor: make('code_mentor', 'Derek', 'male', { skinTone: SKIN.mahogany, hairStyle: 'locs_short', hairTexture: 'coily', hairColor: HAIR.black, glasses: 'square', outfit: 'tee', outfitColor: '#111827', headwear: 'none' }),
  data_coach: make('data_coach', 'Maya', 'female', { skinTone: SKIN.golden, hairStyle: 'curly', hairTexture: 'coily', hairColor: HAIR.darkBrown, glasses: 'round', outfit: 'tee', outfitColor: '#0e7490', headwear: 'none' }),
  chef_coach: make('chef_coach', 'James', 'male', { skinTone: SKIN.honey, hairStyle: 'buzz', hairTexture: 'straight', hairColor: HAIR.black, facialHair: 'beard', bodyType: 'average', outfit: 'chef', headwear: 'chef_hat' }),
  connection_coach: make('connection_coach', 'Cole', 'male', { skinTone: SKIN.beige, hairStyle: 'slick_back', hairTexture: 'wavy', hairColor: HAIR.brown, outfit: 'linen', outfitColor: '#e8ddc7', headwear: 'none' }),
  style_coach: make('style_coach', 'Nia', 'female', { skinTone: SKIN.brown, hairStyle: 'high_puff', hairTexture: 'coily', hairColor: HAIR.black, outfit: 'suit', outfitColor: '#7b2d4b', headwear: 'none', earrings: 'hoops' }),
  home_coach: make('home_coach', 'Hazel', 'female', { skinTone: SKIN.light, hairStyle: 'pixie', hairTexture: 'straight', hairColor: HAIR.red, outfit: 'tee', outfitColor: '#5b8a72', headwear: 'none' }),
};

/** Faces for every goal without a coach of its own. Four of each, so neighbours don't all look alike. */
export const CATCH_ALL_PRESETS: Record<Gender, HelperPreset[]> = {
  male: [
    make('any_m_1', 'Owen', 'male', { skinTone: SKIN.light, hairStyle: 'short', hairTexture: 'straight', hairColor: HAIR.brown, outfit: 'linen', headwear: 'none' }),
    make('any_m_2', 'Jamal', 'male', { skinTone: SKIN.ebony, hairStyle: 'fade', hairTexture: 'coily', hairColor: HAIR.black, outfit: 'tee', outfitColor: '#2d4a6b', headwear: 'none' }),
    make('any_m_3', 'Rafael', 'male', { skinTone: SKIN.olive, hairStyle: 'slick_back', hairTexture: 'wavy', hairColor: HAIR.black, facialHair: 'stubble', outfit: 'suit', outfitColor: '#2f3b52', headwear: 'none' }),
    make('any_m_4', 'Wen', 'male', { skinTone: SKIN.beige, hairStyle: 'undercut', hairTexture: 'straight', hairColor: HAIR.black, glasses: 'round', outfit: 'linen', outfitColor: '#d8cdb8', headwear: 'none' }),
  ],
  female: [
    make('any_f_1', 'Grace', 'female', { skinTone: SKIN.porcelain, hairStyle: 'wavy', hairTexture: 'wavy', hairColor: HAIR.blonde, outfit: 'linen', headwear: 'none' }),
    make('any_f_2', 'Amara', 'female', { skinTone: SKIN.espresso, hairStyle: 'braids', hairTexture: 'coily', hairColor: HAIR.black, outfit: 'tee', outfitColor: '#b45309', headwear: 'none' }),
    make('any_f_3', 'Lucia', 'female', { skinTone: SKIN.tan, hairStyle: 'sleek', hairTexture: 'straight', hairColor: HAIR.darkBrown, outfit: 'suit', outfitColor: '#44304d', headwear: 'none' }),
    make('any_f_4', 'Mei', 'female', { skinTone: SKIN.ivory, hairStyle: 'bob', hairTexture: 'straight', hairColor: HAIR.black, glasses: 'cat-eye', outfit: 'linen', outfitColor: '#cfd8c8', headwear: 'none' }),
  ],
};

function hashText(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Who carries this goal. A coach with a preset of their own gets it; everyone else gets a
 * catch-all face of the asked-for gender, picked from the goal's wording so the same goal always
 * meets the same person.
 */
export function helperPresetFor(rec: { expertId: string | null; helperGender: Gender; goalText: string; kind: 'coach' | 'assistant' }): HelperPreset {
  if (rec.kind === 'coach' && rec.expertId && COACH_PRESETS[rec.expertId]) return COACH_PRESETS[rec.expertId];
  const pool = CATCH_ALL_PRESETS[rec.helperGender] ?? CATCH_ALL_PRESETS.female;
  return pool[hashText(rec.goalText) % pool.length];
}
