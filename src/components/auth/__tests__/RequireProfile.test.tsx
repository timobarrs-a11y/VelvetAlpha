import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let row: unknown = null;
let failed = false;
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u-' + Math.random() }, loading: false }) }));
vi.mock('../../../shared/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: failed ? { message: 'x' } : null }) }) }) }) },
}));

import { RequireProfile, isProfileComplete } from '../RequireProfile';

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/lobby']}>
      <Routes>
        <Route path="/lobby" element={<RequireProfile><p>lobby</p></RequireProfile>} />
        <Route path="/user-questionnaire" element={<p>questions</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { row = null; failed = false; });

describe('isProfileComplete', () => {
  it('needs a name, birthday and gender unless marked done', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ name: 'babe', birthday: '2000-01-01', gender: 'x' })).toBe(false);
    expect(isProfileComplete({ nickname: 'Ace', birthday: '2000-01-01', gender: null })).toBe(false);
    expect(isProfileComplete({ nickname: 'Ace', birthday: '2000-01-01', gender: 'x' })).toBe(true);
    expect(isProfileComplete({ profile_completed: true })).toBe(true);
  });
});

describe('RequireProfile', () => {
  it('sends an unfinished profile back to the questions', async () => {
    row = { profile_completed: false, name: 'babe', nickname: null, birthday: '2000-01-01', gender: null };
    renderAt();
    await waitFor(() => expect(screen.getByText('questions')).toBeTruthy());
  });
  it('lets a finished profile through', async () => {
    row = { profile_completed: true };
    renderAt();
    await waitFor(() => expect(screen.getByText('lobby')).toBeTruthy());
  });
  it('does not lock anyone out when the lookup fails', async () => {
    failed = true;
    renderAt();
    await waitFor(() => expect(screen.getByText('lobby')).toBeTruthy());
  });
});
