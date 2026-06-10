import {
  AvatarConfigV2,
  AVATAR_CONFIG_VERSION,
  DEFAULT_MALE_AVATAR_V2,
  DEFAULT_FEMALE_AVATAR_V2,
} from '../types/avatar-v2';

const V2_OPTIONAL_DEFAULTS: Required<Pick<
  AvatarConfigV2,
  '_version' | 'hairLength' | 'makeupIntensity' | 'eyeShadow' | 'eyeliner' | 'skinDetail'
>> = {
  _version: AVATAR_CONFIG_VERSION,
  hairLength: 'medium',
  makeupIntensity: 'none',
  eyeShadow: 'none',
  eyeliner: 'none',
  skinDetail: 'none',
};

export function migrateAvatarConfig(raw: unknown): AvatarConfigV2 {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FEMALE_AVATAR_V2, ...V2_OPTIONAL_DEFAULTS };
  }

  const partial = raw as Record<string, unknown>;
  const gender = partial.gender === 'male' ? 'male' : 'female';
  const base = gender === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2;

  return {
    ...base,
    ...V2_OPTIONAL_DEFAULTS,
    ...(partial as Partial<AvatarConfigV2>),
    gender,
    _version: AVATAR_CONFIG_VERSION,
  };
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
