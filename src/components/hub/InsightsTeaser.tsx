import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageCircle, Flame, TrendingUp, Lightbulb,
  ArrowRight, Sparkles,
} from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import { useSubscription } from '../../hooks/useSubscription';

interface TeaserData {
  totalConversations: number;
  totalMessages: number;
  streak: number;
  topTopic: string | null;
}

const emptyData: TeaserData = {
  totalConversations: 0,
  totalMessages: 0,
  streak: 0,
  topTopic: null,
};

function toUTCDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function calculateStreak(utcDateStrings: string[]): number {
  if (utcDateStrings.length === 0) return 0;
  const sorted = [...utcDateStrings].sort((a, b) => b.localeCompare(a));
  const todayStr = toUTCDateString(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayStr = toUTCDateString(yesterdayDate);
  if (sorted[0] !== todayStr && sorted[0] !== yesterdayStr) return 0;
  let streak = 0;
  let prevDate: Date | null = null;
  for (const ds of sorted) {
    const d = new Date(ds + 'T00:00:00Z');
    if (prevDate) {
      const diff = Math.round((prevDate.getTime() - d.getTime()) / 86400000);
      if (diff !== 1) break;
    }
    streak++;
    prevDate = d;
  }
  return streak;
}

export function InsightsTeaser() {
  const navigate = useNavigate();
  const { tier, loading: subLoading } = useSubscription();
  const [data, setData] = useState<TeaserData>(emptyData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subLoading) return;
    if (tier !== 'trial' && tier !== 'unlimited' && tier !== 'starter' && tier !== 'plus' && tier !== 'elite' && tier !== 'free') return;
    loadTeaser();
  }, [tier, subLoading]);

  const loadTeaser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: rows, error } = await supabase
        .from('conversation_insights')
        .select('conversation_date, message_count, topics')
        .eq('user_id', user.id)
        .gte('conversation_date', weekAgo.toISOString());

      if (error || !rows) {
        setData(emptyData);
        return;
      }

      const totalConversations = rows.length;
      const totalMessages = rows.reduce((sum, r) => sum + (r.message_count || 0), 0);

      const topicCounts: Record<string, number> = {};
      rows.forEach(r => {
        (r.topics || []).forEach((t: string) => {
          topicCounts[t] = (topicCounts[t] || 0) + 1;
        });
      });
      const topTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const uniqueDates = [...new Set(
        rows.map(r => toUTCDateString(new Date(r.conversation_date)))
      )];
      const streak = calculateStreak(uniqueDates);

      setData({ totalConversations, totalMessages, streak, topTopic });
    } catch (err) {
      console.error('Error loading insights teaser:', err);
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      icon: <MessageCircle className="w-4 h-4" />,
      label: 'Conversations',
      value: data.totalConversations,
      color: 'text-sky-300',
      bg: 'bg-sky-500/10',
    },
    {
      icon: <TrendingUp className="w-4 h-4" />,
      label: 'Messages',
      value: data.totalMessages,
      color: 'text-emerald-300',
      bg: 'bg-emerald-500/10',
    },
    {
      icon: <Flame className="w-4 h-4" />,
      label: 'Day streak',
      value: data.streak,
      color: 'text-amber-300',
      bg: 'bg-amber-500/10',
    },
    {
      icon: <Lightbulb className="w-4 h-4" />,
      label: 'Top topic',
      value: data.topTopic ?? '—',
      color: 'text-rose-300',
      bg: 'bg-rose-500/10',
    },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-display">Insights</h2>
            <p className="text-xs text-white/50">Your conversation patterns this week</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl p-5 border border-white/8"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-3 ${card.color}`}>
                {card.icon}
              </div>
              <p className="text-2xl font-bold text-white font-display leading-tight">
                {typeof card.value === 'number' ? card.value : card.value}
              </p>
              <p className="text-xs text-white/50 mt-0.5">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* See full insights */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/insights')}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-white/10 hover:border-white/20 transition-colors group"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-primary-300" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">See full insights</p>
              <p className="text-xs text-white/50">Deep dive into patterns, goals & reflections</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
        </motion.button>
      </div>
    </div>
  );
}
