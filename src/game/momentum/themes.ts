// Theme loading for Momentum: AI-generated themes are cached per name, and a built-in
// palette is used immediately if generation is slow or fails, so a level never waits.

export interface MomentumTheme {
  levelName: string;
  background: [string, string];
  playerColor: string;
  playerGlow: string;
  boostTrailColor: string;
  platforms: string[];
  glows: string[];
  checkpoint: string;
  checkpointGlow: string;
  flavorText: string;
}

const CACHE_KEY = 'momentum_theme_cache_v1';
const FETCH_TIMEOUT_MS = 6000;

const FALLBACKS: Record<string, MomentumTheme> = {
  'neon cityscape': {
    levelName: 'Neon Skyline', background: ['#0b0221', '#2a0845'], playerColor: '#ffffff', playerGlow: '#ff2bd6',
    boostTrailColor: '#00f0ff', platforms: ['#ff2bd6', '#00f0ff', '#fffb00'], glows: ['#ff2bd6', '#00f0ff', '#fffb00'],
    checkpoint: '#7cff6b', checkpointGlow: '#7cff6b', flavorText: 'The city never sleeps. Neither do you.',
  },
  'ancient ruins': {
    levelName: 'Sunken Temple', background: ['#1c1408', '#4a3b1f'], playerColor: '#fff4d6', playerGlow: '#ffd27a',
    boostTrailColor: '#ffb347', platforms: ['#c9a66b', '#a7c4a0', '#d98e5f'], glows: ['#e8c48a', '#bfe0b8', '#f0a878'],
    checkpoint: '#ffe08a', checkpointGlow: '#ffe08a', flavorText: 'Old stones remember every leap.',
  },
  'candy kingdom': {
    levelName: 'Sugar Spires', background: ['#ffb3d9', '#a0e7ff'], playerColor: '#ffffff', playerGlow: '#ff6fb5',
    boostTrailColor: '#ff6fb5', platforms: ['#ff6fb5', '#7ad7ff', '#ffe066'], glows: ['#ff9fd0', '#a6e6ff', '#fff0a0'],
    checkpoint: '#9dff9d', checkpointGlow: '#9dff9d', flavorText: 'Sweet heights await.',
  },
  'deep ocean': {
    levelName: 'Abyssal Rise', background: ['#000814', '#003566'], playerColor: '#e0fbfc', playerGlow: '#4cc9f0',
    boostTrailColor: '#4cc9f0', platforms: ['#4cc9f0', '#80ffdb', '#b388ff'], glows: ['#4cc9f0', '#80ffdb', '#b388ff'],
    checkpoint: '#fca311', checkpointGlow: '#fca311', flavorText: 'Swim toward the light.',
  },
  'volcanic forge': {
    levelName: 'Magma Ascent', background: ['#120000', '#4a0d00'], playerColor: '#fff3e0', playerGlow: '#ff6a00',
    boostTrailColor: '#ffb000', platforms: ['#ff4d00', '#ffb000', '#ff1e56'], glows: ['#ff4d00', '#ffb000', '#ff1e56'],
    checkpoint: '#ffe600', checkpointGlow: '#ffe600', flavorText: 'Do not look down.',
  },
  'crystal caves': {
    levelName: 'Prism Hollow', background: ['#0d0221', '#241e4e'], playerColor: '#ffffff', playerGlow: '#b8f2ff',
    boostTrailColor: '#c77dff', platforms: ['#7df9ff', '#c77dff', '#f5f5ff'], glows: ['#7df9ff', '#c77dff', '#ffffff'],
    checkpoint: '#80ffdb', checkpointGlow: '#80ffdb', flavorText: 'Every surface sings.',
  },
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Built-in theme for a name; unknown custom names get a deterministic preset with their name. */
export const fallbackTheme = (name: string): MomentumTheme => {
  const preset = FALLBACKS[name.trim().toLowerCase()];
  if (preset) return preset;
  const keys = Object.keys(FALLBACKS);
  const base = FALLBACKS[keys[hash(name) % keys.length]];
  return { ...base, levelName: name.trim() || base.levelName };
};

const isValidTheme = (t: unknown): t is MomentumTheme => {
  const v = t as MomentumTheme;
  return !!v && Array.isArray(v.background) && v.background.length === 2 && Array.isArray(v.platforms) && v.platforms.length > 0
    && Array.isArray(v.glows) && v.glows.length > 0 && typeof v.playerColor === 'string';
};

const readCache = (): Record<string, MomentumTheme> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeCache = (name: string, theme: MomentumTheme) => {
  try {
    const cache = readCache();
    cache[name.trim().toLowerCase()] = theme;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage unavailable
  }
};

/** Cached theme if available, otherwise generate with a timeout, falling back to a built-in palette. */
export const loadTheme = async (name: string, fetchTheme: () => Promise<unknown>): Promise<MomentumTheme> => {
  const cached = readCache()[name.trim().toLowerCase()];
  if (isValidTheme(cached)) return cached;
  try {
    const result = await Promise.race([
      fetchTheme(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT_MS)),
    ]);
    if (isValidTheme(result)) {
      writeCache(name, result);
      return result;
    }
  } catch (error) {
    console.warn('Momentum theme generation failed, using built-in theme:', error);
  }
  return fallbackTheme(name);
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Near-white: every channel high (bright and barely tinted). Unknown formats count as not white. */
export const isNearWhite = (color: string): boolean => {
  const rgb = hexToRgb(color);
  return !!rgb && Math.min(...rgb) > 200;
};

/** White is reserved for boost ledges, so ordinary ledges never look like one. */
export const reserveBoostWhite = <T extends { platforms: string[]; glows: string[] }>(theme: T): T => {
  const keep = theme.platforms.map((c, i) => ({ c, g: theme.glows[i % theme.glows.length] })).filter(({ c }) => !isNearWhite(c));
  if (keep.length === theme.platforms.length) return theme;
  const safe = keep.length > 0 ? keep : [{ c: '#8f9bff', g: '#8f9bff' }];
  return { ...theme, platforms: safe.map(k => k.c), glows: safe.map(k => k.g) };
};
