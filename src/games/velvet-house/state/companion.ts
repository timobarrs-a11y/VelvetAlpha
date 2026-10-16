export interface CompanionState {
  source: 'game' | 'velvet';
  preset: string;
  pronoun: 'she' | 'he';
  gender: 'female' | 'male';
  bio: string;
  memories: string[];
}

export interface Preset {
  label: string;
  text: string;
}

export const PRESETS: Record<string, Preset> = {
  warm: {
    label: 'Warm and teasing',
    text: 'Warm, funny, a little sarcastic, quick to tease, and honest when something bugs her. She loves R&B, cooking shows and her houseplants, and she hates early mornings.',
  },
  calm: {
    label: 'Calm and thoughtful',
    text: 'Calm, thoughtful and quietly funny. Notices small things, gives honest advice, loves books, rainy days and long walks, and hates loud surprises.',
  },
  bubbly: {
    label: 'Bubbly and chaotic',
    text: 'Bubbly, affectionate and a little chaotic. Talks fast, gets excited about everything, loves dancing, snacks and reality TV, and hates sitting still.',
  },
  dry: {
    label: 'Dry and witty',
    text: 'Dry, witty and a little guarded. Shows love by teasing and doing small favors instead of saying it, loves movies and cooking, and hates small talk.',
  },
};

const HER_OBJ = new Set([
  'to', 'and', 'up', 'down', 'out', 'off', 'on', 'in', 'a', 'an', 'the',
  'about', 'back', 'for', 'with', 'at', 'from', 'over', 'into', 'some',
  'it', 'that', 'this', 'what', 'how', 'when', 'so', 'too', 'again',
  'alone', 'before', 'after', 'first', 'once', 'while', 'if', 'today',
  'tonight', 'now', 'more', 'than', 'or', 'but', 'feel', 'know', 'go',
  'get', 'come', 'down', 'laugh', 'smile', 'cry', 'think', 'want', 'look', 'pick',
]);

export function heSwap(s: string): string {
  return s
    .replace(/\b(She|she)'s\b/g, (_m, w) => (w === 'She' ? "He's" : "he's"))
    .replace(/\bShe\b/g, 'He')
    .replace(/\bshe\b/g, 'he')
    .replace(/\bherself\b/g, 'himself')
    .replace(/\bhers\b/g, 'his')
    .replace(/\b(H|h)er\b(\s*)([A-Za-z]*)/g, (_m, H, sp, nx) => {
      const obj = !nx || HER_OBJ.has(nx.toLowerCase());
      return (H === 'H' ? (obj ? 'Him' : 'His') : (obj ? 'him' : 'his')) + sp + nx;
    });
}

export function replaceName(s: string, from: string, to: string): string {
  if (from === to) return s;
  return s.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
}

export function pronounSwap(
  s: string,
  partnerName: string,
  companion: CompanionState,
): string {
  if (typeof s !== 'string') return s as string;
  let out = s;
  if (partnerName !== 'Maya') out = replaceName(out, 'Maya', partnerName);
  if (companion.pronoun === 'he') out = heSwap(out);
  return out;
}

export function playerPronounSwap(
  s: string,
  simName: string,
  partnerName: string,
  companion: CompanionState,
): string {
  if (s.startsWith(simName + ': ')) {
    return partnerName === 'Maya' ? s : s.replace(/\bMaya\b/g, partnerName);
  }
  return pronounSwap(s, partnerName, companion);
}
