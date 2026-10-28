import { describe, it, expect } from 'vitest';
import { followUpPrompt, noteAsText, sortNotes, type GoalNote } from '../goalNotesService';

const note = (o: Partial<GoalNote>): GoalNote => ({
  id: 'n', goal_id: 'g', companion_id: 'c', commitment_id: null, title: 'T', summary: 'S', key_points: [], next_step: null, pinned: false, created_at: '2026-10-27T10:00:00Z', ...o,
});

describe('notes', () => {
  it('lists pinned notes first, then newest first', () => {
    const sorted = sortNotes([
      note({ id: 'old', created_at: '2026-10-01T00:00:00Z' }),
      note({ id: 'new', created_at: '2026-10-27T00:00:00Z' }),
      note({ id: 'pinned-old', pinned: true, created_at: '2026-09-01T00:00:00Z' }),
    ]);
    expect(sorted.map(n => n.id)).toEqual(['pinned-old', 'new', 'old']);
  });

  it('copies as plain text, without the bold and italic marks', () => {
    expect(noteAsText(note({ title: 'Trademark filing', summary: 'Needs a **clear mark** and a class.', key_points: ['Search first', 'Pay *per class*'], next_step: 'Search the database' })))
      .toBe('Trademark filing\n\nNeeds a clear mark and a class.\n\n- Search first\n- Pay per class\n\nNext: Search the database');
  });

  it('asks the coach to pick it up where the note left off', () => {
    expect(followUpPrompt({ title: 'Trademark filing', next_step: 'Search the database' }))
      .toBe('Following up on my note "Trademark filing". The next thing to do is: Search the database. Walk me through it, and tell me what I should watch out for.');
    expect(followUpPrompt({ title: 'Trademark filing', next_step: null })).toContain('Following up on my note "Trademark filing". Walk me through it');
  });
});
