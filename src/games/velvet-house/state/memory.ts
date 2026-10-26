/**
 * What the companion remembers, in three tiers so it can grow without outgrowing the prompt:
 *   coreMem   things a partner should never forget (family, health, big news, promises), kept for good
 *   memories  recent everyday things; once there are too many, the oldest are condensed into one pastMem summary
 *   pastMem   condensed summaries of older stretches; once there are too many, the two oldest merge into one
 *
 * Nothing is thrown away to make room: older entries are condensed into a shorter one (by the AI when it is
 * available). If a condense fails, the entries it was working on go back where they were.
 */
import type { SampleFn } from './companionAI';

export const CORE_CAP = 24;
export const RECENT_CAP = 30;
export const PAST_CAP = 8;
export const MEM_BUDGET = 8000;
export const MEM_CLIP = 220;

// How many of the oldest entries are folded together each time a tier is over its cap.
const RECENT_BATCH = 12;
const CORE_BATCH = 8;
const PAST_BATCH = 2;
// Without the AI, tiers are left to grow a little past the cap instead of being cut; past this they are folded by hand.
const HARD_FACTOR = 2;

export interface MemoryStore {
  coreMem: string[];
  memories: string[];
  pastMem: string[];
}

/** Folds several memories into one shorter text of at most `maxChars`. */
export type Condenser = (lines: string[], maxChars: number) => Promise<string>;

/** Adds a memory. Returns false for an empty or repeated one. */
export function remember(text: string, important: boolean, store: MemoryStore): boolean {
  const t = String(text ?? '').trim().slice(0, MEM_CLIP);
  if (!t) return false;
  if (store.coreMem.includes(t) || store.memories.includes(t)) return false;
  (important ? store.coreMem : store.memories).push(t);
  return true;
}

export function needsCompaction(store: MemoryStore): boolean {
  return store.memories.length > RECENT_CAP || store.coreMem.length > CORE_CAP || store.pastMem.length > PAST_CAP;
}

/** The fallback when the AI isn't there: the start of each entry, joined, so every entry is still represented. */
export function plainCondense(lines: string[], maxChars: number): string {
  const each = Math.max(20, Math.floor(maxChars / Math.max(1, lines.length)) - 1);
  const parts = lines.map(l => (l.length > each ? l.slice(0, each - 1).trimEnd() + '…' : l));
  return parts.join(' ').slice(0, maxChars);
}

/** A condenser that asks the AI (the game's sample function), and falls back to plainCondense on any failure. */
export function condenserFrom(sample: SampleFn | null, name: string): Condenser {
  return async (lines, maxChars) => {
    if (!sample) return plainCondense(lines, maxChars);
    try {
      const prompt = [
        `You keep ${name}'s memory in a life-sim game. Condense these memories into one short paragraph under ${maxChars} characters, in third person, oldest first. Keep names, people, places, promises and anything emotional. Return only the paragraph.`,
        '',
        ...lines.map(l => `- ${l}`),
      ].join('\n');
      const out = String(await sample([prompt], { modelTier: 'quick', cache: false }) ?? '')
        .replace(/\[[^\]]*mood[^\]]*\]/gi, '').trim();
      return out ? out.slice(0, maxChars) : plainCondense(lines, maxChars);
    } catch {
      return plainCondense(lines, maxChars);
    }
  };
}

const running = new WeakSet<MemoryStore>();

/**
 * Brings every tier back under its cap by condensing the oldest entries. Without a condenser, nothing happens
 * until a tier is far over its cap (then entries are folded by plainCondense), so memories are never dropped.
 */
export async function compactMemory(store: MemoryStore, condense?: Condenser): Promise<void> {
  if (running.has(store)) return;
  running.add(store);
  try {
    const fold = condense ?? plainCondense as unknown as Condenser;
    const over = (len: number, cap: number) => len > (condense ? cap : cap * HARD_FACTOR);

    while (over(store.memories.length, RECENT_CAP)) {
      const old = store.memories.splice(0, RECENT_BATCH);
      try { store.pastMem.push(await fold(old, 400)); } catch { store.memories.unshift(...old); break; }
    }
    while (over(store.coreMem.length, CORE_CAP)) {
      const old = store.coreMem.splice(0, CORE_BATCH);
      try {
        // A few short sentences, so each stays a separate fact.
        const merged = (await fold(old, MEM_CLIP * 2)).match(/[^.!?]+[.!?]*/g) ?? [];
        store.coreMem.unshift(...merged.map(s => s.trim()).filter(Boolean).slice(0, 3));
      } catch { store.coreMem.unshift(...old); break; }
    }
    while (over(store.pastMem.length, PAST_CAP)) {
      const old = store.pastMem.splice(0, PAST_BATCH);
      try { store.pastMem.unshift(await fold(old, 500)); } catch { store.pastMem.unshift(...old); break; }
    }
  } finally {
    running.delete(store);
  }
}

/** The newest entries that fit in `left` characters, oldest first; returns them and what is left. */
function take(list: string[], left: number, per: number): { out: string[]; left: number } {
  const out: string[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const cost = list[i].length + per;
    if (cost > left) break;
    out.unshift(list[i]);
    left -= cost;
  }
  return { out, left };
}

/** What goes in the companion's prompt, held to MEM_BUDGET characters: never-forget first, then the newest of the rest. */
export function memoryBrief(store: MemoryStore): string {
  let left = MEM_BUDGET;
  const core = take(store.coreMem, left, 3); left = core.left;
  const past = take(store.pastMem, left, 1); left = past.left;
  const recent = take(store.memories, left, 3);
  const parts: string[] = [];
  if (core.out.length) parts.push(`Memory (never forget these):\n${core.out.map(m => `- ${m}`).join('\n')}`);
  if (past.out.length) parts.push(`Older summaries:\n${past.out.join('\n')}`);
  if (recent.out.length) parts.push(`Recent memories:\n${recent.out.map(m => `- ${m}`).join('\n')}`);
  return parts.join('\n\n');
}
