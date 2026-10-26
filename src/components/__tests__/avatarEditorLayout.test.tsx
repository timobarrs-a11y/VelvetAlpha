import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

// The editors never touch the network here; the unlock, favourites and analytics modules are stubbed.
vi.mock('../../hooks/useAvatarUnlocks', () => ({ useAvatarUnlocks: () => ({ member: false, earned: [], owned: [] }) }));
vi.mock('../../hooks/useAvatarFavorites', () => ({
  useAvatarFavorites: () => ({ favorites: [], maxSlots: 3, addFavorite: vi.fn(), removeFavorite: vi.fn(), applyFavorite: vi.fn() }),
}));

vi.mock('../../services/avatarAnalytics', () => ({ trackApplyPreset: vi.fn(), trackRandomize: vi.fn() }));

import { AvatarCreatorV2 } from '../AvatarCreatorV2';
import { GuidedAvatarFlow } from '../GuidedAvatarFlow';
import { migrateAvatarConfig } from '../../utils/avatarConfig';

// Both editors sit in a fixed-height box (the "Edit appearance" modal). On a phone they stack
// a preview/tools block over the options. If the options list is its own scroller there, it gets
// only the few pixels the block leaves it, and people can't scroll down to the rest of the
// options. On phones the whole editor scrolls as one; only from `lg` up do the columns scroll
// separately. These checks pin that.
const tokens = (el: Element) => el.className.toString().split(/\s+/);
const optionsList = (root: ParentNode) => {
  const el = [...root.querySelectorAll('div')].find(d => tokens(d).includes('p-5') && tokens(d).includes('space-y-5'));
  if (!el) throw new Error('options list not found');
  return el;
};

describe.each([
  ['AvatarCreatorV2', () => <AvatarCreatorV2 favoritesNamespace="t" unlocks={{ member: false, earned: [], owned: [] }} />],
  ['GuidedAvatarFlow', () => <GuidedAvatarFlow config={migrateAvatarConfig({ gender: 'male' })} onChange={() => {}} onSwitchToAdvanced={() => {}} />],
])('%s on a phone', (_name, ui) => {
  it('scrolls as a whole, so every option can be reached', () => {
    const { container } = render(ui());
    const root = container.firstElementChild!;
    expect(tokens(root)).toContain('overflow-y-auto');
    // ...and hands scrolling back to the options column on wide screens.
    expect(tokens(root)).toContain('lg:overflow-visible');
  });

  it('never makes the options list a scroller of its own below the lg breakpoint', () => {
    const { container } = render(ui());
    const list = tokens(optionsList(container));
    expect(list).not.toContain('overflow-y-auto');
    expect(list).not.toContain('flex-1');
    expect(list).toContain('lg:overflow-y-auto');
    expect(list).toContain('lg:flex-1');
  });

  it('lets the options column take its natural height on a phone', () => {
    const { container } = render(ui());
    const column = optionsList(container).parentElement!;
    expect(tokens(column)).toContain('flex-none');
    expect(tokens(column)).not.toContain('flex-1');
    expect(tokens(column)).toContain('lg:flex-1');
  });
});

// Words must never be cut off on a phone. Four fixed columns squeeze each button to ~70px, which is
// narrower than "Downturned", and `truncate` replaces the end of a description with "...".
// Below the sm breakpoint option grids size by the width of a word; the fixed 3 and 4 columns
// only apply from sm up, and labels wrap instead of truncating.
describe('long words on a phone', () => {
  const allTokens = (root: ParentNode) => [...root.querySelectorAll('*')].flatMap(e => (e.getAttribute('class') ?? '').split(/\s+/));
  const check = (tokens: string[]) => {
    expect(tokens.filter(t => /^grid-cols-[34]$/.test(t)), 'bare 3 or 4 column grid').toEqual([]);
    expect(tokens.filter(t => t === 'truncate'), 'truncating label').toEqual([]);
  };

  it('AvatarCreatorV2: no tab uses a bare 3 or 4 column grid or truncates a label', () => {
    const { container } = render(<AvatarCreatorV2 favoritesNamespace="t" unlocks={{ member: false, earned: [], owned: [] }} />);
    let sawAutoFill = false;
    for (const name of ['Presets', 'Face', 'Hair', 'Body', 'Wardrobe', 'Accessories']) {
      const tab = [...container.querySelectorAll('button')].find(b => b.textContent?.replace('\u2726', '').trim() === name)!;
      fireEvent.click(tab);
      const tokens = allTokens(container);
      check(tokens);
      sawAutoFill ||= tokens.some(t => t.startsWith('grid-cols-[repeat(auto-fill'));
    }
    expect(sawAutoFill).toBe(true);
  });

  it('GuidedAvatarFlow: every step does the same', () => {
    const { container } = render(<GuidedAvatarFlow config={migrateAvatarConfig({ gender: 'male' })} onChange={() => {}} onSwitchToAdvanced={() => {}} />);
    for (let i = 0; i < 4; i++) {
      check(allTokens(container));
      const next = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Next');
      if (next) fireEvent.click(next);
    }
  });

  it('the tab row scrolls without a scrollbar and marks the open tab', () => {
    const { container } = render(<AvatarCreatorV2 favoritesNamespace="t" unlocks={{ member: false, earned: [], owned: [] }} />);
    expect(container.querySelector('.scrollbar-hide')).not.toBeNull();
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
  });
});
