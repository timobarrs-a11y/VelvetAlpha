import { describe, it, expect } from 'vitest';
import { weekOneQuestions, weekOneBlock, takeTraitMarkers } from '../../../supabase/functions/_shared/companionWeekOne';

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
