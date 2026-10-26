// Unlockable ball skins. Progress is tracked locally; career stars come from the server.

const STATS_KEY = 'momentum_lifetime_stats';
const SKIN_KEY = 'momentum_skin';

export interface LifetimeStats {
  perfects: number;
  bestEndlessHeight: number;
  dailyCompletions: number;
  levelsCompleted: number;
}

export interface Skin {
  id: string;
  name: string;
  /** null = use the theme's colours */
  fill: string | null;
  trail: string | null;
  rainbow?: boolean;
  requirement: string;
  isUnlocked: (stats: LifetimeStats, totalStars: number) => boolean;
}

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', fill: null, trail: null, requirement: 'Always available', isUnlocked: () => true },
  { id: 'ember', name: 'Ember', fill: '#ff7a1a', trail: '#ffb000', requirement: 'Complete 3 levels', isUnlocked: (s) => s.levelsCompleted >= 3 },
  { id: 'mint', name: 'Mint', fill: '#7dffc4', trail: '#2dffa0', requirement: 'Land 10 perfect bounces', isUnlocked: (s) => s.perfects >= 10 },
  { id: 'gold', name: 'Gold', fill: '#ffd447', trail: '#fff1a8', requirement: 'Earn 10 career stars', isUnlocked: (_s, stars) => stars >= 10 },
  { id: 'void', name: 'Void', fill: '#1b0033', trail: '#b46bff', requirement: 'Climb 5,000 in Endless', isUnlocked: (s) => s.bestEndlessHeight >= 5000 },
  { id: 'daily', name: 'Sunrise', fill: '#ff9ec7', trail: '#ffd6a5', requirement: 'Finish 3 Daily Climbs', isUnlocked: (s) => s.dailyCompletions >= 3 },
  { id: 'prism', name: 'Prism', fill: null, trail: null, rainbow: true, requirement: 'Earn 25 career stars', isUnlocked: (_s, stars) => stars >= 25 },
];

export const loadStats = (): LifetimeStats => {
  const base: LifetimeStats = { perfects: 0, bestEndlessHeight: 0, dailyCompletions: 0, levelsCompleted: 0 };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(STATS_KEY) || '{}') };
  } catch {
    return base;
  }
};

export const updateStats = (patch: (s: LifetimeStats) => Partial<LifetimeStats>): LifetimeStats => {
  const current = loadStats();
  const next = { ...current, ...patch(current) };
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable
  }
  return next;
};

export const loadSkinId = (): string => {
  try {
    return localStorage.getItem(SKIN_KEY) || 'classic';
  } catch {
    return 'classic';
  }
};

export const saveSkinId = (id: string) => {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // storage unavailable
  }
};

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) || SKINS[0];
