import { supabase } from '../shared/supabase/client';

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface PerformanceEntry {
  functionName: string;
  durationMs: number;
  statusCode?: number;
  modelUsed?: string;
  tokensUsed?: number;
  estimatedCostUsd?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertPayload {
  alertType: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

const THRESHOLDS = {
  chatLatencyWarnMs: 8000,
  chatLatencyCriticalMs: 15000,
  errorRateWarnPerHour: 10,
  errorRateCriticalPerHour: 25,
};

class MonitoringService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.initSessionId();
  }

  private initSessionId(): string {
    const existing = sessionStorage.getItem('velvet_session_id');
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem('velvet_session_id', id);
    return id;
  }

  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    return 'Other';
  }

  private getOS(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Other';
  }

  async trackPerformance(entry: PerformanceEntry): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('api_performance_logs').insert({
        function_name: entry.functionName,
        duration_ms: entry.durationMs,
        status_code: entry.statusCode ?? 200,
        user_id: user?.id ?? null,
        model_used: entry.modelUsed ?? null,
        tokens_used: entry.tokensUsed ?? null,
        estimated_cost_usd: entry.estimatedCostUsd ?? null,
        error_message: entry.errorMessage ?? null,
        metadata: entry.metadata ?? {},
      });

      await this.checkLatencyThresholds(entry);
    } catch {
    }
  }

  private async checkLatencyThresholds(entry: PerformanceEntry): Promise<void> {
    if (entry.functionName !== 'chat-turn' && entry.functionName !== 'chat') return;

    if (entry.durationMs > THRESHOLDS.chatLatencyCriticalMs) {
      await this.fireAlert({
        alertType: 'latency_spike',
        severity: 'critical',
        title: 'Critical Chat Latency',
        message: `${entry.functionName} took ${(entry.durationMs / 1000).toFixed(1)}s (threshold: ${THRESHOLDS.chatLatencyCriticalMs / 1000}s)`,
        metadata: { durationMs: entry.durationMs, functionName: entry.functionName },
      });
    } else if (entry.durationMs > THRESHOLDS.chatLatencyWarnMs) {
      await this.fireAlert({
        alertType: 'latency_spike',
        severity: 'warning',
        title: 'High Chat Latency',
        message: `${entry.functionName} took ${(entry.durationMs / 1000).toFixed(1)}s (threshold: ${THRESHOLDS.chatLatencyWarnMs / 1000}s)`,
        metadata: { durationMs: entry.durationMs, functionName: entry.functionName },
      });
    }
  }

  async trackError(params: {
    errorType: 'client_error' | 'server_error' | 'network_error' | 'validation_error' | 'authentication_error' | 'permission_error';
    errorMessage: string;
    errorStack?: string;
    pagePath?: string;
    userAction?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    component?: string;
  }): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('error_logs').insert({
        user_id: user?.id ?? null,
        error_type: params.errorType,
        error_message: params.errorMessage,
        error_stack: params.errorStack ?? '',
        page_path: params.pagePath ?? window.location.pathname,
        user_action: params.userAction ?? '',
        severity: params.severity,
        component: params.component ?? '',
        session_id: this.sessionId,
        browser: this.getBrowser(),
        os: this.getOS(),
        resolved: false,
      });

      if (params.severity === 'critical') {
        await this.fireAlert({
          alertType: 'critical_error',
          severity: 'critical',
          title: `Critical Error: ${params.errorType}`,
          message: params.errorMessage,
          metadata: { component: params.component, pagePath: params.pagePath ?? window.location.pathname },
        });
      }
    } catch {
    }
  }

  async fireAlert(payload: AlertPayload): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.user_role !== 'admin') return;

      await supabase.from('alert_events').insert({
        alert_type: payload.alertType,
        severity: payload.severity,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata ?? {},
        resolved: false,
      });
    } catch {
    }
  }

  async recordHealthCheck(serviceName: string, status: HealthStatus, latencyMs?: number, errorMessage?: string): Promise<void> {
    try {
      await supabase.from('health_checks').insert({
        service_name: serviceName,
        status,
        latency_ms: latencyMs ?? null,
        error_message: errorMessage ?? null,
      });
    } catch {
    }
  }

  async runHealthChecks(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {};

    const dbStart = Date.now();
    try {
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      const latency = Date.now() - dbStart;
      const status: HealthStatus = error ? 'down' : latency > 3000 ? 'degraded' : 'healthy';
      results.database = status;
      await this.recordHealthCheck('database', status, latency, error?.message);
    } catch (e: any) {
      results.database = 'down';
      await this.recordHealthCheck('database', 'down', Date.now() - dbStart, e?.message);
    }

    const authStart = Date.now();
    try {
      const { error } = await supabase.auth.getSession();
      const latency = Date.now() - authStart;
      const status: HealthStatus = error ? 'degraded' : 'healthy';
      results.auth = status;
      await this.recordHealthCheck('auth', status, latency, error?.message);
    } catch (e: any) {
      results.auth = 'down';
      await this.recordHealthCheck('auth', 'down', Date.now() - authStart, e?.message);
    }

    return results;
  }

  measureApiCall<T>(functionName: string, call: () => Promise<{ data: T; status?: number; error?: any }>): Promise<T> {
    const start = Date.now();
    return call().then(async (result) => {
      const durationMs = Date.now() - start;
      await this.trackPerformance({
        functionName,
        durationMs,
        statusCode: result.error ? 500 : (result.status ?? 200),
        errorMessage: result.error?.message,
      });
      if (result.error) throw result.error;
      return result.data;
    }).catch(async (err) => {
      const durationMs = Date.now() - start;
      await this.trackPerformance({
        functionName,
        durationMs,
        statusCode: 500,
        errorMessage: err?.message,
      });
      throw err;
    });
  }

  async resolveAlert(alertId: string): Promise<void> {
    await supabase
      .from('alert_events')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', alertId);
  }

  getSessionId(): string {
    return this.sessionId;
  }
}

export const monitoringService = new MonitoringService();
