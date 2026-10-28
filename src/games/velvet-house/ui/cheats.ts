import type { Game } from '../kernel/game';

/**
 * The cheat console (state/cheats.ts has the codes). It is hidden: on a keyboard press the backtick key; on a phone tap
 * the money chip five times quickly. Enter runs a code, Escape or a tap outside closes it.
 */
export function createCheatsUi(g: Game): void {
  const stage = g.stage as HTMLElement;
  const box = document.createElement('div');
  box.className = 'vh-cheat';
  box.hidden = true;
  box.innerHTML = `
    <form autocomplete="off">
      <input name="code" placeholder="cheat code (try: help)" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Cheat code" />
      <button type="submit">Go</button>
      <button type="button" class="vh-cheat-x" aria-label="Close">×</button>
    </form>
    <pre class="vh-cheat-out" aria-live="polite"></pre>`;
  stage.appendChild(box);
  const form = box.querySelector('form')!, input = box.querySelector('input')!, out = box.querySelector('.vh-cheat-out')!;

  const open = (): void => { box.hidden = false; input.focus(); };
  const close = (): void => { box.hidden = true; input.blur(); };
  const toggle = (): void => (box.hidden ? open() : close());

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const said = g.runCheat(input.value);
    out.textContent = said;
    input.value = '';
    input.focus();
  });
  box.querySelector('.vh-cheat-x')!.addEventListener('click', close);
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); });
  box.addEventListener('pointerdown', (e) => e.stopPropagation());

  window.addEventListener('keydown', (e) => {
    if (e.key !== '`' || e.ctrlKey || e.metaKey || e.altKey) return;
    // Typing a backtick in any other box (chat, a name) is just typing.
    if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) && e.target !== input) return;
    e.preventDefault();
    toggle();
  });

  // Five taps on the money chip within five seconds.
  const chip = g.el('money');
  let taps: number[] = [];
  chip.addEventListener('click', () => {
    const now = Date.now();
    taps = [...taps.filter((t) => now - t < 5000), now];
    if (taps.length >= 5) { taps = []; toggle(); }
  });
}
