export type CoachColorKey = 'blue' | 'green' | 'amber' | 'coral' | 'teal';

export interface CoachColorPalette {
  key: CoachColorKey;
  base: string;
  light: string;
  dark: string;
  soft: string;
  text: string;
  border: string;
  glow: string;
}

export const COACH_COLORS: Record<CoachColorKey, CoachColorPalette> = {
  blue: {
    key: 'blue',
    base: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
    soft: 'rgba(59,130,246,0.12)',
    text: '#93c5fd',
    border: 'rgba(59,130,246,0.3)',
    glow: 'rgba(59,130,246,0.2)',
  },
  green: {
    key: 'green',
    base: '#10b981',
    light: '#34d399',
    dark: '#059669',
    soft: 'rgba(16,185,129,0.12)',
    text: '#6ee7b7',
    border: 'rgba(16,185,129,0.3)',
    glow: 'rgba(16,185,129,0.2)',
  },
  amber: {
    key: 'amber',
    base: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
    soft: 'rgba(245,158,11,0.12)',
    text: '#fcd34d',
    border: 'rgba(245,158,11,0.3)',
    glow: 'rgba(245,158,11,0.2)',
  },
  coral: {
    key: 'coral',
    base: '#f97316',
    light: '#fb923c',
    dark: '#ea580c',
    soft: 'rgba(249,115,22,0.12)',
    text: '#fdba74',
    border: 'rgba(249,115,22,0.3)',
    glow: 'rgba(249,115,22,0.2)',
  },
  teal: {
    key: 'teal',
    base: '#14b8a6',
    light: '#2dd4bf',
    dark: '#0d9488',
    soft: 'rgba(20,184,166,0.12)',
    text: '#5eead4',
    border: 'rgba(20,184,166,0.3)',
    glow: 'rgba(20,184,166,0.2)',
  },
};

export const COACH_COLOR_KEYS: CoachColorKey[] = ['blue', 'green', 'amber', 'coral', 'teal'];

const usedColors = new Set<string>();

export function assignCoachColor(takenColors: string[] = []): CoachColorKey {
  const available = COACH_COLOR_KEYS.filter(k => !takenColors.includes(k));
  const pool = available.length > 0 ? available : COACH_COLOR_KEYS;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick;
}

export function getCoachColor(colorKey: string | null | undefined): CoachColorPalette {
  if (colorKey && colorKey in COACH_COLORS) {
    return COACH_COLORS[colorKey as CoachColorKey];
  }
  return COACH_COLORS.blue;
}

export function formatDeadline(
  targetDate: string | null,
  precision: string | null | undefined,
): string {
  if (!targetDate) return 'No deadline';
  const date = new Date(targetDate);

  switch (precision) {
    case 'month':
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    case 'quarter': {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `Q${q} ${date.getFullYear()}`;
    }
    case 'season': {
      const m = date.getMonth();
      const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];
      const seasonIndex = Math.floor((m + 1) / 3) % 4;
      return `${seasons[seasonIndex]} ${date.getFullYear()}`;
    }
    default:
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function daysToDeadline(
  targetDate: string | null,
  precision: string | null | undefined,
): number | null {
  if (!targetDate) return null;
  return Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000);
}

export function deadlineUrgency(
  targetDate: string | null,
  precision: string | null | undefined,
): 'overdue' | 'soon' | 'onTrack' | 'far' | 'none' {
  const days = daysToDeadline(targetDate, precision);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= 14) return 'soon';
  if (days <= 60) return 'onTrack';
  return 'far';
}
