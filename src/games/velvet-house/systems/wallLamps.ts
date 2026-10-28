import { defaultWallLamps, readWallLamps, checkLamp, snapLamp, freeLampSpot, lampRoom, lampReach, LAMP_STYLES, PROMO_LAMP_STYLES, LAMP_NAMES, isLampStyle, type WallLamp, type LampStyle } from '../state/wallLamps';
import { LEVEL_NAMES } from '../state/house';
import type { Game } from '../kernel/game';

/**
 * Wall lamps you can move. While arranging, tap a lamp on the wall to pick it, drag it along the walls (it follows the
 * pointer and shows green where it can hang and red where it cannot), and let go to hang it; a lamp let go somewhere it
 * cannot hang goes back. A small bar offers a new style, taking it down, and hanging lamps that are in storage.
 * The lamps are plain records kept in the save's flags: the furniture, the floor plan and the story are not touched.
 */
export function createWallLamps(g: Game): Partial<Game> {
  const { flags, canvas, stage, art, view, log, world } = g;
  const lamps: WallLamp[] = readWallLamps(flags.wallLamps) ?? defaultWallLamps();
  flags.wallLamps = lamps;
  const stockOf = (): LampStyle[] => ((flags.lampStock as unknown[] | undefined) ?? []).filter(isLampStyle);
  const setStock = (s: LampStyle[]): void => { flags.lampStock = s; };

  let selectedId: string | null = null;
  let held: { id: string; orig: Pick<WallLamp, 'p' | 'u' | 'z'> } | null = null;
  let valid = true;
  let reason = '';
  let press: { pointerId: number; x: number; y: number } | null = null;
  const find = (id: string | null): WallLamp | undefined => (id ? lamps.find((l) => l.id === id) : undefined);
  const check = (l: WallLamp) => checkLamp(lamps, l, world.objs);
  const nameOf = (l: WallLamp): string => LAMP_NAMES[l.style].toLowerCase();
  const nextId = (): string => { let n = lamps.length; while (lamps.some((l) => l.id === `wl${n}`)) n++; return `wl${n}`; };

  // ---- Hanging and taking down ----
  function hang(style: LampStyle, level: number): WallLamp | null {
    const spot = freeLampSpot(lamps, level, world.objs);
    if (!spot) return null;
    const lamp: WallLamp = { id: nextId(), level, ...spot, style, r: lampReach(style) };
    lamps.push(lamp);
    return lamp;
  }
  /** A bought lamp: hung on the floor being looked at if there is room, else kept in storage to hang later. */
  function addLamp(style: LampStyle): void {
    const lamp = hang(style, view.level);
    if (lamp) { selectedId = null; log(`Hung the ${nameOf(lamp)} in the ${lampRoom(lamp).toLowerCase()}. Use Arrange to move it.`); return; }
    setStock([...stockOf(), style]);
    log(`No wall free on the ${LEVEL_NAMES[view.level].toLowerCase()}, so the ${LAMP_NAMES[style].toLowerCase()} is in storage (Arrange).`);
  }
  function hangFromStock(i: number): void {
    const stock = stockOf(), style = stock[i];
    if (!style) return;
    const lamp = hang(style, view.level);
    if (!lamp) { log(`No wall free on the ${LEVEL_NAMES[view.level].toLowerCase()} for a lamp.`); return; }
    stock.splice(i, 1); setStock(stock);
    selectedId = lamp.id;
    log(`Hung the ${nameOf(lamp)} in the ${lampRoom(lamp).toLowerCase()}. Drag it where you want it.`);
  }
  function takeDown(): void {
    const l = find(selectedId);
    if (!l) return;
    lamps.splice(lamps.indexOf(l), 1);
    setStock([...stockOf(), l.style]);
    selectedId = null; held = null;
    log(`Took the ${nameOf(l)} down. It is in storage.`);
  }
  function nextStyle(): void {
    const l = find(selectedId);
    if (!l) return;
    // The styles the player can use: the shop's, and a promo pack's once they have it.
    const cycle: LampStyle[] = [...LAMP_STYLES, ...PROMO_LAMP_STYLES.filter((s) => g.owned.has(`lamp-${s}`))];
    l.style = cycle[(cycle.indexOf(l.style) + 1) % cycle.length];
    log(`The lamp is now the ${LAMP_NAMES[l.style].toLowerCase()}.`);
  }

  // ---- Dragging along the walls ----
  const SLOP = 6;
  const arranging = (): boolean => g.isArranging() && g.s.scriptMode !== 'cutscene';
  canvas.addEventListener('pointerdown', (e) => {
    if (!arranging() || !e.isPrimary || e.button > 0) return;
    const [sx, sy] = g.toView(e.clientX, e.clientY);
    const id = art.hitWallLamp(view.level, sx, sy);
    if (!id) { if (selectedId) selectedId = null; return; }
    e.stopImmediatePropagation();
    g.selectObject(null);
    selectedId = id;
    press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the drag still works while over the canvas */ }
  }, true);
  canvas.addEventListener('pointermove', (e) => {
    if (!press || press.pointerId !== e.pointerId) return;
    const l = find(selectedId);
    if (!l) return;
    if (!held) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < SLOP) return;
      held = { id: l.id, orig: { p: l.p, u: l.u, z: l.z } };
      g.s.suppressClick = true;
    }
    const [sx, sy] = g.toView(e.clientX, e.clientY);
    const w = art.wallPointAt(view.level, sx, sy);
    if (!w) return;
    Object.assign(l, snapLamp(w.p, w.u, w.z));
    const c = check(l);
    valid = c.ok; reason = c.reason ?? '';
  });
  const release = (e: PointerEvent): void => {
    if (!press || press.pointerId !== e.pointerId) return;
    press = null;
    const l = find(held?.id ?? null);
    if (held && l) {
      if (valid) log(`Moved the ${nameOf(l)}.`);
      else { Object.assign(l, held.orig); log(`${reason || 'It will not hang there.'} It went back.`); }
    }
    held = null; valid = true; reason = '';
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---- The bar ----
  const bar = document.createElement('div');
  bar.className = 'vh-lampbar';
  bar.hidden = true;
  stage.appendChild(bar);
  let barSig = '';
  function refreshBar(): void {
    const l = find(selectedId), stock = stockOf(), show = arranging();
    const sig = show ? JSON.stringify([l?.id, l?.style, l ? lampRoom(l) : '', stock, view.level]) : '';
    if (sig === barSig) return;
    barSig = sig;
    bar.hidden = !show;
    if (!show) { bar.replaceChildren(); return; }
    const parts: string[] = [];
    if (l) parts.push(`<div class="vh-lampbar-sel"><strong>${LAMP_NAMES[l.style]}</strong><small>${LEVEL_NAMES[l.level]} · ${lampRoom(l)}</small><button data-lamp="style">Next style</button><button data-lamp="down">Take down</button></div>`);
    else parts.push('<p class="vh-lampbar-hint">Tap a wall lamp to move it.</p>');
    if (stock.length) parts.push(`<div class="vh-lampbar-stock"><span>Hang one</span>${stock.map((s, i) => `<button data-stock="${i}">${LAMP_NAMES[s]}</button>`).join('')}</div>`);
    bar.innerHTML = parts.join('');
    bar.querySelector('[data-lamp="style"]')?.addEventListener('click', nextStyle);
    bar.querySelector('[data-lamp="down"]')?.addEventListener('click', takeDown);
    bar.querySelectorAll<HTMLElement>('[data-stock]').forEach((b) => b.addEventListener('click', () => hangFromStock(Number(b.dataset.stock))));
  }
  setInterval(refreshBar, 150);

  return {
    addLamp,
    /** Wall lamps that come with a pack go into storage, to hang from Arrange. */
    stockLamps: (styles: string[]) => setStock([...stockOf(), ...styles.filter(isLampStyle)]),
    /** What arrange mode tells the art about the lamps. */
    lampFrame: () => ({ wallLamps: lamps, lampUi: arranging() ? { id: selectedId, held: !!held, valid } : null }),
  };
}
