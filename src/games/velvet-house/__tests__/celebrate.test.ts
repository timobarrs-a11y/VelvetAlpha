import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCelebrate } from '../ui/celebrate';
import type { Game } from '../kernel/game';

describe('the celebration pop-up', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });
  const make = () => {
    const stage = document.createElement('div');
    document.body.appendChild(stage);
    return { stage, celebrate: createCelebrate({ stage } as unknown as Game).celebrate! };
  };

  it('shows what they got, a picture of it, and closes on the button', () => {
    vi.useFakeTimers();
    const { stage, celebrate } = make();
    celebrate({ kicker: 'Congrats, you just unlocked', title: 'Cloud Nine', tagline: 'Try it out today!', image: 'data:image/jpeg;base64,AAAA' });
    const root = stage.querySelector('.vh-celebrate')!;
    expect(root.textContent).toContain('Congrats, you just unlocked');
    expect(root.querySelector('h2')!.textContent).toBe('Cloud Nine');
    expect(root.textContent).toContain('Try it out today!');
    expect(root.querySelector('img')!.getAttribute('src')).toMatch(/^data:image/);
    (root.querySelector('button') as HTMLButtonElement).click();
    vi.advanceTimersByTime(300);
    expect(stage.querySelector('.vh-celebrate')).toBeNull();
  });

  it('never treats the text as markup, and waits its turn when there are two', () => {
    vi.useFakeTimers();
    const { stage, celebrate } = make();
    celebrate({ kicker: 'k', title: '<b>x</b>' });
    celebrate({ kicker: 'k', title: 'Second' });
    expect(stage.querySelectorAll('.vh-celebrate')).toHaveLength(1);
    expect(stage.querySelector('b')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    vi.advanceTimersByTime(300);
    expect(stage.querySelector('h2')!.textContent).toBe('Second');
  });
});
