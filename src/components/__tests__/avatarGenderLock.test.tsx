import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../hooks/useAvatarUnlocks', () => ({ useAvatarUnlocks: () => ({ member: false, earned: [], owned: [] }) }));
vi.mock('../../hooks/useAvatarFavorites', () => ({
  useAvatarFavorites: () => ({ favorites: [], maxSlots: 3, addFavorite: vi.fn(), removeFavorite: vi.fn(), applyFavorite: vi.fn() }),
}));
vi.mock('../../services/avatarAnalytics', () => ({ trackApplyPreset: vi.fn(), trackRandomize: vi.fn() }));

import { AvatarCreatorV2, coherentRandomize } from '../AvatarCreatorV2';
import { migrateAvatarConfig } from '../../utils/avatarConfig';

const unlocks = { member: false, earned: [], owned: [] };

describe('coherentRandomize', () => {
  it('keeps the gender it is given, every time', () => {
    for (let i = 0; i < 100; i++) {
      expect(coherentRandomize('male').gender).toBe('male');
      expect(coherentRandomize('female').gender).toBe('female');
    }
  });
});

describe('the avatar creator\'s shuffle', () => {
  it('never changes the gender it is on', () => {
    const seen: string[] = [];
    render(<AvatarCreatorV2 favoritesNamespace="t" unlocks={unlocks} initialConfig={migrateAvatarConfig({ gender: 'male' })} onChange={c => seen.push(c.gender)} />);
    for (let i = 0; i < 30; i++) fireEvent.click(screen.getAllByTitle('Randomize')[0]);
    expect(seen).toHaveLength(30);
    expect(new Set(seen)).toEqual(new Set(['male']));
  });
});

describe('lockGender', () => {
  it('hides the Male / Female choice, and a preset can\'t change the gender', () => {
    const seen: string[] = [];
    const { rerender } = render(<AvatarCreatorV2 favoritesNamespace="t" unlocks={unlocks} initialConfig={migrateAvatarConfig({ gender: 'female' })} lockGender onChange={c => seen.push(c.gender)} />);
    expect(screen.queryByRole('button', { name: 'Male' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Female' })).toBeNull();
    fireEvent.click(screen.getAllByTitle('Randomize')[0]);
    expect(seen.every(g => g === 'female')).toBe(true);
    rerender(<AvatarCreatorV2 favoritesNamespace="t" unlocks={unlocks} initialConfig={migrateAvatarConfig({ gender: 'female' })} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Male' })).toBeTruthy();
  });
});
