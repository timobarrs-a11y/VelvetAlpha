import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardMode } from '../../../game/momentum/leaderboard';
import { supabase } from '../../../shared/supabase/client';

interface LeaderboardPanelProps {
  mode: LeaderboardMode;
  period: string;
  /** bump to refetch after a submission */
  refreshKey?: number;
}

export function LeaderboardPanel({ mode, period, refreshKey = 0 }: LeaderboardPanelProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => !cancelled && setUserId(data.user?.id ?? null)).catch(() => {});
    fetchLeaderboard(mode, period, 10).then((rows) => !cancelled && setEntries(rows));
    return () => {
      cancelled = true;
    };
  }, [mode, period, refreshKey]);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
      <p className="text-white/40 text-xs tracking-[0.2em] mb-3 text-center">
        {mode === 'daily' ? "TODAY'S FASTEST" : "TODAY'S HIGHEST"}
      </p>
      {entries === null ? (
        <p className="text-white/30 text-sm text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-white/30 text-sm text-center">No runs yet. Be the first!</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((e, i) => (
            <li
              key={e.user_id}
              className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm ${e.user_id === userId ? 'bg-white/15 text-white' : 'text-white/70'}`}
            >
              <span className="w-5 text-white/40">{i + 1}</span>
              <span className="flex-1 truncate">{e.display_name}</span>
              <span className="font-mono">{mode === 'daily' ? `${Number(e.time).toFixed(2)}s` : `${e.score.toLocaleString()}m`}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
