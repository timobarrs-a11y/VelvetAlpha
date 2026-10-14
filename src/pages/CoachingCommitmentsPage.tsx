import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, CheckCircle2, Circle, AlertCircle, Trophy,
  Calendar,
} from 'lucide-react';
import { PageHeader, PageShell, LoadingState, Badge, EmptyState } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import {
  getCommitments, updateCommitmentStatus, getWeeklyStats,
  commitmentDueLabel, commitmentStatusColor,
  type CoachingCommitment, type CommitmentStatus,
} from '../services/coachingService';

export function CoachingCommitmentsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [commitments, setCommitments] = useState<CoachingCommitment[]>([]);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/splash', { replace: true });
      return;
    }
    const comms = await getCommitments(user.id);
    setCommitments(comms);
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

  const handleMarkCompleted = async (commitmentId: string) => {
    setUpdatingId(commitmentId);
    await updateCommitmentStatus(commitmentId, 'completed');
    setCommitments(prev =>
      prev.map(c => c.id === commitmentId
        ? { ...c, status: 'completed' as CommitmentStatus, completed_at: new Date().toISOString() }
        : c,
      ),
    );
    toast.success('Commitment marked complete. Nice work.');
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
    toast.info('Marked as renegotiated. Talk to your coach about a new plan.');
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading commitments..." />
      </PageShell>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title="Commitments"
          subtitle="Your active and completed commitments"
          icon={CheckCircle2}
          accent="var(--ds-success, #10b981)"
          actions={
            <button
              onClick={() => navigate('/coaching-progress')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Progress
            </button>
          }
        />
      }
    >
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <MiniStat icon={<CheckCircle2 className="w-4 h-4" />} label="Kept" value={stats.kept} tone="var(--ds-success, #10b981)" />
        <MiniStat icon={<AlertCircle className="w-4 h-4" />} label="Missed" value={stats.missed} tone="var(--ds-error, #ef4444)" />
        <MiniStat icon={<Calendar className="w-4 h-4" />} label="Pending" value={stats.pending} tone="var(--ds-accent, #3b82f6)" />
        <MiniStat icon={<Trophy className="w-4 h-4" />} label="Done" value={completedCommitments.length} tone="var(--ds-warning, #f59e0b)" />
      </div>

      {commitments.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-7 h-7 text-ink-muted" />}
          title="No commitments yet"
          description="Start a conversation with your coach and make a commitment. They'll show up here so you can track and complete them."
          action={{ label: 'Go to coaching', onClick: () => navigate('/lobby'), variant: 'primary' }}
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

          {/* Commitment list */}
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
        </>
      )}
    </PageShell>
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
      className="rounded-xl border border-white/8 bg-white/[0.03] flex items-center gap-3 p-4"
    >
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
    </motion.div>
  );
}
