import {
  AvatarConfigV2,
  AVATAR_CONFIG_VERSION,
  DEFAULT_MALE_AVATAR_V2,
  DEFAULT_FEMALE_AVATAR_V2,
  HairTexture,
  HairStyle,
} from '../types/avatar-v2';

const V3_OPTIONAL_DEFAULTS: Required<Pick<
  AvatarConfigV2,
  '_version' | 'hairLength' | 'makeupIntensity' | 'eyeShadow' | 'eyeliner' | 'skinDetail'
  | 'outfit' | 'outfitColor' | 'outfitAccent' | 'headwear' | 'faceAccessory'
>> = {
  _version: AVATAR_CONFIG_VERSION,
  hairLength: 'medium',
  makeupIntensity: 'none',
  eyeShadow: 'none',
  eyeliner: 'none',
  skinDetail: 'none',
  // The navy tee every avatar wore before the wardrobe existed.
  outfit: 'tee',
  outfitColor: '#1e293b',
  outfitAccent: '#2d3748',
  headwear: 'none',
  faceAccessory: 'none',
};

export function migrateAvatarConfig(raw: unknown): AvatarConfigV2 {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FEMALE_AVATAR_V2, ...V3_OPTIONAL_DEFAULTS };
  }

  const partial = raw as Record<string, unknown>;
  const gender = partial.gender === 'male' ? 'male' : 'female';
  const base = gender === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2;

  const merged: AvatarConfigV2 = {
    ...base,
    ...V3_OPTIONAL_DEFAULTS,
    ...(partial as Partial<AvatarConfigV2>),
    gender,
    _version: AVATAR_CONFIG_VERSION,
  };

  if (!merged.hairTexture) {
    merged.hairTexture = inferTextureFromStyle(merged.hairStyle);
  }

  // Clamp face-tune values to [-1, 1] so a malformed or hand-edited draft
  // can never push facial proportions to an absurd or broken extreme.
  if (merged.faceTune && typeof merged.faceTune === 'object') {
    const clamped: Record<string, number> = {};
    for (const [key, value] of Object.entries(merged.faceTune)) {
      const num = Number(value);
      clamped[key] = Number.isFinite(num) ? Math.max(-1, Math.min(1, num)) : 0;
    }
    merged.faceTune = clamped as unknown as AvatarConfigV2['faceTune'];
  }

  // Frame colour is a #rrggbb or nothing; anything else is dropped, so a
  // hand-edited draft can't put junk into the SVG.
  if (merged.glassesColor !== undefined && !/^#[0-9a-f]{6}$/i.test(String(merged.glassesColor))) {
    delete merged.glassesColor;
  }

  // Version 4 opened every hairstyle to everyone. Three names used to mean a
  // short cut on male avatars; give those their own names so nothing changes.
  if ((Number(partial._version) || 0) < 4 && gender === 'male') {
    const renamed: Record<string, HairStyle> = { sleek: 'slick_back', wavy: 'short_wavy', locs: 'locs_short' };
    merged.hairStyle = renamed[merged.hairStyle] ?? merged.hairStyle;
  }

  return merged;
}

// Apply an edit to any stored config: bring it up to date first, so an old
// config's names are read the old way, then stamp the current version.
export function applyAvatarChange(config: unknown, change: Partial<AvatarConfigV2>): AvatarConfigV2 {
  return { ...migrateAvatarConfig(config), ...change, _version: AVATAR_CONFIG_VERSION };
}

function inferTextureFromStyle(style: string): HairTexture {
  if (['afro', 'locs', 'locs_short', 'braids', 'curly', 'cornrows', 'twists', 'bantu_knots', 'high_puff', 'boho_braids', 'goddess_locs', 'barrel_twists'].includes(style)) {
    return 'coily';
  }
  if (style === 'wavy' || style === 'short_wavy') {
    return 'wavy';
  }
  return 'straight';
}

export function loadDraftConfig(draftKey: string): AvatarConfigV2 | null {
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return null;
    return migrateAvatarConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveDraftConfig(draftKey: string, config: AvatarConfigV2): void {
  try {
    localStorage.setItem(draftKey, JSON.stringify({ ...config, _version: AVATAR_CONFIG_VERSION }));
  } catch {
    // localStorage may be unavailable (private browsing quota)
  }
}
