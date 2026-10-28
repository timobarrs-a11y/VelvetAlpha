import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, CheckCircle2, Layers, MessageCircle, TrendingUp } from 'lucide-react';
import type { ArrivalPlan } from '../../../supabase/functions/_shared/atlasArrival';
import { formatDay } from './arrivalUtils';

export interface PlanSummary {
  finishDate: string;
  runTime: string;
}

interface Props {
  plan: ArrivalPlan;
  summary: PlanSummary;
  helper: { name: string; kind: 'coach' | 'assistant' };
  onChangeCommitmentDate: (index: number, date: string) => void;
  onConfirm: () => void;
  /** Take one of the first steps to their coach or assistant: the plan is saved and the chat opens with the question typed in. */
  onAsk?: (commitment: { description: string; dueDate: string }) => void;
  busy: boolean;
}

const STEPS = [
  { key: 'plan', label: 'Plan', icon: Layers },
  { key: 'commitments', label: 'Commitments', icon: CheckCircle2 },
  { key: 'progress', label: 'Progress', icon: TrendingUp },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
] as const;

/**
 * Atlas walks them through the goal before anything lands on the calendar:
 * the whole road, what they're signing up for, how they'll know it's working,
 * and last, the calendar summary.
 */
export function PlanWalkthrough({ plan, summary, helper, onChangeCommitmentDate, onConfirm, onAsk, busy }: Props) {
  const [step, setStep] = useState(0);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const helperLine = helper.kind === 'coach' ? `${helper.name}, your coach` : `${helper.name}, your assistant`;

  const lines = [
    "Here's the whole road, from first step to last. Have a look; nothing is set in stone.",
    "This is what you'd be signing up for first. Move anything that won't fit your week.",
    `And this is how you'll know it's working. ${helperLine}, will keep count.`,
    'Finally, the calendar. Shall I put it there?',
  ];

  return (
    <div className="w-full rounded-2xl p-4 sm:p-5" style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-border-strong)' }}>
      <ol className="mb-4 flex gap-1.5" aria-label="Setting up your goal">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex-1">
            <div className="h-1 rounded-full" style={{ background: i <= step ? 'var(--shell-accent)' : 'var(--shell-border)' }} />
            <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider" style={{ color: i === step ? 'var(--shell-text-primary)' : 'var(--shell-text-muted)' }}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <p className="mb-4 text-[15px] leading-relaxed" style={{ color: 'var(--shell-text-primary)' }}>{lines[step]}</p>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <div className="space-y-4">
              {plan.phases.map((phase, i) => (
                <div key={phase.title}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-accent)' }}>
                    {i + 1}. {phase.title}
                  </h3>
                  <ul className="mt-1.5 space-y-1">
                    {phase.steps.map(s => (
                      <li key={s.title} className="flex items-baseline justify-between gap-3 text-sm" style={{ color: 'var(--shell-text-primary)' }}>
                        <span>{s.title}</span>
                        {s.scheduledFor && <span className="shrink-0 text-xs" style={{ color: 'var(--shell-text-muted)' }}>{formatDay(s.scheduledFor)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <ul className="space-y-2">
              {plan.commitments.length === 0 && (
                <li className="text-sm" style={{ color: 'var(--shell-text-muted)' }}>Nothing this week; the plan starts gently.</li>
              )}
              {plan.commitments.map((c, i) => (
                <li key={c.description} className="rounded-xl px-3 py-2" style={{ background: 'var(--shell-accent-soft)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm" style={{ color: 'var(--shell-text-primary)' }}>{c.description}</span>
                    <input
                      type="date"
                      aria-label={`Date for ${c.description}`}
                      value={c.dueDate}
                      min={todayKey}
                      onChange={e => e.target.value && onChangeCommitmentDate(i, e.target.value)}
                      className="shrink-0 rounded-lg bg-transparent px-2 py-1 text-xs"
                      style={{ border: '1px solid var(--shell-border)', color: 'var(--shell-text-primary)' }}
                    />
                  </div>
                  {onAsk && (
                    <button
                      type="button"
                      onClick={() => onAsk(c)}
                      disabled={busy}
                      className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                      style={{ border: '1px solid var(--shell-border-strong)', color: 'var(--shell-accent)' }}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Ask {helper.name} about this
                    </button>
                  )}
                </li>
              ))}
              {onAsk && plan.commitments.length > 0 && (
                <li className="px-1 text-xs" style={{ color: 'var(--shell-text-muted)' }}>
                  Asking {helper.name} puts this plan on your calendar and takes you to {helper.name}'s chat, with your question ready to send.
                </li>
              )}
            </ul>
          )}

          {step === 2 && (
            <dl className="space-y-3 text-sm">
              {plan.goal.measure && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-text-muted)' }}>What's measured</dt>
                  <dd style={{ color: 'var(--shell-text-primary)' }}>
                    {plan.goal.measure.what}
                    {plan.goal.measure.target !== null && ` · target ${plan.goal.measure.unit === '$' ? '$' : ''}${plan.goal.measure.target.toLocaleString()}${plan.goal.measure.unit && plan.goal.measure.unit !== '$' ? ` ${plan.goal.measure.unit}` : ''}`}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-text-muted)' }}>Where it shows</dt>
                <dd style={{ color: 'var(--shell-text-primary)' }}>On your goal page, and ticked off in Today as you go.</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--shell-text-muted)' }}>Check-ins</dt>
                <dd style={{ color: 'var(--shell-text-primary)' }}>{plan.checkIns}, with {helper.name}.</dd>
              </div>
            </dl>
          )}

          {step === 3 && (
            <div className="space-y-2 text-sm" style={{ color: 'var(--shell-text-primary)' }}>
              <p className="font-semibold">
                {plan.goal.title} · with {helper.name} · {summary.runTime} · estimated finish {formatDay(summary.finishDate, true)}
              </p>
              {plan.weeklyRhythm.map(w => (
                <p key={w.day}><span style={{ color: 'var(--shell-text-muted)' }}>{w.day}s:</span> {w.what}</p>
              ))}
              {plan.commitments.length > 0 && (
                <p>
                  <span style={{ color: 'var(--shell-text-muted)' }}>This week:</span>{' '}
                  {plan.commitments.map(c => `${c.description} (${formatDay(c.dueDate)})`).join(' · ')}
                </p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0 || busy}
          className="text-sm disabled:opacity-0"
          style={{ color: 'var(--shell-text-secondary)' }}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
          >
            Looks right
          </button>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}
          >
            {busy ? 'Putting it on your calendar…' : 'Put it on my calendar'}
          </button>
        )}
      </div>
    </div>
  );
}
