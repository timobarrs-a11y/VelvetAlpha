import type { UiTarget } from '../script/types';

/**
 * What a script puts on screen: letterbox bars, the speaker's line (tap to go on), choices, a card. Nothing skips a scene.
 * Plain DOM, added to the game stage; the engine talks to it through the script host.
 */
export interface ScriptUi {
  setMode(mode: 'cutscene' | 'guided' | 'beat' | null): void;
  say(name: string, text: string): void;
  sayDone(): boolean;
  hideSay(): void;
  choose(labels: string[]): void;
  choiceMade(): number | null;
  card(title: string, body: string, button?: string): void;
  cardDone(): boolean;
  /** Folds the card down to its title bar (and its button, if it has one). */
  minimizeCard(): void;
  /** The button was pressed but the lesson is not done: the card stays in view until the world is right. */
  reopenCard(): void;
  hideCard(): void;
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
    <div class="vh-speech" hidden role="dialog" aria-live="polite"><div class="vh-speech-name"></div><div class="vh-speech-text"></div><div class="vh-choices" hidden></div><div class="vh-speech-next" aria-hidden="true">&#9660;</div></div>
    <div class="vh-scard" hidden><div class="vh-scard-head"><strong></strong><button type="button" class="vh-scard-min" aria-label="Minimize" aria-expanded="true">&#9662;</button></div><p></p><button type="button" class="vh-scard-go" hidden></button></div>`;
  stage.appendChild(root);
  const speech = root.querySelector('.vh-speech') as HTMLElement;
  const nameEl = root.querySelector('.vh-speech-name') as HTMLElement;
  const textEl = root.querySelector('.vh-speech-text') as HTMLElement;
  const choices = root.querySelector('.vh-choices') as HTMLElement;
  const cardEl = root.querySelector('.vh-scard') as HTMLElement;
  const cardBtn = cardEl.querySelector('.vh-scard-go') as HTMLButtonElement;
  const cardMin = cardEl.querySelector('.vh-scard-min') as HTMLButtonElement;
  const setMin = (min: boolean) => { if (min) cardEl.dataset.min = '1'; else delete cardEl.dataset.min; cardMin.setAttribute('aria-expanded', String(!min)); };
  cardMin.addEventListener('click', () => setMin(!cardEl.dataset.min));

  // A line is typed out; a tap finishes it, and the next tap goes on. `**words**` in a line are shown bold (the town's
  // name in green), typed out like the rest.
  type Seg = { text: string; bold: boolean };
  const segments = (text: string): Seg[] => text.split(/\*\*/).map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((p) => p.text);
  const renderShown = (segs: Seg[], n: number): void => {
    textEl.textContent = '';
    let left = n;
    for (const p of segs) {
      if (left <= 0) break;
      const part = p.text.slice(0, left); left -= part.length;
      if (p.bold) { const b = document.createElement('b'); b.textContent = part; textEl.appendChild(b); } else textEl.appendChild(document.createTextNode(part));
    }
  };
  let full = '', segs: Seg[] = [], total = 0, shown = 0, typing: ReturnType<typeof setInterval> | null = null, lineDone = true;
  const stopTyping = () => { if (typing) { clearInterval(typing); typing = null; } };
  speech.addEventListener('click', () => {
    // A this-or-that is answered with its buttons, not by tapping the box.
    if (!choices.hidden) return;
    if (typing) { stopTyping(); renderShown(segs, total); shown = total; return; }
    lineDone = true;
    speech.hidden = true;
  });

  void full;
  let pick: number | null = null;
  let cardClosed = true;
  let cardPress: () => void = () => {};
  cardBtn.addEventListener('click', () => { cardClosed = true; cardEl.hidden = true; cardPress(); });

  const stageEl = stage as HTMLElement;
  let marked: Element[] = [];

  return {
    setMode(mode) {
      if (mode) stageEl.dataset.script = mode; else delete stageEl.dataset.script;
      if (!mode) { speech.hidden = true; choices.hidden = true; choices.innerHTML = ''; delete speech.dataset.choosing; cardEl.hidden = true; stopTyping(); lineDone = true; }
    },
    say(name, text) {
      nameEl.textContent = name;
      full = text; segs = segments(text); total = segs.reduce((n, p) => n + p.text.length, 0); shown = 0; lineDone = false;
      textEl.textContent = '';
      speech.hidden = false;
      stopTyping();
      typing = setInterval(() => {
        shown = Math.min(total, shown + 2);
        renderShown(segs, shown);
        if (shown >= total) stopTyping();
      }, 28);
    },
    sayDone: () => lineDone,
    hideSay() { speech.hidden = true; lineDone = true; stopTyping(); },
    // The choices sit in the dialogue box, under the line that asked: the box comes back with that line and its buttons.
    choose(labels) {
      pick = null;
      stopTyping();
      renderShown(segs, total);
      shown = total;
      choices.innerHTML = labels.map((l, i) => `<button type="button" data-pick="${i}">${esc(l)}</button>`).join('');
      choices.hidden = false;
      speech.dataset.choosing = '1';
      speech.hidden = false;
      choices.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => {
        pick = Number(b.dataset.pick);
        choices.hidden = true; choices.innerHTML = '';
        delete speech.dataset.choosing;
        speech.hidden = true; lineDone = true;
      }));
    },
    choiceMade: () => pick,
    card(title, body, button) {
      (cardEl.querySelector('strong') as HTMLElement).textContent = title;
      (cardEl.querySelector('p') as HTMLElement).innerHTML = esc(body).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      cardBtn.hidden = !button;
      cardBtn.textContent = button ?? '';
      cardClosed = !button;
      setMin(false);
      cardEl.hidden = false;
    },
    cardDone: () => cardClosed,
    hideCard() { cardEl.hidden = true; cardClosed = true; },
    minimizeCard() { setMin(true); },
    // The button counts as pressed (the script moves on to its wait on the world); the card just stays in view.
    reopenCard() { cardEl.hidden = false; },
    onCardButton(fn) { cardPress = fn; },
    spotlight(targets) {
      marked.forEach((e) => e.classList.remove('vh-spot'));
      marked = [];
      for (const t of targets) {
        const sel = t.startsWith('tab:') ? `.vh-dock [data-open="${t.slice(4)}"]` : t === 'floorbar' ? '.vh-floors' : t === 'camera' ? '[data-act=rotate]'
          : t === 'wallet' ? '[data-el=money]' : t === 'bill' ? '.vh-vitals [data-vital=bills]' : t === 'needs' ? '.vh-dock [data-people]' : '';
        if (!sel) continue;
        stageEl.querySelectorAll(sel).forEach((e) => { e.classList.add('vh-spot'); marked.push(e); });
      }
    },
  };
}
