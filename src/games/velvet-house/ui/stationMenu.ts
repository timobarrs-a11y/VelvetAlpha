/**
 * The station menu: tap a working piece in the office and a small sheet lists what you can do there, each with how long it takes.
 * A station with several kinds of action (the desk: computer and phone) splits them into tabs. It closes on a pick, a tap
 * outside it, or Escape; picking is the only thing it does (the game decides what happens).
 */
export interface StationItem { id: string; label: string; secs: number; group?: string }
export interface StationSheet {
  title: string;
  /** A line under the title (why nothing can be picked, or what the station is). */
  note?: string;
  groups?: string[];
  items: StationItem[];
  /** Nothing in it can be picked right now. */
  disabled?: boolean;
}

export function createStationMenu(stage: Element): { el: HTMLElement; show: (s: StationSheet, x: number, y: number, onPick: (id: string) => void) => void; hide: () => void; isOpen: () => boolean } {
  const el = document.createElement('div');
  el.className = 'vh-station';
  el.hidden = true;
  stage.appendChild(el);
  let armed = true;
  const secsText = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` : `${s} s`);
  const esc = (t: string): string => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

  function hide(): void { el.hidden = true; el.innerHTML = ''; }

  function show(sheet: StationSheet, x: number, y: number, onPick: (id: string) => void): void {
    let group = sheet.groups?.[0] ?? '';
    const draw = (): void => {
      const items = sheet.groups ? sheet.items.filter((i) => i.group === group) : sheet.items;
      el.innerHTML = `<div class="vh-station-head"><strong>${esc(sheet.title)}</strong><button class="vh-station-x" data-x aria-label="Close">&times;</button></div>`
        + (sheet.note ? `<p class="vh-station-note">${esc(sheet.note)}</p>` : '')
        + (sheet.groups ? `<div class="vh-station-tabs" role="tablist">${sheet.groups.map((g) => `<button role="tab" data-tab="${esc(g)}" aria-selected="${g === group}">${esc(g)}</button>`).join('')}</div>` : '')
        + `<div class="vh-station-list">${items.map((i) => `<button class="vh-station-act" data-id="${esc(i.id)}"${sheet.disabled ? ' disabled' : ''}><span>${esc(i.label)}</span><small>${secsText(i.secs)}</small></button>`).join('')}</div>`;
      el.querySelector('[data-x]')?.addEventListener('click', (e) => { e.stopPropagation(); hide(); });
      el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); group = b.dataset.tab!; draw(); place(); }));
      el.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const id = b.dataset.id!; hide(); onPick(id); }));
    };
    const place = (): void => {
      // Beside the tap, kept inside the stage; the sheet is wide enough that on a narrow screen it simply sits in the middle.
      const r = stage.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      const left = Math.max(8, Math.min(r.width - w - 8, x - r.left - w / 2)), top = Math.max(8, Math.min(r.height - h - 8, y - r.top - h - 14));
      el.style.left = `${left}px`; el.style.top = `${Math.max(8, top < 8 ? y - r.top + 14 : top)}px`;
    };
    el.hidden = false;
    armed = false;
    setTimeout(() => { armed = true; }, 0);
    draw();
    place();
  }

  document.addEventListener('click', (e) => { if (armed && !el.hidden && e.target instanceof Node && !el.contains(e.target)) hide(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) hide(); });
  return { el, show, hide, isOpen: () => !el.hidden };
}
