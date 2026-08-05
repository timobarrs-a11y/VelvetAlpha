import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, MessageCircle, Calendar, Heart, Target, Lightbulb,
  Clock, Flame, BarChart3, Sparkles, CheckCircle2, Circle, ChevronDown,
  ChevronUp, FlaskConical, PenLine, Activity, Info, TrendingDown, Minus,
  Brain, Shield, Users, Star
} from 'lucide-react';
import { FeatureLoadingSplash } from '../components/FeatureLoadingSplash';
import { supabase } from '../shared/supabase/client';
import { useSubscription } from '../hooks/useSubscription';
import { generateInsights } from '../features/insights/engine';
import type { InsightCard, InsightConfidence, ReflectionAtom } from '../features/insights/types';
import { INSIGHT_TEMPLATE_DESCRIPTIONS } from '../features/insights/templates';
import { CBTReflectionModal } from '../components/CBTReflectionModal';
import {
  getRelationshipHealthScore,
  generatePersonalizedInsights,
  getGoalsData,
  getCommunicationPatterns,
} from '../services/enhancedInsightsService';
import type { AIAnalysisResult } from '../services/enhancedInsightsService';

interface InsightsData {
  totalConversations: number;
  totalMessages: number;
  avgConversationLength: number;
  topTopics: Array<{ topic: string; count: number }>;
  sentimentTrend: Array<{ date: string; score: number }>;
  factsLearned: string[];
  goalsMentioned: Array<{ goal: string; count: number }>;
  mostActiveDay: string;
  streak: number;
  insightCards: InsightCard[];
}

interface HealthScore {
  score: number;
  factors: {
    communication: number;
    emotional_support: number;
    engagement: number;
    consistency: number;
  };
  insights: string[];
  trend: 'improving' | 'stable' | 'declining';
}

const STORAGE_KEY = 'insights_expanded_cards';

function getStoredExpandedCards(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveExpandedCards(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

function toUTCDateString(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function InsightsPage() {
  const navigate = useNavigate();
  const { tier, loading: subLoading } = useSubscription();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [personalizedInsights, setPersonalizedInsights] = useState<string[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(getStoredExpandedCards);
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [companionName, setCompanionName] = useState('Your companion');
  const [, setCompanionId] = useState<string | null>(null);
  const [cachedUserId, setCachedUserId] = useState<string | null>(null);
  const [cachedCompanionId, setCachedCompanionId] = useState<string | null>(null);
  const [goalsData, setGoalsData] = useState<Array<{ goal: string; status: 'active' | 'completed' | 'abandoned'; progress: number }>>([]);
  const [communicationPatterns, setCommunicationPatterns] = useState<AIAnalysisResult['communicationPatterns'] | null>(null);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (subLoading) return;
    if (tier !== 'trial' && tier !== 'unlimited' && tier !== 'starter' && tier !== 'plus' && tier !== 'elite' && tier !== 'free') {
      navigate('/lobby');
      return;
    }
    loadInsights();
  }, [tier, subLoading, period]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveExpandedCards(next);
      return next;
    });
  };

  const loadInsights = async () => {
    const isFirst = isFirstLoad.current;
    if (isFirst) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      let uid = cachedUserId;
      let cid = cachedCompanionId;

      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        uid = user.id;
        setCachedUserId(uid);
      }

      if (!cid) {
        const { data: companion } = await supabase
          .from('companions')
          .select('id, name')
          .eq('user_id', uid)
          .maybeSingle();

        if (companion) {
          setCompanionName(companion.name);
          setCompanionId(companion.id);
          setCachedCompanionId(companion.id);
          cid = companion.id;
        }
      }

      const startDate = getStartDate(period);

      const [conversationInsightsResult, atomRowsResult] = await Promise.all([
        supabase
          .from('conversation_insights')
          .select('*')
          .eq('user_id', uid)
          .gte('conversation_date', startDate),
        supabase
          .from('reflection_atoms')
          .select('*')
          .eq('user_id', uid)
          .order('timestamp', { ascending: false })
          .limit(100),
      ]);

      const atoms: ReflectionAtom[] = (atomRowsResult.data || []).map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        situation: r.situation ?? undefined,
        automaticThought: r.automatic_thought ?? undefined,
        emotion: r.emotion ?? undefined,
        emotionIntensity: r.emotion_intensity ?? undefined,
        bodySignal: r.body_signal ?? undefined,
        behavior: r.behavior ?? undefined,
        outcome: r.outcome ?? undefined,
        tags: r.tags ?? undefined,
      }));

      setInsights(processInsights(conversationInsightsResult.data || [], atoms));

      if (cid) {
        const [health, piInsights, goals, commPatterns] = await Promise.all([
          getRelationshipHealthScore(uid, cid),
          generatePersonalizedInsights(uid, cid),
          getGoalsData(uid, cid),
          getCommunicationPatterns(uid, cid),
        ]);
        setHealthScore(health);
        const filtered = piInsights.filter(i => !i.includes('Start chatting') && !i.includes('Unable'));
        setPersonalizedInsights(filtered);
        setGoalsData(goals);
        setCommunicationPatterns(commPatterns);
      }

      isFirstLoad.current = false;
    } catch (error) {
      console.error('Error loading insights:', error);
      setInsights(emptyInsights());
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  const getStartDate = (p: 'week' | 'month' | 'all') => {
    if (p === 'all') return new Date(0).toISOString();
    const now = new Date();
    if (p === 'week') now.setDate(now.getDate() - 7);
    else now.setMonth(now.getMonth() - 1);
    return now.toISOString();
  };

  const emptyInsights = (): InsightsData => ({
    totalConversations: 0,
    totalMessages: 0,
    avgConversationLength: 0,
    topTopics: [],
    sentimentTrend: [],
    factsLearned: [],
    goalsMentioned: [],
    mostActiveDay: 'N/A',
    streak: 0,
    insightCards: generateInsights([]),
  });

  const processInsights = (data: any[], atoms: ReflectionAtom[]): InsightsData => {
    const totalConversations = data.length;
    const totalMessages = data.reduce((sum, item) => sum + (item.message_count || 0), 0);
    const avgConversationLength = totalConversations > 0 ? Math.round(totalMessages / totalConversations) : 0;

    const topicCounts: Record<string, number> = {};
    const allFacts: string[] = [];
    const sentimentByDate: Record<string, number[]> = {};

    data.forEach(item => {
      (item.topics || []).forEach((topic: string) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
      if (item.facts_extracted && Array.isArray(item.facts_extracted)) {
        allFacts.push(...item.facts_extracted);
      }
      if (item.sentiment_score !== null && item.sentiment_score !== undefined) {
        const date = item.conversation_date.slice(0, 10);
        if (!sentimentByDate[date]) sentimentByDate[date] = [];
        sentimentByDate[date].push(item.sentiment_score);
      }
    });

    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sentimentTrend = Object.entries(sentimentByDate)
      .map(([date, scores]) => ({ date, score: scores.reduce((a, b) => a + b, 0) / scores.length }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const dayOfWeekCounts: Record<string, number> = {};
    data.forEach(item => {
      const day = new Date(item.conversation_date).toLocaleDateString('en-US', { weekday: 'long' });
      dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1;
    });
    const mostActiveDay = Object.entries(dayOfWeekCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const uniqueDateStrings = [...new Set(
      data.map(item => toUTCDateString(new Date(item.conversation_date)))
    )];
    const streak = calculateStreak(uniqueDateStrings);

    const insightCards = generateInsights(atoms);

    return {
      totalConversations,
      totalMessages,
      avgConversationLength,
      topTopics,
      sentimentTrend,
      factsLearned: [...new Set(allFacts)].slice(0, 20),
      goalsMentioned: [],
      mostActiveDay,
      streak,
      insightCards,
    };
  };

  const calculateStreak = (utcDateStrings: string[]): number => {
    if (utcDateStrings.length === 0) return 0;
    const sorted = [...utcDateStrings].sort((a, b) => b.localeCompare(a));
    const todayStr = toUTCDateString(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStr = toUTCDateString(yesterdayDate);

    if (sorted[0] !== todayStr && sorted[0] !== yesterdayStr) return 0;

    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1] + 'T00:00:00Z');
      const curr = new Date(sorted[i] + 'T00:00:00Z');
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diffDays === 1) streak++;
      else break;
    }
    return streak;
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.3) return 'text-emerald-400';
    if (score < -0.3) return 'text-red-400';
    return 'text-amber-400';
  };

  const avgSentiment = insights?.sentimentTrend.length
    ? insights.sentimentTrend.reduce((sum, item) => sum + item.score, 0) / insights.sentimentTrend.length
    : 0;

  const topicColors = [
    'from-rose-500 to-pink-500',
    'from-sky-500 to-blue-500',
    'from-amber-500 to-orange-500',
    'from-emerald-500 to-teal-500',
    'from-cyan-500 to-blue-400',
  ];

  const confidenceMeta: Record<InsightConfidence, { label: string; color: string; bgColor: string; borderColor: string; dotColor: string; accentColor: string }> = {
    confirmed: {
      label: 'Confirmed pattern',
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-500/[0.06]',
      borderColor: 'border-emerald-500/20',
      dotColor: 'text-emerald-400',
      accentColor: 'bg-emerald-500',
    },
    early: {
      label: 'Emerging pattern',
      color: 'text-sky-300',
      bgColor: 'bg-sky-500/[0.06]',
      borderColor: 'border-sky-500/20',
      dotColor: 'text-sky-400',
      accentColor: 'bg-sky-500',
    },
    starter: {
      label: 'Starting point',
      color: 'text-white/40',
      bgColor: 'bg-white/[0.03]',
      borderColor: 'border-white/5',
      dotColor: 'text-white/20',
      accentColor: 'bg-white/20',
    },
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    if (score >= 25) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreGradient = (score: number) => {
    if (score >= 75) return 'from-emerald-500 to-teal-400';
    if (score >= 50) return 'from-amber-500 to-yellow-400';
    if (score >= 25) return 'from-orange-500 to-amber-400';
    return 'from-red-500 to-orange-400';
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    if (trend === 'improving') return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    if (trend === 'declining') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-white/40" />;
  };

  const getTrendLabel = (trend: 'improving' | 'stable' | 'declining') => {
    if (trend === 'improving') return <span className="text-emerald-400">Improving</span>;
    if (trend === 'declining') return <span className="text-red-400">Declining</span>;
    return <span className="text-white/40">Stable</span>;
  };

  const FACTOR_ICONS: Record<string, React.ReactNode> = {
    communication: <MessageCircle className="w-3.5 h-3.5" />,
    emotional_support: <Heart className="w-3.5 h-3.5" />,
    engagement: <Activity className="w-3.5 h-3.5" />,
    consistency: <Calendar className="w-3.5 h-3.5" />,
  };

  const FACTOR_LABELS: Record<string, string> = {
    communication: 'Communication',
    emotional_support: 'Emotional Support',
    engagement: 'Engagement',
    consistency: 'Consistency',
  };

  if (initialLoading) {
    return (
      <FeatureLoadingSplash
        icon={Lightbulb}
        label="Loading your insights..."
        accentColor="#38bdf8"
        bgColor="#040d18"
      />
    );
  }

  const hasData = insights && insights.totalConversations > 0;
  const hasHealthData = healthScore && healthScore.score > 0;
  const hasPersonalizedInsights = personalizedInsights.length > 0;
  const hasNoReflections = !insights || insights.insightCards.every(c => c.confidence === 'starter' && c.id.startsWith('starter-'));
  const hasGoals = goalsData.length > 0;
  const hasCommunicationPatterns = communicationPatterns !== null;

  return (
    <div className="min-h-screen bg-[#0a0f1a] relative">
      <CBTReflectionModal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        onSaved={loadInsights}
      />

      <div className="border-b border-white/5 bg-[#0d1424]/90 backdrop-blur-xl sticky top-0 z-10">
        {refreshing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
            <div className="h-full bg-sky-500/70" style={{ width: '40%', animation: 'shimmer 1s ease-in-out infinite' }} />
          </div>
        )}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/lobby')}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <BarChart3 className="w-5 h-5 text-sky-400" />
            <span className="font-bold text-white text-lg">Insights</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setReflectionOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40 transition-all text-xs font-medium"
            >
              <PenLine className="w-3.5 h-3.5" />
              Log Reflection
            </button>

            <div className="flex gap-1 bg-white/5 rounded-lg p-1">
              {(['week', 'month', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                    period === p
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-sky-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Your Insights</h1>
          </div>
          <p className="text-white/40 text-sm ml-11">
            Conversation patterns and everything {companionName} has learned about you
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: MessageCircle, label: 'Conversations', value: insights?.totalConversations || 0, suffix: '', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
            { icon: TrendingUp, label: 'Total Messages', value: insights?.totalMessages || 0, suffix: '', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { icon: Flame, label: 'Chat Streak', value: insights?.streak || 0, suffix: ' days', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
            { icon: Clock, label: 'Avg. Length', value: insights?.avgConversationLength || 0, suffix: ' msgs', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          ].map(({ icon: Icon, label, value, suffix, color, bg }) => (
            <div key={label} className={`rounded-xl p-5 border ${bg} bg-white/[0.03]`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-white/40 text-xs">{label}</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {value}<span className="text-base font-normal text-white/40">{suffix}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Relationship Health Score */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Heart className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white">Relationship Health</h2>
            {hasHealthData && healthScore.trend && (
              <div className="ml-auto flex items-center gap-1.5 text-xs">
                {getTrendIcon(healthScore.trend)}
                {getTrendLabel(healthScore.trend)}
              </div>
            )}
          </div>

          {hasHealthData ? (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex items-center gap-5 shrink-0">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                    <circle
                      cx="48" cy="48" r="38" fill="none"
                      stroke="url(#healthGradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 38}`}
                      strokeDashoffset={`${2 * Math.PI * 38 * (1 - healthScore.score / 100)}`}
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={healthScore.score >= 75 ? '#10b981' : healthScore.score >= 50 ? '#f59e0b' : '#f97316'} />
                        <stop offset="100%" stopColor={healthScore.score >= 75 ? '#14b8a6' : healthScore.score >= 50 ? '#eab308' : '#fb923c'} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-2xl font-bold ${getScoreColor(healthScore.score)}`}>{healthScore.score}</span>
                    <span className="text-white/30 text-xs">/ 100</span>
                  </div>
                </div>
                <div>
                  <p className="text-white/50 text-xs mb-0.5">Overall Score</p>
                  <p className={`text-lg font-semibold ${getScoreColor(healthScore.score)}`}>
                    {healthScore.score >= 75 ? 'Thriving' : healthScore.score >= 50 ? 'Growing' : healthScore.score >= 25 ? 'Building' : 'Getting started'}
                  </p>
                  {healthScore.insights.length > 0 && (
                    <p className="text-white/40 text-xs mt-1 max-w-[160px] leading-relaxed">{healthScore.insights[0]}</p>
                  )}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3">
                {Object.entries(healthScore.factors).map(([key, value]) => (
                  <div key={key} className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`${getScoreColor(value)}`}>{FACTOR_ICONS[key]}</span>
                      <span className="text-white/50 text-xs">{FACTOR_LABELS[key]}</span>
                      <span className={`ml-auto text-xs font-semibold ${getScoreColor(value)}`}>{value}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full bg-gradient-to-r ${getScoreGradient(value)} transition-all duration-700`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Heart className="w-8 h-8 text-white/10" />}
              title="Start chatting to unlock your relationship health score"
              subtitle="Your score is calculated from conversation patterns and AI analysis"
              action={{ label: 'Start a conversation', onClick: () => navigate('/lobby') }}
            />
          )}
        </div>

        {/* AI-Generated Personalized Insights */}
        {hasPersonalizedInsights && (
          <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">AI-Generated Insights</h2>
              <span className="ml-auto text-xs text-sky-400/60 bg-sky-500/10 border border-sky-500/15 px-2 py-0.5 rounded-full">
                Based on your conversations
              </span>
            </div>
            <div className="space-y-2">
              {personalizedInsights.map((insight, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-4"
                >
                  <div className="w-6 h-6 rounded-full bg-sky-500/15 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Star className="w-3 h-3 text-sky-400" />
                  </div>
                  <p className="text-white/75 text-sm leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <Target className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-white">Goals</h2>
            {hasGoals && (
              <span className="ml-auto text-xs text-white/30">
                {goalsData.filter(g => g.status === 'active').length} active
              </span>
            )}
          </div>
          {hasGoals ? (
            <div className="space-y-3">
              {goalsData.map((g, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-white/80 text-sm leading-snug flex-1">{g.goal}</p>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
                      g.status === 'completed'
                        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        : g.status === 'abandoned'
                        ? 'text-white/30 bg-white/5 border-white/10'
                        : 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                    }`}>
                      {g.status}
                    </span>
                  </div>
                  {g.status !== 'abandoned' && (
                    <div className="w-full bg-white/5 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full transition-all duration-700 ${g.status === 'completed' ? 'bg-emerald-500' : 'bg-sky-500'}`}
                        style={{ width: `${Math.max(4, g.progress)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Target className="w-8 h-8 text-white/10" />}
              title="Goals you mention in conversation will appear here"
              subtitle="Start chatting about what you're working toward"
              action={{ label: 'Start a conversation', onClick: () => navigate('/lobby') }}
            />
          )}
        </div>

        {/* Communication Patterns */}
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6 mb-4">
          <div className="flex items-center gap-2 mb-5">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Communication Patterns</h2>
          </div>
          {hasCommunicationPatterns ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: 'Response Pace',
                  value: communicationPatterns.responseTime,
                  color: communicationPatterns.responseTime === 'fast' ? 'text-emerald-400' : communicationPatterns.responseTime === 'slow' ? 'text-amber-400' : 'text-sky-400',
                  bg: communicationPatterns.responseTime === 'fast' ? 'bg-emerald-500/10 border-emerald-500/20' : communicationPatterns.responseTime === 'slow' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-sky-500/10 border-sky-500/20',
                },
                {
                  icon: <Users className="w-4 h-4" />,
                  label: 'Who Initiates',
                  value: communicationPatterns.conversationInitiator,
                  color: communicationPatterns.conversationInitiator === 'balanced' ? 'text-emerald-400' : 'text-sky-400',
                  bg: communicationPatterns.conversationInitiator === 'balanced' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-sky-500/10 border-sky-500/20',
                },
                {
                  icon: <Brain className="w-4 h-4" />,
                  label: 'Topic Depth',
                  value: communicationPatterns.topicDepth,
                  color: communicationPatterns.topicDepth === 'deep' ? 'text-emerald-400' : communicationPatterns.topicDepth === 'shallow' ? 'text-amber-400' : 'text-sky-400',
                  bg: communicationPatterns.topicDepth === 'deep' ? 'bg-emerald-500/10 border-emerald-500/20' : communicationPatterns.topicDepth === 'shallow' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-sky-500/10 border-sky-500/20',
                },
                {
                  icon: <Shield className="w-4 h-4" />,
                  label: 'Openness Level',
                  value: communicationPatterns.vulnerabilityLevel,
                  color: communicationPatterns.vulnerabilityLevel === 'high' ? 'text-emerald-400' : communicationPatterns.vulnerabilityLevel === 'low' ? 'text-amber-400' : 'text-sky-400',
                  bg: communicationPatterns.vulnerabilityLevel === 'high' ? 'bg-emerald-500/10 border-emerald-500/20' : communicationPatterns.vulnerabilityLevel === 'low' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-sky-500/10 border-sky-500/20',
                },
              ].map(({ icon, label, value, color, bg }) => (
                <div key={label} className={`rounded-xl p-4 border ${bg}`}>
                  <div className={`mb-2 ${color}`}>{icon}</div>
                  <div className="text-white/40 text-xs mb-0.5">{label}</div>
                  <div className={`text-sm font-semibold capitalize ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<MessageCircle className="w-8 h-8 text-white/10" />}
              title="Chat patterns will appear here once you have a few conversations"
              action={{ label: 'Start a conversation', onClick: () => navigate('/lobby') }}
            />
          )}
        </div>

        {/* Patterns & Reflections */}
        {insights && insights.insightCards.length > 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6 mb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-white">Patterns & Reflections</h2>
              </div>
              <button
                onClick={() => setReflectionOpen(true)}
                className="flex items-center gap-1.5 text-amber-400/70 hover:text-amber-300 text-xs transition-colors"
              >
                <PenLine className="w-3 h-3" />
                Add entry
              </button>
            </div>
            <p className="text-white/30 text-xs mb-4 ml-6">Based on your CBT reflections</p>

            {hasNoReflections && (
              <div className="mb-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-4 py-3.5 flex items-start gap-3">
                <PenLine className="w-4 h-4 text-amber-400/70 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-amber-200/70 text-xs leading-relaxed">
                    Log your first reflection to unlock personal patterns. It only takes 60 seconds.
                  </p>
                </div>
                <button
                  onClick={() => setReflectionOpen(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-all"
                >
                  Start
                </button>
              </div>
            )}

            <div className="space-y-3" ref={tooltipRef}>
              {insights.insightCards.map((card) => {
                const meta = confidenceMeta[card.confidence];
                const isExpanded = expandedCards.has(card.id);
                const conceptDescription = INSIGHT_TEMPLATE_DESCRIPTIONS[card.templateId];
                const isTooltipOpen = activeTooltip === card.id;

                return (
                  <div
                    key={card.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${meta.bgColor} ${meta.borderColor}`}
                  >
                    <button
                      className="w-full text-left p-4"
                      onClick={() => toggleCard(card.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {card.confidence === 'confirmed' ? (
                            <CheckCircle2 className={`w-4 h-4 ${meta.dotColor}`} />
                          ) : (
                            <Circle className={`w-4 h-4 ${meta.dotColor}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white/85 text-sm font-medium leading-snug">{card.title}</p>
                          <p className="text-white/45 text-xs mt-1 leading-relaxed line-clamp-2">{card.observation}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-flex items-center gap-1 text-xs ${meta.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.accentColor}`} />
                              {meta.label}
                            </span>
                            {conceptDescription && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTooltip(isTooltipOpen ? null : card.id);
                                }}
                                className="ml-1 text-white/20 hover:text-white/50 transition-colors"
                              >
                                <Info className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {isTooltipOpen && conceptDescription && (
                            <div
                              className="mt-2 px-3 py-2 rounded-lg bg-[#0d1424] border border-white/10 text-white/60 text-xs leading-relaxed"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="font-medium text-white/50 mb-1 text-xs uppercase tracking-wider">What this means</p>
                              {conceptDescription}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-white/20 mt-0.5">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
                        <div>
                          <p className="text-white/30 text-xs uppercase tracking-wider mb-1.5">What we're noticing</p>
                          <p className="text-white/65 text-sm leading-relaxed">{card.pattern}</p>
                        </div>
                        <div>
                          <p className="text-white/30 text-xs uppercase tracking-wider mb-1.5">Why it makes sense</p>
                          <p className="text-white/65 text-sm leading-relaxed">{card.whyItMakesSense}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.04] border border-white/8 p-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                            <p className="text-amber-300/70 text-xs uppercase tracking-wider">Try this</p>
                          </div>
                          <p className="text-white/70 text-sm leading-relaxed">{card.experiment}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Top Topics */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Top Topics</h2>
            </div>
            {hasData && insights.topTopics.length > 0 ? (
              <div className="space-y-4">
                {insights.topTopics.map((topic, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-white/80 capitalize font-medium">{topic.topic}</span>
                      <span className="text-white/30">{topic.count} {topic.count === 1 ? 'time' : 'times'}</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-1.5">
                      <div
                        className={`bg-gradient-to-r ${topicColors[i % topicColors.length]} h-1.5 rounded-full transition-all duration-700`}
                        style={{ width: `${(topic.count / (insights.topTopics[0]?.count || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Lightbulb className="w-8 h-8 text-white/10" />}
                title="Start chatting to see your topic trends"
              />
            )}
          </div>

          {/* Mood Trend */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold text-white">Mood Trend</h2>
              {hasData && insights.sentimentTrend.length > 0 && (
                <div className={`ml-auto text-xs font-medium ${getSentimentColor(avgSentiment)}`}>
                  {getSentimentLabel(avgSentiment)} overall
                </div>
              )}
            </div>
            {hasData && insights.sentimentTrend.length > 0 ? (
              <div>
                {/* Mini sparkline */}
                <div className="mb-4 h-16 flex items-end gap-1">
                  {insights.sentimentTrend.slice(-14).map((item, i) => {
                    const height = Math.max(8, Math.abs(item.score) * 56 + 8);
                    const isPositive = item.score >= 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center justify-end group relative"
                        title={`${item.date}: ${getSentimentLabel(item.score)}`}
                      >
                        <div
                          className={`w-full rounded-sm transition-all duration-500 ${isPositive ? 'bg-emerald-500/60' : 'bg-red-500/60'} group-hover:opacity-100 opacity-70`}
                          style={{ height: `${height}px` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2.5">
                  {insights.sentimentTrend.slice(-5).reverse().map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-white/30 text-xs w-20 shrink-0">{item.date}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${item.score > 0.3 ? 'bg-emerald-500' : item.score < -0.3 ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.max(4, Math.abs(item.score) * 100)}%` }}
                        />
                      </div>
                      <span className={`text-xs w-14 text-right shrink-0 ${getSentimentColor(item.score)}`}>
                        {getSentimentLabel(item.score)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Activity className="w-8 h-8 text-white/10" />}
                title="Start chatting to see your mood trends"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Facts Learned */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Target className="w-4 h-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">{companionName} Remembers</h2>
            </div>
            {hasData && insights.factsLearned.length > 0 ? (
              <div
                className="space-y-2 max-h-80 overflow-y-auto pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
              >
                {insights.factsLearned.map((fact, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-white/70 bg-white/[0.04] border border-white/5 rounded-lg p-3">
                    <span className="text-sky-400 mt-0.5 shrink-0">•</span>
                    <span className="leading-relaxed">{fact}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Target className="w-8 h-8 text-white/10" />}
                title={`As you chat, ${companionName} will learn about your interests and preferences`}
              />
            )}
          </div>

          {/* Activity Patterns */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-6">
            <div className="flex items-center gap-2 mb-5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Activity Patterns</h2>
            </div>
            <div className="space-y-5">
              <div>
                <div className="text-xs text-white/40 mb-1">Most Active Day</div>
                <div className="text-lg font-semibold text-white">{insights?.mostActiveDay || 'N/A'}</div>
              </div>

              {insights?.streak && insights.streak > 0 ? (
                <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl p-4 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <div className="text-xs text-orange-200/70">Current Streak</div>
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {insights.streak} <span className="text-base font-normal text-white/40">days</span>
                  </div>
                  <div className="text-xs text-white/30">
                    You've talked with {companionName} {insights.streak} {insights.streak === 1 ? 'day' : 'days'} in a row
                  </div>
                </div>
              ) : (
                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-white/20" />
                    <div className="text-xs text-white/30">No active streak</div>
                  </div>
                  <div className="text-xs text-white/20">Chat daily to build your streak</div>
                </div>
              )}

              {/* Connection quality badge */}
              <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-sky-400/60" />
                  <div className="text-xs text-white/30">Connection quality</div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-xs text-white/50">
                    {hasData
                      ? `${insights.totalConversations} conversation${insights.totalConversations === 1 ? '' : 's'} analyzed`
                      : 'Start chatting to track connection quality'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
      {icon}
      <p className="text-white/30 text-sm max-w-[200px] leading-relaxed">{title}</p>
      {subtitle && <p className="text-white/20 text-xs max-w-[180px] leading-relaxed">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 px-4 py-1.5 rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 text-xs transition-all"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
