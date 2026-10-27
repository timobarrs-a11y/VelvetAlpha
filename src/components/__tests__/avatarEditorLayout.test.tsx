import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

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
  // The popup gives the editor a box of fixed height, so there it scrolls inside the box.
  ['AvatarCreatorV2', () => <AvatarCreatorV2 contained favoritesNamespace="t" unlocks={{ member: false, earned: [], owned: [] }} />],
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

// On a page (the arrival, the avatar pages) the editor has no box of its own. If it were a scroller anyway,
// it could not scroll (it is as tall as its content) yet it would still swallow a finger's swipe, so only the
// strip beside it scrolled the page; and the avatar riding along at the top could not stick to the screen.
describe('AvatarCreatorV2 sitting in a page', () => {
  const root = () => render(<AvatarCreatorV2 favoritesNamespace="t" unlocks={{ member: false, earned: [], owned: [] }} />).container.firstElementChild!;

  it('is not a scroller, so the page scrolls wherever a finger lands', () => {
    const list = tokens(root());
    expect(list).not.toContain('overflow-y-auto');
    expect(list).not.toContain('overscroll-contain');
    expect(list).not.toContain('h-full');
  });

  it('keeps the avatar and the tabs stuck to the top of the screen while the options scroll', () => {
    const el = root();
    const sticky = [...el.querySelectorAll('div')].find(d => tokens(d).includes('sticky') && tokens(d).includes('top-0') && tokens(d).includes('z-20'));
    expect(sticky).toBeTruthy();
    expect(sticky!.querySelector('svg')).not.toBeNull();
    // and nothing between it and the page is a scroller that would stop it sticking
    for (let n: Element | null = sticky!.parentElement; n; n = n.parentElement) {
      expect(tokens(n)).not.toContain('overflow-y-auto');
    }
  });
});
