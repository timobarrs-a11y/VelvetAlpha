import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCelebrate } from '../ui/celebrate';
import type { Game } from '../kernel/game';

describe('the celebration pop-up', () => {
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });
  const make = () => {
    const stage = document.createElement('div');
    document.body.appendChild(stage);
    const view = { paused: false };
    return { stage, view, celebrate: createCelebrate({ stage, view } as unknown as Game).celebrate! };
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

  it('with two buttons, pauses the house while open; Apply it now and Not now each do their own thing', () => {
    vi.useFakeTimers();
    const { stage, view, celebrate } = make();
    const chose: string[] = [];
    celebrate({ kicker: 'You unlocked', title: 'Nana', detail: '10 pieces, free.', button: 'Apply it now', onButton: () => chose.push('apply'), secondary: 'Not now', onSecondary: () => chose.push('later') });
    celebrate({ kicker: 'You unlocked', title: 'Cuddle Clouds', button: 'Apply it now', onButton: () => chose.push('apply2'), secondary: 'Not now', onSecondary: () => chose.push('later2') });
    expect(view.paused).toBe(true);
    expect(stage.querySelector('.vh-celebrate-detail')!.textContent).toBe('10 pieces, free.');
    const buttons = () => [...stage.querySelectorAll<HTMLButtonElement>('.vh-celebrate-btn')];
    expect(buttons().map((b) => b.textContent)).toEqual(['Apply it now', 'Not now']);
    buttons()[1].click();
    expect(chose).toEqual(['later']);
    vi.advanceTimersByTime(300);
    // Escape on the next one is Not now too.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(chose).toEqual(['later', 'later2']);
    vi.advanceTimersByTime(300);
    expect(view.paused).toBe(false);
  });
});
