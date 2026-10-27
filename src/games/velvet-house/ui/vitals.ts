import { vitals, type Vitals } from '../state/vitals';
import type { Game } from '../kernel/game';

/**
 * The house's vital signs, always on screen in the bottom-left: food, fitness, tidy, bills and the bond, the numbers
 * the player's actions move and the companion reacts to. One panel for all of them, so cause and effect sit together.
 */
const ROWS: Array<{ key: keyof Vitals; label: string }> = [
  { key: 'food', label: 'Food' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'tidy', label: 'Tidy' },
  { key: 'bills', label: 'Bills' },
  { key: 'bond', label: 'Bond' },
];

export function createVitals(g: Game): Partial<Game> {
  const { world, flags, stage, partnerName } = g;
  const el = document.createElement('div');
  el.className = 'vh-vitals';
  el.setAttribute('aria-label', 'How the house is doing');
  el.innerHTML = `<div class="vh-vitals-title">Home</div>${ROWS.map((r) => `<div class="vh-vital" data-vital="${r.key}"><span class="vh-vital-label">${r.key === 'bond' ? partnerName : r.label}</span><span class="vh-vital-bar"><i></i></span><span class="vh-vital-value"></span></div>`).join('')}`;
  stage.appendChild(el);
  const bars = Object.fromEntries(ROWS.map((r) => [r.key, el.querySelector<HTMLElement>(`[data-vital="${r.key}"] i`)!])) as Record<keyof Vitals, HTMLElement>;
  const values = Object.fromEntries(ROWS.map((r) => [r.key, el.querySelector<HTMLElement>(`[data-vital="${r.key}"] .vh-vital-value`)!])) as Record<keyof Vitals, HTMLElement>;
  const rows = Object.fromEntries(ROWS.map((r) => [r.key, el.querySelector<HTMLElement>(`[data-vital="${r.key}"]`)!])) as Record<keyof Vitals, HTMLElement>;
  let last = '';

  function refreshVitals(): void {
    const v = vitals(world.household, world.life, flags, world.day, g.s.bond);
    const sig = JSON.stringify(v);
    if (sig === last) return;
    last = sig;
    for (const key of ['food', 'fitness', 'tidy', 'bond'] as const) {
      const n = Math.round(v[key]);
      bars[key].style.width = `${n}%`;
      bars[key].dataset.tone = n < 25 ? 'low' : n < 55 ? 'mid' : 'ok';
      values[key].textContent = key === 'food' ? `${world.household.fridge.basic + world.household.fridge.fresh} meals` : `${n}`;
    }
    const b = v.bills;
    bars.bills.style.width = b.overdue ? '100%' : b.dueIn === null ? '100%' : `${Math.max(10, 100 - Math.max(0, 7 - b.dueIn) * 14)}%`;
    bars.bills.dataset.tone = b.overdue ? 'low' : b.dueIn !== null && b.dueIn <= 1 ? 'mid' : 'ok';
    values.bills.textContent = b.amount ? `$${b.amount} · ${b.label}` : b.label;
    rows.bills.dataset.overdue = b.overdue ? '1' : '';
  }
  refreshVitals();
  return { refreshVitals };
}
