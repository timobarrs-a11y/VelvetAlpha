import { escapeHtml } from '../kernel/config';
import { postToParent } from '../bridge/protocol';
import type { Game } from '../kernel/game';

/**
 * A visit to a friend's house (see `run.visit` in kernel/config): their house as they left it, with the two of them and
 * their pets going about their day. There is nothing to buy, move or say, nothing is saved, and Go home takes the
 * player back to their own house.
 */
export function startVisit(g: Game): void {
  const { stage, world, view } = g;
  stage.classList.add('vh-visiting');
  g.drawer.close();
  // Their settling-in and goals are theirs: nothing is ticked off, paid or celebrated while visiting.
  g.s.settleDone = true;
  g.s.lifeGoal = null;
  view.speedIdx = 0;
  view.follow = null;
  const owner = typeof world.save?.ownerName === 'string' && world.save.ownerName.trim() ? world.save.ownerName.trim().slice(0, 40) : 'A friend';
  const bar = document.createElement('div');
  bar.className = 'vh-visit-bar';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span class="vh-visit-who"><strong>${escapeHtml(owner)}'s house</strong><small>Day ${world.day} · just looking</small></span><button type="button" data-visit-home>Go home</button>`;
  bar.querySelector('[data-visit-home]')!.addEventListener('click', () => postToParent({ type: 'velvet:visitEnd', game: 'velvet-house' }));
  stage.appendChild(bar);
}
