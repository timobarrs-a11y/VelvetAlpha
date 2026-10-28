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
  // One row per pet, under the house's own: who, their lowest need as the bar, what they are up to.
  const petRows = new Map<string, HTMLElement>();
  function refreshPets(views: ReturnType<Game['petViews']>): void {
    for (const [id, row] of petRows) if (!views.some(p => p.id === id)) { row.remove(); petRows.delete(id); }
    for (const p of views) {
      let row = petRows.get(p.id);
      if (!row) {
        row = document.createElement('div');
        row.className = 'vh-vital vh-vital-pet';
        row.dataset.vital = 'pet';
        row.innerHTML = `<span class="vh-vital-label"></span><span class="vh-vital-bar"><i></i></span><span class="vh-vital-value"></span>`;
        el.appendChild(row);
        petRows.set(p.id, row);
      }
      const low = Math.round(Math.min(...Object.values(p.needs)));
      row.querySelector<HTMLElement>('.vh-vital-label')!.textContent = p.name;
      const bar = row.querySelector<HTMLElement>('i')!;
      bar.style.width = `${low}%`;
      bar.dataset.tone = low < 25 ? 'low' : low < 55 ? 'mid' : 'ok';
      row.querySelector<HTMLElement>('.vh-vital-value')!.textContent = p.status;
    }
  }

  function refreshVitals(): void {
    const v = vitals(world.household, world.life, flags, world.day, g.s.bond);
    // The pets module is wired after this one, so the first refresh may run without it.
    const pv = g.petViews ? g.petViews() : [];
    const sig = JSON.stringify(v) + g.concernMood() + JSON.stringify(pv);
    if (sig === last) return;
    last = sig;
    refreshPets(pv);
    for (const key of ['food', 'fitness', 'tidy', 'bond'] as const) {
      const n = Math.round(v[key]);
      bars[key].style.width = `${n}%`;
      bars[key].dataset.tone = n < 25 ? 'low' : n < 55 ? 'mid' : 'ok';
      values[key].textContent = key === 'food' ? `${world.household.fridge.basic + world.household.fridge.fresh} meals` : key === 'bond' ? `${n} · ${g.concernMood()}` : `${n}`;
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
