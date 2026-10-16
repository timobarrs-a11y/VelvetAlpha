import type { WishKind, WishState } from './wishes';

export interface SparkContext {
  hour: number;
  hasWish: boolean;
  homeNow: boolean;
  dishes: number;
  money: number;
  lawnWeeds: number;
  raining: boolean;
  laundryPile: number;
  messLevel: number;
  hasPets: boolean;
}

export interface SparkWeight {
  id: string;
  weight: (ctx: SparkContext) => number;
}

export type SparkId =
  | 'coffee' | 'dance' | 'tv'
  | 'toast' | 'monstera' | 'momCall'
  | 'dishes' | 'moneyCheck' | 'playlist'
  | 'dandelions' | 'rain' | 'laundry'
  | 'messy' | 'pets';

export const SPARK_WEIGHTS: SparkWeight[] = [
  { id: 'coffee', weight: c => c.hour < 11 && !c.hasWish ? 3 : 0 },
  { id: 'dance', weight: c => c.hour >= 18 && !c.hasWish && c.homeNow ? 2 : 0 },
  { id: 'tv', weight: c => c.hour >= 19 && !c.hasWish && c.homeNow ? 2.5 : 0 },
  { id: 'toast', weight: () => 1 },
  { id: 'monstera', weight: () => 1 },
  { id: 'momCall', weight: c => c.hour >= 10 && c.hour < 21 ? 1 : 0 },
  { id: 'dishes', weight: c => c.dishes >= 2 ? 1.5 : 0 },
  { id: 'moneyCheck', weight: c => c.money < 50 ? 1.2 : 0 },
  { id: 'playlist', weight: c => c.hour >= 19 ? 1.2 : 0 },
  { id: 'dandelions', weight: c => c.lawnWeeds >= 5 ? 1 : 0 },
  { id: 'rain', weight: c => c.raining ? 1.2 : 0 },
  { id: 'laundry', weight: c => c.laundryPile >= 5 ? 1.5 : 0 },
  { id: 'messy', weight: c => c.messLevel > 5 ? 1.5 : 0 },
  { id: 'pets', weight: c => c.hasPets ? 1.4 : 0 },
];

export function sparkWeights(ctx: SparkContext): number[] {
  return SPARK_WEIGHTS.map(s => s.weight(ctx));
}

export function pickSpark(ctx: SparkContext, rng: () => number): SparkId | null {
  const ws = sparkWeights(ctx);
  const sum = ws.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  let r = rng() * sum;
  for (let i = 0; i < SPARK_WEIGHTS.length; i++) {
    r -= ws[i];
    if (r <= 0) return SPARK_WEIGHTS[i].id as SparkId;
  }
  return SPARK_WEIGHTS[0].id as SparkId;
}

export const SPARK_TO_WISH: Partial<Record<SparkId, WishKind>> = {
  coffee: 'coffee',
  dance: 'dance',
  tv: 'tv',
};

export interface SparkLogConfig {
  toast: string[];
  monstera: string;
  momCall: string;
  dishes: string[];
  moneyCheck: string;
  playlist: string;
  dandelions: string;
  rain: string;
  laundry: string[];
  messy: string[];
  pets: string[];
}

export const SPARK_MOOD: Partial<Record<SparkId, string>> = {
  monstera: 'happy',
  dishes: 'annoyed',
  moneyCheck: 'tired',
  playlist: 'playful',
  rain: 'happy',
  laundry: 'annoyed',
  messy: 'annoyed',
};
