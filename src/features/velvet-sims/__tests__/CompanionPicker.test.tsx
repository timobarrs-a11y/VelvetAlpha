import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../components/Avatar', () => ({ Avatar: () => <div data-testid="avatar" /> }));

import { CompanionPicker } from '../CompanionPicker';

const companions = [
  { id: 'a', custom_name: 'Maya', relationship_type: 'romantic', avatar_config: {} },
  { id: 'b', custom_name: 'Riley', relationship_type: 'friend', avatar_config: {} },
] as never;

describe('CompanionPicker', () => {
  it('shows each companion and what they are to you, and picks the one tapped', () => {
    const onPick = vi.fn();
    render(<CompanionPicker companions={companions} currentId="a" mode="new" days={{ a: 4 }} onPick={onPick} onCancel={() => {}} />);
    expect(screen.getByText('Partner')).toBeTruthy();
    expect(screen.getByText(/Friend · roommates/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Riley, friend' }));
    expect(onPick).toHaveBeenCalledWith('b');
  });
  it('says what each pick means: starting over puts a house away, continuing goes back to it', () => {
    const { unmount } = render(<CompanionPicker companions={companions} currentId="a" mode="new" days={{ a: 4 }} onPick={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/Day 4 · a new house puts it away/)).toBeTruthy();
    expect(screen.getByText('New house')).toBeTruthy();
    unmount();
    render(<CompanionPicker companions={companions} currentId="a" mode="continue" days={{ a: 4 }} onPick={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Whose house?')).toBeTruthy();
    expect(screen.getByText('Day 4')).toBeTruthy();
    expect(screen.getByText(/No house yet/)).toBeTruthy();
  });
  it('lets you back out', () => {
    const onCancel = vi.fn();
    render(<CompanionPicker companions={companions} currentId="a" mode="continue" days={{}} onPick={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
