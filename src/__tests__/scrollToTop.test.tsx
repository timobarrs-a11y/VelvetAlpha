import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { ScrollToTop } from '../Router';

let go: (to: string | number) => void = () => {};
function Nav() { const n = useNavigate(); go = (to) => (typeof to === 'number' ? n(to) : n(to)); return null; }

describe('ScrollToTop', () => {
  beforeEach(() => { window.scrollTo = vi.fn(); });

  it('sends a new page to the top', () => {
    render(<MemoryRouter initialEntries={['/splash']}><ScrollToTop /><Nav /></MemoryRouter>);
    (window.scrollTo as ReturnType<typeof vi.fn>).mockClear();
    act(() => go('/signup'));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('leaves back and forward where they were, and links to a part of a page alone', () => {
    render(<MemoryRouter initialEntries={['/splash']}><ScrollToTop /><Nav /></MemoryRouter>);
    act(() => go('/signup'));
    (window.scrollTo as ReturnType<typeof vi.fn>).mockClear();
    act(() => go(-1));
    expect(window.scrollTo).not.toHaveBeenCalled();
    act(() => go('/splash#how'));
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
