import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  DollarSign,
  AlertCircle,
  Activity,
  Zap,
  Target,
  Shield,
  MonitorDot,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Crown,
  BarChart3,
  Gamepad2,
  Star,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { analyticsService } from '../services/analyticsService';
import { useRole } from '../hooks/useRole';

interface DashboardStats {
  dau: number;
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  trialUsers: number;
  totalMessages: number;
  errorCount: number;
  avgSessionDuration: number;
  newUsersToday: number;
  totalCompanions: number;
  messagesPerUser: number;
  conversionRate: number;
}

interface PopularFeature {
  feature: string;
  count: number;
}

interface TierBreakdown {
  tier: string;
  count: number;
  color: string;
  label: string;
}

interface RecentSignup {
  id: string;
  name: string;
  subscription_tier: string;
  created_at: string;
}

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  free:      { label: 'Free',      color: 'text-white/60',  bg: 'bg-white/10' },
  trial:     { label: 'Trial',     color: 'text-cyan-400',  bg: 'bg-cyan-500/20' },
  unlimited: { label: 'Essential', color: 'text-sky-400',   bg: 'bg-sky-500/20' },
  starter:   { label: 'Starter',   color: 'text-green-400', bg: 'bg-green-500/20' },
  plus:      { label: 'Plus',      color: 'text-amber-400', bg: 'bg-amber-500/20' },
  elite:     { label: 'Elite',     color: 'text-rose-400',  bg: 'bg-rose-500/20' },
};

const TIER_COLORS: Record<string, string> = {
  free: '#6b7280',
  trial: '#06b6d4',
  unlimited: '#0ea5e9',
  starter: '#22c55e',
  plus: '#f59e0b',
  elite: '#f43f6b',
};

export function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    dau: 0, totalUsers: 0, premiumUsers: 0, freeUsers: 0, trialUsers: 0,
    totalMessages: 0, errorCount: 0, avgSessionDuration: 0,
    newUsersToday: 0, totalCompanions: 0, messagesPerUser: 0, conversionRate: 0,
  });
  const [popularFeatures, setPopularFeatures] = useState<PopularFeature[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [conversionFunnels, setConversionFunnels] = useState<any>({});
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown[]>([]);
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const now = new Date();
      const startDate = new Date();
      if (selectedPeriod === 'today') startDate.setHours(0, 0, 0, 0);
      else if (selectedPeriod === 'week') startDate.setDate(now.getDate() - 7);
      else startDate.setMonth(now.getMonth() - 1);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [
        { count: totalUsers },
        { count: premiumUsers },
        { count: freeUsers },
        { count: trialUsers },
        { count: totalMessages },
        { count: errorCount },
        { count: newUsersToday },
        { count: totalCompanions },
        { data: activeUsersData },
        { data: tierData },
        { data: recentSignupsData },
      ] = await Promise.all([
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }).in('subscription_tier', ['unlimited', 'starter', 'plus', 'elite']),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'free'),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'trial'),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('error_logs').select('*', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('user_profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('companions').select('*', { count: 'exact', head: true }),
        supabase.from('user_behavior_analytics').select('user_id').gte('created_at', startDate.toISOString()).not('user_id', 'is', null),
        supabase.from('user_profiles').select('subscription_tier').not('subscription_tier', 'is', null),
        supabase.from('user_profiles').select('id, name, subscription_tier, created_at').order('created_at', { ascending: false }).limit(8),
      ]);

      const uniqueActiveUsers = new Set(activeUsersData?.map((d: any) => d.user_id) || []).size;
      const total = totalUsers || 0;
      const premium = premiumUsers || 0;

      const tierCounts: Record<string, number> = {};
      (tierData || []).forEach((row: any) => {
        const t = row.subscription_tier || 'free';
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      });

      const breakdown: TierBreakdown[] = Object.entries(TIER_CONFIG).map(([tier, cfg]) => ({
        tier,
        count: tierCounts[tier] || 0,
        color: cfg.color,
        label: cfg.label,
      })).filter(t => t.count > 0);

      const { data: sessions } = await supabase
        .from('user_behavior_analytics')
        .select('metadata')
        .eq('action_type', 'navigation')
        .eq('action_target', 'session_end')
        .gte('created_at', startDate.toISOString());

      const durations = sessions?.filter((s: any) => s.metadata?.session_duration).map((s: any) => s.metadata.session_duration) || [];
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;

      setStats({
        dau: uniqueActiveUsers,
        totalUsers: total,
        premiumUsers: premium,
        freeUsers: freeUsers || 0,
        trialUsers: trialUsers || 0,
        totalMessages: totalMessages || 0,
        errorCount: errorCount || 0,
        avgSessionDuration: avgDuration,
        newUsersToday: newUsersToday || 0,
        totalCompanions: totalCompanions || 0,
        messagesPerUser: uniqueActiveUsers > 0 ? Math.round((totalMessages || 0) / uniqueActiveUsers) : 0,
        conversionRate: total > 0 ? Math.round((premium / total) * 100) : 0,
      });

      setTierBreakdown(breakdown);
      setRecentSignups((recentSignupsData || []) as RecentSignup[]);

      const features = await analyticsService.getMostPopularFeatures(8);
      setPopularFeatures(features);

      const { data: errors } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);
      setRecentErrors(errors || []);

      const [onboardingFunnel, upgradeFunnel] = await Promise.all([
        analyticsService.getFunnelAnalytics('onboarding'),
        analyticsService.getFunnelAnalytics('upgrade'),
      ]);
      setConversionFunnels({ onboarding: onboardingFunnel, upgrade: upgradeFunnel });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'high':     return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'medium':   return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default:         return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    }
  };

  const maxTier = tierBreakdown.reduce((a, b) => a.count > b.count ? a : b, tierBreakdown[0] || { count: 1 });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4" />
          <p className="text-white/60">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)' }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-white/60 hover:text-white transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">Analytics</h1>
              {lastUpdated && (
                <p className="text-white/40 text-xs mt-0.5">
                  Updated {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => loadAnalytics(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/admin/monitoring')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/20 transition text-sm"
            >
              <MonitorDot className="w-4 h-4" />
              Monitoring
            </button>
            <button
              onClick={() => navigate('/admin/response-quality')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-rose-300 border border-rose-500/30 hover:bg-rose-600/20 transition text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Response Quality
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/admin/users')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sky-300 border border-sky-500/30 hover:bg-sky-600/20 transition text-sm"
              >
                <Shield className="w-4 h-4" />
                Users
              </button>
            )}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
              {(['today', 'week', 'month'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    selectedPeriod === p ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  {p === 'today' ? 'Today' : p === 'week' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Primary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard
            icon={Users}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/15"
            label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            sub={`+${stats.newUsersToday} today`}
            trend="up"
          />
          <KPICard
            icon={Activity}
            iconColor="text-green-400"
            iconBg="bg-green-500/15"
            label="Active Users"
            value={stats.dau.toLocaleString()}
            sub={`${stats.totalUsers > 0 ? Math.round((stats.dau / stats.totalUsers) * 100) : 0}% of total`}
          />
          <KPICard
            icon={DollarSign}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/15"
            label="Premium Users"
            value={stats.premiumUsers.toLocaleString()}
            sub={`${stats.conversionRate}% conversion`}
            trend="up"
          />
          <KPICard
            icon={MessageCircle}
            iconColor="text-rose-400"
            iconBg="bg-rose-500/15"
            label="Messages"
            value={stats.totalMessages.toLocaleString()}
            sub={`${stats.messagesPerUser} avg/user`}
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KPICard
            icon={Clock}
            iconColor="text-sky-400"
            iconBg="bg-sky-500/15"
            label="Avg Session"
            value={formatDuration(stats.avgSessionDuration)}
            sub="per session"
          />
          <KPICard
            icon={Gamepad2}
            iconColor="text-purple-400"
            iconBg="bg-purple-500/15"
            label="Companions"
            value={stats.totalCompanions.toLocaleString()}
            sub={`${stats.totalUsers > 0 ? (stats.totalCompanions / stats.totalUsers).toFixed(1) : 0} per user avg`}
          />
          <KPICard
            icon={AlertCircle}
            iconColor={stats.errorCount > 10 ? 'text-red-400' : 'text-emerald-400'}
            iconBg={stats.errorCount > 10 ? 'bg-red-500/15' : 'bg-emerald-500/15'}
            label="Errors"
            value={stats.errorCount.toLocaleString()}
            sub={stats.errorCount > 0 ? 'Needs attention' : 'All clear'}
            trend={stats.errorCount > 10 ? 'down' : undefined}
          />
          <KPICard
            icon={Star}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/15"
            label="Trial Users"
            value={stats.trialUsers.toLocaleString()}
            sub="in trial period"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Tier Breakdown */}
          <div className="lg:col-span-1 rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-5">
              <Crown className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-white">Tier Breakdown</h2>
            </div>
            {tierBreakdown.length > 0 ? (
              <div className="space-y-3">
                {tierBreakdown
                  .sort((a, b) => b.count - a.count)
                  .map(tier => {
                    const cfg = TIER_CONFIG[tier.tier] || { label: tier.tier, color: 'text-white/60', bg: 'bg-white/10' };
                    const pct = maxTier.count > 0 ? (tier.count / (stats.totalUsers || 1)) * 100 : 0;
                    return (
                      <div key={tier.tier}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-white/50">{tier.count.toLocaleString()} ({Math.round(pct)}%)</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: TIER_COLORS[tier.tier] || '#6b7280',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No tier data yet</p>
            )}
          </div>

          {/* Popular Features */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Popular Features</h2>
            </div>
            {popularFeatures.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {popularFeatures.map((f, i) => {
                  const maxCount = popularFeatures[0]?.count || 1;
                  const pct = (f.count / maxCount) * 100;
                  return (
                    <div key={i} className="p-3 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white capitalize font-medium">{String(f.feature).replace(/_/g, ' ')}</span>
                        <span className="text-white/50">{Number(f.count).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f43f6b, #fb923c)' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No feature usage data yet</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Signups */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">Recent Signups</h2>
              </div>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin/users')}
                  className="text-xs text-white/40 hover:text-white/70 transition flex items-center gap-1"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            {recentSignups.length > 0 ? (
              <div className="space-y-2">
                {recentSignups.map(user => {
                  const cfg = TIER_CONFIG[user.subscription_tier] || TIER_CONFIG.free;
                  return (
                    <div key={user.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 text-sm font-medium" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          {(user.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{user.name || 'Unnamed'}</p>
                          <p className="text-white/30 text-xs">{new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-lg ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No signups yet</p>
            )}
          </div>

          {/* Conversion Funnels */}
          <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2 mb-5">
              <Target className="w-5 h-5 text-pink-400" />
              <h2 className="text-lg font-semibold text-white">Conversion Funnels</h2>
            </div>
            {(conversionFunnels.onboarding?.length > 0 || conversionFunnels.upgrade?.length > 0) ? (
              <div className="space-y-6">
                {conversionFunnels.onboarding?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-3">Onboarding</p>
                    <div className="space-y-2">
                      {conversionFunnels.onboarding.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step.completion_rate >= 80 ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
                            {step.completion_rate >= 80
                              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              : <XCircle className="w-3.5 h-3.5 text-orange-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/80 truncate">{step.step_name}</span>
                              <span className={step.completion_rate >= 80 ? 'text-emerald-400' : 'text-orange-400'}>
                                {Math.round(step.completion_rate)}%
                              </span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${step.completion_rate >= 80 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                style={{ width: `${step.completion_rate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {conversionFunnels.upgrade?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-3">Upgrade Flow</p>
                    <div className="space-y-2">
                      {conversionFunnels.upgrade.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${step.completion_rate >= 50 ? 'bg-blue-500/20' : 'bg-red-500/20'}`}>
                            {step.completion_rate >= 50
                              ? <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/80 truncate">{step.step_name}</span>
                              <span className={step.completion_rate >= 50 ? 'text-blue-400' : 'text-red-400'}>
                                {Math.round(step.completion_rate)}%
                              </span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${step.completion_rate >= 50 ? 'bg-blue-500' : 'bg-red-500'}`}
                                style={{ width: `${step.completion_rate}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No funnel data for this period</p>
            )}
          </div>
        </div>

        {/* Recent Errors */}
        <div className="rounded-2xl border border-white/10 p-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2 mb-5">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Recent Errors</h2>
            {recentErrors.length > 0 && (
              <span className="ml-auto text-xs px-2 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20">
                {recentErrors.length} logged
              </span>
            )}
          </div>
          {recentErrors.length > 0 ? (
            <div className="space-y-2">
              {recentErrors.map((error, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium border flex-shrink-0 ${getSeverityColor(error.severity)}`}>
                    {error.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium">{error.error_type}</span>
                      <span className="text-white/30 text-xs">{new Date(error.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-white/60 text-sm truncate">{error.error_message}</p>
                    {error.page_path && <p className="text-white/30 text-xs mt-1">{error.page_path}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
              <p className="text-sm">No errors recorded for this period</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} style={{ width: '18px', height: '18px' }} />
        </div>
        <span className="text-white/50 text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {sub && (
        <div className="flex items-center gap-1 text-xs text-white/40">
          {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
          {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
          <span className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : ''}>{sub}</span>
        </div>
      )}
    </div>
  );
}
