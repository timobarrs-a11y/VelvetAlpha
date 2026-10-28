import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
const auth = { user: { id: 'u1', created_at: new Date(Date.now() - 2 * 86_400_000).toISOString() } };
vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('../../../shared/supabase/client', () => ({ supabase: {} }));
vi.mock('../../today/PeopleSheet', () => ({ PeopleSheet: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <p>People form</p> : null) }));
const progress = { friend: true, space: false, game: false, companion: false, people: false };
vi.mock('../firstWeek', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../firstWeek')>();
  return { ...actual, getFirstWeekProgress: async () => ({ ...progress }) };
});

const { FirstWeekCard } = await import('../FirstWeekCard');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('FirstWeekCard', () => {
  it('lists the five things, ticking off what is done', async () => {
    render(<FirstWeekCard />);
    expect(await screen.findByText('Your first week')).toBeTruthy();
    expect(screen.getByText(/1 of 5/)).toBeTruthy();
    expect((screen.getByText('Add a friend in town').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('takes each one to the right place', async () => {
    render(<FirstWeekCard />);
    fireEvent.click(await screen.findByText('Say something in a space'));
    expect(navigate).toHaveBeenCalledWith('/spaces');
    fireEvent.click(screen.getByText("Add your people's birthdays"));
    expect(screen.getByText('People form')).toBeTruthy();
    fireEvent.click(screen.getByText('Play a game'));
    expect(navigate).toHaveBeenCalledWith('/checkers');
    expect(screen.getByText(/2 of 5/)).toBeTruthy();
  });

  it('stays hidden once dismissed', async () => {
    const { unmount } = render(<FirstWeekCard />);
    fireEvent.click(await screen.findByLabelText('Hide your first week'));
    expect(screen.queryByText('Your first week')).toBeNull();
    unmount();
    render(<FirstWeekCard />);
    await new Promise(r => setTimeout(r, 10));
    expect(screen.queryByText('Your first week')).toBeNull();
  });
});
