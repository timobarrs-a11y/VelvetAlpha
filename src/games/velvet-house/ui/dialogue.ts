/**
 * Dialogue box — Pokémon-style chat with the companion.
 * Shows text with a typewriter effect, tap-to-advance.
 */
import { headFrameFor, type HeadImages } from '../state/headSprites';
export interface DialogueCallbacks {
  onSend: (text: string) => void;
  onClose: () => void;
}

export function createDialogue(cb: DialogueCallbacks): {
  el: HTMLElement;
  open: () => void;
  close: () => void;
  showAI: (text: string, streaming?: boolean) => void;
  // `keepText` leaves the last reply on screen above the box, so it can be read while you answer.
  showInput: (keepText?: boolean) => void;
  busy: (b: boolean) => void;
  setPortraitLook: (l: { skin: string; hair: string; longHair: boolean } | null) => void;
  setPortraitTalking: (v: boolean) => void;
  setPortraitImages: (imgs: HeadImages | null) => void;
} {
  const el = document.createElement('div');
  el.className = 'vh-dialogue';
  el.hidden = true;
  el.innerHTML = `
    <div class="vh-dialogue-box">
      <button type="button" class="vh-dialogue-close" aria-label="Close chat">&times;</button>
      <canvas class="vh-dialogue-portrait" width="64" height="64" aria-hidden="true"></canvas>
      <div class="vh-dialogue-name"></div>
      <div class="vh-dialogue-text"></div>
      <div class="vh-dialogue-input" style="display:none">
        <input type="text" placeholder="Say something..." maxlength="500" />
        <button data-send>Send</button>
      </div>
      <div class="vh-dialogue-hint"></div>
    </div>`;

  let typing = false;
  let typeTimer: ReturnType<typeof setTimeout> | null = null;

  // Animated portrait: blinks on a timer, mouth moves while the reply streams
  const portrait = el.querySelector('.vh-dialogue-portrait') as HTMLCanvasElement;
  const pctx = portrait.getContext('2d')!;
  let look: { skin: string; hair: string; longHair: boolean } | null = null;
  let talking = false, blinkT = Math.random() * 3;
  function setPortraitLook(l: { skin: string; hair: string; longHair: boolean } | null): void { look = l; }
  function setPortraitTalking(v: boolean): void { talking = Boolean(v); }
  // The companion's real avatar head, when the host sent one.
  let images: HeadImages | null = null;
  function setPortraitImages(imgs: HeadImages | null): void { images = imgs; }
  let last = performance.now();
  function frame(ts: number): void {
    const dt = Math.min(0.1, (ts - last) / 1000); last = ts;
    if (!el.hidden) {
      blinkT = (blinkT + dt) % 3.5;
      const blink = blinkT > 3.3;
      pctx.clearRect(0, 0, 64, 64);
      if (images?.neutral) {
        const frame = headFrameFor({ front: true, talking, t: ts / 1000, seed: 0.3, blink, mood: 0.5 }, images);
        pctx.drawImage((images[frame] || images.neutral)!, 0, -1, 64, 66.5);
      } else if (look) {
        if (look.longHair) { pctx.fillStyle = look.hair; pctx.beginPath(); pctx.ellipse(32, 32, 22, 23, 0, 0, Math.PI * 2); pctx.fill(); }
        pctx.fillStyle = look.skin; pctx.beginPath(); pctx.arc(32, 35, 17, 0, Math.PI * 2); pctx.fill();
        pctx.fillStyle = look.hair; pctx.beginPath(); pctx.ellipse(32, 21, 18, 9, 0, 0, Math.PI * 2); pctx.fill();
        pctx.fillStyle = '#241B25';
        [-1, 1].forEach(s => pctx.fillRect(32 + s * 6 - 1.5, blink ? 30 : 28, 3, blink ? 1.5 : 5));
        const mh = talking ? 1.5 + Math.abs(Math.sin(ts / 90)) * 3.5 : 1.5;
        pctx.fillStyle = '#8C4A42';
        pctx.beginPath(); pctx.ellipse(32, 47, 4.5, mh, 0, 0, Math.PI * 2); pctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function open(): void {
    el.hidden = false;
    showInput();
  }

  function close(): void {
    el.hidden = true;
    if (typeTimer) clearTimeout(typeTimer);
    typing = false;
    cb.onClose();
  }

  function typeText(text: string): void {
    const textEl = el.querySelector('.vh-dialogue-text') as HTMLElement;
    textEl.textContent = '';
    typing = true;
    let i = 0;
    const speed = 20;
    function next(): void {
      if (i < text.length && typing) {
        textEl.textContent += text[i];
        i++;
        typeTimer = setTimeout(next, speed);
      } else {
        typing = false;
        const hint = el.querySelector('.vh-dialogue-hint') as HTMLElement;
        hint.textContent = '\u25BC';
      }
    }
    next();
  }

  function showAI(text: string, streaming = false): void {
    const input = el.querySelector('.vh-dialogue-input') as HTMLElement;
    input.style.display = 'none';
    if (streaming) {
      const textEl = el.querySelector('.vh-dialogue-text') as HTMLElement;
      textEl.textContent = text;
      typing = false;
    } else {
      typeText(text);
    }
  }

  function showInput(keepText = false): void {
    if (typing) {
      // skip typewriter
      typing = false;
      if (typeTimer) clearTimeout(typeTimer);
    }
    const input = el.querySelector('.vh-dialogue-input') as HTMLElement;
    input.style.display = 'flex';
    const textEl = el.querySelector('.vh-dialogue-text') as HTMLElement;
    if (!keepText) textEl.textContent = '';
    const hint = el.querySelector('.vh-dialogue-hint') as HTMLElement;
    hint.textContent = '';
    const inp = el.querySelector('input') as HTMLInputElement;
    inp.value = '';
    inp.focus();
  }

  function busy(b: boolean): void {
    const btn = el.querySelector('[data-send]') as HTMLButtonElement;
    btn.disabled = b;
    btn.textContent = b ? '...' : 'Send';
  }

  const sendBtn = el.querySelector('[data-send]')!;
  const input = el.querySelector('input')!;

  function doSend(): void {
    const text = (input as HTMLInputElement).value.trim();
    if (!text) return;
    cb.onSend(text);
  }

  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });

  el.querySelector('.vh-dialogue-close')!.addEventListener('click', (e) => { e.stopPropagation(); close(); });

  el.addEventListener('click', (e) => {
    if (typing) { typing = false; if (typeTimer) clearTimeout(typeTimer); return; }
    if (e.target === el) close();
  });

  return { el, open, close, showAI, showInput, busy, setPortraitLook, setPortraitTalking, setPortraitImages };
}

/**
 * Interaction tray — radial/contextual menu for object interactions.
 */
export interface TrayAction {
  act: string;
  label: string;
  icon?: string;
}

export function createTray(): {
  el: HTMLElement;
  show: (actions: TrayAction[], x: number, y: number, onPick: (a: TrayAction) => void) => void;
  hide: () => void;
} {
  const el = document.createElement('div');
  el.className = 'vh-tray';
  el.hidden = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // The tap that opened the tray is still on its way up to the document; it must not count as a tap outside.
  let armed = true;

  function hide(): void {
    el.hidden = true;
    el.innerHTML = '';
    if (timer) clearTimeout(timer);
  }

  // The hover handlers are attached once, not per show: each show used to stack two more listeners on the tray.
  const pause = (): void => { if (timer) clearTimeout(timer); };
  const resume = (): void => { timer = setTimeout(hide, 6000); };
  el.addEventListener('mouseenter', pause);
  el.addEventListener('mouseleave', resume);

  function show(actions: TrayAction[], x: number, y: number, onPick: (a: TrayAction) => void): void {
    hide();
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = actions.map(a =>
      `<button data-act="${a.act}">${a.icon ?? ''} ${a.label}</button>`
    ).join('');
    el.hidden = false;
    armed = false;
    setTimeout(() => { armed = true; }, 0);
    el.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.act!;
        const action = actions.find(a => a.act === act);
        if (action) onPick(action);
        hide();
      });
    });
    timer = setTimeout(hide, 6000);
  }

  function handleOutsideClick(e: MouseEvent): void {
    if (armed && !el.hidden && e.target instanceof Node && !el.contains(e.target)) hide();
  }
  document.addEventListener('click', handleOutsideClick);

  return { el, show, hide };
}

/**
 * Discovery card — overlay for story events and milestones.
 */
export function showDiscoveryCard(title: string, body: string, onClose?: () => void): void {
  const card = document.createElement('div');
  card.className = 'vh-dcard';
  card.innerHTML = `
    <div class="vh-dcard-inner">
      <div class="vh-dcard-eyebrow">New discovery</div>
      <h3>${title}</h3>
      <p>${body}</p>
      <button>OK</button>
    </div>`;
  card.querySelector('button')!.addEventListener('click', () => {
    card.remove();
    onClose?.();
  });
  document.body.appendChild(card);
}

/**
 * Town sign — small label shown in the corner.
 */
export function createTownSign(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'vh-town-sign';
  return el;
}
