import { AvatarConfig, DEFAULT_MALE_AVATAR, DEFAULT_FEMALE_AVATAR } from '../../types/avatar';

export type CompanionTone = 'voice' | 'coach' | 'correspondent';

/** Accent colour per lobby section. Shared by cards, section headers and add-tiles. */
export const TONE_COLOR: Record<CompanionTone, string> = {
  voice:         '#f472b6',
  coach:         '#34d399',
  correspondent: '#fbbf24',
};

export const STATUS_DOT: Record<CompanionTone, string> = {
  voice:         '#4ade80',
  coach:         '#4ade80',
  correspondent: '#f59e0b',
};

export function formatTimeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days  = Math.floor(diffMs / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function companionAvatarConfig(c: { avatar_config?: unknown; gender?: string | null }): AvatarConfig {
  return (c.avatar_config as AvatarConfig) ?? (c.gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR);
}

