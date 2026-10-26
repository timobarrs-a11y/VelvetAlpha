import type { CoachingCommitment, CoachingGoal, CoachPlan } from '../../services/coachingService';

// The search button in a coach's or assistant's chat. Before searching, it asks
// what the search is for, so the helper can search with the goal, commitment or
// plan step in hand instead of asking follow-up questions. General searches
// belong to Atlas. Design: docs/goals-and-coaches/plan.md (web search).

/** Flip to true to make the search button a Velvet Plus feature. */
export const WEB_SEARCH_PRO_ONLY = false;

export type SearchTopicKind = 'goal' | 'commitment' | 'step';

export interface SearchTopic {
  kind: SearchTopicKind;
  id: string;
  title: string;
  /** A short line under the title: the goal it serves, or when it's due. */
  detail: string | null;
}

/** What goes to chat-turn with a search. `about` is null for "something else". */
export interface HelperSearchRequest {
  query: string;
  about: { kind: SearchTopicKind; id: string; title: string } | null;
}

const MAX_TOPICS = 8;

function dueLine(due: string | null): string | null {
  if (!due) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(due) ? new Date(`${due}T12:00:00`) : new Date(due);
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * What this helper is carrying with them: its active goals, then open
 * commitments (soonest first), then open steps on its active plans.
 */
export function searchTopics(
  companionId: string,
  goals: CoachingGoal[],
  commitments: CoachingCommitment[],
  plans: CoachPlan[],
): SearchTopic[] {
  const mine = goals.filter(g => g.source_companion_id === companionId && g.status === 'active');
  const goalTitle = new Map(goals.map(g => [g.id, g.title]));
  const topics: SearchTopic[] = mine.map(g => ({ kind: 'goal', id: g.id, title: g.title, detail: 'Goal' }));

  const open = commitments
    .filter(c => c.companion_id === companionId && (c.status === 'pending' || c.status === 'in_progress' || c.status === 'missed'))
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  for (const c of open) {
    topics.push({ kind: 'commitment', id: c.id, title: c.description, detail: dueLine(c.due_date) ?? (c.goal_id ? goalTitle.get(c.goal_id) ?? null : null) });
  }

  const covered = new Set(open.map(c => c.description));
  for (const plan of plans.filter(p => p.companion_id === companionId && p.status === 'active')) {
    for (const step of plan.steps ?? []) {
      if (step.status === 'completed' || step.status === 'skipped' || covered.has(step.title)) continue;
      topics.push({ kind: 'step', id: step.id, title: step.title, detail: plan.title });
    }
  }
  return topics.slice(0, MAX_TOPICS);
}

/** The message shown in the chat for a search. */
export function searchMessage(req: HelperSearchRequest): string {
  const query = req.query.trim();
  if (req.about) return query ? `Search for "${req.about.title}": ${query}` : `Search the web for "${req.about.title}"`;
  return `Search: ${query}`;
}
