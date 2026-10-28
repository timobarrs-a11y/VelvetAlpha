import type { UiTarget } from '../script/types';

/**
 * What a script puts on screen: letterbox bars, the speaker's line (tap to go on), choices, a card. Nothing skips a scene.
 * Plain DOM, added to the game stage; the engine talks to it through the script host.
 *
 * A card is told, then left to the player, like a handheld RPG: it comes up over the game (nothing else can be tapped
 * while it is up), the player taps Got it, and it folds away into the objective bar at the top. The bar is only a
 * reminder: the whole game is theirs again, and tapping the bar brings the card back to read.
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
  /** Whether the card is up over the game, waiting for Got it. */
  cardOpen(): boolean;
  /** Folds the card into the objective bar, which reminds the player what it asked. */
  showObjective(): void;
  /** Takes the card and the objective bar away (the objective is done, or the scene moved on). */
  hideCard(): void;
  /** Called when the player taps Got it (or the card's own button). */
  onCardDismissed(fn: (ownButton: boolean) => void): void;
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
    <div class="vh-scard-veil" hidden></div>
    <div class="vh-scard" hidden role="dialog" aria-modal="true"><strong></strong><p></p><button type="button" class="vh-scard-go">Got it</button></div>
    <button type="button" class="vh-objective" hidden aria-label="Objective: tap to read it again"><span>Objective</span><strong></strong></button>`;
  stage.appendChild(root);
  const speech = root.querySelector('.vh-speech') as HTMLElement;
  const nameEl = root.querySelector('.vh-speech-name') as HTMLElement;
  const textEl = root.querySelector('.vh-speech-text') as HTMLElement;
  const choices = root.querySelector('.vh-choices') as HTMLElement;
  const cardEl = root.querySelector('.vh-scard') as HTMLElement;
  const veil = root.querySelector('.vh-scard-veil') as HTMLElement;
  const cardBtn = cardEl.querySelector('.vh-scard-go') as HTMLButtonElement;
  const objective = root.querySelector('.vh-objective') as HTMLButtonElement;
  const openCard = (open: boolean) => { cardEl.hidden = !open; veil.hidden = !open; };

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
  let hasButton = false;
  let dismissed: (ownButton: boolean) => void = () => {};
  // Got it: the card goes, and the game is the player's again. A card with its own button (Set it down) does that too.
  cardBtn.addEventListener('click', () => { openCard(false); if (hasButton) cardClosed = true; dismissed(hasButton); });
  // The objective bar brings the card back to read; Got it folds it away again.
  objective.addEventListener('click', () => { objective.hidden = true; openCard(true); });

  const stageEl = stage as HTMLElement;
  let marked: Element[] = [];

  return {
    setMode(mode) {
      if (mode) stageEl.dataset.script = mode; else delete stageEl.dataset.script;
      // The scene is over: its lines go. A card that only told something stays up until it is read (the host takes an
      // objective's card away once its objective is done).
      if (!mode) { speech.hidden = true; choices.hidden = true; choices.innerHTML = ''; delete speech.dataset.choosing; stopTyping(); lineDone = true; }
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
      cardBtn.textContent = button ?? 'Got it';
      hasButton = !!button;
      cardClosed = !button;
      (objective.querySelector('strong') as HTMLElement).textContent = title;
      objective.hidden = true;
      openCard(true);
    },
    cardDone: () => cardClosed,
    cardOpen: () => !cardEl.hidden,
    showObjective() { openCard(false); objective.hidden = false; },
    hideCard() { openCard(false); objective.hidden = true; cardClosed = true; },
    onCardDismissed(fn) { dismissed = fn; },
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
