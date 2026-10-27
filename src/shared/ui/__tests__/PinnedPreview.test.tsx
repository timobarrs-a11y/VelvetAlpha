import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PinnedPreview } from '../PinnedPreview';

const tokens = (el: Element) => el.className.toString().split(/\s+/);

describe('PinnedPreview', () => {
  it('pins the preview, its controls and its tabs to the top while the options scroll', () => {
    const { container } = render(
      <PinnedPreview preview={<p>the thing</p>} controls={<button>shuffle</button>} tabs={<nav>tabs</nav>}>
        <p>options</p>
      </PinnedPreview>,
    );
    const strip = container.querySelector('[data-pinned-preview]')!;
    expect(tokens(strip)).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-20']));
    for (const text of ['the thing', 'shuffle', 'tabs']) expect(strip.contains(screen.getByText(text))).toBe(true);
    expect(strip.contains(screen.getByText('options'))).toBe(false);
  });

  it('adds no scroller of its own: a scroller would stop it sticking and swallow swipes', () => {
    const { container } = render(<PinnedPreview preview={<p>x</p>}><p>y</p></PinnedPreview>);
    for (const el of container.querySelectorAll('*')) {
      expect(tokens(el)).not.toContain('overflow-y-auto');
      expect(tokens(el)).not.toContain('overflow-hidden');
      expect(tokens(el)).not.toContain('overscroll-contain');
    }
  });
});
