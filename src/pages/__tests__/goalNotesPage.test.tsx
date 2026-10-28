import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const notes = [
  { id: 'n1', goal_id: 'g1', companion_id: 'c1', commitment_id: 't1', title: 'Trademark filing: what the USPTO needs', summary: 'Filing needs a **clear mark**, a class and a fee per class.', key_points: ['Search the database first', 'Pay per class'], next_step: 'Search the database', pinned: false, created_at: '2026-10-27T10:00:00Z' },
  { id: 'n2', goal_id: 'g2', companion_id: 'c1', commitment_id: null, title: 'Race day checklist', summary: 'Bib pickup closes Friday.', key_points: ['Bring ID'], next_step: null, pinned: false, created_at: '2026-10-26T10:00:00Z' },
];

const listGoalNotes = vi.fn();
const deleteGoalNote = vi.fn(async () => {});
const setNotePinned = vi.fn(async () => {});
vi.mock('../../services/goalNotesService', async () => {
  const actual = await vi.importActual<typeof import('../../services/goalNotesService')>('../../services/goalNotesService');
  return { ...actual, listGoalNotes: () => listGoalNotes(), deleteGoalNote: (id: string) => deleteGoalNote(id), setNotePinned: (id: string, p: boolean) => setNotePinned(id, p) };
});
vi.mock('../../services/coachingService', () => ({ getGoals: async () => [{ id: 'g1', title: 'Start my own company' }, { id: 'g2', title: 'Run a 5K' }] }));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../shared/ui/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
const draftToCompanion = vi.fn();
vi.mock('../../components/dock/DockContext', () => ({ useDockOptional: () => ({ companions: [{ id: 'c1' }], draftToCompanion }) }));
vi.mock('../../shared/supabase/client', () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});

import { GoalNotesPage } from '../GoalNotesPage';

const mount = (path = '/notes') => render(<MemoryRouter initialEntries={[path]}><GoalNotesPage /></MemoryRouter>);

beforeEach(() => { listGoalNotes.mockReset(); listGoalNotes.mockResolvedValue(notes); draftToCompanion.mockReset(); deleteGoalNote.mockClear(); setNotePinned.mockClear(); });

describe('the Notes page', () => {
  it('shows each note as a review with its key points and next step', async () => {
    mount();
    expect(await screen.findByText('Trademark filing: what the USPTO needs')).toBeTruthy();
    expect(screen.getByText('clear mark').tagName).toBe('STRONG');
    expect(screen.getByText('Pay per class')).toBeTruthy();
    expect(screen.getByText('Search the database', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('Race day checklist')).toBeTruthy();
  });

  it('says what it is for when there are none', async () => {
    listGoalNotes.mockResolvedValue([]);
    mount();
    expect(await screen.findByText('No notes yet')).toBeTruthy();
  });

  it('searches, and filters to one goal or one task', async () => {
    mount();
    await screen.findByText('Race day checklist');
    fireEvent.change(screen.getByLabelText('Search your notes'), { target: { value: 'bib' } });
    expect(screen.queryByText('Trademark filing: what the USPTO needs')).toBeNull();
    expect(screen.getByText('Race day checklist')).toBeTruthy();
  });

  it('opens on one task\'s notes from the task\'s chip', async () => {
    mount('/notes?task=t1');
    await screen.findByText('Trademark filing: what the USPTO needs');
    expect(screen.queryByText('Race day checklist')).toBeNull();
  });

  it('pins, deletes, and takes a note back to the coach that gave it, typed in not sent', async () => {
    mount();
    await screen.findByText('Race day checklist');
    fireEvent.click(screen.getAllByLabelText('Pin note')[1]);
    await waitFor(() => expect(setNotePinned).toHaveBeenCalledWith('n2', true));
    fireEvent.click(screen.getAllByText('Delete')[0]);
    await waitFor(() => expect(deleteGoalNote).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText('Ask more')[0]);
    expect(draftToCompanion).toHaveBeenCalledWith('c1', expect.stringContaining('Following up on my note'));
  });
});
