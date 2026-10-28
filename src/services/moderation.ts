import { supabase } from '../shared/supabase/client';

/**
 * The database refuses slurs and hate speech in public text (see the
 * hate_speech_word_bank migration) with this SQLSTATE and a message written
 * for the person posting, so it can be shown as is.
 */
export const MODERATION_BLOCK_CODE = 'VM001';

export class ModerationBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationBlockedError';
  }
}

export function isModerationBlock(error: unknown): boolean {
  if (error instanceof ModerationBlockedError) return true;
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === MODERATION_BLOCK_CODE;
}

/** Re-throw a database moderation block as a ModerationBlockedError; ignore anything else. */
export function throwIfModerated(error: unknown): void {
  if (isModerationBlock(error)) {
    throw new ModerationBlockedError((error as { message: string }).message);
  }
}

/** The message to show for a failed save: the block reason, or `fallback`. */
export function saveErrorMessage(error: unknown, fallback: string): string {
  return isModerationBlock(error) && error instanceof Error ? error.message : fallback;
}

// Admin console: the word bank and what it has flagged.

export type ModerationTier = 'block' | 'flag';

export interface ModerationTerm {
  id: string;
  term: string;
  tier: ModerationTier;
  category: string;
  match_anywhere: boolean;
  active: boolean;
  note: string | null;
  created_at: string;
}

export interface ModerationHit {
  id: string;
  user_id: string | null;
  source: string;
  term: string;
  category: string;
  excerpt: string;
  created_at: string;
}

export interface ModerationTestResult {
  action: 'allow' | ModerationTier;
  term: string | null;
  category: string | null;
}

/** Lowercase letters, digits and single spaces: the shape the database accepts. */
export function cleanTerm(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const moderationAdmin = {
  async listTerms(): Promise<ModerationTerm[]> {
    const { data, error } = await supabase
      .from('moderation_terms')
      .select('id, term, tier, category, match_anywhere, active, note, created_at')
      .order('category')
      .order('term');
    if (error) throw new Error(error.message);
    return (data ?? []) as ModerationTerm[];
  },

  async addTerm(input: { term: string; tier: ModerationTier; category: string; match_anywhere: boolean }): Promise<void> {
    const term = cleanTerm(input.term);
    if (!term) throw new Error('Enter a word or phrase.');
    const { error } = await supabase.from('moderation_terms').insert({ ...input, term, category: input.category.trim() || 'other' });
    if (error) throw new Error(error.code === '23505' ? `"${term}" is already in the list.` : error.message);
  },

  async updateTerm(id: string, changes: Partial<Pick<ModerationTerm, 'tier' | 'active' | 'match_anywhere'>>): Promise<void> {
    const { error } = await supabase.from('moderation_terms').update(changes).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async removeTerm(id: string): Promise<void> {
    const { error } = await supabase.from('moderation_terms').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async recentHits(limit = 50): Promise<ModerationHit[]> {
    const { data, error } = await supabase
      .from('moderation_hits')
      .select('id, user_id, source, term, category, excerpt, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as ModerationHit[];
  },

  async dismissHit(id: string): Promise<void> {
    const { error } = await supabase.from('moderation_hits').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async test(text: string): Promise<ModerationTestResult> {
    const { data, error } = await supabase.rpc('moderation_test', { p_text: text });
    if (error) throw new Error(error.message);
    return data as ModerationTestResult;
  },
};
