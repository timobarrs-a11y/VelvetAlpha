import type { Gender } from '../../types/avatar-v2';
import { helperPronouns } from './helperPronouns';

/** What the helper is the best at, from the label Atlas gave the goal; "this" when there is none worth saying. */
function focusOf(domain: string | null | undefined): string {
  const d = (domain ?? '').trim().replace(/[.!?]+$/, '');
  return d && d.length <= 40 ? d : 'this';
}

/** Atlas handing over the coach or assistant, once the plan is drafted. */
export function handoffLine(helper: { name: string; gender: Gender; kind: 'coach' | 'assistant'; domain?: string | null }): string {
  const role = helper.kind === 'coach' ? 'coach' : 'assistant';
  return `Splendid work. Your plan is ready for you to look over. You want this done properly, so I've brought you the best there is: ${helper.name}, your ${role}. There is none better for ${focusOf(helper.domain)}. Whatever you need, take it to ${helperPronouns(helper.gender).object}.`;
}
