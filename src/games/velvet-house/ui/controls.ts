import { ATTIC } from '../state/house';
import { LEVEL_COUNT, FLOOR_ORDER } from '../state/scenes';
import { type AgentId } from '../state/agents';
import { qualityManager } from '../engine/qualityTier';
import { SPEEDS, WALL_MODES } from '../kernel/config';
import type { Game } from '../kernel/game';

export function createControls(g: Game): Partial<Game> {
  const { app, people, view, canvas, btn, personEl, hasAttic } = g;
  // Controls
  const QUALITY_CHOICES = [null, 'high', 'medium', 'low'] as const;
  const QUALITY_LABELS = ['Auto', 'High', 'Medium', 'Low'];
  try { g.s.qualityIdx = Math.max(0, Math.min(3, Number(localStorage.getItem('velvet-quality')) || 0)); } catch {}
  const applyQuality = (): void => qualityManager.setPlayerOverride(QUALITY_CHOICES[g.s.qualityIdx]);
  applyQuality();
  g.fit();
  const syncControls = (): void => {
    app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
      b.setAttribute('aria-selected', String(Number(b.dataset.level) === view.level));
      if (Number(b.dataset.level) === ATTIC) b.hidden = !hasAttic();
    });
    btn('walls').textContent = WALL_MODES[view.wallIdx].label;
    btn('speed').textContent = `${SPEEDS[view.speedIdx]}x`;
    btn('quality').textContent = QUALITY_LABELS[g.s.qualityIdx];
    btn('pause').setAttribute('aria-pressed', String(view.paused));
    btn('pause').textContent = view.paused ? 'Play' : 'Pause';
    people.filter((p) => p.kind !== 'npc').forEach((p) => personEl(p.id).setAttribute('aria-pressed', String(view.follow === p.id)));
  };
  // Changing floors or turning the view crossfades instead of snapping.
  const softCut = (): void => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    canvas.animate?.([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  };
  // Going up or down a floor, the picture slides the way you are going: the old floor leaves as the new one arrives.
  const slideFloors = (to: number): void => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const parent = canvas.parentElement;
    const dir = Math.sign(FLOOR_ORDER.indexOf(to) - FLOOR_ORDER.indexOf(view.level)) || 1;
    if (reduced || !parent || !canvas.animate || !canvas.width) return softCut();
    const old = document.createElement('canvas');
    old.width = canvas.width; old.height = canvas.height;
    old.className = 'vh-floor-slide';
    old.getContext('2d')?.drawImage(canvas, 0, 0);
    old.style.cssText = `position:absolute;left:${canvas.offsetLeft}px;top:${canvas.offsetTop}px;width:${canvas.offsetWidth}px;height:${canvas.offsetHeight}px;pointer-events:none;z-index:1`;
    parent.insertBefore(old, canvas.nextSibling);
    const opts = { duration: 420, easing: 'cubic-bezier(.3,.7,.2,1)' };
    // Up: the old floor drops away below and the new one comes down from above (the view rises). Down: the other way.
    const gone = old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${dir * 16}%)`, opacity: 0 }], opts);
    gone.onfinish = () => old.remove();
    canvas.animate([{ transform: `translateY(${-dir * 16}%)`, opacity: 0.15 }, { transform: 'translateY(0)', opacity: 1 }], opts);
  };
  const setLevel = (lv: number, keepFollow = false): void => {
    if (lv !== view.level) slideFloors(lv);
    g.dropSelectionIfOffFloor(lv);
    const changed = lv !== view.level;
    view.level = lv;
    if (changed) g.scriptEmit({ type: 'level.visited', level: lv });
    if (!keepFollow) view.follow = null;
    syncControls();
  };
  const rotate = (): void => { softCut(); view.rot = (view.rot + 1) % 4; };
  const cycleWalls = (): void => { view.wallIdx = (view.wallIdx + 1) % WALL_MODES.length; syncControls(); };
  const togglePause = (): void => { view.paused = !view.paused; syncControls(); };
  const toggleFollow = (id: AgentId): void => {
    view.follow = view.follow === id ? null : id;
    const p = people.find((x) => x.id === id)!;
    if (view.follow) setLevel(p.level, true);
    else syncControls();
  };

  app.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((b) => {
    b.addEventListener('click', () => setLevel(Number(b.dataset.level)));
  });
  people.filter((p) => p.kind !== 'npc').forEach((p) => personEl(p.id).addEventListener('click', () => toggleFollow(p.id)));
  btn('rotate').addEventListener('click', rotate);
  btn('walls').addEventListener('click', cycleWalls);
  btn('quality').addEventListener('click', () => {
    g.s.qualityIdx = (g.s.qualityIdx + 1) % QUALITY_CHOICES.length;
    applyQuality();
    try { localStorage.setItem('velvet-quality', String(g.s.qualityIdx)); } catch {}
    g.fit();
    syncControls();
  });
  btn('pause').addEventListener('click', togglePause);
  btn('skipwork').addEventListener('click', () => { if (people[0].away) { g.s.skipping = true; btn('skipwork').hidden = true; } });
  btn('speed').addEventListener('click', () => { view.speedIdx = (view.speedIdx + 1) % SPEEDS.length; syncControls(); });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // A cutscene takes no keys; a guided lesson only the ones that help place the piece.
    if (g.s.scriptMode === 'cutscene') return;
    if (g.s.scriptMode === 'guided' && !['r', 'R', 'Escape'].includes(e.key)) return;
    if (e.key >= '1' && Number(e.key) <= LEVEL_COUNT && (Number(e.key) - 1 !== ATTIC || hasAttic())) setLevel(Number(e.key) - 1);
    else if (e.key === 'r' || e.key === 'R') { if (g.isArranging()) { g.rotateSelected(); e.preventDefault(); } else rotate(); }
    else if (e.key === 'w' || e.key === 'W') cycleWalls();
    else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === 'a' || e.key === 'A') { g.toggleArrange(); }
    if (g.isArranging()) {
      if (e.key === 'c' || e.key === 'C') { g.recolourHeld(); }
      if (e.key === 'Escape') g.escapeArrange();
    }
  });
  syncControls();
  return { syncControls, setLevel, rotate, cycleWalls, togglePause, toggleFollow };
}
