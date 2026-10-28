import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const deleted: string[] = [];
let people = [
  { id: 'c1', custom_name: 'Maya', relationship_type: 'romantic' },
  { id: 'c2', custom_name: 'Sofia', relationship_type: 'mentor' },
];
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../services/companionService', () => ({
  getCompanions: async () => people,
  deleteCompanion: async (id: string) => { deleted.push(id); people = people.filter((p) => p.id !== id); return null; },
}));

import { YourTeamPanel } from '../YourTeamPanel';

describe('YourTeamPanel', () => {
  it('lists companions and coaches, and deletes only after a confirmation that says it is permanent', async () => {
    render(<MemoryRouter><YourTeamPanel /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Maya')).toBeTruthy());
    expect(screen.getByText('Sofia')).toBeTruthy();
    expect(screen.getByText('Coach')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Delete Sofia'));
    expect(screen.getByText('Delete Sofia permanently?')).toBeTruthy();
    expect(screen.getByText(/can't be undone/)).toBeTruthy();
    expect(screen.getByText(/Your goals and plans stay/)).toBeTruthy();
    expect(deleted).toEqual([]);

    fireEvent.click(screen.getByText('Cancel'));
    expect(deleted).toEqual([]);

    fireEvent.click(screen.getByLabelText('Delete Maya'));
    expect(screen.getByText(/Velvet Sims house together are deleted/)).toBeTruthy();
    fireEvent.click(screen.getByText('Delete permanently'));
    await waitFor(() => expect(deleted).toEqual(['c1']));
    await waitFor(() => expect(screen.queryByText('Maya')).toBeNull());
  });
});
