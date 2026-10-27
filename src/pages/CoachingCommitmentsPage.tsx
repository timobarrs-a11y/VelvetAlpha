import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, AlertCircle, Trophy,
  Calendar, Plus, X, Trash2, Loader2, Target,
  Clock, PlayCircle, RotateCcw, Sparkles, Layers, ChevronDown, ChevronRight,
  ListChecks, ExternalLink, Pencil, Check,
} from 'lucide-react';
import { PageHeader, PageShell, LoadingState, Badge, EmptyState, Card, Button } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import {
  getCommitments, updateCommitmentStatus, createCommitment, updateProgressNote, deleteCommitment,
  getWeeklyStats, commitmentDueLabel, commitmentStatusColor,
  getPlans, createPlan, updatePlanStepStatus, deletePlan, planProgressPercent,
  createTickEvent, updatePlanStepTitle, respondToPlan, getGoals,
  type CoachingCommitment, type CommitmentStatus,
  type CoachPlan, type StepStatus, type CoachingGoal,
} from '../services/coachingService';
import { getCoachColor } from '../utils/coachColors';
import { useAuth } from '../auth/AuthProvider';
import { useDockCoach } from '../components/dock/DockContext';
import { useCoachHighlight, useCoachingRealtime, HIGHLIGHT_CLASS } from '../components/coaching/coachingHooks';

const COACHING_TABLES = ['user_goals', 'coach_plans', 'coach_plan_steps', 'coaching_commitments'];

const ASK_GOAL = "Let's set my goal. Ask me what I want to achieve and by when.";
const ASK_PLAN = 'Build me a plan for my goal, with concrete steps.';
const ASK_COMMITMENTS = "Turn my plan's next steps into commitments for this week, with dates.";

type Filter = 'active' | 'completed' | 'all';

export function CoachingCommitmentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const companionId = searchParams.get('companion');
  const companionName = searchParams.get('name');

  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<CoachingCommitment[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [progressDraft, setProgressDraft] = useState('');
  const [plans, setPlans] = useState<CoachPlan[]>([]);
  const [goals, setGoals] = useState<CoachingGoal[]>([]);
  // The sidebar links to both views of this one page, so follow the URL.
  const view: 'tasks' | 'plans' = searchParams.get('view') === 'plans' ? 'plans' : 'tasks';
  const setView = (next: 'tasks' | 'plans') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'plans') params.set('view', 'plans'); else params.delete('view');
    setSearchParams(params, { replace: true });
  };
  const { user } = useAuth();
  const { highlighted, flash } = useCoachHighlight();
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/splash', { replace: true });
      return;
    }
    const [comms, planData, goalData] = await Promise.all([
      getCommitments(user.id, companionId),
      getPlans(user.id, companionId),
      getGoals(user.id),
    ]);
    setCommitments(comms);
    setPlans(planData);
    setGoals(goalData.filter(g => g.status === 'active'));
  }, [navigate, companionId]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  useCoachingRealtime(user?.id, COACHING_TABLES, () => { loadData(); });

  const handleCoachChanged = useCallback((ids: string[]) => {
    loadData();
    flash(ids);
  }, [loadData, flash]);

  const stats = getWeeklyStats(commitments);

  const overdue = commitments.filter(c =>
    (c.status === 'pending' || c.status === 'in_progress') &&
    c.due_date && new Date(c.due_date) < new Date()
  );
  const dueToday = commitments.filter(c =>
    (c.status === 'pending' || c.status === 'in_progress') &&
    c.due_date && new Date(c.due_date).toDateString() === new Date().toDateString()
  );
  const dueThisWeek = commitments.filter(c =>
    (c.status === 'pending' || c.status === 'in_progress') &&
    c.due_date &&
    new Date(c.due_date) > new Date() &&
    new Date(c.due_date).toDateString() !== new Date().toDateString() &&
    Math.ceil((new Date(c.due_date).getTime() - Date.now()) / 86400000) <= 7
  );
  const noDeadline = commitments.filter(c =>
    (c.status === 'pending' || c.status === 'in_progress') && !c.due_date
  );
  const completedCommitments = commitments.filter(c => c.status === 'completed');
  const missedCommitments = commitments.filter(c => c.status === 'missed');

  const activeCommitments = commitments.filter(c =>
    c.status === 'pending' || c.status === 'in_progress' || c.status === 'missed'
  );

  const filteredCommitments = filter === 'active'
    ? activeCommitments
    : filter === 'completed'
      ? completedCommitments
      : commitments;

  const handleMarkCompleted = async (commitmentId: string, description: string) => {
    setUpdatingId(commitmentId);
    await updateCommitmentStatus(commitmentId, 'completed');
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await createTickEvent(user.id, {
        eventType: 'commitment_completed',
        targetType: 'commitment',
        targetId: commitmentId,
        companionId: companionId ?? null,
        details: { description },
      });
    }
    // If this commitment is linked to a plan step, also complete the step
    const commitment = commitments.find(c => c.id === commitmentId);
    if (commitment?.plan_step_id) {
      // The database trigger completes the linked step; mirror it locally for instant feedback.
      setPlans(prev => prev.map(p => ({
        ...p,
        steps: (p.steps ?? []).map(s =>
          s.id === commitment.plan_step_id
            ? { ...s, status: 'completed' as StepStatus, completed_at: new Date().toISOString() }
            : s,
        ),
      })));
    }
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId
        ? { ...c, status: 'completed' as CommitmentStatus, completed_at: new Date().toISOString() }
        : c,
      ),
    );
    toast.success('Marked complete. Nice work.');
    setUpdatingId(null);
    void loadData();
  };

  const handleStartProgress = async (commitmentId: string) => {
    setUpdatingId(commitmentId);
    await updateCommitmentStatus(commitmentId, 'in_progress');
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId ? { ...c, status: 'in_progress' as CommitmentStatus } : c),
    );
    setUpdatingId(null);
  };

  const handleRenegotiate = async (commitmentId: string) => {
    setUpdatingId(commitmentId);
    await updateCommitmentStatus(commitmentId, 'renegotiated');
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId ? { ...c, status: 'renegotiated' as CommitmentStatus } : c),
    );
    toast.info('Marked as rescheduled. Talk to your coach about a new plan.');
    setUpdatingId(null);
  };

  const handleDelete = async (commitmentId: string) => {
    setUpdatingId(commitmentId);
    await deleteCommitment(commitmentId);
    setCommitments(prev => prev.filter(c => c.id !== commitmentId));
    toast.info('Task deleted.');
    setUpdatingId(null);
  };

  const handleSaveProgress = async (commitmentId: string, description: string) => {
    setUpdatingId(commitmentId);
    await updateProgressNote(commitmentId, progressDraft);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await createTickEvent(user.id, {
        eventType: 'commitment_progress',
        targetType: 'commitment',
        targetId: commitmentId,
        companionId: companionId ?? null,
        details: { description, note: progressDraft },
      });
    }
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId ? { ...c, progress_note: progressDraft } : c),
    );
    toast.success('Progress saved.');
    setExpandedId(null);
    setUpdatingId(null);
  };

  const handleCreate = async (planStepId: string, description: string, dueDate: string | null, category: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const created = await createCommitment(user.id, {
      planStepId,
      description,
      dueDate,
      companionId: companionId ?? null,
      category,
    });
    if (created) {
      setCommitments(prev => [{ ...created, companion_name: 'You' }, ...prev]);
      toast.success('Task created.');
    } else {
      toast.error('Could not create task. Please try again.');
    }
    setShowCreate(false);
  };

  const handleCreatePlan = async (goalId: string, title: string, cadence: string | null, steps: { title: string; description?: string | null }[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const created = await createPlan(user.id, {
      goalId,
      title,
      companionId: companionId ?? null,
      cadence,
      steps,
    });
    if (created) {
      setPlans(prev => [{ ...created, companion_name: companionName ?? 'You' }, ...prev]);
      toast.success('Plan created.');
    } else {
      toast.error('Could not create plan. Please try again.');
    }
    setShowCreatePlan(false);
  };

  const handleStepToggle = async (stepId: string, current: StepStatus, stepTitle: string) => {
    setUpdatingId(stepId);
    const next: StepStatus = current === 'completed' ? 'pending' : 'completed';
    try {
      await updatePlanStepStatus(stepId, next);
    } catch {
      toast.error('Could not update that step. Please try again.');
      setUpdatingId(null);
      return;
    }
    if (next === 'completed') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await createTickEvent(user.id, {
          eventType: 'step_completed',
          targetType: 'plan_step',
          targetId: stepId,
          companionId: companionId ?? null,
          details: { title: stepTitle },
        });
      }
    }
    setPlans(prev => prev.map(p => ({
      ...p,
      steps: (p.steps ?? []).map(s =>
        s.id === stepId
          ? { ...s, status: next, completed_at: next === 'completed' ? new Date().toISOString() : null }
          : s,
      ),
    })));
    setUpdatingId(null);
    // A linked commitment (and the plan's own status) change in the database; reload to show them.
    void loadData();
  };

  const handleEditStep = async (stepId: string, newTitle: string): Promise<boolean> => {
    try {
      const res = await updatePlanStepTitle(stepId, newTitle);
      if (res.is_below_floor) {
        toast.warning(`That's below your coach's minimum${res.minimum_text ? ` (${res.minimum_text})` : ''}. Saved, but expect them to weigh in.`);
      } else {
        toast.success('Step updated. Your coach will see the change.');
      }
      await loadData();
      return true;
    } catch {
      toast.error('Could not save that edit. Please try again.');
      return false;
    }
  };

  const handleRespondToPlan = async (plan: CoachPlan, accept: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUpdatingId(plan.id);
    try {
      await respondToPlan(user.id, { id: plan.id, title: plan.title, companion_id: plan.companion_id }, accept);
      toast.success(accept ? 'Plan accepted. Your coach will build on it.' : 'Plan declined. Tell your coach what you would change.');
      await loadData();
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setUpdatingId(null);
  };

  const handleDeletePlan = async (planId: string) => {
    setUpdatingId(planId);
    await deletePlan(planId);
    setPlans(prev => prev.filter(p => p.id !== planId));
    toast.info('Plan deleted, along with the commitments built from it.');
    setUpdatingId(null);
    void loadData();
  };

  const proposedPlans = plans.filter(p => p.status === 'proposed');
  const activePlans = plans.filter(p => p.status === 'active' || p.status === 'paused');
  const completedPlans = plans.filter(p => p.status === 'completed');
  const openPlans = [...proposedPlans, ...activePlans];
  // Steps a commitment can be built from: open steps of open plans.
  const stepOptions = openPlans.flatMap(p => (p.steps ?? [])
    .filter(st => st.status !== 'completed' && st.status !== 'skipped')
    .map(st => ({ id: st.id, title: st.user_set_title ?? st.title, planTitle: p.title })));
  const hasGoal = goals.length > 0;
  const hasPlan = openPlans.length > 0;
  const nextAsk = !hasGoal ? ASK_GOAL : !hasPlan ? ASK_PLAN : ASK_COMMITMENTS;

  const quickPrompts = view === 'plans'
    ? (!hasGoal
      ? ['Help me set my goal', 'I want to get fitter', 'I want to learn a skill']
      : !hasPlan
        ? ['Build me a plan for my goal', 'Make the first week easy', 'What should my steps be?']
        : ['Add a step', 'Make this plan easier', 'Make it more challenging', 'Activate my plan'])
    : (!hasGoal
      ? ['Help me set my goal']
      : !hasPlan
        ? ['Build me a plan first']
        : ["Plan this week's commitments", 'Reschedule what I missed', 'What should I do today?']);

  const coach = useDockCoach({
    surface: view === 'plans' ? 'plans' : 'commitments',
    quickPrompts,
    preferredCoachId: companionId,
    onCoachChanged: handleCoachChanged,
  });

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your tasks..." />
      </PageShell>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title={view === 'plans' ? 'Plans' : 'Commitments'}
          subtitle={view === 'plans' ? 'Ordered steps toward your goal' : "Dated things you'll do, built from your plan"}
          icon={view === 'plans' ? Layers : CheckCircle2}
          accent="var(--ds-success, #10b981)"
          back={false}
        />
      }
    >
      <ChainProgress
        goal={goals[0]?.title ?? null}
        planCount={openPlans.length}
        commitmentCount={activeCommitments.length}
        onAsk={coach.ask}
      />

      {/* View toggle: Tasks / Plans */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-white/[0.03] border border-white/8 w-fit">
        <button
          onClick={() => setView('tasks')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'tasks' ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          Tasks
        </button>
        <button
          onClick={() => setView('plans')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'plans' ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Layers className="w-4 h-4" />
          Plans
          {activePlans.length > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-ink-muted">{activePlans.length}</span>
          )}
        </button>
      </div>

      {view === 'plans' ? (
        <PlansView
          plans={plans}
          proposedPlans={proposedPlans}
          activePlans={activePlans}
          onEditStep={handleEditStep}
          onRespondToPlan={handleRespondToPlan}
          completedPlans={completedPlans}
          hasGoal={hasGoal}
          goals={goals}
          highlighted={highlighted}
          onAsk={coach.ask}
          expandedPlanId={expandedPlanId}
          setExpandedPlanId={setExpandedPlanId}
          onStepToggle={handleStepToggle}
          onDeletePlan={handleDeletePlan}
          updatingId={updatingId}
          companionName={companionName}
          showCreatePlan={showCreatePlan}
          setShowCreatePlan={setShowCreatePlan}
          onCreatePlan={handleCreatePlan}
        />
      ) : (
        <>
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MiniStat icon={<CheckCircle2 className="w-4 h-4" />} label="Kept" value={stats.kept} tone="var(--ds-success, #10b981)" />
        <MiniStat icon={<AlertCircle className="w-4 h-4" />} label="Overdue" value={overdue.length} tone="var(--ds-error, #ef4444)" />
        <MiniStat icon={<Clock className="w-4 h-4" />} label="Active" value={activeCommitments.length} tone="var(--ds-accent, #3b82f6)" />
        <MiniStat icon={<Trophy className="w-4 h-4" />} label="Done" value={completedCommitments.length} tone="var(--ds-warning, #f59e0b)" />
      </div>

      {/* New commitment button: commitments come from plan steps */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreate(true)}
          disabled={stepOptions.length === 0}
          title={stepOptions.length === 0 ? 'Commitments come from plan steps. Build a plan first.' : undefined}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-white/25 text-white/50 hover:text-white/80 transition-all text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/50"
        >
          <Plus className="w-4 h-4" />
          Add a commitment from your plan
        </button>
      </div>

      {commitments.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-7 h-7 text-ink-muted" />}
          title={!hasGoal ? 'Start with your goal' : !hasPlan ? 'Build your plan first' : 'No commitments yet'}
          description={!hasGoal
            ? 'Commitments come from a plan, and a plan serves a goal. Set the goal with your coach and the rest follows.'
            : !hasPlan
              ? 'Commitments are built from plan steps. Have your coach lay out the plan, then turn its steps into commitments.'
              : "Turn your plan's next steps into dated commitments. Your coach can do it with you right now."}
          action={{ label: !hasGoal ? 'Set my goal with my coach' : !hasPlan ? 'Build my plan with my coach' : "Plan this week's commitments", onClick: () => coach.ask(nextAsk), variant: 'primary' }}
        />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-1 text-xs">
              {(['active', 'completed', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filter === f
                      ? 'bg-white/10 text-ink'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {f === 'active' ? 'Active' : f === 'completed' ? 'Completed' : 'All'}
                </button>
              ))}
            </div>
            <span className="text-xs text-ink-muted ml-auto">{filteredCommitments.length} shown</span>
          </div>

          {filter === 'active' ? (
            <div className="space-y-6">
              {overdue.length > 0 && (
                <CommitmentSection
                  title="Overdue"
                  icon={<AlertCircle className="w-4 h-4" />}
                  tone="var(--ds-error, #ef4444)"
                  commitments={overdue}
                  expandedId={expandedId}
                  progressDraft={progressDraft}
                  setProgressDraft={setProgressDraft}
                  onExpand={setExpandedId}
                  onComplete={handleMarkCompleted}
                  onStart={handleStartProgress}
                  onRenegotiate={handleRenegotiate}
                  onDelete={handleDelete}
                  onSaveProgress={handleSaveProgress}
                  updatingId={updatingId}
                  highlighted={highlighted}
                />
              )}
              {dueToday.length > 0 && (
                <CommitmentSection
                  title="Due Today"
                  icon={<Clock className="w-4 h-4" />}
                  tone="var(--ds-warning, #f59e0b)"
                  commitments={dueToday}
                  expandedId={expandedId}
                  progressDraft={progressDraft}
                  setProgressDraft={setProgressDraft}
                  onExpand={setExpandedId}
                  onComplete={handleMarkCompleted}
                  onStart={handleStartProgress}
                  onRenegotiate={handleRenegotiate}
                  onDelete={handleDelete}
                  onSaveProgress={handleSaveProgress}
                  updatingId={updatingId}
                  highlighted={highlighted}
                />
              )}
              {dueThisWeek.length > 0 && (
                <CommitmentSection
                  title="This Week"
                  icon={<Calendar className="w-4 h-4" />}
                  tone="var(--ds-accent, #3b82f6)"
                  commitments={dueThisWeek}
                  expandedId={expandedId}
                  progressDraft={progressDraft}
                  setProgressDraft={setProgressDraft}
                  onExpand={setExpandedId}
                  onComplete={handleMarkCompleted}
                  onStart={handleStartProgress}
                  onRenegotiate={handleRenegotiate}
                  onDelete={handleDelete}
                  onSaveProgress={handleSaveProgress}
                  updatingId={updatingId}
                  highlighted={highlighted}
                />
              )}
              {noDeadline.length > 0 && (
                <CommitmentSection
                  title="No Due Date"
                  icon={<Circle className="w-4 h-4" />}
                  tone="var(--ds-muted, #6b7280)"
                  commitments={noDeadline}
                  expandedId={expandedId}
                  progressDraft={progressDraft}
                  setProgressDraft={setProgressDraft}
                  onExpand={setExpandedId}
                  onComplete={handleMarkCompleted}
                  onStart={handleStartProgress}
                  onRenegotiate={handleRenegotiate}
                  onDelete={handleDelete}
                  onSaveProgress={handleSaveProgress}
                  updatingId={updatingId}
                  highlighted={highlighted}
                />
              )}
              {missedCommitments.length > 0 && (
                <CommitmentSection
                  title="Missed"
                  icon={<AlertCircle className="w-4 h-4" />}
                  tone="var(--ds-error, #ef4444)"
                  commitments={missedCommitments}
                  expandedId={expandedId}
                  progressDraft={progressDraft}
                  setProgressDraft={setProgressDraft}
                  onExpand={setExpandedId}
                  onComplete={handleMarkCompleted}
                  onStart={handleStartProgress}
                  onRenegotiate={handleRenegotiate}
                  onDelete={handleDelete}
                  onSaveProgress={handleSaveProgress}
                  updatingId={updatingId}
                  highlighted={highlighted}
                />
              )}
              {activeCommitments.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-sm text-ink font-medium mb-1">All caught up!</p>
                  <p className="text-xs text-ink-muted">No active commitments. Ask your coach for the next ones.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredCommitments.map(commitment => (
                  <CommitmentRow
                    key={commitment.id}
                    commitment={commitment}
                    expanded={expandedId === commitment.id}
                    progressDraft={progressDraft}
                    setProgressDraft={setProgressDraft}
                    onExpand={setExpandedId}
                    onComplete={() => handleMarkCompleted(commitment.id, commitment.description)}
                    onStart={() => handleStartProgress(commitment.id)}
                    onRenegotiate={() => handleRenegotiate(commitment.id)}
                    onDelete={() => handleDelete(commitment.id)}
                    onSaveProgress={() => handleSaveProgress(commitment.id, commitment.description)}
                    updating={updatingId === commitment.id}
                    highlighted={highlighted.has(commitment.id)}
                  />
                ))}
              </AnimatePresence>
              {filteredCommitments.length === 0 && (
                <p className="text-sm text-ink-muted text-center py-8">
                  {filter === 'completed'
                    ? 'No completed tasks yet.'
                    : 'No tasks found.'}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Create task modal */}
      <CreateTaskModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
        defaultCompanionName={companionName}
        stepOptions={stepOptions}
      />
        </>
      )}
    </PageShell>
  );
}

/** Goal → Plan → Commitments, each built on the one before. */
function ChainProgress({ goal, planCount, commitmentCount, onAsk }: {
  goal: string | null;
  planCount: number;
  commitmentCount: number;
  onAsk: (text: string) => void;
}) {
  const stages = [
    { key: 'goal', label: 'Goal', done: !!goal, detail: goal ?? 'Not set yet', ask: ASK_GOAL },
    { key: 'plan', label: 'Plan', done: planCount > 0, detail: planCount > 0 ? `${planCount} open` : 'Needs a goal first', ask: ASK_PLAN },
    { key: 'commitments', label: 'Commitments', done: commitmentCount > 0, detail: commitmentCount > 0 ? `${commitmentCount} active` : 'Built from plan steps', ask: ASK_COMMITMENTS },
  ];
  const nextIndex = stages.findIndex(st => !st.done);

  return (
    <div className="mb-6 grid grid-cols-3 gap-2">
      {stages.map((stage, i) => {
        const isNext = i === nextIndex;
        const locked = nextIndex !== -1 && i > nextIndex;
        return (
          <div
            key={stage.key}
            className={`rounded-xl border p-3 ${isNext ? 'border-pink-400/50 bg-pink-500/10' : 'border-white/8 bg-white/[0.03]'} ${locked ? 'opacity-50' : ''}`}
          >
            <div className="mb-1 flex items-center gap-1.5">
              {stage.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Target className={`h-3.5 w-3.5 ${isNext ? 'text-pink-300' : 'text-ink-muted'}`} />}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{i + 1}. {stage.label}</span>
            </div>
            <p className="truncate text-xs text-ink">{stage.detail}</p>
            {isNext && (
              <button type="button" onClick={() => onAsk(stage.ask)} className="mt-1.5 text-[11px] font-semibold text-pink-300 hover:text-pink-200">
                Do this with my coach →
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: tone }}>
        {icon}
        <span className="text-xl font-bold font-display text-ink">{value}</span>
      </div>
      <span className="text-[10px] text-ink-muted leading-tight">{label}</span>
    </div>
  );
}

function CommitmentSection({
  title, icon, tone, commitments, expandedId, progressDraft, setProgressDraft,
  onExpand, onComplete, onStart, onRenegotiate, onDelete, onSaveProgress, updatingId, highlighted,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  commitments: CoachingCommitment[];
  expandedId: string | null;
  progressDraft: string;
  setProgressDraft: (s: string) => void;
  onExpand: (id: string | null) => void;
  onComplete: (id: string, description: string) => void;
  onStart: (id: string) => void;
  onRenegotiate: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveProgress: (id: string, description: string) => void;
  updatingId: string | null;
  highlighted: Set<string>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: tone }}>{icon}</span>
        <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-ink-muted">({commitments.length})</span>
      </div>
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {commitments.map(commitment => (
            <CommitmentRow
              key={commitment.id}
              commitment={commitment}
              expanded={expandedId === commitment.id}
              progressDraft={progressDraft}
              setProgressDraft={setProgressDraft}
              onExpand={onExpand}
              onComplete={() => onComplete(commitment.id, commitment.description)}
              onStart={() => onStart(commitment.id)}
              onRenegotiate={() => onRenegotiate(commitment.id)}
              onDelete={() => onDelete(commitment.id)}
              onSaveProgress={() => onSaveProgress(commitment.id, commitment.description)}
              updating={updatingId === commitment.id}
              highlighted={highlighted.has(commitment.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CommitmentRow({
  commitment, expanded, progressDraft, setProgressDraft, onExpand,
  onComplete, onStart, onRenegotiate, onDelete, onSaveProgress, updating, highlighted,
}: {
  commitment: CoachingCommitment;
  expanded: boolean;
  progressDraft: string;
  setProgressDraft: (s: string) => void;
  onExpand: (id: string | null) => void;
  onComplete: () => void;
  onStart: () => void;
  onRenegotiate: () => void;
  onDelete: () => void;
  onSaveProgress: () => void;
  updating: boolean;
  highlighted: boolean;
}) {
  const isDone = commitment.status === 'completed';
  const isMissed = commitment.status === 'missed';
  const isRenegotiated = commitment.status === 'renegotiated';
  const isInProgress = commitment.status === 'in_progress';
  const isPending = commitment.status === 'pending';
  const showActions = isPending || isMissed || isInProgress;
  const tone = commitmentStatusColor(commitment.status);
  const coachColor = getCoachColor(commitment.companion_color);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden ${highlighted ? HIGHLIGHT_CLASS : ''}`}
      style={{ borderLeft: `3px solid ${coachColor.base}` }}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => onExpand(expanded ? null : commitment.id)}
          className="flex-shrink-0"
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5" style={{ color: tone }} />
          ) : isMissed ? (
            <AlertCircle className="w-5 h-5" style={{ color: tone }} />
          ) : isInProgress ? (
            <PlayCircle className="w-5 h-5" style={{ color: tone }} />
          ) : (
            <Circle className="w-5 h-5 text-ink-muted" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${isDone ? 'text-ink-muted line-through' : 'text-ink'}`}>
            {commitment.description}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-ink-muted flex-wrap">
            <span className="flex items-center gap-1" style={{ color: coachColor.text }}>
              {commitment.is_user_created && <Sparkles className="w-3 h-3" />}
              {commitment.companion_name ?? 'You'}
            </span>
            <span>·</span>
            <span style={{ color: tone }}>{commitmentDueLabel(commitment.due_date)}</span>
            {isInProgress && (
              <>
                <span>·</span>
                <span style={{ color: tone }} className="font-medium">In Progress</span>
              </>
            )}
            {commitment.category && (
              <>
                <span>·</span>
                <span className="capitalize">{commitment.category}</span>
              </>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {isPending && (
              <button
                onClick={onStart}
                disabled={updating}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-ink-muted hover:text-sky-400 disabled:opacity-50"
                title="Start working on this"
              >
                <PlayCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onComplete}
              disabled={updating}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-ink-muted hover:text-emerald-400 disabled:opacity-50"
              title="Mark complete"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRenegotiate}
              disabled={updating}
              className="text-xs text-ink-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Reschedule"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isDone && (
          <Badge tone={tone} size="xs" className="flex-shrink-0">
            <Trophy className="w-3 h-3 mr-1" /> Done
          </Badge>
        )}

        {isRenegotiated && (
          <Badge tone={tone} size="xs" className="flex-shrink-0">
            Rescheduled
          </Badge>
        )}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/5">
              {/* Progress note */}
              <div className="mb-3">
                <label className="text-xs text-ink-muted mb-1.5 block">Progress Note</label>
                <textarea
                  value={expanded ? progressDraft || commitment.progress_note || '' : commitment.progress_note || ''}
                  onChange={(e) => setProgressDraft(e.target.value)}
                  placeholder="Log an update — what's been done, what's blocking you..."
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg p-3 text-ink text-xs leading-relaxed placeholder:text-ink-muted/50 focus:outline-none focus:border-white/20 transition-all resize-none"
                  rows={2}
                />
                {showActions && (
                  <button
                    onClick={onSaveProgress}
                    disabled={updating}
                    className="mt-1.5 text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50 transition-colors"
                  >
                    Save progress
                  </button>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-3 text-xs text-ink-muted flex-wrap">
                <span>Created {new Date(commitment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                {commitment.completed_at && (
                  <span>· Completed {new Date(commitment.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                )}
                {commitment.extracted_from_message && (
                  <span className="italic text-ink-muted/70">From conversation</span>
                )}
              </div>

              {/* Delete (user-created only) */}
              {commitment.is_user_created && (
                <button
                  onClick={onDelete}
                  disabled={updating}
                  className="mt-2 flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete task
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CreateTaskModal({
  isOpen, onClose, onCreate, defaultCompanionName, stepOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (planStepId: string, description: string, dueDate: string | null, category: string | null) => void;
  defaultCompanionName?: string | null;
  stepOptions: { id: string; title: string; planTitle: string }[];
}) {
  const [stepId, setStepId] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStepId('');
      setDescription('');
      setDueDate('');
      setCategory('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedStep = stepOptions.find(o => o.id === stepId);

  const handleSubmit = () => {
    if (!selectedStep) return;
    const due = dueDate ? new Date(dueDate).toISOString() : null;
    onCreate(selectedStep.id, description.trim() || selectedStep.title, due, category.trim() || null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0d1424] border border-white/10 rounded-2xl max-w-md w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-ink font-display">New Commitment</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted mb-1.5 block">Which plan step is this for?</label>
            <select
              value={stepId}
              onChange={(e) => setStepId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-ink text-sm focus:outline-none focus:border-white/20 transition-all"
              autoFocus
            >
              <option value="">Choose a step…</option>
              {stepOptions.map(o => (
                <option key={o.id} value={o.id}>{o.title} · {o.planTitle}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1.5 block">What exactly will you do? (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={selectedStep ? selectedStep.title : 'e.g. 15 push-ups before work on Monday'}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:border-white/20 transition-all resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-muted mb-1.5 block">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-ink text-sm focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted mb-1.5 block">Category (optional)</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-ink text-sm focus:outline-none focus:border-white/20 transition-all"
              >
                <option value="">None</option>
                <option value="work">Work</option>
                <option value="health">Health</option>
                <option value="personal">Personal</option>
                <option value="creative">Creative</option>
                <option value="social">Social</option>
              </select>
            </div>
          </div>

          {defaultCompanionName && (
            <p className="text-xs text-ink-muted">
              Linked to <span className="text-ink font-medium">{defaultCompanionName}</span>
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!selectedStep}
            >
              Create Commitment
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// =====================================================
// Plans View
// =====================================================

function PlansView({
  plans, proposedPlans, activePlans, completedPlans, hasGoal, goals, highlighted, onAsk, expandedPlanId, setExpandedPlanId,
  onStepToggle, onEditStep, onRespondToPlan, onDeletePlan, updatingId, companionName,
  showCreatePlan, setShowCreatePlan, onCreatePlan,
}: {
  plans: CoachPlan[];
  hasGoal: boolean;
  goals: CoachingGoal[];
  highlighted: Set<string>;
  onAsk: (text: string) => void;
  proposedPlans: CoachPlan[];
  onEditStep: (stepId: string, newTitle: string) => Promise<boolean>;
  onRespondToPlan: (plan: CoachPlan, accept: boolean) => void;
  activePlans: CoachPlan[];
  completedPlans: CoachPlan[];
  expandedPlanId: string | null;
  setExpandedPlanId: (id: string | null) => void;
  onStepToggle: (stepId: string, current: StepStatus, stepTitle: string) => void;
  onDeletePlan: (planId: string) => void;
  updatingId: string | null;
  companionName: string | null;
  showCreatePlan: boolean;
  setShowCreatePlan: (v: boolean) => void;
  onCreatePlan: (goalId: string, title: string, cadence: string | null, steps: { title: string; description?: string | null }[]) => void;
}) {
  const planHighlighted = (plan: CoachPlan) =>
    highlighted.has(plan.id) || (plan.steps ?? []).some(st => highlighted.has(st.id));

  return (
    <div className="space-y-6">
      {/* Create plan CTA: a plan always serves a goal */}
      <div>
        <button
          onClick={() => setShowCreatePlan(true)}
          disabled={!hasGoal}
          title={!hasGoal ? 'A plan serves a goal. Set your goal first.' : undefined}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/15 hover:border-white/25 text-white/50 hover:text-white/80 transition-all text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/15 disabled:hover:text-white/50"
        >
          <Plus className="w-4 h-4" />
          Create a plan yourself
        </button>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-7 h-7 text-ink-muted" />}
          title={hasGoal ? 'No plans yet' : 'Set your goal first'}
          description={hasGoal
            ? 'A plan breaks your goal into ordered steps, each with a real number to hit. Your coach can lay it out with you right now.'
            : 'Every plan serves a goal. Tell your coach what you want to achieve and by when, then build the plan together.'}
          action={hasGoal
            ? { label: 'Build my plan with my coach', onClick: () => onAsk(ASK_PLAN), variant: 'primary' }
            : { label: 'Set my goal with my coach', onClick: () => onAsk(ASK_GOAL), variant: 'primary' }}
        />
      ) : (
        <>
          {proposedPlans.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider px-1">Proposed by your coach</h3>
              {proposedPlans.map(plan => (
                <div key={plan.id} className={`rounded-2xl border border-amber-400/25 ${planHighlighted(plan) ? HIGHLIGHT_CLASS : ''}`}>
                  <PlanCard
                    plan={plan}
                    expanded={expandedPlanId === plan.id || expandedPlanId === null}
                    onToggleExpand={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                    onStepToggle={onStepToggle}
                    onEditStep={onEditStep}
                    onDelete={() => onRespondToPlan(plan, false)}
                    updatingId={updatingId}
                  />
                  <div className="flex items-center gap-2 px-4 pb-3">
                    <p className="flex-1 text-[11px] text-ink-muted">Edit any step to make it yours. Your coach sees your changes.</p>
                    <Button variant="secondary" onClick={() => onRespondToPlan(plan, false)} disabled={updatingId === plan.id}>Decline</Button>
                    <Button variant="primary" onClick={() => onRespondToPlan(plan, true)} disabled={updatingId === plan.id}>Accept plan</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activePlans.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider px-1">Active</h3>
              {activePlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  highlighted={planHighlighted(plan)}
                  expanded={expandedPlanId === plan.id}
                  onToggleExpand={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                  onStepToggle={onStepToggle}
                  onEditStep={onEditStep}
                  onDelete={() => onDeletePlan(plan.id)}
                  updatingId={updatingId}
                />
              ))}
            </div>
          )}
          {completedPlans.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider px-1">Completed</h3>
              {completedPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  highlighted={planHighlighted(plan)}
                  expanded={expandedPlanId === plan.id}
                  onToggleExpand={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                  onStepToggle={onStepToggle}
                  onEditStep={onEditStep}
                  onDelete={() => onDeletePlan(plan.id)}
                  updatingId={updatingId}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CreatePlanModal
        isOpen={showCreatePlan}
        onClose={() => setShowCreatePlan(false)}
        onCreate={onCreatePlan}
        defaultCompanionName={companionName}
        goals={goals}
      />
    </div>
  );
}

function PlanCard({
  plan, expanded, onToggleExpand, onStepToggle, onEditStep, onDelete, updatingId, highlighted = false,
}: {
  plan: CoachPlan;
  highlighted?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onStepToggle: (stepId: string, current: StepStatus, stepTitle: string) => void;
  onEditStep: (stepId: string, newTitle: string) => Promise<boolean>;
  onDelete: () => void;
  updatingId: string | null;
}) {
  const steps = plan.steps ?? [];
  const progress = planProgressPercent(plan);
  const doneCount = steps.filter(s => s.status === 'completed').length;
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (stepId: string, current: string) => {
    setEditingStepId(stepId);
    setEditDraft(current);
  };
  const saveEdit = async (stepId: string) => {
    const text = editDraft.trim();
    if (!text) return;
    setSavingEdit(true);
    const saved = await onEditStep(stepId, text);
    setSavingEdit(false);
    if (saved) setEditingStepId(null);
  };

  return (
    <Card className={`overflow-hidden ${highlighted ? HIGHLIGHT_CLASS : ''}`}>
      <button
        onClick={onToggleExpand}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            <h4 className="text-sm font-semibold text-ink truncate">{plan.title}</h4>
            {plan.cadence && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/8 text-ink-muted shrink-0">{plan.cadence}</span>
            )}
          </div>
          {plan.description && (
            <p className="text-xs text-ink-muted line-clamp-2 mb-2">{plan.description}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full bg-sky-400/70 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-ink-muted tabular-nums">{doneCount}/{steps.length}</span>
          </div>
        </div>
        {expanded
          ? <ChevronDown className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
          : <ChevronRight className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
        }
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2">
              {steps.length === 0 ? (
                <p className="text-xs text-ink-muted py-2">No steps yet. Chat with your coach to add steps to this plan.</p>
              ) : (
                steps.map((step, i) => {
                  const isDone = step.status === 'completed';
                  const isUpdating = updatingId === step.id;
                  const displayTitle = step.user_set_title || step.title;
                  const wasEdited = step.coach_proposed_title && step.user_set_title && step.coach_proposed_title !== step.user_set_title;
                  const isBelowFloor = step.is_below_floor;
                  return (
                    <div key={step.id} className="flex items-start gap-2.5 py-1.5">
                      <button
                        onClick={() => onStepToggle(step.id, step.status, displayTitle)}
                        disabled={isUpdating}
                        className="mt-0.5 shrink-0 transition-colors"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 text-ink-muted animate-spin" />
                        ) : isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-ink-muted hover:text-ink transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        {editingStepId === step.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editDraft}
                              maxLength={300}
                              onChange={e => setEditDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') void saveEdit(step.id);
                                if (e.key === 'Escape') setEditingStepId(null);
                              }}
                              className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-md px-2 py-1 text-xs text-ink focus:outline-none focus:border-white/30"
                              aria-label="Edit step"
                            />
                            <button
                              onClick={() => void saveEdit(step.id)}
                              disabled={savingEdit || !editDraft.trim()}
                              className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                              aria-label="Save step"
                            >
                              {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setEditingStepId(null)} className="p-1 text-ink-muted hover:text-ink" aria-label="Cancel edit">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className={`group text-xs leading-relaxed ${isDone ? 'text-ink-muted line-through' : 'text-ink'}`}>
                            <span className="text-ink-muted mr-1.5 tabular-nums">{i + 1}.</span>
                            {displayTitle}
                            {!isDone && (
                              <button
                                onClick={() => startEdit(step.id, displayTitle)}
                                className="ml-1.5 align-middle text-ink-muted/60 hover:text-ink transition-colors"
                                aria-label="Edit step"
                              >
                                <Pencil className="w-3 h-3 inline" />
                              </button>
                            )}
                          </p>
                        )}
                        {wasEdited && (
                          <p className="text-[10px] text-ink-muted/60 italic mt-0.5">
                            Coach proposed: "{step.coach_proposed_title}"
                          </p>
                        )}
                        {isBelowFloor ? (
                          <p className="text-[10px] text-amber-400/80 mt-0.5">
                            Below your coach's minimum{step.coach_minimum ? ` (${step.coach_minimum})` : ''}. Expect them to weigh in.
                          </p>
                        ) : step.coach_minimum && !isDone ? (
                          <p className="text-[10px] text-ink-muted/60 mt-0.5">Coach minimum: {step.coach_minimum}</p>
                        ) : null}
                        {step.description && (
                          <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">{step.description}</p>
                        )}
                        {step.resource_url && (
                          <a
                            href={step.resource_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Resource
                          </a>
                        )}
                        {step.resource_note && (
                          <p className="text-[11px] text-ink-muted/70 italic mt-0.5">{step.resource_note}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <button
                onClick={onDelete}
                className="mt-2 flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete plan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function CreatePlanModal({
  isOpen, onClose, onCreate, defaultCompanionName, goals,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (goalId: string, title: string, cadence: string | null, steps: { title: string; description?: string | null }[]) => void;
  defaultCompanionName?: string | null;
  goals: CoachingGoal[];
}) {
  const [goalId, setGoalId] = useState('');
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState('');
  const [steps, setSteps] = useState<string[]>(['', '']);

  useEffect(() => {
    if (!isOpen) {
      setGoalId('');
      setTitle('');
      setCadence('');
      setSteps(['', '']);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const chosenGoalId = goalId || (goals.length === 1 ? goals[0].id : '');

  const handleSubmit = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle || !chosenGoalId) return;
    const cleanSteps = steps
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => ({ title: s, description: null }));
    onCreate(chosenGoalId, cleanTitle, cadence.trim() || null, cleanSteps);
  };

  const updateStep = (idx: number, val: string) => {
    setSteps(prev => prev.map((s, i) => i === idx ? val : s));
  };
  const addStep = () => setSteps(prev => [...prev, '']);
  const removeStep = (idx: number) => setSteps(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0d1424] border border-white/10 rounded-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-ink font-display">New Plan</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-ink-muted mb-1.5 block">Goal this plan serves</label>
            <select
              value={chosenGoalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-ink text-sm focus:outline-none focus:border-white/20 transition-all"
            >
              {goals.length !== 1 && <option value="">Choose a goal…</option>}
              {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1.5 block">Plan title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 4-week running progression"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-3 text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:border-white/20 transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1.5 block">Cadence (optional)</label>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl p-2.5 text-ink text-sm focus:outline-none focus:border-white/20 transition-all"
            >
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1.5 block">Steps</label>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted tabular-nums w-5 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => updateStep(idx, e.target.value)}
                    placeholder={`Step ${idx + 1}`}
                    className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg p-2.5 text-ink text-sm placeholder:text-ink-muted/50 focus:outline-none focus:border-white/20 transition-all"
                  />
                  {steps.length > 1 && (
                    <button
                      onClick={() => removeStep(idx)}
                      className="text-ink-muted hover:text-red-400 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addStep}
              className="mt-2 flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add step
            </button>
          </div>

          {defaultCompanionName && (
            <p className="text-xs text-ink-muted">
              Linked to <span className="text-ink font-medium">{defaultCompanionName}</span>
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={!title.trim() || !chosenGoalId}
            >
              Create Plan
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
