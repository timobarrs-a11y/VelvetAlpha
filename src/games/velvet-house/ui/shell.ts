import { LEVEL_NAMES, FLOOR_ORDER, ATTIC } from '../state/house';
import { NEED_KEYS, NEED_LABELS } from '../state/needs';
import { type Agent, type AgentId } from '../state/agents';
import { escapeHtml } from '../kernel/config';

export interface Shell {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  stage: Element;
  el: (name: string) => HTMLElement;
  btn: (act: string) => HTMLButtonElement;
  personEl: (id: AgentId) => HTMLButtonElement;
}

/** Builds the page: the canvas, the clock and money chips, the people cards and the floor and tool buttons. */
export function mountShell(app: HTMLElement, people: Agent[], logEl: HTMLElement): Shell | null {
  const card = (p: Agent): string => `
    <button class="vh-person" data-person="${p.id}" aria-pressed="false" title="Follow ${escapeHtml(p.name)}">
      <span class="vh-person-head">
        <span class="vh-dot" style="background:${p.look.top}"></span>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="vh-where" data-where></span>
      </span>
      <span class="vh-status" data-status></span>
      <span class="vh-needs">
        ${NEED_KEYS.map((k) => `<span class="vh-need" title="${NEED_LABELS[k]}"><span class="vh-need-label">${NEED_LABELS[k]}</span><span class="vh-bar"><i data-need="${k}"></i></span></span>`).join('')}
      </span>
    </button>`;

  app.innerHTML = `
    <div class="vh-stage">
      <div class="vh-hud">
        <div class="vh-chip"><span data-el="when"></span><strong data-el="clock"></strong></div>
        <div class="vh-chip vh-season" data-el="season"></div>
        <div class="vh-chip vh-money" data-el="money"></div>
      </div>
      <div class="vh-view">
        <canvas class="vh-canvas" aria-label="Your house"></canvas>
        <ul class="vh-log" aria-live="polite"></ul>
      </div>
      <div class="vh-people" aria-label="Who is home">${people.map(card).join('')}</div>
      <div class="vh-controls">
        <div class="vh-floors" role="tablist" aria-label="Floors">
          ${FLOOR_ORDER.map((i) => `<button role="tab" data-level="${i}"${i === ATTIC ? ' hidden' : ''}>${LEVEL_NAMES[i]}</button>`).join('')}
        </div>
        <div class="vh-tools">
          <button data-act="rotate" title="Turn the house (R)" aria-label="Turn the house">&#8635;</button>
          <button data-act="walls" title="Change how walls show (W)">Cutaway</button>
          <button data-act="speed" title="Game speed">1x</button>
          <button data-act="skipwork" title="Skip ahead to when he's home" hidden>Skip to 5 PM</button>
          <button data-act="weather" title="Demo: choose the weather" hidden>Weather: Auto</button>
          <button data-act="quality" title="Graphics quality">Auto</button>
          <button data-act="pause" title="Pause (Space)" aria-pressed="false">Pause</button>
        </div>
      </div>
    </div>`;

  const canvas = app.querySelector<HTMLCanvasElement>('.vh-canvas')!;
  app.querySelector('.vh-log')!.replaceWith(logEl);
  const stage = app.querySelector('.vh-stage')!;
  const ctx = canvas.getContext('2d');
  if (!ctx) { app.textContent = 'Your browser could not start the game display.'; return null; }

  const el = (name: string) => app.querySelector<HTMLElement>(`[data-el="${name}"]`)!;
  const btn = (act: string) => app.querySelector<HTMLButtonElement>(`[data-act="${act}"]`)!;
  const personEl = (id: AgentId) => app.querySelector<HTMLButtonElement>(`[data-person="${id}"]`)!;
  return { canvas, ctx, stage, el, btn, personEl };
}
