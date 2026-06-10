import { supabase } from '../shared/supabase/client';

export interface BehaviorEvent {
  action_type: 'page_view' | 'feature_used' | 'button_clicked' | 'message_sent' | 'form_submitted' | 'error_occurred' | 'navigation';
  action_target: string;
  page_path: string;
  referrer?: string;
  metadata?: Record<string, any>;
}

export interface FeatureUsage {
  feature_name: 'chat' | 'insights' | 'calendar' | 'stories' | 'games_checkers' | 'games_pacman' | 'games_stellar_pursuit' | 'games_momentum' | 'avatar_creator' | 'video_watch' | 'companion_creation';
  usage_count: number;
  total_time_spent_seconds: number;
  last_used_at: string;
}

export interface BusinessMetric {
  metric_date: string;
  metric_type: 'dau' | 'wau' | 'mau' | 'new_signups' | 'churned_users' | 'premium_conversions' | 'revenue' | 'avg_session_duration' | 'messages_per_user' | 'retention_rate';
  metric_value: number;
  metadata?: Record<string, any>;
}

export interface ErrorLog {
  error_type: 'client_error' | 'server_error' | 'network_error' | 'validation_error' | 'authentication_error' | 'permission_error';
  error_message: string;
  error_stack?: string;
  page_path?: string;
  user_action?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class AnalyticsService {
  private sessionId: string;
  private startTime: number;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.initializeSession();
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    if (width >= 1024) return 'desktop';
    return 'unknown';
  }

  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private async initializeSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await this.trackPageView(window.location.pathname);
      }
    } catch (error) {
    }
  }

  // ========== USER BEHAVIOR TRACKING ==========

  async trackEvent(event: BehaviorEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('user_behavior_analytics').insert({
        user_id: user?.id || null,
        session_id: this.sessionId,
        action_type: event.action_type,
        action_target: event.action_target,
        page_path: event.page_path,
        referrer: event.referrer || document.referrer,
        device_type: this.getDeviceType(),
        browser: this.getBrowser(),
        metadata: event.metadata || {}
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }

  async trackPageView(path: string): Promise<void> {
    await this.trackEvent({
      action_type: 'page_view',
      action_target: path,
      page_path: path,
      referrer: document.referrer
    });
  }

  async trackFeatureUse(
    featureName: FeatureUsage['feature_name'],
    timeSpentSeconds: number = 0
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await this.trackEvent({
        action_type: 'feature_used',
        action_target: featureName,
        page_path: window.location.pathname,
        metadata: { time_spent: timeSpentSeconds }
      });

      const { data: existing } = await supabase
        .from('feature_usage_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('feature_name', featureName)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('feature_usage_stats')
          .update({
            usage_count: existing.usage_count + 1,
            total_time_spent_seconds: existing.total_time_spent_seconds + timeSpentSeconds,
            last_used_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('feature_usage_stats')
          .insert({
            user_id: user.id,
            feature_name: featureName,
            usage_count: 1,
            total_time_spent_seconds: timeSpentSeconds,
            last_used_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error tracking feature use:', error);
    }
  }

  async trackButtonClick(buttonName: string, metadata?: Record<string, any>): Promise<void> {
    await this.trackEvent({
      action_type: 'button_clicked',
      action_target: buttonName,
      page_path: window.location.pathname,
      metadata
    });
  }

  async trackMessageSent(companionId: string): Promise<void> {
    await this.trackEvent({
      action_type: 'message_sent',
      action_target: companionId,
      page_path: '/chat',
      metadata: { session_duration: Date.now() - this.startTime }
    });
  }

  // ========== CONVERSION FUNNEL TRACKING ==========

  async trackFunnelStep(
    funnelType: 'onboarding' | 'upgrade' | 'feature_discovery' | 'companion_creation' | 'first_message',
    stepName: string,
    stepNumber: number,
    completed: boolean,
    timeToCompleteSeconds?: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('conversion_funnel').insert({
        user_id: user.id,
        funnel_type: funnelType,
        step_name: stepName,
        step_number: stepNumber,
        completed,
        time_to_complete_seconds: timeToCompleteSeconds,
        dropped_off: !completed
      });
    } catch (error) {
      console.error('Error tracking funnel step:', error);
    }
  }

  async getFunnelAnalytics(funnelType: string): Promise<any> {
    try {
      const { data } = await supabase
        .from('conversion_funnel')
        .select('*')
        .eq('funnel_type', funnelType)
        .order('step_number', { ascending: true });

      if (!data) return null;

      const stepStats = data.reduce((acc: any, item) => {
        if (!acc[item.step_name]) {
          acc[item.step_name] = {
            step_number: item.step_number,
            total_users: 0,
            completed: 0,
            dropped_off: 0,
            avg_time: []
          };
        }

        acc[item.step_name].total_users++;
        if (item.completed) acc[item.step_name].completed++;
        if (item.dropped_off) acc[item.step_name].dropped_off++;
        if (item.time_to_complete_seconds) {
          acc[item.step_name].avg_time.push(item.time_to_complete_seconds);
        }

        return acc;
      }, {});

      return Object.entries(stepStats).map(([step_name, stats]: [string, any]) => ({
        step_name,
        step_number: stats.step_number,
        total_users: stats.total_users,
        completion_rate: (stats.completed / stats.total_users) * 100,
        drop_off_rate: (stats.dropped_off / stats.total_users) * 100,
        avg_completion_time: stats.avg_time.length > 0
          ? stats.avg_time.reduce((a: number, b: number) => a + b, 0) / stats.avg_time.length
          : 0
      }));
    } catch (error) {
      console.error('Error getting funnel analytics:', error);
      return null;
    }
  }

  // ========== ERROR LOGGING ==========

  async logError(error: ErrorLog): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('error_logs').insert({
        user_id: user?.id || null,
        error_type: error.error_type,
        error_message: error.error_message,
        error_stack: error.error_stack || '',
        page_path: error.page_path || window.location.pathname,
        user_action: error.user_action || '',
        severity: error.severity,
        resolved: false
      });

      await this.trackEvent({
        action_type: 'error_occurred',
        action_target: error.error_type,
        page_path: window.location.pathname,
        metadata: {
          message: error.error_message,
          severity: error.severity
        }
      });
    } catch (err) {
      console.error('Error logging error:', err);
    }
  }

  // ========== BUSINESS METRICS (Admin Only) ==========

  async recordBusinessMetric(metric: BusinessMetric): Promise<void> {
    try {
      await supabase.from('business_metrics').insert(metric);
    } catch (error) {
      console.error('Error recording business metric:', error);
    }
  }

  async getBusinessMetrics(
    metricType: BusinessMetric['metric_type'],
    startDate: Date,
    endDate: Date
  ): Promise<BusinessMetric[]> {
    try {
      const { data, error } = await supabase
        .from('business_metrics')
        .select('*')
        .eq('metric_type', metricType)
        .gte('metric_date', startDate.toISOString().split('T')[0])
        .lte('metric_date', endDate.toISOString().split('T')[0])
        .order('metric_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching business metrics:', error);
      return [];
    }
  }

  async calculateDAU(date: Date = new Date()): Promise<number> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from('user_behavior_analytics')
        .select('user_id')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .not('user_id', 'is', null);

      const uniqueUsers = new Set(data?.map(d => d.user_id) || []);

      await this.recordBusinessMetric({
        metric_date: dateStr,
        metric_type: 'dau',
        metric_value: uniqueUsers.size
      });

      return uniqueUsers.size;
    } catch (error) {
      console.error('Error calculating DAU:', error);
      return 0;
    }
  }

  // ========== USER FEATURE USAGE ANALYTICS ==========

  async getUserFeatureUsage(userId: string): Promise<FeatureUsage[]> {
    try {
      const { data, error } = await supabase
        .from('feature_usage_stats')
        .select('*')
        .eq('user_id', userId)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user feature usage:', error);
      return [];
    }
  }

  async getMostPopularFeatures(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('feature_usage_stats')
        .select('feature_name, usage_count')
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const featureCounts = (data || []).reduce((acc: any, item) => {
        if (!acc[item.feature_name]) {
          acc[item.feature_name] = 0;
        }
        acc[item.feature_name] += item.usage_count;
        return acc;
      }, {});

      return Object.entries(featureCounts)
        .map(([feature, count]) => ({ feature, count }))
        .sort((a: any, b: any) => b.count - a.count);
    } catch (error) {
      console.error('Error fetching popular features:', error);
      return [];
    }
  }

  // ========== SESSION MANAGEMENT ==========

  endSession(): void {
    const sessionDuration = Math.floor((Date.now() - this.startTime) / 1000);

    this.trackEvent({
      action_type: 'navigation',
      action_target: 'session_end',
      page_path: window.location.pathname,
      metadata: { session_duration: sessionDuration }
    });
  }
}

export const analyticsService = new AnalyticsService();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    analyticsService.endSession();
  });
}
