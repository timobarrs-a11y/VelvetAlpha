const COLOR_NAME_TO_HEX: Record<string, string> = {
  Red: '#E53E3E',
  Pink: '#ED64A6',
  Orange: '#DD6B20',
  Yellow: '#D69E2E',
  Green: '#38A169',
  Teal: '#14B8A6',
  Cyan: '#06B6D4',
  Blue: '#3182CE',
  Purple: '#805AD5',
  Magenta: '#D946EF',
  White: '#E2E8F0',
  Gray: '#9CA3AF',
  Black: '#1A202C',
};

export function colorNameToHex(colorName: string): string {
  if (!colorName) return '#3182CE';
  if (colorName.startsWith('#')) return colorName;
  return COLOR_NAME_TO_HEX[colorName] || '#3182CE';
}

export function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1A202C' : '#FFFFFF';
}

export const QUESTIONNAIRE_COLORS = [
  'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Teal', 'Cyan', 'Blue', 'Purple', 'Magenta', 'White', 'Gray', 'Black'
] as const;

// Color themes for mouse trails and particles
export interface ColorTheme {
  trail: string;
  particles: string[];
  glow: string;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  Red: {
    trail: 'rgba(239, 68, 68, 0.8)',
    particles: [
      'rgb(239, 68, 68)',
      'rgb(248, 113, 113)',
      'rgb(252, 165, 165)',
      'rgb(220, 38, 38)',
    ],
    glow: 'rgba(239, 68, 68, 0.3)',
  },
  Pink: {
    trail: 'rgba(236, 72, 153, 0.8)',
    particles: [
      'rgb(236, 72, 153)',
      'rgb(249, 168, 212)',
      'rgb(251, 207, 232)',
      'rgb(219, 39, 119)',
    ],
    glow: 'rgba(236, 72, 153, 0.3)',
  },
  Orange: {
    trail: 'rgba(249, 115, 22, 0.8)',
    particles: [
      'rgb(249, 115, 22)',
      'rgb(251, 146, 60)',
      'rgb(253, 186, 116)',
      'rgb(234, 88, 12)',
    ],
    glow: 'rgba(249, 115, 22, 0.3)',
  },
  Yellow: {
    trail: 'rgba(250, 204, 21, 0.8)',
    particles: [
      'rgb(250, 204, 21)',
      'rgb(253, 224, 71)',
      'rgb(254, 240, 138)',
      'rgb(234, 179, 8)',
    ],
    glow: 'rgba(250, 204, 21, 0.3)',
  },
  Green: {
    trail: 'rgba(34, 197, 94, 0.8)',
    particles: [
      'rgb(34, 197, 94)',
      'rgb(134, 239, 172)',
      'rgb(187, 247, 208)',
      'rgb(22, 163, 74)',
    ],
    glow: 'rgba(34, 197, 94, 0.3)',
  },
  Teal: {
    trail: 'rgba(20, 184, 166, 0.8)',
    particles: [
      'rgb(20, 184, 166)',
      'rgb(94, 234, 212)',
      'rgb(153, 246, 228)',
      'rgb(13, 148, 136)',
    ],
    glow: 'rgba(20, 184, 166, 0.3)',
  },
  Cyan: {
    trail: 'rgba(6, 182, 212, 0.8)',
    particles: [
      'rgb(6, 182, 212)',
      'rgb(103, 232, 249)',
      'rgb(165, 243, 252)',
      'rgb(8, 145, 178)',
    ],
    glow: 'rgba(6, 182, 212, 0.3)',
  },
  Blue: {
    trail: 'rgba(59, 130, 246, 0.8)',
    particles: [
      'rgb(59, 130, 246)',
      'rgb(147, 197, 253)',
      'rgb(191, 219, 254)',
      'rgb(37, 99, 235)',
    ],
    glow: 'rgba(59, 130, 246, 0.3)',
  },
  Purple: {
    trail: 'rgba(168, 85, 247, 0.8)',
    particles: [
      'rgb(168, 85, 247)',
      'rgb(196, 181, 253)',
      'rgb(221, 214, 254)',
      'rgb(147, 51, 234)',
    ],
    glow: 'rgba(168, 85, 247, 0.3)',
  },
  Magenta: {
    trail: 'rgba(217, 70, 239, 0.8)',
    particles: [
      'rgb(217, 70, 239)',
      'rgb(240, 171, 252)',
      'rgb(245, 208, 254)',
      'rgb(192, 38, 211)',
    ],
    glow: 'rgba(217, 70, 239, 0.3)',
  },
  White: {
    trail: 'rgba(248, 250, 252, 0.8)',
    particles: [
      'rgb(248, 250, 252)',
      'rgb(226, 232, 240)',
      'rgb(203, 213, 225)',
      'rgb(241, 245, 249)',
    ],
    glow: 'rgba(248, 250, 252, 0.3)',
  },
  Gray: {
    trail: 'rgba(156, 163, 175, 0.8)',
    particles: [
      'rgb(156, 163, 175)',
      'rgb(209, 213, 219)',
      'rgb(229, 231, 235)',
      'rgb(107, 114, 128)',
    ],
    glow: 'rgba(156, 163, 175, 0.3)',
  },
  Black: {
    trail: 'rgba(31, 41, 55, 0.8)',
    particles: [
      'rgb(31, 41, 55)',
      'rgb(75, 85, 99)',
      'rgb(107, 114, 128)',
      'rgb(17, 24, 39)',
    ],
    glow: 'rgba(31, 41, 55, 0.3)',
  },
};

// Default theme if color not found
export const DEFAULT_THEME: ColorTheme = COLOR_THEMES.Pink;

export function getColorTheme(favoriteColor: string | null | undefined): ColorTheme {
  if (!favoriteColor) return DEFAULT_THEME;
  return COLOR_THEMES[favoriteColor] || DEFAULT_THEME;
}
