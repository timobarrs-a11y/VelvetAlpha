// Memory engine helpers shared by chat-turn and dream-hygiene.
//
// Pure functions only (plus one fetch-based embedding call) so they run under
// both Deno (edge functions) and vitest. See docs/memory-engine.md for the
// design and the research behind it.

// Embeddings are versioned: rows remember which model made their vector, and
// retrieval only compares vectors from the same model. Changing this constant
// is safe; dream-hygiene re-embeds rows from the old model over a few nights.
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

export interface MemoryCandidate {
  id: string;
  kind: string;
  content: string;
  confidence: number;
  scope: string;
  companion_id: string | null;
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
  last_confirmed_at: string | null;
  confirm_count: number;
  relevance: number;
  score: number;
}

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

/** "as of Oct 19" style date so the model can reason about staleness. */
export function formatAsOf(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}

export function formatMemoryLine(m: Pick<MemoryCandidate, 'content' | 'kind' | 'source' | 'updated_at' | 'last_confirmed_at'>, now: Date = new Date()): string {
  const asOf = formatAsOf(m.last_confirmed_at ?? m.updated_at, now);
  const tags: string[] = [];
  if (m.kind !== 'fact' && m.kind !== 'thread') tags.push(m.kind.replace('_', ' '));
  if (m.source === 'user_stated' || m.source === 'user_edited') tags.push('user confirmed');
  if (asOf) tags.push(`as of ${asOf}`);
  // Collapse whitespace so stored text can't fake new lines / fence markers.
  const text = m.content.replace(/\s+/g, ' ').replace(/<\/?memory>/gi, '').trim();
  return `- ${text}${tags.length ? ` (${tags.join(', ')})` : ''}`;
}

/**
 * Is the extractor's quoted evidence really in what the user said? Facts whose
 * evidence can't be found are hallucinated extractions and are dropped.
 */
export function isGroundedIn(evidence: string | null | undefined, sourceText: string): boolean {
  if (!evidence) return false;
  const ev = normalizeMemoryText(evidence);
  const src = normalizeMemoryText(sourceText);
  if (ev.length < 2) return false;
  if (src.includes(ev)) return true;
  const evTokens = ev.split(' ').filter(w => w.length > 1);
  if (evTokens.length === 0) return false;
  const srcTokens = new Set(src.split(' '));
  const found = evTokens.filter(w => srcTokens.has(w)).length;
  return found / evTokens.length >= 0.8;
}

const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above|earlier) (instructions|rules|prompts)/i,
  /\b(your|the) (rules|instructions|system prompt|guidelines) (have |has )?(changed|are now|is now)/i,
  /\bfrom now on,? (you|always|never)\b/i,
  /\b(you are|you're) now (a|an|my)\b/i,
  /\balways (respond|reply|answer|say)\b/i,
  /\bnever (refuse|mention|say)\b/i,
  /\bsystem prompt\b/i,
  /\bdeveloper mode\b/i,
  /\bjailbreak\b/i,
  /\bpretend (to be|you are)\b/i,
  /\bact as (a|an|if)\b/i,
  /\bnew (rules|instructions|persona)\b/i,
  /SYSTEM:/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /<\/?(memory|system|instructions?)>/i,
];

/** Text that tries to instruct the AI is never stored as a memory about the user. */
export function looksLikeInstruction(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text));
}

export interface DuplicateItem {
  id: string;
  kind: string;
  content: string;
  source: string;
  confirm_count?: number | null;
  recall_count?: number | null;
  created_at: string;
  embedding?: number[] | null;
  companion_id?: string | null;
  scope?: string;
}

/** Which of two duplicates to keep: user-stated beats inferred, then the most reinforced, then the oldest. */
function keeperRank(m: DuplicateItem): [number, number, number] {
  const userSaid = m.source === 'user_stated' || m.source === 'user_edited' ? 1 : 0;
  const reinforced = (m.confirm_count ?? 1) + (m.recall_count ?? 0);
  return [userSaid, reinforced, -new Date(m.created_at).getTime()];
}

function better(a: DuplicateItem, b: DuplicateItem): boolean {
  const ra = keeperRank(a);
  const rb = keeperRank(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] > rb[i];
  }
  return a.id < b.id;
}

/**
 * Group near-duplicate memories of the same kind and visibility (a shared
 * memory is never folded into one only a single companion can see). Returns one entry per group
 * with the row to keep and the rows to fold into it.
 */
export function findDuplicateGroups(
  items: DuplicateItem[],
  opts: { embeddingThreshold?: number } = {},
): Array<{ keep: DuplicateItem; drop: DuplicateItem[] }> {
  const embeddingThreshold = opts.embeddingThreshold ?? 0.95;
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.kind !== b.kind || (a.companion_id ?? null) !== (b.companion_id ?? null) || a.scope !== b.scope) continue;
      const textDup = isNearDuplicate(a.content, b.content, 'strict');
      // Vectors alone can't tell "lives in Denver" from "lives in Boulder";
      // a vector match also needs real word overlap so contradictions never merge.
      const vecDup = !!(a.embedding && b.embedding)
        && cosineSimilarity(a.embedding, b.embedding) >= embeddingThreshold
        && tokenOverlap(contentTokens(a.content), contentTokens(b.content)) >= 0.75;
      if (textDup || vecDup) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, DuplicateItem[]>();
  items.forEach((m, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), m]);
  });
  const out: Array<{ keep: DuplicateItem; drop: DuplicateItem[] }> = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const keep = members.reduce((best, m) => (better(m, best) ? m : best));
    out.push({ keep, drop: members.filter(m => m.id !== keep.id) });
  }
  return out;
}

/**
 * Embed texts with OpenAI. Returns null (never throws) when the key is
 * missing, the call fails or it takes longer than `timeoutMs`; callers fall
 * back to full-text retrieval.
 */
export async function embedTexts(
  texts: string[],
  apiKey: string | undefined,
  timeoutMs = 2500,
  fetchImpl: typeof fetch = fetch,
): Promise<number[][] | null> {
  if (!apiKey || texts.length === 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts.map(t => t.slice(0, 8000)) }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const rows = (json?.data ?? []) as Array<{ index: number; embedding: number[] }>;
    if (rows.length !== texts.length) return null;
    const out: number[][] = new Array(texts.length);
    for (const r of rows) out[r.index] = r.embedding;
    if (out.some(e => !Array.isArray(e) || e.length !== EMBEDDING_DIMENSIONS)) return null;
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** pgvector text form for RPC parameters typed `vector`. */
export function toPgVector(embedding: number[] | null | undefined): string | null {
  return embedding && embedding.length > 0 ? `[${embedding.join(',')}]` : null;
}
