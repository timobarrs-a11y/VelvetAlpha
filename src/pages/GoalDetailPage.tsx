import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Layers, CheckCircle2, BookOpen, TrendingUp, ChevronRight,
  Circle, Clock, Flame, AlertCircle, Calendar, Plus, X, ArrowLeft,
  Sparkles, Lock, Activity, Eye, EyeOff,
} from 'lucide-react';
import { PageShell, PageHeader, Card, EmptyState, LoadingState, Badge } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import { useSubscription } from '../hooks/useSubscription';
import { SUBSCRIPTION_PLANS } from '../types/subscription';
import {
  getGoalById, getCommitments, getPlans, getArtifacts,
  updateCommitmentStatus, updatePlanStepStatus, updatePlanStepTitle,
  respondToPlan, updateGoalDeadline, updateGoalStatus, deletePlan,
  getWeeklyStats, commitmentDueLabel, goalProgressPercent, goalDaysRemaining,
  GOAL_TYPE_LABELS, planProgressPercent,
  ARTIFACT_TYPE_LABELS, updateArtifactStatus, deleteArtifact,
  createTickEvent,
  type CoachingGoal, type CoachingCommitment, type CoachPlan, type CoachPlanStep,
  type CoachArtifact, type CommitmentStatus, type PlanStatus, type StepStatus,
} from '../services/coachingService';
import { getCoachColor, formatDeadline, daysToDeadline, deadlineUrgency, type CoachColorPalette } from '../utils/coachColors';
import { toggleGoalShowOnProfile, toggleCommitmentShowOnProfile } from '../services/publicProfileService';

type Tab = 'plans' | 'commitments' | 'progress' | 'library';

export function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const { tier } = useSubscription();
  const plan = SUBSCRIPTION_PLANS[tier];

  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<CoachingGoal | null>(null);
  const [commitments, setCommitments] = useState<CoachingCommitment[]>([]);
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [artifacts, setArtifacts] = useState<CoachArtifact[]>([]);
  const [tab, setTab] = useState<Tab>('plans');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showDeadlineEditor, setShowDeadlineEditor] = useState(false);

  const loadData = useCallback(async () => {
    if (!goalId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/splash', { replace: true }); return; }

    const [g, comms, plns, arts] = await Promise.all([
      getGoalById(user.id, goalId),
      getCommitments(user.id),
      getPlans(user.id),
      getArtifacts(user.id),
    ]);

    setGoal(g);
    setCommitments(comms.filter(c => c.goal_id === goalId));
    setPlans(plns.filter(p => {
      if (p.companion_id && g?.source_companion_id) return p.companion_id === g.source_companion_id;
      return false;
    }));
    setArtifacts(arts.filter(a => a.goal_id === goalId));
  }, [goalId, navigate]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const coachColor: CoachColorPalette = useMemo(
    () => getCoachColor(goal?.companion_color),
    [goal?.companion_color],
  );

  const activeCommitments = commitments.filter(c =>
    c.status === 'pending' || c.status === 'in_progress' || c.status === 'missed'
  );
  const stats = getWeeklyStats(commitments);
  const daysLeft = daysToDeadline(goal?.target_date ?? null, goal?.deadline_precision);
  const urgency = deadlineUrgency(goal?.target_date ?? null, goal?.deadline_precision);

  const handleCompleteCommitment = async (id: string) => {
    setUpdatingId(id);
    await updateCommitmentStatus(id, 'completed');
    setCommitments(prev => prev.map(c => c.id === id
      ? { ...c, status: 'completed' as CommitmentStatus, completed_at: new Date().toISOString() }
      : c));
    if (goal && goal.source_companion_id) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await createTickEvent(user.id, {
        eventType: 'commitment_completed',
        targetType: 'commitment', targetId: id,
        companionId: goal.source_companion_id,
      });
    }
    toast.success('Done. Nice work.');
    setUpdatingId(null);
  };

  const handleStepToggle = async (step: CoachPlanStep) => {
    const newStatus: StepStatus = step.status === 'completed' ? 'pending' : 'completed';
    setUpdatingId(step.id);
    try {
      await updatePlanStepStatus(step.id, newStatus);
      setPlans(prev => prev.map(p => ({
        ...p,
        steps: p.steps?.map(s => s.id === step.id
          ? { ...s, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
          : s),
      })));
    } catch (err) {
      toast.error('Could not update step.');
    }
    setUpdatingId(null);
  };

  const handleRespondToPlan = async (p: CoachPlan, accept: boolean) => {
    if (!goal) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await respondToPlan(user.id, { id: p.id, title: p.title, companion_id: p.companion_id }, accept);
    if (accept) {
      setPlans(prev => prev.map(p => p.id === p.id ? { ...p, status: 'active' as PlanStatus } : p));
      toast.success('Plan accepted.');
    } else {
      setPlans(prev => prev.filter(x => x.id !== p.id));
      toast.info('Plan declined.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    await deletePlan(planId);
    setPlans(prev => prev.filter(p => p.id !== planId));
    toast.info('Plan deleted.');
  };

  const handlePauseGoal = async () => {
    if (!goal) return;
    await updateGoalStatus(goal.id, 'paused');
    toast.info('Goal paused.');
    navigate('/coaching-progress');
  };

  const handleDeadlineSave = async (date: string, precision: string) => {
    if (!goal) return;
    await updateGoalDeadline(goal.id, date, precision);
    setGoal(prev => prev ? { ...prev, target_date: date, deadline_precision: precision } : prev);
    setShowDeadlineEditor(false);
    toast.success('Deadline updated.');
  };

  const handleToggleProfile = async () => {
    if (!goal) return;
    const next = !goal.show_on_profile;
    setGoal(prev => prev ? { ...prev, show_on_profile: next } : prev);
    try {
      await toggleGoalShowOnProfile(goal.id, next);
      toast.success(next ? 'Goal visible on your profile.' : 'Goal hidden from your profile.');
    } catch {
      setGoal(prev => prev ? { ...prev, show_on_profile: !next } : prev);
      toast.error('Could not update visibility.');
    }
  };

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your goal..." />
      </PageShell>
    );
  }

  if (!goal) {
    return (
      <PageShell center>
        <EmptyState
          icon={<Target className="w-7 h-7 text-ink-muted" />}
          title="Goal not found"
          description="This goal may have been removed."
          action={{ label: 'Back to progress', onClick: () => navigate('/coaching-progress'), variant: 'primary' }}
        />
      </PageShell>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Layers; count: number }[] = [
    { key: 'plans', label: 'Plans', icon: Layers, count: plans.length },
    { key: 'commitments', label: 'Commitments', icon: CheckCircle2, count: activeCommitments.length },
    { key: 'progress', label: 'Progress', icon: TrendingUp, count: 0 },
    { key: 'library', label: 'Library', icon: BookOpen, count: artifacts.length },
  ];

  return (
    <PageShell
      header={
        <PageHeader
          title={goal.title}
          subtitle={`${GOAL_TYPE_LABELS[goal.goal_type] ?? 'Goal'} · ${goal.companion_name ?? 'Coach'}`}
          back="/coaching-progress"
          backLabel="Progress"
          accent={coachColor.base}
          leading={
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: coachColor.soft, border: `1px solid ${coachColor.border}` }}
            >
              <Target className="w-[18px] h-[18px]" style={{ color: coachColor.base }} />
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleProfile}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  goal.show_on_profile
                    ? 'text-ink hover:bg-white/5'
                    : 'text-ink-muted hover:text-ink hover:bg-white/5'
                }`}
                title={goal.show_on_profile ? 'Visible on your public profile' : 'Hidden from your public profile'}
              >
                {goal.show_on_profile ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{goal.show_on_profile ? 'On profile' : 'Hidden'}</span>
              </button>
              <button
                onClick={handlePauseGoal}
                className="text-xs px-3 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
              >
                Pause
              </button>
            </div>
          }
        >
          {/* Deadline + pace strip */}
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button
              onClick={() => setShowDeadlineEditor(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ background: coachColor.soft, color: coachColor.text }}
            >
              <Calendar className="w-3.5 h-3.5" />
              {formatDeadline(goal.target_date, goal.deadline_precision)}
              {daysLeft !== null && (
                <span className="ml-1 opacity-70">
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                </span>
              )}
            </button>
            {urgency === 'overdue' && (
              <span className="text-xs px-2 py-1 rounded-md bg-red-500/10 text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Overdue
              </span>
            )}
            {urgency === 'soon' && (
              <span className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Due soon
              </span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-3 border-b border-white/5">
            {tabs.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                    active ? 'text-ink' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                  {t.count > 0 && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: active ? coachColor.soft : 'rgba(255,255,255,0.05)', color: active ? coachColor.text : 'inherit' }}
                    >
                      {t.count}
                    </span>
                  )}
                  {active && (
                    <motion.div
                      layoutId="goal-tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: coachColor.base }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </PageHeader>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {tab === 'plans' && (
            <PlansTab
              plans={plans}
              coachColor={coachColor}
              onStepToggle={handleStepToggle}
              onRespond={handleRespondToPlan}
              onDelete={handleDeletePlan}
              updatingId={updatingId}
              onStepEdit={async (step, title) => {
                try {
                  await updatePlanStepTitle(step.id, title);
                  setPlans(prev => prev.map(p => ({
                    ...p,
                    steps: p.steps?.map(s => s.id === step.id ? { ...s, title } : s),
                  })));
                  toast.success('Step updated.');
                } catch {
                  toast.error('Could not edit step.');
                }
              }}
            />
          )}
          {tab === 'commitments' && (
            <CommitmentsTab
              commitments={commitments}
              coachColor={coachColor}
              onComplete={handleCompleteCommitment}
              updatingId={updatingId}
            />
          )}
          {tab === 'progress' && (
            <ProgressTab
              goal={goal}
              commitments={commitments}
              plans={plans}
              coachColor={coachColor}
              tier={tier}
              planLimits={plan}
            />
          )}
          {tab === 'library' && (
            <LibraryTab
              artifacts={artifacts}
              coachColor={coachColor}
              onAccept={async (id) => { await updateArtifactStatus(id, 'accepted'); setArtifacts(prev => prev.map(a => a.id === id ? { ...a, status: 'accepted' } : a)); toast.success('Saved to your library.'); }}
              onArchive={async (id) => { await updateArtifactStatus(id, 'archived'); setArtifacts(prev => prev.map(a => a.id === id ? { ...a, status: 'archived' } : a)); }}
              onDelete={async (id) => { await deleteArtifact(id); setArtifacts(prev => prev.filter(a => a.id !== id)); toast.info('Item deleted.'); }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {showDeadlineEditor && (
        <DeadlineEditor
          goal={goal}
          coachColor={coachColor}
          onSave={handleDeadlineSave}
          onCancel={() => setShowDeadlineEditor(false)}
        />
      )}
    </PageShell>
  );
}

// =====================================================
// Plans Tab
// =====================================================

function PlansTab({
  plans, coachColor, onStepToggle, onRespond, onDelete, updatingId, onStepEdit,
}: {
  plans: CoachPlan[];
  coachColor: CoachColorPalette;
  onStepToggle: (step: CoachPlanStep) => void;
  onRespond: (plan: CoachPlan, accept: boolean) => void;
  onDelete: (planId: string) => void;
  updatingId: string | null;
  onStepEdit: (step: CoachPlanStep, title: string) => void;
}) {
  const proposed = plans.filter(p => p.status === 'proposed');
  const active = plans.filter(p => p.status === 'active');
  const completed = plans.filter(p => p.status === 'completed' || p.status === 'paused');

  if (plans.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<Layers className="w-6 h-6 text-ink-muted" />}
          title="No plans yet"
          description="Your coach will propose plans as you discuss your goal. They'll appear here."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {proposed.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> Proposed by your coach
          </h3>
          <div className="space-y-3">
            {proposed.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                coachColor={coachColor}
                onStepToggle={onStepToggle}
                onRespond={onRespond}
                onDelete={onDelete}
                updatingId={updatingId}
                onStepEdit={onStepEdit}
                proposed
              />
            ))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
            Active plans
          </h3>
          <div className="space-y-3">
            {active.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                coachColor={coachColor}
                onStepToggle={onStepToggle}
                onRespond={onRespond}
                onDelete={onDelete}
                updatingId={updatingId}
                onStepEdit={onStepEdit}
              />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
            Completed / Paused
          </h3>
          <div className="space-y-3">
            {completed.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                coachColor={coachColor}
                onStepToggle={onStepToggle}
                onRespond={onRespond}
                onDelete={onDelete}
                updatingId={updatingId}
                onStepEdit={onStepEdit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan, coachColor, onStepToggle, onRespond, onDelete, updatingId, onStepEdit, proposed,
}: {
  plan: CoachPlan;
  coachColor: CoachColorPalette;
  onStepToggle: (step: CoachPlanStep) => void;
  onRespond: (plan: CoachPlan, accept: boolean) => void;
  onDelete: (planId: string) => void;
  updatingId: string | null;
  onStepEdit: (step: CoachPlanStep, title: string) => void;
  proposed?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const pct = planProgressPercent(plan);

  return (
    <Card padding="none" className="overflow-hidden" style={{ borderLeft: `3px solid ${coachColor.base}` }}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-sm text-ink">{plan.title}</h4>
            {plan.description && <p className="text-xs text-ink-muted mt-1">{plan.description}</p>}
            {plan.cadence && (
              <span className="text-[10px] text-ink-muted mt-1.5 inline-block px-2 py-0.5 rounded bg-white/5">
                {plan.cadence}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-medium text-ink-muted">{pct}%</span>
            {proposed ? (
              <>
                <button
                  onClick={() => onRespond(plan, true)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: coachColor.base }}
                >
                  Accept
                </button>
                <button
                  onClick={() => onRespond(plan, false)}
                  className="text-xs px-3 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
                >
                  Decline
                </button>
              </>
            ) : (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs px-2 py-1 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
              >
                {expanded ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: coachColor.base }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Steps */}
      {expanded && plan.steps && plan.steps.length > 0 && (
        <div className="border-t border-white/5 px-4 sm:px-5 py-3 space-y-1">
          {plan.steps.map(step => (
            <div
              key={step.id}
              className="flex items-start gap-2.5 py-1.5 group"
            >
              <button
                onClick={() => onStepToggle(step)}
                disabled={updatingId === step.id}
                className="mt-0.5 flex-shrink-0 transition-opacity"
                style={{ color: step.status === 'completed' ? coachColor.base : 'var(--ds-muted)' }}
              >
                {step.status === 'completed'
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <Circle className="w-4 h-4" />}
              </button>
              <div className="min-w-0 flex-1">
                {editingStep === step.id ? (
                  <div className="flex gap-1.5">
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      className="flex-1 text-sm bg-white/5 rounded px-2 py-1 text-ink outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => { onStepEdit(step, editText); setEditingStep(null); }}
                      className="text-xs px-2 py-1 rounded bg-white/5 text-ink hover:bg-white/10"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingStep(null)}
                      className="text-xs px-2 py-1 rounded text-ink-muted hover:text-ink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={`text-sm ${step.status === 'completed' ? 'line-through text-ink-muted' : 'text-ink'}`}>
                      {step.user_set_title || step.title}
                    </span>
                    {step.is_below_floor && (
                      <span className="ml-2 text-[10px] text-amber-400" title={`Coach minimum: ${step.coach_minimum}`}>
                        below minimum
                      </span>
                    )}
                    {!proposed && step.status !== 'completed' && (
                      <button
                        onClick={() => { setEditingStep(step.id); setEditText(step.user_set_title || step.title); }}
                        className="ml-2 text-[10px] text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-ink"
                      >
                        edit
                      </button>
                    )}
                    {step.resource_url && (
                      <a
                        href={step.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-[10px] text-blue-400 hover:underline"
                      >
                        resource
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!proposed && (
        <div className="border-t border-white/5 px-4 sm:px-5 py-2">
          <button
            onClick={() => onDelete(plan.id)}
            className="text-[10px] text-ink-muted hover:text-red-400 transition-colors"
          >
            Delete plan
          </button>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Commitments Tab
// =====================================================

function CommitmentsTab({
  commitments, coachColor, onComplete, updatingId,
}: {
  commitments: CoachingCommitment[];
  coachColor: CoachColorPalette;
  onComplete: (id: string) => void;
  updatingId: string | null;
}) {
  const groups = groupCommitmentsByWeek(commitments);

  if (commitments.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<CheckCircle2 className="w-6 h-6 text-ink-muted" />}
          title="No commitments yet"
          description="As you work with your coach, commitments will appear here, sorted by week."
        />
      </Card>
    );
  }

  const groupOrder: { key: string; label: string }[] = [
    { key: 'overdue', label: 'Overdue' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'nextWeek', label: 'Next Week' },
    { key: 'later', label: 'Later This Month' },
    { key: 'horizon', label: 'On the Horizon' },
    { key: 'noDate', label: 'No Due Date' },
    { key: 'done', label: 'Completed' },
  ];

  return (
    <div className="space-y-5">
      {groupOrder.map(g => {
        const items = groups[g.key];
        if (!items || items.length === 0) return null;
        return (
          <div key={g.key}>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">{g.label}</h3>
            <div className="space-y-2">
              {items.map(c => (
                <CommitmentRow
                  key={c.id}
                  commitment={c}
                  coachColor={coachColor}
                  onComplete={onComplete}
                  updating={updatingId === c.id}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupCommitmentsByWeek(commitments: CoachingCommitment[]): Record<string, CoachingCommitment[]> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfThisWeek = new Date(startOfToday);
  endOfThisWeek.setDate(startOfToday.getDate() + (7 - startOfToday.getDay()));
  const endOfNextWeek = new Date(endOfThisWeek);
  endOfNextWeek.setDate(endOfThisWeek.getDate() + 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const groups: Record<string, CoachingCommitment[]> = {
    overdue: [], thisWeek: [], nextWeek: [], later: [], horizon: [], noDate: [], done: [],
  };

  for (const c of commitments) {
    if (c.status === 'completed' || c.status === 'renegotiated') {
      groups.done.push(c);
      continue;
    }
    if (!c.due_date) { groups.noDate.push(c); continue; }
    const due = new Date(c.due_date);
    if (due < startOfToday) groups.overdue.push(c);
    else if (due <= endOfThisWeek) groups.thisWeek.push(c);
    else if (due <= endOfNextWeek) groups.nextWeek.push(c);
    else if (due <= endOfMonth) groups.later.push(c);
    else groups.horizon.push(c);
  }

  return groups;
}

function CommitmentRow({
  commitment, coachColor, onComplete, updating,
}: {
  commitment: CoachingCommitment;
  coachColor: CoachColorPalette;
  onComplete: (id: string) => void;
  updating: boolean;
}) {
  const done = commitment.status === 'completed';
  return (
    <Card padding="sm" className="flex items-center gap-3" style={{ borderLeft: `2px solid ${coachColor.border}` }}>
      <button
        onClick={() => !done && onComplete(commitment.id)}
        disabled={updating || done}
        className="flex-shrink-0 transition-opacity"
        style={{ color: done ? coachColor.base : 'var(--ds-muted)', opacity: updating ? 0.5 : 1 }}
      >
        {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? 'line-through text-ink-muted' : 'text-ink'}`}>
          {commitment.description}
        </p>
        {commitment.due_date && (
          <span className="text-[11px] text-ink-muted">{commitmentDueLabel(commitment.due_date)}</span>
        )}
      </div>
    </Card>
  );
}

// =====================================================
// Progress Tab
// =====================================================

function ProgressTab({
  goal, commitments, plans, coachColor, tier, planLimits,
}: {
  goal: CoachingGoal;
  commitments: CoachingCommitment[];
  plans: CoachPlan[];
  coachColor: CoachColorPalette;
  tier: string;
  planLimits: typeof SUBSCRIPTION_PLANS[string];
}) {
  const stats = getWeeklyStats(commitments);
  const pct = goalProgressPercent(goal);
  const daysLeft = daysToDeadline(goal.target_date, goal.deadline_precision);

  const activePlans = plans.filter(p => p.status === 'active');
  const totalSteps = activePlans.reduce((sum, p) => sum + (p.steps?.length ?? 0), 0);
  const doneSteps = activePlans.reduce((sum, p) => sum + (p.steps?.filter(s => s.status === 'completed').length ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Goal progress */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-ink">Goal Progress</h4>
          <span className="text-xs text-ink-muted">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
          <motion.div
            className="h-full rounded-full"
            style={{ background: coachColor.base }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {goal.target_value && goal.current_value != null && (
          <p className="text-xs text-ink-muted">
            {Number(goal.current_value)} / {Number(goal.target_value)} {goal.unit ?? ''}
          </p>
        )}
        {daysLeft !== null && (
          <p className="text-xs text-ink-muted mt-1">
            {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`}
          </p>
        )}
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Kept" value={stats.kept} tone={coachColor.base} />
        <StatCard icon={<AlertCircle className="w-4 h-4" />} label="Missed" value={stats.missed} tone="#ef4444" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={stats.pending} tone="#3b82f6" />
        <StatCard icon={<Flame className="w-4 h-4" />} label="Streak" value={stats.streak} tone="#f59e0b" />
      </div>

      {/* Plan progress */}
      {activePlans.length > 0 && (
        <Card padding="md">
          <h4 className="text-sm font-semibold text-ink mb-3">Plan Progress</h4>
          <div className="space-y-3">
            {activePlans.map(p => {
              const pctP = planProgressPercent(p);
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink">{p.title}</span>
                    <span className="text-xs text-ink-muted">{pctP}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pctP}%`, background: coachColor.base }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted mt-3">
            {doneSteps} of {totalSteps} steps completed across {activePlans.length} plan{activePlans.length > 1 ? 's' : ''}
          </p>
        </Card>
      )}

      {/* Confidence tracking locked for free */}
      {tier === 'free' && (
        <Card padding="md">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-ink-muted" />
            <div>
              <p className="text-sm font-medium text-ink">Confidence Tracking</p>
              <p className="text-xs text-ink-muted">Log your confidence over time. Available on Essential and above.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// Library Tab
// =====================================================

function LibraryTab({
  artifacts, coachColor, onAccept, onArchive, onDelete,
}: {
  artifacts: CoachArtifact[];
  coachColor: CoachColorPalette;
  onAccept: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (artifacts.length === 0) {
    return (
      <Card padding="lg">
        <EmptyState
          icon={<BookOpen className="w-6 h-6 text-ink-muted" />}
          title="Your library is empty"
          description="Your coach will create study materials, checklists, and quizzes for this goal. They'll appear here."
        />
      </Card>
    );
  }

  const proposed = artifacts.filter(a => a.status === 'proposed');
  const accepted = artifacts.filter(a => a.status === 'accepted');

  return (
    <div className="space-y-5">
      {proposed.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" /> New from your coach
          </h3>
          <div className="space-y-3">
            {proposed.map(a => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                coachColor={coachColor}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                onAccept={onAccept}
                onArchive={onArchive}
                onDelete={onDelete}
                proposed
              />
            ))}
          </div>
        </div>
      )}

      {accepted.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Saved items</h3>
          <div className="space-y-3">
            {accepted.map(a => (
              <ArtifactCard
                key={a.id}
                artifact={a}
                coachColor={coachColor}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                onAccept={onAccept}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ArtifactCard({
  artifact, coachColor, expanded, onToggle, onAccept, onArchive, onDelete, proposed,
}: {
  artifact: CoachArtifact;
  coachColor: CoachColorPalette;
  expanded: boolean;
  onToggle: () => void;
  onAccept: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  proposed?: boolean;
}) {
  const label = ARTIFACT_TYPE_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const content = artifact.content as Record<string, unknown>;
  const items = Array.isArray(content.items) ? content.items as string[] : [];
  const text = typeof content.text === 'string' ? content.text : '';
  const url = typeof content.url === 'string' ? content.url : '';

  return (
    <Card padding="none" className="overflow-hidden" style={{ borderLeft: `3px solid ${coachColor.base}` }}>
      <button
        onClick={onToggle}
        className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: coachColor.base }} />
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</span>
          </div>
          <h4 className="text-sm font-medium text-ink">{artifact.title}</h4>
        </div>
        <ChevronRight className={`w-4 h-4 text-ink-muted flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 border-t border-white/5 pt-3">
              {text && <p className="text-sm text-ink-muted whitespace-pre-wrap">{text}</p>}
              {items.length > 0 && (
                <ul className="space-y-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink">
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: coachColor.base }} />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline">
                  Open resource
                </a>
              )}
              <div className="flex gap-2 mt-3">
                {proposed && (
                  <button
                    onClick={() => onAccept(artifact.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: coachColor.base }}
                  >
                    Save
                  </button>
                )}
                <button
                  onClick={() => onArchive(artifact.id)}
                  className="text-xs px-3 py-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
                >
                  Archive
                </button>
                <button
                  onClick={() => onDelete(artifact.id)}
                  className="text-xs px-3 py-1.5 rounded-lg text-ink-muted hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// =====================================================
// Deadline Editor Modal
// =====================================================

function DeadlineEditor({
  goal, coachColor, onSave, onCancel,
}: {
  goal: CoachingGoal;
  coachColor: CoachColorPalette;
  onSave: (date: string, precision: string) => void;
  onCancel: () => void;
}) {
  const [precision, setPrecision] = useState<string>(goal.deadline_precision ?? 'exact');
  const [month, setMonth] = useState(goal.target_date ? new Date(goal.target_date).getMonth() : new Date().getMonth());
  const [year, setYear] = useState(goal.target_date ? new Date(goal.target_date).getFullYear() : new Date().getFullYear() + 1);
  const [quarter, setQuarter] = useState(goal.target_date ? Math.floor(new Date(goal.target_date).getMonth() / 3) + 1 : 1);
  const [season, setSeason] = useState(0);
  const [exactDate, setExactDate] = useState(goal.target_date ?? '');

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const seasons = ['Winter', 'Spring', 'Summer', 'Fall'];

  const handleSave = () => {
    let dateStr: string;
    if (precision === 'exact') {
      dateStr = exactDate;
    } else if (precision === 'month') {
      dateStr = new Date(year, month, 15).toISOString().split('T')[0];
    } else if (precision === 'quarter') {
      dateStr = new Date(year, (quarter - 1) * 3 + 1, 15).toISOString().split('T')[0];
    } else if (precision === 'season') {
      const seasonMonths = [0, 3, 6, 9];
      dateStr = new Date(year, seasonMonths[season] + 1, 15).toISOString().split('T')[0];
    } else {
      dateStr = exactDate;
    }
    onSave(dateStr, precision);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--ds-surface, #1a1a2e)] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink">Set deadline</h3>
          <button onClick={onCancel} className="text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
        </div>

        {/* Precision selector */}
        <div className="flex gap-1 mb-4">
          {[
            { key: 'month', label: 'Month' },
            { key: 'quarter', label: 'Quarter' },
            { key: 'season', label: 'Season' },
            { key: 'exact', label: 'Exact' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPrecision(p.key)}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
                precision === p.key ? 'text-white' : 'text-ink-muted hover:text-ink bg-white/5'
              }`}
              style={precision === p.key ? { background: coachColor.base } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Month + Year */}
        {(precision === 'month' || precision === 'quarter' || precision === 'season') && (
          <div className="space-y-3">
            {precision === 'month' && (
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none"
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            {precision === 'quarter' && (
              <select
                value={quarter}
                onChange={e => setQuarter(Number(e.target.value))}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none"
              >
                <option value={1}>Q1 (Jan–Mar)</option>
                <option value={2}>Q2 (Apr–Jun)</option>
                <option value={3}>Q3 (Jul–Sep)</option>
                <option value={4}>Q4 (Oct–Dec)</option>
              </select>
            )}
            {precision === 'season' && (
              <select
                value={season}
                onChange={e => setSeason(Number(e.target.value))}
                className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none"
              >
                {seasons.map((s, i) => <option key={i} value={i}>{s}</option>)}
              </select>
            )}
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {precision === 'exact' && (
          <input
            type="date"
            value={exactDate}
            onChange={e => setExactDate(e.target.value)}
            className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink outline-none"
          />
        )}

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            className="flex-1 text-sm py-2.5 rounded-lg font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: coachColor.base }}
          >
            Save deadline
          </button>
          <button
            onClick={onCancel}
            className="text-sm py-2.5 px-4 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================
// Shared
// =====================================================

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: tone }}>{icon}</span>
        <span className="text-[11px] text-ink-muted">{label}</span>
      </div>
      <p className="text-xl font-bold text-ink">{value}</p>
    </Card>
  );
}
