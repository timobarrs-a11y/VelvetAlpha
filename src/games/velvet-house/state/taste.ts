export const STYLE_TAGS = [
  'warm', 'cool', 'bold', 'soft', 'natural', 'modern',
  'vintage', 'playful', 'luxe', 'industrial', 'cozy', 'minimal'
] as const;

export type StyleTag = typeof STYLE_TAGS[number];

export interface StyleProfile {
  seed: number;
  [tag: string]: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface TasteNormal {
  key: string;
  mean: number;
  sd: number;
}

export function rollStyle(rng: () => number, bias: Partial<Record<StyleTag, number>> = {}): StyleProfile {
  const st: StyleProfile = { seed: Math.floor(rng() * 1e6) };
  for (const k of STYLE_TAGS) {
    st[k] = +(((rng() * 2 - 1) * 0.6) + (bias[k] || 0)).toFixed(2);
  }
  return st;
}

export function rawTaste(item: CatalogItem, style: StyleProfile): number {
  if (!item.tags || !item.tags.length) return 0;
  let h = style.seed || 0;
  for (const ch of item.id) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return (
    item.tags.reduce((a, t) => a + (style[t] || 0), 0) / Math.sqrt(item.tags.length) +
    ((h % 100) / 100 - 0.5) * 0.45
  );
}

export function computeTasteNorm(items: CatalogItem[], style: StyleProfile): TasteNormal {
  const vs = items.filter(i => i.tags).map(i => rawTaste(i, style));
  if (!vs.length) return { key: JSON.stringify(style), mean: 0, sd: 1 };
  const m = vs.reduce((a, b) => a + b, 0) / vs.length;
  const sd = Math.sqrt(vs.reduce((a, b) => a + (b - m) * (b - m), 0) / vs.length) || 1;
  return { key: JSON.stringify(style), mean: m, sd };
}

export function tasteOf(
  item: CatalogItem,
  style: StyleProfile,
  norm: TasteNormal
): number {
  if (!item.tags) return 0;
  const z = (rawTaste(item, style) - norm.mean) / norm.sd;
  return Math.max(-2, Math.min(2, Math.round(z * 1.05))) || 0;
}

export interface StyleSummary {
  loves: StyleTag[];
  hates: StyleTag[];
}

export function styleWords(style: StyleProfile): StyleSummary {
  const ks = STYLE_TAGS.slice().sort((a, b) => style[b] - style[a]);
  return {
    loves: ks.slice(0, 3).filter(k => style[k] > 0.15) as StyleTag[],
    hates: ks.slice(-2).filter(k => style[k] < -0.2) as StyleTag[],
  };
}

export const TASTE_LINE: Record<number, string> = {
  2: 'they love it',
  1: 'they like it',
  0: 'they are lukewarm on it',
  '-1': 'it is not really their taste',
  '-2': 'they can not stand it',
};
