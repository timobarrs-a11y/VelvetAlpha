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
