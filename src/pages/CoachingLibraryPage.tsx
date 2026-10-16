import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Plus, X, Loader2,
  CheckCircle2, Clock, FileText, Dumbbell, ClipboardList,
  Lightbulb, Video, TrendingUp, Archive,
} from 'lucide-react';
import { PageHeader, PageShell, LoadingState, Badge, EmptyState, Card, Button } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import {
  getArtifacts, updateArtifactStatus, deleteArtifact,
  ARTIFACT_TYPE_LABELS,
  type CoachArtifact,
  type ArtifactStatus,
} from '../services/coachingService';
import { getCoachColor } from '../utils/coachColors';

const ARTIFACT_ICONS: Record<string, React.ReactNode> = {
  reading_material: <BookOpen className="w-4 h-4" />,
  plan: <ClipboardList className="w-4 h-4" />,
  routine: <Dumbbell className="w-4 h-4" />,
  practice_set: <FileText className="w-4 h-4" />,
  worksheet: <FileText className="w-4 h-4" />,
  resource_pick: <Video className="w-4 h-4" />,
  checklist: <CheckCircle2 className="w-4 h-4" />,
  progress_report: <TrendingUp className="w-4 h-4" />,
};

const ARTIFACT_TONES: Record<string, string> = {
  reading_material: 'var(--ds-accent, #3b82f6)',
  plan: 'var(--ds-success, #10b981)',
  routine: 'var(--ds-warning, #f59e0b)',
  practice_set: 'var(--ds-accent, #3b82f6)',
  worksheet: 'var(--ds-accent, #3b82f6)',
  resource_pick: 'var(--ds-warning, #f59e0b)',
  checklist: 'var(--ds-success, #10b981)',
  progress_report: 'var(--ds-accent, #3b82f6)',
};

export function CoachingLibraryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');
  const companionName = searchParams.get('name');

  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<CoachArtifact[]>([]);
  const [filter, setFilter] = useState<'proposed' | 'accepted' | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/splash', { replace: true });
      return;
    }
    const data = await getArtifacts(user.id, companionId, filter === 'all' ? 'all' : filter);
    setArtifacts(data);
  }, [navigate, companionId, filter]);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const handleAccept = async (artifactId: string) => {
    setUpdatingId(artifactId);
    await updateArtifactStatus(artifactId, 'accepted');
    setArtifacts(prev =>
      prev.map(a => a.id === artifactId ? { ...a, status: 'accepted' } : a),
    );
    toast.success('Saved to your library.');
    setUpdatingId(null);
  };

  const handleArchive = async (artifactId: string) => {
    setUpdatingId(artifactId);
    await updateArtifactStatus(artifactId, 'archived');
    setArtifacts(prev => prev.filter(a => a.id !== artifactId));
    toast.info('Archived.');
    setUpdatingId(null);
  };

  const handleDelete = async (artifactId: string) => {
    setUpdatingId(artifactId);
    await deleteArtifact(artifactId);
    setArtifacts(prev => prev.filter(a => a.id !== artifactId));
    toast.info('Deleted.');
    setUpdatingId(null);
  };

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your library..." />
      </PageShell>
    );
  }

  return (
    <PageShell
      header={
        <PageHeader
          title={companionName ? `${companionName} — Library` : 'Coaching Library'}
          subtitle="Reading material, routines, practice sets, and more from your coach"
          icon={BookOpen}
          accent="var(--ds-accent, #3b82f6)"
          actions={
            <button
              onClick={() => navigate(companionId ? '/lobby' : '/coaching-progress')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          }
        />
      }
    >
      {/* Filter tabs */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 text-xs">
          {(['all', 'proposed', 'accepted'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-white/10 text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {f === 'all' ? 'All' : f === 'proposed' ? 'Proposed' : 'Accepted'}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-muted ml-auto">{artifacts.length} shown</span>
      </div>

      {artifacts.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-7 h-7 text-ink-muted" />}
          title="Nothing in your library yet"
          description="Your coach creates reading material, routines, practice sets, and other resources during your conversations. They'll show up here."
          action={companionId
            ? { label: `Chat with ${companionName ?? 'coach'}`, onClick: () => navigate(`/chat?companion=${companionId}`), variant: 'primary' }
            : { label: 'Go to lobby', onClick: () => navigate('/lobby'), variant: 'primary' }
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {artifacts.map(artifact => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                expanded={expandedId === artifact.id}
                onToggleExpand={() => setExpandedId(expandedId === artifact.id ? null : artifact.id)}
                onAccept={() => handleAccept(artifact.id)}
                onArchive={() => handleArchive(artifact.id)}
                onDelete={() => handleDelete(artifact.id)}
                updating={updatingId === artifact.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </PageShell>
  );
}

function ArtifactCard({
  artifact, expanded, onToggleExpand, onAccept, onArchive, onDelete, updating,
}: {
  artifact: CoachArtifact;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onArchive: () => void;
  onDelete: () => void;
  updating: boolean;
}) {
  const typeLabel = ARTIFACT_TYPE_LABELS[artifact.artifact_type] ?? artifact.artifact_type;
  const icon = ARTIFACT_ICONS[artifact.artifact_type] ?? <FileText className="w-4 h-4" />;
  const tone = ARTIFACT_TONES[artifact.artifact_type] ?? 'var(--ds-accent, #3b82f6)';
  const isProposed = artifact.status === 'proposed';
  const content = artifact.content || {};
  const coachColor = getCoachColor(artifact.companion_color);

  return (
    <Card className="overflow-hidden" style={{ borderLeft: `3px solid ${coachColor.base}` }}>
      <button
        onClick={onToggleExpand}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-shrink-0 mt-0.5" style={{ color: tone }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-ink truncate">{artifact.title}</h4>
            {isProposed && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 shrink-0">
                Proposed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>{typeLabel}</span>
            <span>·</span>
            <span>{artifact.companion_name ?? 'Coach'}</span>
            <span>·</span>
            <span>{new Date(artifact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
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
            <div className="px-4 pb-4 pt-1 border-t border-white/5">
              {/* Render content based on type */}
              {content.text && (
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap mb-3">
                  {content.text as string}
                </p>
              )}
              {content.items && Array.isArray(content.items) && (
                <ul className="space-y-1.5 mb-3">
                  {(content.items as Array<Record<string, string>>).map((item, i) => (
                    <li key={i} className="text-sm text-ink leading-relaxed flex gap-2">
                      <span className="text-ink-muted tabular-nums shrink-0">{i + 1}.</span>
                      <span>
                        {item.text ?? item.title ?? ''}
                        {item.note && <span className="text-ink-muted block text-xs mt-0.5">{item.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {content.url && (
                <a
                  href={content.url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-sky-400 hover:text-sky-300 transition-colors mb-3"
                >
                  <Video className="w-3.5 h-3.5" />
                  {content.url as string}
                </a>
              )}
              {content.note && (
                <p className="text-xs text-ink-muted/70 italic mb-3">{content.note as string}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {isProposed && (
                  <Button variant="primary" size="sm" onClick={onAccept} disabled={updating}>
                    {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save to library
                  </Button>
                )}
                <button
                  onClick={onArchive}
                  disabled={updating}
                  className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink px-2 py-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
                <button
                  onClick={onDelete}
                  disabled={updating}
                  className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
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
