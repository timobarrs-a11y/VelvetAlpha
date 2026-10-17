/**
 * Dialogue box — Pokémon-style chat with the companion.
 * Shows text with a typewriter effect, tap-to-advance.
 */
export interface DialogueCallbacks {
  onSend: (text: string) => void;
  onClose: () => void;
}

export function createDialogue(cb: DialogueCallbacks): {
  el: HTMLElement;
  open: () => void;
  close: () => void;
  showAI: (text: string, streaming?: boolean) => void;
  showInput: () => void;
  busy: (b: boolean) => void;
} {
  const el = document.createElement('div');
  el.className = 'vh-dialogue';
  el.hidden = true;
  el.innerHTML = `
    <div class="vh-dialogue-box">
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

  function showInput(): void {
    if (typing) {
      // skip typewriter
      typing = false;
      if (typeTimer) clearTimeout(typeTimer);
    }
    const input = el.querySelector('.vh-dialogue-input') as HTMLElement;
    input.style.display = 'flex';
    const textEl = el.querySelector('.vh-dialogue-text') as HTMLElement;
    textEl.textContent = '';
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

  el.addEventListener('click', (e) => {
    if (typing) { typing = false; if (typeTimer) clearTimeout(typeTimer); return; }
    if (e.target === el) close();
  });

  return { el, open, close, showAI, showInput, busy };
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

  function hide(): void {
    el.hidden = true;
    el.innerHTML = '';
    if (timer) clearTimeout(timer);
  }

  function show(actions: TrayAction[], x: number, y: number, onPick: (a: TrayAction) => void): void {
    hide();
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = actions.map(a =>
      `<button data-act="${a.act}">${a.icon ?? ''} ${a.label}</button>`
    ).join('');
    el.hidden = false;
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
    el.addEventListener('mouseenter', () => { if (timer) clearTimeout(timer); });
    el.addEventListener('mouseleave', () => { timer = setTimeout(hide, 6000); });
  }

  function handleOutsideClick(e: MouseEvent): void {
    if (!el.hidden && e.target instanceof Node && !el.contains(e.target)) hide();
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
