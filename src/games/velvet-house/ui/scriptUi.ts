import type { UiTarget } from '../script/types';

/**
 * What a script puts on screen: letterbox bars, the speaker's line (tap to go on), choices, a card, a Skip button.
 * Plain DOM, added to the game stage; the engine talks to it through the script host.
 */
export interface ScriptUi {
  setMode(mode: 'cutscene' | 'guided' | 'beat' | null, skippable: boolean): void;
  say(name: string, text: string): void;
  sayDone(): boolean;
  hideSay(): void;
  choose(labels: string[]): void;
  choiceMade(): number | null;
  card(title: string, body: string, button?: string): void;
  cardDone(): boolean;
  hideCard(): void;
  onSkip(fn: () => void): void;
  onCardButton(fn: () => void): void;
  /** Marks the buttons and panels a script has pointed at. */
  spotlight(targets: UiTarget[]): void;
}

const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function createScriptUi(stage: Element): ScriptUi {
  const root = document.createElement('div');
  root.className = 'vh-script';
  root.innerHTML = `
    <div class="vh-bar vh-bar-top"></div><div class="vh-bar vh-bar-bottom"></div>
    <button type="button" class="vh-skip" hidden>Skip</button>
    <div class="vh-speech" hidden role="dialog" aria-live="polite"><div class="vh-speech-name"></div><div class="vh-speech-text"></div><div class="vh-speech-next" aria-hidden="true">&#9660;</div></div>
    <div class="vh-choices" hidden></div>
    <div class="vh-scard" hidden><strong></strong><p></p><button type="button" hidden></button></div>`;
  stage.appendChild(root);
  const speech = root.querySelector('.vh-speech') as HTMLElement;
  const nameEl = root.querySelector('.vh-speech-name') as HTMLElement;
  const textEl = root.querySelector('.vh-speech-text') as HTMLElement;
  const choices = root.querySelector('.vh-choices') as HTMLElement;
  const cardEl = root.querySelector('.vh-scard') as HTMLElement;
  const cardBtn = cardEl.querySelector('button') as HTMLButtonElement;
  const skipBtn = root.querySelector('.vh-skip') as HTMLButtonElement;

  // A line is typed out; a tap finishes it, and the next tap goes on.
  let full = '', shown = 0, typing: ReturnType<typeof setInterval> | null = null, lineDone = true;
  const stopTyping = () => { if (typing) { clearInterval(typing); typing = null; } };
  speech.addEventListener('click', () => {
    if (typing) { stopTyping(); textEl.textContent = full; shown = full.length; return; }
    lineDone = true;
    speech.hidden = true;
  });

  let pick: number | null = null;
  let cardClosed = true;
  let cardPress: () => void = () => {};
  cardBtn.addEventListener('click', () => { cardClosed = true; cardEl.hidden = true; cardPress(); });
  let skip: () => void = () => {};
  skipBtn.addEventListener('click', () => skip());

  const stageEl = stage as HTMLElement;
  let marked: Element[] = [];

  return {
    setMode(mode, skippable) {
      if (mode) stageEl.dataset.script = mode; else delete stageEl.dataset.script;
      skipBtn.hidden = !(skippable && (mode === 'cutscene' || mode === 'guided'));
      if (!mode) { speech.hidden = true; choices.hidden = true; cardEl.hidden = true; stopTyping(); lineDone = true; }
    },
    say(name, text) {
      nameEl.textContent = name;
      full = text; shown = 0; lineDone = false;
      textEl.textContent = '';
      speech.hidden = false;
      stopTyping();
      typing = setInterval(() => {
        shown = Math.min(full.length, shown + 2);
        textEl.textContent = full.slice(0, shown);
        if (shown >= full.length) stopTyping();
      }, 28);
    },
    sayDone: () => lineDone,
    hideSay() { speech.hidden = true; lineDone = true; stopTyping(); },
    choose(labels) {
      pick = null;
      choices.innerHTML = labels.map((l, i) => `<button type="button" data-pick="${i}">${esc(l)}</button>`).join('');
      choices.hidden = false;
      choices.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { pick = Number(b.dataset.pick); choices.hidden = true; }));
    },
    choiceMade: () => pick,
    card(title, body, button) {
      (cardEl.querySelector('strong') as HTMLElement).textContent = title;
      (cardEl.querySelector('p') as HTMLElement).textContent = body;
      cardBtn.hidden = !button;
      cardBtn.textContent = button ?? '';
      cardClosed = !button;
      cardEl.hidden = false;
    },
    cardDone: () => cardClosed,
    hideCard() { cardEl.hidden = true; cardClosed = true; },
    onSkip(fn) { skip = fn; },
    onCardButton(fn) { cardPress = fn; },
    spotlight(targets) {
      marked.forEach((e) => e.classList.remove('vh-spot'));
      marked = [];
      for (const t of targets) {
        const sel = t.startsWith('tab:') ? `.vh-dock [data-open="${t.slice(4)}"]` : t === 'floorbar' ? '.vh-floors' : t === 'camera' ? '[data-act=rotate]'
          : t === 'wallet' ? '[data-el=money]' : t === 'bill' ? '[data-el=fridge]' : t === 'needs' ? '.vh-dock [data-people]' : '';
        if (!sel) continue;
        stageEl.querySelectorAll(sel).forEach((e) => { e.classList.add('vh-spot'); marked.push(e); });
      }
    },
  };
}
