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
const look = voiceAttire('bad_boy')!;
const button = (text: string) => screen.getByText(text).closest('button')!;

// A companion starts in the plain default outfit. Their voice's signature style is the one outfit a person without a
// membership can pick (it is a find on the Wardrobe tab); everything else is shown, locked. Members can wear anything.
describe('a companion\'s signature style on the Wardrobe tab', () => {
  it('starts in the default outfit, with the signature style on offer', () => {
    const changes: AvatarConfigV2[] = [];
    render(<AvatarCreatorV2 initialConfig={DEFAULT_MALE_AVATAR_V2} onChange={c => changes.push(c)} unlocks={attireUnlocks(FREE, 'bad_boy')}
      signatureStyle={{ label: 'Bad Boy', look, lockOthers: true }} favoritesNamespace="t" lockGender />);
    fireEvent.click(screen.getByText('Wardrobe'));
    expect(screen.getByText(/Bad Boy's signature style/)).toBeTruthy();
    expect(changes).toHaveLength(0);
  });

  it('picking it dresses them in the whole outfit, even its member-only pieces', () => {
    const changes: AvatarConfigV2[] = [];
    render(<AvatarCreatorV2 initialConfig={DEFAULT_MALE_AVATAR_V2} onChange={c => changes.push(c)} unlocks={attireUnlocks(FREE, 'bad_boy')}
      signatureStyle={{ label: 'Bad Boy', look, lockOthers: true }} favoritesNamespace="t" lockGender />);
    fireEvent.click(screen.getByText('Wardrobe'));
    fireEvent.click(screen.getByTestId('signature-style'));
    const last = changes[changes.length - 1];
    expect([last.outfit, last.bottom]).toEqual(['rockstar', 'leather']);
    expect(button('Rockstar jacket').disabled).toBe(false);
  });

  it('shows every other outfit, locked, without a membership', () => {
    render(<AvatarCreatorV2 initialConfig={DEFAULT_MALE_AVATAR_V2} unlocks={attireUnlocks(FREE, 'bad_boy')}
      signatureStyle={{ label: 'Bad Boy', look, lockOthers: true }} favoritesNamespace="t" lockGender />);
    fireEvent.click(screen.getByText('Wardrobe'));
    expect(button('Chef whites').disabled).toBe(true);
    expect(button('Suit & tie').disabled).toBe(true);
    expect(button('Cop').disabled).toBe(true); // a persona
    expect(button('Tee').disabled).toBe(false); // the plain default stays
  });

  it('locks nothing for a member', () => {
    render(<AvatarCreatorV2 initialConfig={DEFAULT_MALE_AVATAR_V2} unlocks={{ member: true, earned: [], owned: [] }}
      signatureStyle={{ label: 'Bad Boy', look, lockOthers: false }} favoritesNamespace="t" lockGender />);
    fireEvent.click(screen.getByText('Wardrobe'));
    expect(button('Chef whites').disabled).toBe(false);
    expect(button('Cop').disabled).toBe(false);
    expect(screen.getByTestId('signature-style')).toBeTruthy();
  });
});
