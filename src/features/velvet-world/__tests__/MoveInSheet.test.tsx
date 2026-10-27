import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../services/worldService', () => ({
  claimPlot: vi.fn(), saveHouse: vi.fn(), getUnlocks: vi.fn(async () => ({ is_member: false, earned: [] })),
}));
vi.mock('../HousePicker', () => ({ HousePicker: () => <p>houses</p> }));
vi.mock('../houseTiles', () => ({ drawHouseTile: vi.fn(), tilePlot: vi.fn() }));

import { MoveInPanel } from '../MoveInSheet';

const tokens = (el: Element) => el.className.toString().split(/\s+/);

// Picking a wall or roof color happens well below the house; on a phone the house has to stay on screen.
describe('MoveInPanel', () => {
  it('pins the house to the top while the picker and colors scroll under it', () => {
    const { container } = render(<MoveInPanel onMoved={() => {}} />);
    const strip = container.querySelector('[data-pinned-preview]')!;
    expect(strip).not.toBeNull();
    expect(strip.querySelector('canvas[aria-label="Your house"]')).not.toBeNull();
    // the colors are outside the strip, below it, in the same page scroll
    expect(strip.contains(screen.getByText('Walls'))).toBe(false);
    for (let n: Element | null = strip.parentElement; n; n = n.parentElement) {
      expect(tokens(n)).not.toContain('overflow-y-auto');
      expect(tokens(n)).not.toContain('overflow-hidden');
    }
  });

  it('keeps the house a sensible size on a phone, so it does not eat the screen', () => {
    const { container } = render(<MoveInPanel compact onMoved={() => {}} />);
    const box = container.querySelector('canvas')!.parentElement!;
    expect(tokens(box)).toContain('h-[140px]');
    expect(tokens(box)).toContain('sm:h-[190px]');
  });
});
