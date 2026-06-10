import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, AlertTriangle, CheckCircle, Clock,
  RefreshCw, XCircle, Zap, TrendingUp, Server, Database,
  Shield, Bell, BellOff
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { monitoringService, type HealthStatus } from '../services/monitoringService';

interface PerformanceLog {
  id: string;
  function_name: string;
  duration_ms: number;
  status_code: number;
  model_used: string | null;
  error_message: string | null;
  created_at: string;
}

interface AlertEvent {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

interface ErrorLog {
  id: string;
  error_type: string;
  error_message: string;
  severity: string;
  component: string;
  browser: string;
  os: string;
  page_path: string;
  created_at: string;
}

interface MetricSummary {
  avgChatLatencyMs: number;
  p95ChatLatencyMs: number;
  totalCallsLastHour: number;
  errorRateLastHour: number;
  criticalErrorsToday: number;
  openAlerts: number;
}

const REFRESH_INTERVAL_MS = 30_000;

function StatusBadge({ status }: { status: HealthStatus | null }) {
  if (!status) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-400">Unknown</span>;
  const map: Record<HealthStatus, { label: string; cls: string }> = {
    healthy: { label: 'Healthy', cls: 'bg-emerald-500/20 text-emerald-400' },
    degraded: { label: 'Degraded', cls: 'bg-amber-500/20 text-amber-400' },
    down: { label: 'Down', cls: 'bg-red-500/20 text-red-400' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    info: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
    low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[severity] ?? map.low}`}>
      {severity}
    </span>
  );
}

function LatencyBar({ ms, maxMs = 15000 }: { ms: number; maxMs?: number }) {
  const pct = Math.min((ms / maxMs) * 100, 100);
  const color = ms < 4000 ? 'bg-emerald-500' : ms < 8000 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/60 w-16 text-right">{ms.toLocaleString()}ms</span>
    </div>
  );
}

export function MonitoringDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [healthStatuses, setHealthStatuses] = useState<Record<string, HealthStatus | null>>({
    database: null,
    auth: null,
  });
  const [metrics, setMetrics] = useState<MetricSummary>({
    avgChatLatencyMs: 0,
    p95ChatLatencyMs: 0,
    totalCallsLastHour: 0,
    errorRateLastHour: 0,
    criticalErrorsToday: 0,
    openAlerts: 0,
  });
  const [perfLogs, setPerfLogs] = useState<PerformanceLog[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'errors' | 'alerts'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [perfResult, alertResult, errorResult, criticalResult] = await Promise.all([
        supabase
          .from('api_performance_logs')
          .select('*')
          .gte('created_at', oneHourAgo)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('alert_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('error_logs')
          .select('*')
          .gte('created_at', twentyFourHoursAgo)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('error_logs')
          .select('*', { count: 'exact', head: true })
          .in('severity', ['high', 'critical'])
          .gte('created_at', twentyFourHoursAgo),
      ]);

      const perf = perfResult.data ?? [];
      const alerts = alertResult.data ?? [];
      const errors = errorResult.data ?? [];

      setPerfLogs(perf);
      setAlertEvents(alerts);
      setErrorLogs(errors);

      const chatPerf = perf.filter(p => p.function_name === 'chat-turn' || p.function_name === 'chat');
      const chatLatencies = chatPerf.map(p => p.duration_ms).sort((a, b) => a - b);
      const avgLatency = chatLatencies.length
        ? Math.round(chatLatencies.reduce((s, v) => s + v, 0) / chatLatencies.length)
        : 0;
      const p95Index = Math.floor(chatLatencies.length * 0.95);
      const p95Latency = chatLatencies[p95Index] ?? 0;

      const errorCount = perf.filter(p => p.status_code >= 500).length;
      const errorRate = perf.length > 0 ? Math.round((errorCount / perf.length) * 100) : 0;
      const openAlerts = alerts.filter(a => !a.resolved).length;

      setMetrics({
        avgChatLatencyMs: avgLatency,
        p95ChatLatencyMs: p95Latency,
        totalCallsLastHour: perf.length,
        errorRateLastHour: errorRate,
        criticalErrorsToday: criticalResult.count ?? 0,
        openAlerts,
      });

      const latestHealth = await supabase
        .from('health_checks')
        .select('service_name, status')
        .order('checked_at', { ascending: false })
        .limit(10);

      const statusMap: Record<string, HealthStatus | null> = { database: null, auth: null };
      for (const row of latestHealth.data ?? []) {
        if (!statusMap[row.service_name]) {
          statusMap[row.service_name] = row.status as HealthStatus;
        }
      }
      setHealthStatuses(statusMap);

    } catch (err) {
      console.error('Monitoring load error', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const runHealthCheck = async () => {
    const results = await monitoringService.runHealthChecks();
    setHealthStatuses(prev => ({ ...prev, ...results }));
  };

  const resolveAlert = async (id: string) => {
    await monitoringService.resolveAlert(id);
    setAlertEvents(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    setMetrics(prev => ({ ...prev, openAlerts: Math.max(0, prev.openAlerts - 1) }));
  };

  const metricCards = [
    {
      label: 'Avg Chat Latency',
      value: metrics.avgChatLatencyMs ? `${(metrics.avgChatLatencyMs / 1000).toFixed(1)}s` : '—',
      sub: `p95: ${metrics.p95ChatLatencyMs ? `${(metrics.p95ChatLatencyMs / 1000).toFixed(1)}s` : '—'}`,
      icon: Clock,
      status: metrics.avgChatLatencyMs === 0 ? 'neutral' : metrics.avgChatLatencyMs < 5000 ? 'good' : metrics.avgChatLatencyMs < 10000 ? 'warn' : 'bad',
    },
    {
      label: 'API Calls (1h)',
      value: metrics.totalCallsLastHour,
      sub: `${metrics.errorRateLastHour}% error rate`,
      icon: Activity,
      status: metrics.errorRateLastHour < 5 ? 'good' : metrics.errorRateLastHour < 15 ? 'warn' : 'bad',
    },
    {
      label: 'Critical Errors (24h)',
      value: metrics.criticalErrorsToday,
      sub: 'high + critical severity',
      icon: AlertTriangle,
      status: metrics.criticalErrorsToday === 0 ? 'good' : metrics.criticalErrorsToday < 5 ? 'warn' : 'bad',
    },
    {
      label: 'Open Alerts',
      value: metrics.openAlerts,
      sub: metrics.openAlerts === 0 ? 'All clear' : 'Needs attention',
      icon: metrics.openAlerts === 0 ? BellOff : Bell,
      status: metrics.openAlerts === 0 ? 'good' : metrics.openAlerts < 3 ? 'warn' : 'bad',
    },
  ];

  const statusColor = (s: string) => ({
    good: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    neutral: 'text-white/60',
  }[s] ?? 'text-white/60');

  const tabs = ['overview', 'performance', 'errors', 'alerts'] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/analytics')}
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Analytics
            </button>
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Monitoring</h1>
                {metrics.openAlerts > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
                    {metrics.openAlerts} alert{metrics.openAlerts > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/40 mt-0.5">
                Last refreshed {lastRefreshed.toLocaleTimeString()} · auto-refreshes every 30s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runHealthCheck}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-sm"
            >
              <Server className="w-4 h-4" />
              Run Health Check
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-all text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Service Health Strip */}
        <div className="flex items-center gap-3 mb-8 p-4 rounded-xl bg-white/5 border border-white/10">
          <span className="text-sm font-medium text-white/50 mr-2">Services</span>
          {[
            { name: 'database', label: 'Database', icon: Database },
            { name: 'auth', label: 'Auth', icon: Shield },
          ].map(({ name, label, icon: Icon }) => (
            <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
              <Icon className="w-3.5 h-3.5 text-white/40" />
              <span className="text-sm text-white/70">{label}</span>
              <StatusBadge status={healthStatuses[name] ?? null} />
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5">
            <Zap className="w-3.5 h-3.5 text-white/40" />
            <span className="text-sm text-white/70">Edge Functions</span>
            <StatusBadge status={metrics.errorRateLastHour < 20 ? 'healthy' : 'degraded'} />
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metricCards.map(({ label, value, sub, icon: Icon, status }) => (
            <div key={label} className="p-5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</span>
                <Icon className={`w-4 h-4 ${statusColor(status)}`} />
              </div>
              <div className={`text-3xl font-bold mb-1 ${statusColor(status)}`}>{value}</div>
              <div className="text-xs text-white/40">{sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              {tab}
              {tab === 'alerts' && metrics.openAlerts > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-red-500 text-white">
                  {metrics.openAlerts}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Performance */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-white/50" />
                <h2 className="text-base font-semibold text-white">Recent API Calls</h2>
                <span className="ml-auto text-xs text-white/30">last hour</span>
              </div>
              {perfLogs.length === 0 ? (
                <p className="text-sm text-white/30 text-center py-8">No API calls recorded yet</p>
              ) : (
                <div className="space-y-3">
                  {perfLogs.slice(0, 8).map(log => (
                    <div key={log.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {log.status_code >= 500
                            ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            : <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          }
                          <span className="text-sm text-white/80 font-mono">{log.function_name}</span>
                          {log.model_used && (
                            <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{log.model_used}</span>
                          )}
                        </div>
                        <span className="text-xs text-white/30">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                      <LatencyBar ms={log.duration_ms} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Alerts */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2 mb-5">
                <Bell className="w-4 h-4 text-white/50" />
                <h2 className="text-base font-semibold text-white">Active Alerts</h2>
              </div>
              {alertEvents.filter(a => !a.resolved).length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-white/40">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alertEvents.filter(a => !a.resolved).slice(0, 6).map(alert => (
                    <div key={alert.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={alert.severity} />
                          <span className="text-sm font-medium text-white">{alert.title}</span>
                        </div>
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="text-xs text-white/30 hover:text-white/70 transition-colors shrink-0"
                        >
                          Resolve
                        </button>
                      </div>
                      <p className="text-xs text-white/50">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Errors Overview */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 lg:col-span-2">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-4 h-4 text-white/50" />
                <h2 className="text-base font-semibold text-white">Recent Errors</h2>
                <span className="ml-auto text-xs text-white/30">last 24h</span>
              </div>
              {errorLogs.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-white/40">No errors in the last 24 hours</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-white/30 border-b border-white/10">
                        <th className="pb-2 pr-4">Severity</th>
                        <th className="pb-2 pr-4">Type</th>
                        <th className="pb-2 pr-4">Message</th>
                        <th className="pb-2 pr-4">Component</th>
                        <th className="pb-2">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {errorLogs.slice(0, 8).map(err => (
                        <tr key={err.id} className="text-white/70">
                          <td className="py-2.5 pr-4"><SeverityBadge severity={err.severity} /></td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-white/50">{err.error_type}</td>
                          <td className="py-2.5 pr-4 max-w-xs truncate">{err.error_message}</td>
                          <td className="py-2.5 pr-4 text-xs text-white/40">{err.component || '—'}</td>
                          <td className="py-2.5 text-xs text-white/30">{new Date(err.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-4 h-4 text-white/50" />
              <h2 className="text-base font-semibold text-white">API Performance Logs</h2>
              <span className="ml-auto text-xs text-white/30">last hour · {perfLogs.length} calls</span>
            </div>
            {perfLogs.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-12">No performance data recorded yet. Chat activity will populate this table.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-white/30 border-b border-white/10">
                      <th className="pb-3 pr-4">Function</th>
                      <th className="pb-3 pr-4">Latency</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4">Model</th>
                      <th className="pb-3 pr-4">Error</th>
                      <th className="pb-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {perfLogs.map(log => (
                      <tr key={log.id} className={log.status_code >= 500 ? 'text-red-400/80' : 'text-white/70'}>
                        <td className="py-3 pr-4 font-mono text-xs">{log.function_name}</td>
                        <td className="py-3 pr-4 w-40">
                          <LatencyBar ms={log.duration_ms} />
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${log.status_code >= 500 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {log.status_code}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-white/40">{log.model_used || '—'}</td>
                        <td className="py-3 pr-4 text-xs text-red-400/70 max-w-xs truncate">{log.error_message || '—'}</td>
                        <td className="py-3 text-xs text-white/30">{new Date(log.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Errors Tab */}
        {activeTab === 'errors' && (
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-4 h-4 text-white/50" />
              <h2 className="text-base font-semibold text-white">Error Logs</h2>
              <span className="ml-auto text-xs text-white/30">last 24h · {errorLogs.length} errors</span>
            </div>
            {errorLogs.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-white/40">No errors in the last 24 hours</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errorLogs.map(err => (
                  <div key={err.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={err.severity} />
                        <span className="text-xs font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded">{err.error_type}</span>
                        {err.component && (
                          <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{err.component}</span>
                        )}
                      </div>
                      <span className="text-xs text-white/30 shrink-0">{new Date(err.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-white/80 mb-2">{err.error_message}</p>
                    <div className="flex items-center gap-4 text-xs text-white/30">
                      {err.page_path && <span>Page: {err.page_path}</span>}
                      {err.browser && <span>Browser: {err.browser}</span>}
                      {err.os && <span>OS: {err.os}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-4 h-4 text-white/50" />
              <h2 className="text-base font-semibold text-white">All Alerts</h2>
              <span className="ml-auto text-xs text-white/30">{alertEvents.length} total · {metrics.openAlerts} open</span>
            </div>
            {alertEvents.length === 0 ? (
              <div className="text-center py-12">
                <BellOff className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40">No alerts have fired yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertEvents.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border transition-opacity ${
                      alert.resolved
                        ? 'bg-white/3 border-white/5 opacity-50'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <SeverityBadge severity={alert.severity} />
                          <span className="text-sm font-medium text-white">{alert.title}</span>
                          {alert.resolved && (
                            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Resolved</span>
                          )}
                        </div>
                        <p className="text-sm text-white/60">{alert.message}</p>
                        <p className="text-xs text-white/30 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                      </div>
                      {!alert.resolved && (
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-all text-xs font-medium"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
