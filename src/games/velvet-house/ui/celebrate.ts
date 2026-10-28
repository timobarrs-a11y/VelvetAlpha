import type { Game } from '../kernel/game';

export interface CelebrateOptions {
  /** The line above the name: "Congrats, you just unlocked". */
  kicker: string;
  /** The name of what they got: "Cloud Nine". */
  title: string;
  /** A picture to show (a data URL), if there is one. */
  image?: string;
  /** The line under the picture. */
  tagline?: string;
  /** The button's words. */
  button?: string;
  /** What the button does, besides closing the pop-up. */
  onButton?: () => void;
  /** A second, quieter button ("Not now"), and what it does besides closing. Escape and a tap outside choose it. */
  secondary?: string;
  onSecondary?: () => void;
  /** More words under the title (what the pack holds). */
  detail?: string;
}

const CONFETTI = ['#F27C8D', '#F6B26B', '#F6E06B', '#8FD3A0', '#7FB7E8', '#C9A8F0'];

/**
 * A pop-up over the game for a moment worth stopping for, such as redeeming a code: what they got, a picture of it,
 * and a button to carry on (or two: "Apply it now" and "Not now"). More than one waits its turn. The game is paused
 * while it is open; the pop-up itself changes nothing in the house, its buttons' callbacks do.
 */
export function createCelebrate(g: Game): Partial<Game> {
  const stage = g.stage as HTMLElement;
  const queue: CelebrateOptions[] = [];
  let open: HTMLElement | null = null;

  function show(): void {
    if (open || !queue.length) return;
    const o = queue.shift()!;
    const root = document.createElement('div');
    root.className = 'vh-celebrate';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', `${o.kicker} ${o.title}`);

    const card = document.createElement('div');
    card.className = 'vh-celebrate-card';
    const confetti = document.createElement('div');
    confetti.className = 'vh-celebrate-confetti';
    confetti.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 18; i++) {
      const bit = document.createElement('i');
      bit.style.setProperty('--x', `${(i * 37) % 100}%`);
      bit.style.setProperty('--d', `${(i % 6) * 0.18}s`);
      bit.style.setProperty('--c', CONFETTI[i % CONFETTI.length]);
      confetti.appendChild(bit);
    }
    const kicker = Object.assign(document.createElement('p'), { className: 'vh-celebrate-kicker', textContent: o.kicker });
    const title = Object.assign(document.createElement('h2'), { className: 'vh-celebrate-title', textContent: o.title });
    card.append(confetti, kicker, title);
    if (o.detail) card.appendChild(Object.assign(document.createElement('p'), { className: 'vh-celebrate-detail', textContent: o.detail }));
    if (o.image) {
      const pic = document.createElement('img');
      pic.className = 'vh-celebrate-pic';
      pic.alt = `${o.title}, in your house`;
      pic.src = o.image;
      card.appendChild(pic);
    }
    if (o.tagline) card.appendChild(Object.assign(document.createElement('p'), { className: 'vh-celebrate-tag', textContent: o.tagline }));
    const button = Object.assign(document.createElement('button'), { className: 'vh-celebrate-btn', type: 'button', textContent: o.button ?? 'Take a look' });
    const second = o.secondary
      ? Object.assign(document.createElement('button'), { className: 'vh-celebrate-btn vh-celebrate-btn2', type: 'button', textContent: o.secondary })
      : null;
    const row = document.createElement('div');
    row.className = 'vh-celebrate-actions';
    row.append(button, ...(second ? [second] : []));
    card.appendChild(row);
    root.appendChild(card);

    // The house holds still while the pop-up is up.
    const wasPaused = g.view.paused;
    g.view.paused = true;
    let done = false;
    const close = (then?: () => void): void => {
      if (done) return;
      done = true;
      root.classList.add('vh-celebrate-out');
      document.removeEventListener('keydown', onKey, true);
      g.view.paused = wasPaused;
      then?.();
      setTimeout(() => { root.remove(); open = null; show(); }, 180);
    };
    const primary = (): void => close(o.onButton);
    const dismiss = (): void => close(second ? o.onSecondary : o.onButton);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); (document.activeElement === second ? dismiss : primary)(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dismiss(); }
    };
    button.addEventListener('click', primary);
    second?.addEventListener('click', dismiss);
    root.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === root) dismiss(); });
    document.addEventListener('keydown', onKey, true);
    stage.appendChild(root);
    open = root;
    button.focus();
  }

  return { celebrate(options) { queue.push(options); show(); } };
}
