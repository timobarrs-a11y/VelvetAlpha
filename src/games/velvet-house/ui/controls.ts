import { ATTIC } from '../state/house';
import { LEVEL_COUNT } from '../state/scenes';
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
  const setLevel = (lv: number, keepFollow = false): void => {
    if (lv !== view.level) softCut();
    g.dropSelectionIfOffFloor(lv);
    view.level = lv;
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
  btn('speed').addEventListener('click', () => { view.speedIdx = (view.speedIdx + 1) % SPEEDS.length; syncControls(); });

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
