import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { todaysPair, pairKey } from '../thisOrThat';
import { TASTE_DECK_CARDS } from '../../questionnaire/personalBank';
import {
  weekOneQuestions, weekOneBlock, takeTraitMarkers, tastePicksLine,
} from '../../../../supabase/functions/_shared/companionWeekOne';

const updates: Array<Record<string, unknown>> = [];
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { taste_picks: {} } }) }) }),
      update: (patch: Record<string, unknown>) => ({ eq: async () => { updates.push(patch); return { error: null }; } }),
    }),
  },
}));

const { ThisOrThatCard } = await import('../ThisOrThatCard');

describe('this or that', () => {
  it("picks the first pair they haven't answered, and none once all are done", () => {
    const now = new Date(2026, 9, 26);
    const first = todaysPair({}, now)!;
    expect(todaysPair({ [pairKey(first)]: first.left.label }, now)).not.toEqual(first);
    const all = Object.fromEntries(TASTE_DECK_CARDS.map(c => [pairKey(c), c.left.label]));
    expect(todaysPair(all, now)).toBeNull();
  });

  it('saves the pick', async () => {
    render(<ThisOrThatCard />);
    const card = todaysPair({})!;
    fireEvent.click(await screen.findByText(card.right.label));
    await waitFor(() => expect(updates[0]).toEqual({ taste_picks: { [pairKey(card)]: card.right.label } }));
    expect(screen.getByText('Noted. Your companions will know.')).toBeTruthy();
  });

  it('reads as one line for a companion', () => {
    expect(tastePicksLine({ 'Gym at 6am / Sleep in': 'Sleep in', 'Cook at home / Try a new restaurant': 'Cook at home' }))
      .toContain('Sleep in over Gym at 6am; Cook at home over Try a new restaurant');
    expect(tastePicksLine({})).toBe('');
  });
});

describe("a companion's first week", () => {
  const now = new Date('2026-10-26T12:00:00Z');

  it('asks only what is unknown, only in the first week, and never for coaches or assistants', () => {
    expect(weekOneQuestions({ relationship_type: 'friend', created_at: '2026-10-24T00:00:00Z' }, now)).toEqual(['love_language', 'confrontation_style']);
    expect(weekOneQuestions({ relationship_type: 'romantic', created_at: '2026-10-24T00:00:00Z', love_language: 'time' }, now)).toEqual(['confrontation_style']);
    expect(weekOneQuestions({ relationship_type: 'friend', created_at: '2026-10-10T00:00:00Z' }, now)).toEqual([]);
    expect(weekOneQuestions({ relationship_type: 'assistant', created_at: '2026-10-25T00:00:00Z' }, now)).toEqual([]);
  });

  it('waits a few messages before asking', () => {
    expect(weekOneBlock(['love_language'], 1)).toBe('');
    expect(weekOneBlock(['love_language'], 4)).toContain('[TRAIT love_language=');
  });

  it('saves valid answers and hides the marker', () => {
    expect(takeTraitMarkers('That means a lot. [TRAIT love_language=time]')).toEqual({ text: 'That means a lot.', updates: { love_language: 'time' } });
    expect(takeTraitMarkers('Okay. [TRAIT confrontation_style=yelling]')).toEqual({ text: 'Okay.', updates: {} });
  });
});
