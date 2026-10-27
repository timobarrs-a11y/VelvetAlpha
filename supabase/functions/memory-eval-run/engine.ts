// Copy of the selection helpers from ../_shared/memoryEngine.ts, so the eval scores the same code chat-turn runs.
// Refresh this copy when memoryEngine.ts changes (a function bundle can't import ../_shared when deployed from the dashboard).
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'about', 'they', 'their', 'them', 'have', 'has',
  'had', 'was', 'were', 'are', 'is', 'be', 'been', 'being', 'to', 'of', 'in', 'on', 'at', 'a', 'an', 'or',
  'it', 'its', 'as', 'by', 'user', 'users', 'currently', 'really', 'very', 'just', 'also', 'into', 'than',
]);

/** Case/punctuation/whitespace-insensitive form. Mirrors SQL memory_normalize(). */
export function normalizeMemoryText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function stem(word: string): string {
  // Crude plural/tense folding; enough to make "books"/"book", "reading"/"read" collide.
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of normalizeMemoryText(text).split(' ')) {
    // Single digits stay: "2 kids" and "3 kids" must not look alike.
    if ((w.length < 2 && !/\d/.test(w)) || STOPWORDS.has(w)) continue;
    out.add(stem(w));
  }
  return out;
}

/** Overlap coefficient: |A∩B| / min(|A|,|B|). Catches "X" vs "X, and more detail". */
export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const norm = Math.sqrt(na) * Math.sqrt(nb);
  return norm === 0 ? 0 : dot / norm;
}

// Words that flip or end a statement. "t" is what's left of "doesn't" etc.
const NEGATIONS = new Set([
  'not', 'no', 'never', 'none', 'nothing', 'nobody', 'nor', 'without', 't', 'cannot', 'dont', 'doesnt', 'didnt',
  'isnt', 'wasnt', 'arent', 'werent', 'wont', 'cant', 'anymore', 'longer', 'ex', 'former', 'formerly', 'stopped',
  'quit', 'quitting', 'used',
]);

/**
 * The two texts differ by a negation or a number, so they may say opposite
 * things ("eats red meat" / "doesn't eat red meat", "2 kids" / "3 kids").
 * Such pairs are never treated as duplicates, however many words they share.
 */
export function mayContradict(a: string, b: string): boolean {
  const wa = new Set(normalizeMemoryText(a).split(' '));
  const wb = new Set(normalizeMemoryText(b).split(' '));
  const differs = (w: string) => NEGATIONS.has(w) || /\d/.test(w);
  for (const w of wa) if (!wb.has(w) && differs(w)) return true;
  for (const w of wb) if (!wa.has(w) && differs(w)) return true;
  return false;
}

/**
 * Two memories say the same thing. Loose mode also treats "X" and "X plus
 * detail" as duplicates (fine for keeping a prompt diverse); strict mode only
 * matches near-paraphrases (safe for retiring a row without losing detail).
 */
export function isNearDuplicate(a: string, b: string, mode: 'loose' | 'strict' = 'loose'): boolean {
  if (normalizeMemoryText(a) === normalizeMemoryText(b)) return true;
  if (mayContradict(a, b)) return false;
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (mode === 'strict') return jaccard(ta, tb) >= 0.75;
  return jaccard(ta, tb) >= 0.6 || (tokenOverlap(ta, tb) >= 0.85 && Math.min(ta.size, tb.size) >= 3);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4) + 4;
}

export interface SelectionOptions {
  maxItems: number;
  maxTokens: number;
  /** Below this relevance an item only gets in as one of `backgroundSlots`. */
  minRelevance: number;
  /** Always-on context (pinned, user-stated, high importance) regardless of the message. */
  backgroundSlots: number;
  /** MMR trade-off: 1 = pure score, 0 = pure diversity. */
  lambda: number;
}

export const DEFAULT_FACT_SELECTION: SelectionOptions = {
  maxItems: 12,
  maxTokens: 900,
  minRelevance: 0.2,
  backgroundSlots: 5,
  lambda: 0.7,
};

export const DEFAULT_THREAD_SELECTION: SelectionOptions = {
  maxItems: 4,
  maxTokens: 300,
  minRelevance: 0.2,
  backgroundSlots: 2,
  lambda: 0.6,
};

/**
 * Pick what goes into the prompt: relevant items first, a few always-on
 * background items, no near-duplicates, within a token budget. Greedy MMR
 * (maximal marginal relevance) over the SQL-blended score.
 */
export function selectMemories<T extends Pick<MemoryCandidate, 'id' | 'content' | 'relevance' | 'score' | 'importance'>>(
  candidates: T[],
  opts: SelectionOptions,
): T[] {
  const pool = candidates
    .filter(c => c.content && c.content.trim().length > 0)
    .map(c => ({ c, tokens: contentTokens(c.content) }));
  const chosen: typeof pool = [];
  let tokens = 0;
  let background = 0;

  while (pool.length > 0 && chosen.length < opts.maxItems) {
    let bestIdx = -1;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const { c, tokens: t } = pool[i];
      const relevant = c.relevance >= opts.minRelevance || c.importance >= 9;
      if (!relevant && background >= opts.backgroundSlots) continue;
      const maxSim = chosen.reduce((m, s) => Math.max(m, jaccard(t, s.tokens)), 0);
      const value = opts.lambda * c.score - (1 - opts.lambda) * maxSim;
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    const [pick] = pool.splice(bestIdx, 1);
    if (chosen.some(s => isNearDuplicate(s.c.content, pick.c.content))) continue;
    const cost = estimateTokens(pick.c.content);
    if (tokens + cost > opts.maxTokens) continue;
    chosen.push(pick);
    tokens += cost;
    if (!(pick.c.relevance >= opts.minRelevance || pick.c.importance >= 9)) background++;
  }
  return chosen.map(s => s.c);
}

