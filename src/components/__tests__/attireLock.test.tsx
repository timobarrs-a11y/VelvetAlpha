import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/useAvatarUnlocks', () => ({ useAvatarUnlocks: () => ({ member: false, earned: [], owned: [] }) }));
vi.mock('../../hooks/useAvatarFavorites', () => ({
  useAvatarFavorites: () => ({ favorites: [], maxSlots: 3, addFavorite: vi.fn(), removeFavorite: vi.fn(), applyFavorite: vi.fn() }),
}));
vi.mock('../../services/avatarAnalytics', () => ({ trackApplyPreset: vi.fn(), trackRandomize: vi.fn() }));

import { AvatarCreatorV2 } from '../AvatarCreatorV2';
import { voiceAttire, attireUnlocks } from '../../config/voiceAttire';
import { DEFAULT_MALE_AVATAR_V2, type AvatarConfigV2 } from '../../types/avatar-v2';

const FREE = { member: false, earned: [], owned: [] };

// A person without a membership wears their companion's signature attire and cannot change it; a member can.
describe('a companion\'s signature attire', () => {
  const look = voiceAttire('bad_boy')!;
  const start = { ...DEFAULT_MALE_AVATAR_V2, ...look } as AvatarConfigV2;

  it('is shown instead of the wardrobe options for someone without a membership', () => {
    const changes: AvatarConfigV2[] = [];
    render(<AvatarCreatorV2 initialConfig={start} onChange={c => changes.push(c)} unlocks={attireUnlocks(FREE, 'bad_boy')}
      lockedAttire={{ label: 'Bad Boy', look }} favoritesNamespace="t" lockGender />);
    fireEvent.click(screen.getByText('Wardrobe'));
    expect(screen.getByTestId('attire-locked')).toBeTruthy();
    expect(screen.getByText(/Bad Boy's signature style/)).toBeTruthy();
    expect(screen.queryByText('Personas')).toBeNull();
    expect(screen.queryByText('Shirt')).toBeNull();
  });

  it('survives anything else that changes the look (a reset, a shuffle, a preset)', () => {
    const changes: AvatarConfigV2[] = [];
    render(<AvatarCreatorV2 initialConfig={start} onChange={c => changes.push(c)} unlocks={attireUnlocks(FREE, 'bad_boy')}
      lockedAttire={{ label: 'Bad Boy', look }} favoritesNamespace="t" lockGender />);
    const shuffle = screen.getAllByRole('button').find(b => /shuffle|randomi/i.test(`${b.getAttribute('title')} ${b.getAttribute('aria-label')} ${b.textContent}`));
    if (shuffle) fireEvent.click(shuffle);
    const reset = screen.getAllByRole('button').find(b => /reset/i.test(`${b.getAttribute('title')} ${b.getAttribute('aria-label')} ${b.textContent}`));
    if (reset) fireEvent.click(reset);
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      expect(c.outfit).toBe('rockstar');
      expect(c.bottom).toBe('leather');
    }
  });

  it('shows the full wardrobe to a member', () => {
    render(<AvatarCreatorV2 initialConfig={start} unlocks={{ member: true, earned: [], owned: [] }} favoritesNamespace="t" lockGender />);
    fireEvent.click(screen.getByText('Wardrobe'));
    expect(screen.queryByTestId('attire-locked')).toBeNull();
    expect(screen.getByText('Personas')).toBeTruthy();
  });
});
