import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, MessageCircle, NotebookPen, Pin, PinOff, Search, Trash2 } from 'lucide-react';
import { PageHeader, PageShell, LoadingState, EmptyState, Card } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { AtlasMarkdown } from '../components/AtlasMarkdown';
import { useDockOptional } from '../components/dock/DockContext';
import { getGoals, type CoachingGoal } from '../services/coachingService';
import {
  deleteGoalNote, followUpPrompt, listGoalNotes, noteAsText, setNotePinned, sortNotes, type GoalNote,
} from '../services/goalNotesService';

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * What came out of the conversations: the requirements, steps, fees and deadlines a coach or assistant turned up
 * on the way to a goal, kept as short reviews so nothing has to be dug out of a chat again.
 */
export function GoalNotesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dock = useDockOptional();
  const [params, setParams] = useSearchParams();
  const [notes, setNotes] = useState<GoalNote[] | null>(null);
  const [goals, setGoals] = useState<CoachingGoal[]>([]);
  const [query, setQuery] = useState('');
  const goalFilter = params.get('goal');
  const taskFilter = params.get('task');

  const load = useCallback(async () => {
    try { setNotes(await listGoalNotes()); } catch { setNotes([]); toast.error("We couldn't load your notes."); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (user?.id) getGoals(user.id).then(setGoals).catch(() => {}); }, [user?.id]);

  // New notes appear as they are written.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('goal-notes-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goal_notes', filter: `user_id=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, load]);

  const goalTitle = useMemo(() => new Map(goals.map(g => [g.id, g.title])), [goals]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (notes ?? []).filter(n =>
      (!goalFilter || n.goal_id === goalFilter)
      && (!taskFilter || n.commitment_id === taskFilter)
      && (!q || `${n.title} ${n.summary} ${n.key_points.join(' ')}`.toLowerCase().includes(q)));
  }, [notes, goalFilter, taskFilter, query]);

  const goalsWithNotes = useMemo(() => {
    const ids = new Set((notes ?? []).map(n => n.goal_id).filter(Boolean) as string[]);
    return goals.filter(g => ids.has(g.id));
  }, [notes, goals]);

  const togglePin = async (n: GoalNote) => {
    setNotes(prev => prev && sortNotes(prev.map(x => (x.id === n.id ? { ...x, pinned: !n.pinned } : x))));
    try { await setNotePinned(n.id, !n.pinned); } catch { load(); }
  };

  const remove = async (n: GoalNote) => {
    setNotes(prev => prev && prev.filter(x => x.id !== n.id));
    try { await deleteGoalNote(n.id); } catch { load(); toast.error("We couldn't delete that note."); }
  };

  const copy = async (n: GoalNote) => {
    try { await navigator.clipboard.writeText(noteAsText(n)); toast.success('Copied'); } catch { toast.error("We couldn't copy that."); }
  };

  const askMore = (n: GoalNote) => {
    if (dock && n.companion_id && dock.companions.some(c => c.id === n.companion_id)) dock.draftToCompanion(n.companion_id, followUpPrompt(n));
    else navigate('/lobby');
  };

  if (notes === null) return <PageShell center><LoadingState label="Loading your notes..." /></PageShell>;

  return (
    <PageShell header={<PageHeader title="Notes" subtitle="What your coach and assistant turned up, kept for later" icon={NotebookPen} accent="var(--ds-accent, #3b82f6)" back="/coaching-commitments" />}>
      {notes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-7 w-7" />}
          title="No notes yet"
          description="When your coach or assistant gives you real information about your goal, like what a filing needs or how a process works, it is saved here as a short review."
          action={{ label: 'See your tasks', onClick: () => navigate('/coaching-commitments'), variant: 'secondary' }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your notes"
                aria-label="Search your notes"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-white/25 focus:outline-none"
              />
            </label>
          </div>

          {(goalsWithNotes.length > 1 || goalFilter || taskFilter) && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setParams({})} className={`rounded-full px-3 py-1.5 text-xs font-medium ${!goalFilter && !taskFilter ? 'bg-white/12 text-ink' : 'bg-white/5 text-ink-muted hover:text-ink'}`}>All</button>
              {goalsWithNotes.map(g => (
                <button key={g.id} type="button" onClick={() => setParams({ goal: g.id })} className={`rounded-full px-3 py-1.5 text-xs font-medium ${goalFilter === g.id ? 'bg-white/12 text-ink' : 'bg-white/5 text-ink-muted hover:text-ink'}`}>{g.title}</button>
              ))}
              {taskFilter && <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-medium text-ink">For one task</span>}
            </div>
          )}

          {shown.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">Nothing matches.</p>}

          <ul className="space-y-3">
            {shown.map(n => (
              <li key={n.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-ink">{n.title}</h3>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {when(n.created_at)}
                        {n.goal_id && goalTitle.get(n.goal_id) ? ` · ${goalTitle.get(n.goal_id)}` : ''}
                      </p>
                    </div>
                    <button type="button" onClick={() => togglePin(n)} aria-label={n.pinned ? 'Unpin note' : 'Pin note'} className="shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink">
                      {n.pinned ? <Pin className="h-4 w-4 text-amber-300" /> : <PinOff className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="atlas-md mt-3 text-sm leading-relaxed text-ink"><AtlasMarkdown content={n.summary} /></div>

                  {n.key_points.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {n.key_points.map(p => (
                        <li key={p} className="flex gap-2 text-sm text-ink">
                          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {n.next_step && (
                    <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-ink"><span className="font-semibold">Next: </span>{n.next_step}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <button type="button" onClick={() => askMore(n)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-white/5 hover:text-ink">
                      <MessageCircle className="h-3.5 w-3.5" /> Ask more
                    </button>
                    <button type="button" onClick={() => copy(n)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-white/5 hover:text-ink">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button type="button" onClick={() => remove(n)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-300">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </PageShell>
  );
}
