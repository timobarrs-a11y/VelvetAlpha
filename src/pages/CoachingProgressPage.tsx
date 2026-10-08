import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, CheckCircle2, Circle, Clock, Flame, TrendingUp,
  Calendar, Brain, Trophy, AlertCircle, ChevronRight, Plus,
  Sparkles, X, Activity, ArrowUp, ArrowDown, Minus, Lock,
} from 'lucide-react';
import { PageHeader, PageShell, Card, Badge, EmptyState, LoadingState } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import { useSubscription } from '../hooks/useSubscription';
import { SUBSCRIPTION_PLANS } from '../types/subscription';
import {
  getCommitments, getGoals, updateCommitmentStatus, updateGoalStatus,
  getWeeklyStats, commitmentDueLabel, commitmentStatusColor,
  goalProgressPercent, goalDaysRemaining, GOAL_TYPE_LABELS,
  getLatestWeeklyReview, markReviewRead,
  getConfidenceChecks, addConfidenceCheck, confidenceTrend,
  type CoachingCommitment, type CoachingGoal, type CommitmentStatus,
  type WeeklyReview, type ConfidenceCheck,
} from '../services/coachingService';

export function CoachingProgressPage() {
  const navigate = useNavigate();
  const { tier } = useSubscription();
  const plan = SUBSCRIPTION_PLANS[tier];
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<CoachingCommitment[]>([]);
  const [goals, setGoals] = useState<CoachingGoal[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [confidenceChecks, setConfidenceChecks] = useState<ConfidenceCheck[]>([]);
  const [showConfidenceInput, setShowConfidenceInput] = useState(false);
  const [confidenceScore, setConfidenceScore] = useState(7);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/splash', { replace: true });
      return;
    }

    const [comms, gls, review, checks] = await Promise.all([
      getCommitments(user.id),
      getGoals(user.id),
      getLatestWeeklyReview(user.id),
      getConfidenceChecks(user.id),
    ]);

    setCommitments(comms);
    setGoals(gls);
    setWeeklyReview(review);
    setConfidenceChecks(checks);
  }, [navigate]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const stats = getWeeklyStats(commitments);

  const activeCommitments = commitments.filter(c => c.status === 'pending' || c.status === 'missed');
  const completedCommitments = commitments.filter(c => c.status === 'completed');
  const filteredCommitments = filter === 'active'
    ? activeCommitments
    : filter === 'completed'
      ? completedCommitments
      : commitments;

  const activeGoals = goals.filter(g => g.status === 'active');
  const goalsAtLimit = activeGoals.length >= plan.maxGoals;
  const commitmentsAtLimit = activeCommitments.length >= plan.maxCommitments;

  const handleMarkCompleted = async (commitmentId: string) => {
    setUpdatingId(commitmentId);
    await updateCommitmentStatus(commitmentId, 'completed');
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId
        ? { ...c, status: 'completed' as CommitmentStatus, completed_at: new Date().toISOString() }
        : c,
      ),
    );
    toast({ type: 'success', message: 'Commitment marked complete. Nice work.' });
    setUpdatingId(null);
  };

  const handleRenegotiate = async (commitmentId: string) => {
    setUpdatingId(commitmentId);
    await updateCommitmentStatus(commitmentId, 'renegotiated');
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId
        ? { ...c, status: 'renegotiated' as CommitmentStatus }
        : c,
      ),
    );
    toast({ type: 'info', message: 'Marked as renegotiated. Talk to your coach about a new plan.' });
    setUpdatingId(null);
  };

  const handleLogConfidence = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await addConfidenceCheck(user.id, confidenceScore);
    const updated = await getConfidenceChecks(user.id);
    setConfidenceChecks(updated);
    setShowConfidenceInput(false);
    toast({ type: 'success', message: 'Confidence check logged.' });
  };

  const handlePauseGoal = async (goalId: string) => {
    await updateGoalStatus(goalId, 'paused');
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, status: 'paused' } : g));
    toast({ type: 'info', message: 'Goal paused.' });
  };

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your progress..." />
      </PageShell>
    );
  }

  const hasNoData = commitments.length === 0 && goals.length === 0;

  return (
    <>
      <PageShell
        header={
          <PageHeader
            title="Coaching Progress"
            subtitle="Your commitments, goals, and momentum"
            icon={Target}
            accent="var(--ds-success, #10b981)"
          />
        }
      >
        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Kept This Week" value={stats.kept} tone="var(--ds-success, #10b981)" />
          <StatCard icon={<AlertCircle className="w-4 h-4" />} label="Missed" value={stats.missed} tone="var(--ds-error, #ef4444)" />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={stats.pending} tone="var(--ds-accent, #3b82f6)" />
          <StatCard icon={<Flame className="w-4 h-4" />} label="Streak" value={stats.streak} tone="var(--ds-warning, #f59e0b)" />
        </div>

        {hasNoData && (
          <Card padding="lg" className="mb-6">
            <EmptyState
              icon={<Brain className="w-7 h-7 text-ink-muted" />}
              title="No coaching activity yet"
              description="Start a conversation with your coach and make a commitment. Your progress will show up here."
              action={{ label: 'Go to coaching', onClick: () => navigate('/lobby'), variant: 'primary' }}
            />
          </Card>
        )}

        {/* Free tier upgrade banner */}
        {tier === 'free' && !hasNoData && (
          <UpgradeBanner
            message={`You're on the free plan: ${plan.maxGoals} goal and ${plan.maxCommitments} commitments. Upgrade for unlimited tracking, weekly reviews, and confidence trends.`}
            onUpgrade={() => navigate('/pricing')}
          />
        )}

        {/* Weekly Review — gated behind paid tier */}
        {plan.hasWeeklyReview && weeklyReview && !reviewDismissed && (
          <WeeklyReviewCard
            review={weeklyReview}
            onDismiss={() => {
              setReviewDismissed(true);
              if (!weeklyReview.read_at) markReviewRead(weeklyReview.id);
            }}
          />
        )}

        {/* Confidence Trend — gated behind paid tier */}
        {plan.hasConfidenceTracking ? (
          <ConfidenceCard
            checks={confidenceChecks}
            showInput={showConfidenceInput}
            score={confidenceScore}
            onScoreChange={setConfidenceScore}
            onLog={handleLogConfidence}
            onToggleInput={() => setShowConfidenceInput(s => !s)}
          />
        ) : (
          <LockedFeatureCard
            icon={<Activity className="w-5 h-5" />}
            title="Confidence Tracking"
            description="Log your confidence over time and see how your motivation trends. Available on Essential and above."
            onUpgrade={() => navigate('/pricing')}
          />
        )}

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4" /> Active Goals
              </h2>
              <span className="text-xs text-ink-muted">
                {activeGoals.length} / {plan.maxGoals === 99 ? '∞' : plan.maxGoals}
              </span>
            </div>
            <div className="space-y-3">
              {activeGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPause={() => handlePauseGoal(goal.id)}
                />
              ))}
            </div>
            {goalsAtLimit && tier === 'free' && (
              <LimitNotice message={`You've reached the free plan limit of ${plan.maxGoals} goal. Pause one or upgrade for more.`} onUpgrade={() => navigate('/pricing')} />
            )}
          </div>
        )}

        {/* Commitments */}
        {commitments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Commitments
              </h2>
              <div className="flex items-center gap-3">
                {tier === 'free' && (
                  <span className="text-xs text-ink-muted">
                    {activeCommitments.length} / {plan.maxCommitments} active
                  </span>
                )}
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
              </div>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredCommitments.map(commitment => (
                  <CommitmentRow
                    key={commitment.id}
                    commitment={commitment}
                    onComplete={() => handleMarkCompleted(commitment.id)}
                    onRenegotiate={() => handleRenegotiate(commitment.id)}
                    updating={updatingId === commitment.id}
                  />
                ))}
              </AnimatePresence>
            </div>

            {filteredCommitments.length === 0 && (
              <p className="text-sm text-ink-muted text-center py-8">
                {filter === 'active'
                  ? 'No active commitments. Talk to your coach to set new ones.'
                  : filter === 'completed'
                    ? 'No completed commitments yet.'
                    : 'No commitments found.'}
              </p>
            )}

            {commitmentsAtLimit && tier === 'free' && (
              <LimitNotice message={`You've reached the free plan limit of ${plan.maxCommitments} active commitments. Complete some or upgrade for more.`} onUpgrade={() => navigate('/pricing')} />
            )}
          </div>
        )}
      </PageShell>
    </>
  );
}

function UpgradeBanner({ message, onUpgrade }: { message: string; onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card padding="md" className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--ds-accent-soft, rgba(59,130,246,0.12))' }}
        >
          <Sparkles className="w-5 h-5" style={{ color: 'var(--ds-accent, #3b82f6)' }} />
        </div>
        <p className="flex-1 text-sm text-ink-muted leading-snug">{message}</p>
        <button
          onClick={onUpgrade}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
          style={{ background: 'var(--ds-accent, #3b82f6)' }}
        >
          Upgrade
        </button>
      </Card>
    </motion.div>
  );
}

function LockedFeatureCard({ icon, title, description, onUpgrade }: { icon: React.ReactNode; title: string; description: string; onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <Card padding="md" className="relative overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="relative">
              {icon}
              <Lock className="w-3 h-3 absolute -bottom-1 -right-1 text-ink-muted" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-ink text-sm mb-1">{title}</h3>
            <p className="text-xs text-ink-muted leading-relaxed mb-3">{description}</p>
            <button
              onClick={onUpgrade}
              className="text-xs font-bold transition-colors hover:opacity-80"
              style={{ color: 'var(--ds-accent, #3b82f6)' }}
            >
              Unlock with upgrade →
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function LimitNotice({ message, onUpgrade }: { message: string; onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-3 flex items-center gap-2 text-xs text-ink-muted"
    >
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--ds-warning, #f59e0b)' }} />
      <span className="flex-1">{message}</span>
      <button onClick={onUpgrade} className="font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--ds-accent, #3b82f6)' }}>
        Upgrade
      </button>
    </motion.div>
  );
}

function WeeklyReviewCard({ review, onDismiss }: { review: WeeklyReview; onDismiss: () => void }) {
  const weekLabel = new Date(review.week_starting).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
  const isNew = !review.read_at;
  const s = review.stats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <Card padding="lg" className="relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: 'linear-gradient(90deg, var(--ds-success, #10b981), var(--ds-accent, #3b82f6))' }}
        />
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--ds-success, #10b981)' }} />
            <h3 className="font-semibold text-ink text-sm">Weekly Review</h3>
            <span className="text-xs text-ink-muted">· Week of {weekLabel}</span>
            {isNew && (
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: 'var(--ds-success, #10b981)', color: '#fff' }}
              >
                New
              </span>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="text-ink-muted hover:text-ink transition-colors p-1 rounded-lg hover:bg-white/5"
            aria-label="Dismiss review"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap mb-4">
          {review.review_text}
        </p>

        {s && (s.commitments_kept !== undefined || s.commitments_missed !== undefined) && (
          <div className="flex items-center gap-4 text-xs text-ink-muted pt-3 border-t border-white/8">
            {s.commitments_kept !== undefined && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--ds-success, #10b981)' }} />
                {s.commitments_kept} kept
              </span>
            )}
            {s.commitments_missed !== undefined && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" style={{ color: 'var(--ds-error, #ef4444)' }} />
                {s.commitments_missed} missed
              </span>
            )}
            {s.sessions_count !== undefined && s.sessions_count > 0 && (
              <span className="flex items-center gap-1">
                <Brain className="w-3 h-3" />
                {s.sessions_count} session{s.sessions_count > 1 ? 's' : ''}
              </span>
            )}
            {s.goals_completed !== undefined && s.goals_completed > 0 && (
              <span className="flex items-center gap-1">
                <Trophy className="w-3 h-3" style={{ color: 'var(--ds-warning, #f59e0b)' }} />
                {s.goals_completed} goal{s.goals_completed > 1 ? 's' : ''} completed
              </span>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function ConfidenceCard({
  checks,
  showInput,
  score,
  onScoreChange,
  onLog,
  onToggleInput,
}: {
  checks: ConfidenceCheck[];
  showInput: boolean;
  score: number;
  onScoreChange: (n: number) => void;
  onLog: () => void;
  onToggleInput: () => void;
}) {
  const trend = confidenceTrend(checks);
  const hasData = checks.length > 0;

  const trendIcon = trend.direction === 'up'
    ? <ArrowUp className="w-3.5 h-3.5" style={{ color: 'var(--ds-success, #10b981)' }} />
    : trend.direction === 'down'
      ? <ArrowDown className="w-3.5 h-3.5" style={{ color: 'var(--ds-error, #ef4444)' }} />
      : <Minus className="w-3.5 h-3.5 text-ink-muted" />;

  const trendLabel = trend.direction === 'up'
    ? `+${trend.delta} since first check`
    : trend.direction === 'down'
      ? `${trend.delta} since first check`
      : 'Steady';

  const sorted = [...checks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const sparkPoints = sorted.slice(-12).map((c, i, arr) => {
    const x = arr.length > 1 ? (i / (arr.length - 1)) * 100 : 50;
    const y = 100 - ((c.score - 1) / 9) * 100;
    return { x, y };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <Card padding="md">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--ds-accent, #3b82f6)' }} />
            <h3 className="font-semibold text-ink text-sm">Confidence Trend</h3>
          </div>
          <button
            onClick={onToggleInput}
            className="text-xs text-ink-muted hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            {showInput ? 'Cancel' : '+ Log check'}
          </button>
        </div>

        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <p className="text-xs text-ink-muted mb-2">How confident are you feeling about your goals right now?</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                value={score}
                onChange={(e) => onScoreChange(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-2xl font-bold font-display text-ink w-10 text-center">{score}</span>
              <button
                onClick={onLog}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: 'var(--ds-accent, #3b82f6)' }}
              >
                Save
              </button>
            </div>
            <div className="flex justify-between text-[10px] text-ink-muted mt-1 px-1">
              <span>Not confident</span>
              <span>Very confident</span>
            </div>
          </motion.div>
        )}

        {hasData ? (
          <>
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-3xl font-bold font-display text-ink">{trend.recent}</span>
                <span className="text-xs text-ink-muted">/ 10</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1 text-xs text-ink-muted">
                  {trendIcon}
                  {trendLabel}
                </div>
                <span className="text-[11px] text-ink-muted">
                  Avg {trend.avg} · {checks.length} check{checks.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {sparkPoints.length >= 2 && (
              <div className="relative h-12 w-full">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                  <polyline
                    points={sparkPoints.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="var(--ds-accent, #3b82f6)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {sparkPoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="2"
                      fill="var(--ds-accent, #3b82f6)"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-muted">
            Log a confidence check to start tracking how your motivation trends over time. Your coach may also ask during sessions.
          </p>
        )}
      </Card>
    </motion.div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <Card padding="sm" className="flex flex-col items-center justify-center text-center">
      <div className="flex items-center gap-1.5 mb-1" style={{ color: tone }}>
        {icon}
        <span className="text-2xl font-bold font-display text-ink">{value}</span>
      </div>
      <span className="text-[11px] text-ink-muted leading-tight">{label}</span>
    </Card>
  );
}

function GoalCard({ goal, onPause }: { goal: CoachingGoal; onPause: () => void }) {
  const pct = goalProgressPercent(goal);
  const daysLeft = goalDaysRemaining(goal);
  const typeLabel = GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type;

  return (
    <Card padding="md" interactive>
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink text-sm truncate">{goal.title}</h3>
          <p className="text-xs text-ink-muted mt-0.5">{typeLabel}</p>
        </div>
        <button
          onClick={onPause}
          className="text-xs text-ink-muted hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
        >
          Pause
        </button>
      </div>

      {goal.target_value && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
            <span>
              {goal.current_value ?? 0} / {goal.target_value} {goal.unit ?? ''}
            </span>
            <span className="font-semibold text-ink">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--ds-success, #10b981)' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-ink-muted">
        {daysLeft !== null && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Due today' : `${Math.abs(daysLeft)}d overdue`}
          </span>
        )}
        {goal.goal_type === 'habit' && (
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Day {Math.floor((Date.now() - new Date(goal.start_date).getTime()) / 86400000) + 1}
          </span>
        )}
      </div>
    </Card>
  );
}

function CommitmentRow({
  commitment,
  onComplete,
  onRenegotiate,
  updating,
}: {
  commitment: CoachingCommitment;
  onComplete: () => void;
  onRenegotiate: () => void;
  updating: boolean;
}) {
  const isDone = commitment.status === 'completed';
  const isMissed = commitment.status === 'missed';
  const isRenegotiated = commitment.status === 'renegotiated';
  const showActions = commitment.status === 'pending' || isMissed;
  const tone = commitmentStatusColor(commitment.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card padding="sm" className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {isDone ? (
            <CheckCircle2 className="w-5 h-5" style={{ color: tone }} />
          ) : isMissed ? (
            <AlertCircle className="w-5 h-5" style={{ color: tone }} />
          ) : (
            <Circle className="w-5 h-5 text-ink-muted" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-snug ${isDone ? 'text-ink-muted line-through' : 'text-ink'}`}>
            {commitment.description}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-ink-muted">
            <span>{commitment.companion_name}</span>
            <span>·</span>
            <span style={{ color: tone }}>{commitmentDueLabel(commitment.due_date)}</span>
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-1 flex-shrink-0">
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
              title="Renegotiate with coach"
            >
              Reschedule
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
      </Card>
    </motion.div>
  );
}
