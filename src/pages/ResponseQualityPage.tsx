import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ThumbsDown, TrendingDown, AlertCircle, MessageSquare } from 'lucide-react';
import { supabase } from '../shared/supabase/client';

interface DislikeRow {
  id: string;
  message_id: string;
  conversation_id: string;
  companion_id: string;
  rating: string;
  reason: string | null;
  regenerated: boolean;
  created_at: string;
  message_content: string | null;
  companion_name: string | null;
}

interface CompanionStat {
  companion_id: string;
  companion_name: string;
  total: number;
  dislikes: number;
  recent_dislikes: number;
  dislike_rate: number;
}

const RECENT_DAYS = 7;

export function ResponseQualityPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dislikes, setDislikes] = useState<DislikeRow[]>([]);
  const [stats, setStats] = useState<CompanionStat[]>([]);
  const [filterCompanion, setFilterCompanion] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: dislikeData, error: dislikeErr } = await supabase
        .from('message_ratings')
        .select(`
          id,
          message_id,
          conversation_id,
          companion_id,
          rating,
          reason,
          regenerated,
          created_at
        `)
        .eq('rating', 'dislike')
        .order('created_at', { ascending: false })
        .limit(200);

      if (dislikeErr) throw new Error(dislikeErr.message);

      const dislikeRows: DislikeRow[] = [];
      const messageIds: string[] = [];
      const companionIds: string[] = [];
      for (const row of dislikeData ?? []) {
        messageIds.push(row.message_id);
        companionIds.push(row.companion_id);
      }

      const messageMap: Record<string, string> = {};
      if (messageIds.length > 0) {
        const { data: msgs } = await supabase
          .from('conversations')
          .select('id, content')
          .in('id', messageIds);
        for (const m of msgs ?? []) {
          messageMap[m.id] = m.content;
        }
      }

      const companionMap: Record<string, string> = {};
      if (companionIds.length > 0) {
        const { data: comps } = await supabase
          .from('companions')
          .select('id, custom_name')
          .in('id', [...new Set(companionIds)]);
        for (const c of comps ?? []) {
          companionMap[c.id] = c.custom_name || 'Companion';
        }
      }

      for (const row of dislikeData ?? []) {
        dislikeRows.push({
          ...row,
          message_content: messageMap[row.message_id] ?? null,
          companion_name: companionMap[row.companion_id] ?? 'Unknown',
        });
      }
      setDislikes(dislikeRows);

      const { data: allRatings, error: statsErr } = await supabase
        .from('message_ratings')
        .select('companion_id, rating, created_at');

      if (statsErr) throw new Error(statsErr.message);

      const byCompanion: Record<string, CompanionStat> = {};
      for (const r of allRatings ?? []) {
        if (!byCompanion[r.companion_id]) {
          byCompanion[r.companion_id] = {
            companion_id: r.companion_id,
            companion_name: companionMap[r.companion_id] ?? 'Unknown',
            total: 0,
            dislikes: 0,
            recent_dislikes: 0,
            dislike_rate: 0,
          };
        }
        const s = byCompanion[r.companion_id];
        s.total += 1;
        if (r.rating === 'dislike') {
          s.dislikes += 1;
          if (new Date(r.created_at) >= new Date(since)) {
            s.recent_dislikes += 1;
          }
        }
      }

      const statList = Object.values(byCompanion).map(s => ({
        ...s,
        dislike_rate: s.total > 0 ? Math.round((s.dislikes / s.total) * 100) : 0,
      }));
      statList.sort((a, b) => b.recent_dislikes - a.recent_dislikes);
      setStats(statList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDislikes = filterCompanion === 'all'
    ? dislikes
    : dislikes.filter(d => d.companion_id === filterCompanion);

  const totalDislikes = stats.reduce((sum, s) => sum + s.dislikes, 0);
  const totalRatings = stats.reduce((sum, s) => sum + s.total, 0);
  const overallRate = totalRatings > 0 ? Math.round((totalDislikes / totalRatings) * 100) : 0;
  const flaggedCount = stats.filter(s => s.recent_dislikes >= 3 && s.recent_dislikes > s.dislikes - s.recent_dislikes).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Response Quality</h1>
            <p className="text-sm text-gray-500">Monitor disliked responses and spot persona regressions</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<ThumbsDown className="w-5 h-5" />} label="Total dislikes" value={totalDislikes} accent="rose" />
          <StatCard icon={<TrendingDown className="w-5 h-5" />} label="Overall dislike rate" value={`${overallRate}%`} accent="amber" />
          <StatCard icon={<AlertCircle className="w-5 h-5" />} label={`Companions flagged (last ${RECENT_DAYS}d)`} value={flaggedCount} accent="blue" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Dislike rate by companion</h2>
              {stats.length === 0 ? (
                <EmptyState text="No ratings yet. As users like and dislike responses, stats will appear here." />
              ) : (
                <div className="space-y-2">
                  {stats.map(s => (
                    <CompanionStatBar key={s.companion_id} stat={s} onSelect={() => setFilterCompanion(s.companion_id)} isActive={filterCompanion === s.companion_id} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Disliked responses</h2>
                {filterCompanion !== 'all' && (
                  <button onClick={() => setFilterCompanion('all')} className="text-xs text-rose-600 hover:text-rose-700 font-medium">
                    Clear filter
                  </button>
                )}
              </div>
              {filteredDislikes.length === 0 ? (
                <EmptyState text="No disliked responses to review yet." />
              ) : (
                <div className="space-y-3">
                  {filteredDislikes.map((d) => (
                    <DislikeCard key={d.id} row={d} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: 'rose' | 'amber' | 'blue' }) {
  const colors = {
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[accent]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function CompanionStatBar({ stat, onSelect, isActive }: { stat: CompanionStat; onSelect: () => void; isActive: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.005 }}
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-xl border p-4 transition-all ${isActive ? 'border-rose-300 ring-2 ring-rose-100' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-gray-800 text-sm">{stat.companion_name}</p>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-400">{stat.total} ratings</span>
          <span className={stat.dislike_rate >= 30 ? 'text-rose-600 font-semibold' : 'text-gray-600'}>
            {stat.dislike_rate}% dislike
          </span>
          {stat.recent_dislikes >= 3 && (
            <span className="flex items-center gap-1 text-rose-600 font-semibold">
              <AlertCircle className="w-3 h-3" />
              {stat.recent_dislikes} in last {RECENT_DAYS}d
            </span>
          )}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${stat.dislike_rate >= 30 ? 'bg-rose-500' : stat.dislike_rate >= 15 ? 'bg-amber-500' : 'bg-emerald-400'}`}
          style={{ width: `${Math.max(stat.dislike_rate, 2)}%` }}
        />
      </div>
    </motion.button>
  );
}

function DislikeCard({ row }: { row: DislikeRow }) {
  const date = new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <p className="text-xs font-semibold text-gray-700">{row.companion_name}</p>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">{date}</span>
      </div>
      {row.message_content && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-2 line-clamp-3">
          {row.message_content}
        </p>
      )}
      {row.reason ? (
        <div className="flex items-start gap-2 text-sm">
          <ThumbsDown className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-gray-700">{row.reason}</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">No reason provided</p>
      )}
      {row.regenerated && (
        <span className="inline-block mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          Regenerated by user
        </span>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
