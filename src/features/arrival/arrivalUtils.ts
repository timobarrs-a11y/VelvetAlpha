import { colorNameToHex, getContrastColor } from '../../utils/colorMapping';

// Helpers for the arrival screens (Atlas onboarding and the walkthrough).

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: [number, number, number]): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Their favorite color as the arrival's accent. Very dark colors are lifted
 * toward white so they still read on the dark background; everything else is
 * used as chosen. Returns no overrides for a color we can't read.
 */
export function accentVars(color: string | null | undefined): Record<string, string> {
  if (!color) return {};
  const rgb = hexToRgb(colorNameToHex(color));
  if (!rgb) return {};
  const lum = luminance(rgb);
  const lift = lum < 0.3 ? (0.3 - lum) / 0.3 * 0.55 : 0;
  const accent = rgb.map(v => v + (255 - v) * lift) as [number, number, number];
  const hex = toHex(accent);
  const [r, g, b] = accent.map(Math.round);
  return {
    '--shell-accent': hex,
    '--shell-accent-soft': `rgba(${r}, ${g}, ${b}, 0.14)`,
    '--shell-accent-text': hex,
    '--shell-user-bubble': hex,
    '--shell-user-bubble-text': getContrastColor(hex),
  };
}

/** "2026-10-29" as "Thu, Oct 29", read as a plain local date. */
export function formatDay(day: string, withYear = false): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: withYear ? undefined : 'short',
    month: withYear ? 'long' : 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

// ─── Your look ───────────────────────────────────────────────────────────

/** Avatar fields worth Atlas noticing when chosen by hand, most distinctive first. */
export const REMARKABLE_FIELDS = [
  'headwear', 'glasses', 'faceAccessory', 'tattoo', 'hairHighlight', 'necklace', 'earrings',
  'nosePiercing', 'lipPiercing', 'facialHair', 'outfit', 'hairColor', 'hairStyle',
] as const;

/**
 * What they changed by hand since the look they started from (the seeded one,
 * or the last randomize). Choosing "none" isn't something to remark on.
 */
export function handPicked(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
): Array<{ field: string; value: string }> {
  return REMARKABLE_FIELDS
    .filter(f => current[f] !== undefined && current[f] !== baseline[f] && current[f] !== 'none')
    .map(f => ({ field: f, value: String(current[f]) }));
}

/** The starting look: their gender from Act 1, in their favorite color. */
export function seededAvatar<T extends { gender: string; outfitColor?: string }>(
  defaults: { male: T; female: T },
  gender: string | null | undefined,
  favoriteColor: string | null | undefined,
): T {
  const base = (gender ?? '').toLowerCase() === 'male' ? defaults.male : defaults.female;
  return favoriteColor ? { ...base, outfitColor: colorNameToHex(favoriteColor) } : { ...base };
}

// ─── The end of the arrival ──────────────────────────────────────────────

const HIGHLIGHTS_SEEN_KEY = 'velvet.arrival.highlightsSeen';

/** The home-screen highlights after the arrival are shown once. */
export function highlightsSeen(): boolean {
  try { return localStorage.getItem(HIGHLIGHTS_SEEN_KEY) === '1'; } catch { return false; }
}

export function markHighlightsSeen(): void {
  try { localStorage.setItem(HIGHLIGHTS_SEEN_KEY, '1'); } catch { /* storage blocked */ }
}
