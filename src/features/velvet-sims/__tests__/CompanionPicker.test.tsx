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
    render(<CompanionPicker companions={companions} currentId="a" onPick={onPick} onCancel={() => {}} />);
    expect(screen.getByText('Partner')).toBeTruthy();
    expect(screen.getByText(/Friend · roommates/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Riley, friend' }));
    expect(onPick).toHaveBeenCalledWith('b');
  });
  it('lets you back out', () => {
    const onCancel = vi.fn();
    render(<CompanionPicker companions={companions} currentId="a" onPick={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
