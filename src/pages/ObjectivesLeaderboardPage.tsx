import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Trophy } from 'lucide-react';
import {
  getObjectiveLeaderboard, XP_PER_OBJECTIVE, type LeaderboardPeriod, type LeaderboardRow,
} from '../services/dailyObjectivesService';
import { useDailyObjectives } from '../features/objectives/useDailyObjectives';
import { ReportActivity } from '../features/objectives/ReportActivity';

const PERIODS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'All time' },
];

const PODIUM = ['text-amber-400', 'text-gray-300', 'text-orange-400'];

/** Everyone who's a person, by nickname, ranked by objectives finished. */
export default function ObjectivesLeaderboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { count, total } = useDailyObjectives();

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setFailed(false);
    getObjectiveLeaderboard(period)
      .then(r => { if (!cancelled) setRows(r); })
      .catch(() => { if (!cancelled) { setRows([]); setFailed(true); } });
    return () => { cancelled = true; };
  }, [period, count]);

  return (
    <div className="ds-page text-white h-full overflow-y-auto">
      <ReportActivity activity="check_leaderboard" />
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <button onClick={() => navigate('/lobby')} className="mb-4 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="mb-5 flex items-center gap-3">
          <Trophy className="h-7 w-7 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold leading-tight">Leaderboard</h1>
            <p className="text-sm text-ink-muted">Every objective you finish earns {XP_PER_OBJECTIVE} XP, easy or hard. You&apos;re on {count}/{total}.</p>
          </div>
        </div>

        <div role="tablist" className="mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {PERIODS.map(p => (
            <button
              key={p.id}
              role="tab"
              aria-selected={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${period === p.id ? 'bg-pink-500 text-white' : 'text-ink-muted hover:text-ink'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {rows === null && (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-ink-muted animate-spin" /></div>
        )}
        {failed && <p className="py-10 text-center text-sm text-ink-muted">The leaderboard isn&apos;t available right now.</p>}
        {rows && !failed && rows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="font-semibold">Nobody&apos;s on the board yet.</p>
            <p className="mt-1 text-sm text-ink-muted">Finish an objective from the top bar and you&apos;ll be first.</p>
          </div>
        )}

        {rows && rows.length > 0 && (
          <ol className="space-y-1.5">
            {rows.map((r, i) => {
              // A gap before your own row means you're below the top of the list.
              const gap = i > 0 && r.rank > rows[i - 1].rank + 1;
              return (
                <li key={r.user_id}>
                  {gap && <p className="py-1 text-center text-ink-muted" aria-hidden>…</p>}
                  <button
                    type="button"
                    onClick={() => !r.is_you && navigate(`/member/${r.user_id}`)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                      r.is_you ? 'border-pink-400/60 bg-pink-500/10' : 'border-white/8 bg-white/[0.03] hover:bg-white/[0.07]'
                    }`}
                  >
                    <span className={`w-7 text-center text-sm font-bold ${PODIUM[r.rank - 1] ?? 'text-ink-muted'}`}>{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.nickname}{r.is_you && <span className="ml-2 text-xs font-medium text-pink-300">you</span>}</span>
                    {r.full_days > 0 && <span className="text-[11px] text-ink-muted">{r.full_days} full {r.full_days === 1 ? 'day' : 'days'}</span>}
                    <span className="w-14 text-right text-sm font-bold">{r.xp}<span className="ml-0.5 text-[10px] font-medium text-ink-muted">XP</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
