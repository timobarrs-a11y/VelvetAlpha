import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../shared/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
}));

import { AvatarCreatorV2 } from '../AvatarCreatorV2';
import { PERSONAS } from '../../data/avatarItems';
import type { AvatarConfigV2 } from '../../types/avatar-v2';

const MEMBER = { member: true, earned: [], owned: [] };
const STARTER = { member: false, earned: [], owned: [] };

function setup(unlocks = MEMBER) {
  const changes: AvatarConfigV2[] = [];
  render(<AvatarCreatorV2 unlocks={unlocks} onChange={(c) => changes.push(c)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Wardrobe' }));
  return { last: () => changes[changes.length - 1], wearing: () => screen.getByTestId('wearing').textContent ?? '' };
}

describe('Avatar creator wardrobe', () => {
  it('offers every persona, and applies the whole look in one tap', () => {
    const { last, wearing } = setup();
    for (const p of PERSONAS) expect(screen.getByTitle(p.description), p.id).toBeTruthy();
    fireEvent.click(screen.getByTitle('Uniform, badge and cap'));
    expect(last()).toMatchObject({ outfit: 'cop', bottom: 'cop_pants', headwear: 'cop_cap' });
    expect(wearing()).toContain('Cop');
    expect(wearing()).toContain('Police shirt · Uniform trousers · Police cap');
  });

  it('lets the shirt, pants and hat be chosen separately, and calls it a custom mix', () => {
    const { last, wearing } = setup();
    fireEvent.click(screen.getByTitle('Whites and a proper toque'));
    expect(wearing()).toContain('Chef');
    fireEvent.click(screen.getByRole('button', { name: 'Leather pants' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hair bow' }));
    expect(last()).toMatchObject({ outfit: 'chef', bottom: 'leather', headwear: 'hair_bow' });
    expect(wearing()).toContain('Custom mix');
    expect(wearing()).toContain('Chef whites · Leather pants · Hair bow');
  });

  it('keeps picked pants when the shirt changes, and follows the shirt after Match shirt', () => {
    const { last } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Baggy jeans' }));
    fireEvent.click(screen.getByRole('button', { name: 'Scrubs' }));
    expect(last()).toMatchObject({ outfit: 'scrubs', bottom: 'baggy' });
    fireEvent.click(screen.getByRole('button', { name: 'Match shirt' }));
    expect(last().bottom).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Police shirt' }));
    expect(last().outfit).toBe('cop');
    expect(last().bottom).toBeUndefined();
  });

  it('recolours pants without losing which pants they are', () => {
    const { last } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Police shirt' }));
    fireEvent.click(screen.getAllByTitle('Red').at(-1)!);
    expect(last().bottom).toBe('cop_pants');
  });

  it('shows locked pieces as locked for someone without a plan', () => {
    setup(STARTER);
    for (const name of ['Leather pants', 'Breeches', 'Baggy jeans', 'Snapback cap', 'Rockstar jacket']) {
      expect((screen.getByRole('button', { name: new RegExp(name) }) as HTMLButtonElement).disabled, name).toBe(true);
    }
    expect((screen.getByRole('button', { name: 'Jeans' }) as HTMLButtonElement).disabled).toBe(false);
    // Every locked piece says what unlocks it, personas included.
    expect(screen.getAllByTitle(/Unlocks with: Members/).length).toBeGreaterThan(8);
    expect(screen.getAllByRole('button').filter((b) => /Rockstar/.test(b.textContent ?? '') && /Studded leather/.test(b.textContent ?? ''))[0]).toHaveProperty('disabled', true);
    expect(screen.getByTitle('Team top, pleated skirt, hair bow')).toHaveProperty('disabled', false);
  });
});
