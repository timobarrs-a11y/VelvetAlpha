import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, MessageSquare } from 'lucide-react';
import type { CoachingCommitment, CoachingGoal, CoachPlan } from '../../services/coachingService';
import { commitmentDueLabel } from '../../services/coachingService';
import type { CoachColorPalette } from '../../utils/coachColors';
import { finishDate, targetProgress, thisWeek, timeline } from './goalBoard';

export interface GoalHelper {
  id: string;
  name: string;
  kind: 'coach' | 'assistant';
}

function formatDay(day: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
}

/**
 * The goal at a glance, above its tabs: how far along the timeline they are,
 * who's carrying it, the numbers, and what's due this week.
 */
export function GoalBoard({
  goal, plans, commitments, helper, coachColor, onComplete, updatingId,
}: {
  goal: CoachingGoal;
  plans: CoachPlan[];
  commitments: CoachingCommitment[];
  helper: GoalHelper | null;
  coachColor: CoachColorPalette;
  onComplete: (id: string) => void;
  updatingId: string | null;
}) {
  const navigate = useNavigate();
  const finish = finishDate(goal, plans);
  const line = finish ? timeline(goal.start_date, finish) : null;
  const numbers = targetProgress(goal);
  const week = thisWeek(commitments);

  return (
    <section aria-label="Goal at a glance" className="mb-6 grid gap-3">
      {line && finish && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-baseline justify-between text-xs text-ink-muted">
            <span>Started {formatDay(goal.start_date)}</span>
            <span>{line.runTime} · finish {formatDay(finish, true)}</span>
          </div>
          <div className="relative mt-2 h-2 rounded-full bg-white/5" role="progressbar" aria-label="Time along the plan" aria-valuenow={line.pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-2 rounded-full" style={{ width: `${line.pct}%`, background: coachColor.base }} />
            <span className="absolute -top-1 h-4 w-0.5 rounded-full bg-white" style={{ left: `calc(${line.pct}% - 1px)` }} aria-hidden />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {line.daysLeft >= 0 ? `Today · ${line.daysLeft} days to go` : `${Math.abs(line.daysLeft)} days past the finish`}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {helper && (
          <button
            type="button"
            onClick={() => navigate(`/chat?companion=${helper.id}`)}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left hover:bg-white/[0.04]"
          >
            <MessageSquare className="h-5 w-5 flex-shrink-0" style={{ color: coachColor.base }} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                {helper.kind === 'coach' ? `Taught by ${helper.name}` : `${helper.name}, your assistant`}
              </span>
              <span className="block text-xs text-ink-muted">Open the chat</span>
            </span>
          </button>
        )}
        {numbers && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-sm font-semibold text-ink">{numbers.label}</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/5">
              <div className="h-1.5 rounded-full" style={{ width: `${numbers.pct}%`, background: coachColor.base }} />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">{numbers.pct}% of the target</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">This week</h3>
        {week.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing due this week.</p>
        ) : (
          <ul className="mt-2 grid gap-1.5">
            {week.map(c => (
              <li key={c.id} className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onComplete(c.id)}
                  disabled={updatingId === c.id}
                  aria-label={`Mark "${c.description}" done`}
                  style={{ color: 'var(--ds-muted)' }}
                >
                  {updatingId === c.id ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.description}</span>
                <span className="text-xs text-ink-muted">{commitmentDueLabel(c.due_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
