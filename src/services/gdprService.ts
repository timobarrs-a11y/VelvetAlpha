import { supabase } from '../shared/supabase/client';

export interface GDPRExportData {
  profile: any;
  companions: any[];
  conversations: any[];
  messages: any[];
  memories: any[];
  calendarEvents: any[];
  insights: any[];
  featureUsage: any[];
  customization: any;
  goals: any[];
  commitments: any[];
  coachingSessions: any[];
  userExperts: any[];
  exportedAt: string;
}

class GDPRService {
  async exportUserData(): Promise<GDPRExportData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const uid = user.id;

    const [
      profileRes,
      companionsRes,
      conversationsRes,
      messagesRes,
      memoriesRes,
      calendarRes,
      insightsRes,
      featureUsageRes,
      customizationRes,
      goalsRes,
      commitmentsRes,
      coachingSessionsRes,
      userExpertsRes,
    ] = await Promise.allSettled([
      supabase.from('user_profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('companions').select('id, name, gender, created_at, updated_at, personality_traits, hobbies, sports, music_genre, favorite_color, zodiac_sign').eq('user_id', uid),
      supabase.from('conversations').select('id, companion_id, role, content, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(2000),
      supabase.from('messages').select('id, role, content, created_at, conversation_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(2000),
      supabase.from('companion_memories').select('memory_text, importance_score, created_at').eq('user_id', uid).limit(500),
      supabase.from('calendar_events').select('title, description, event_date, event_type, created_at').eq('user_id', uid).limit(500),
      supabase.from('conversation_insights').select('insight_type, insight_text, created_at').eq('user_id', uid).limit(200),
      supabase.from('feature_usage_stats').select('feature_name, usage_count, total_time_spent_seconds, last_used_at').eq('user_id', uid),
      supabase.from('user_customization').select('pointer_symbol, cursor_color, animation_style, trail_style, show_trail, show_particles').eq('user_id', uid).maybeSingle(),
      supabase.from('user_goals').select('title, goal_type, status, target_value, current_value, unit, target_date, created_at').eq('user_id', uid).limit(200),
      supabase.from('coaching_commitments').select('description, due_date, status, created_at, updated_at').eq('user_id', uid).limit(200),
      supabase.from('coaching_sessions').select('companion_id, session_start, session_end, summary, created_at').eq('user_id', uid).limit(100),
      supabase.from('user_experts').select('name, domain, instruction, accountability_level, check_in_style, created_at').eq('user_id', uid).limit(50),
    ]);

    const getValue = (res: PromiseSettledResult<any>) =>
      res.status === 'fulfilled' ? (res.value.data ?? (Array.isArray(res.value.data) ? [] : null)) : null;

    const profile = getValue(profileRes);
    if (profile) {
      delete profile.stripe_customer_id;
      delete profile.stripe_subscription_id;
    }

    return {
      profile,
      companions: getValue(companionsRes) ?? [],
      conversations: getValue(conversationsRes) ?? [],
      messages: getValue(messagesRes) ?? [],
      memories: getValue(memoriesRes) ?? [],
      calendarEvents: getValue(calendarRes) ?? [],
      insights: getValue(insightsRes) ?? [],
      featureUsage: getValue(featureUsageRes) ?? [],
      customization: getValue(customizationRes),
      goals: getValue(goalsRes) ?? [],
      commitments: getValue(commitmentsRes) ?? [],
      coachingSessions: getValue(coachingSessionsRes) ?? [],
      userExperts: getValue(userExpertsRes) ?? [],
      exportedAt: new Date().toISOString(),
    };
  }

  downloadAsJSON(data: GDPRExportData, filename = 'velvet-data-export.json') {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async requestAccountDeletion(): Promise<{ success: boolean; message: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ deletion_requested_at: new Date().toISOString() } as any)
        .eq('id', user.id);

      if (error) throw error;

      return {
        success: true,
        message: 'Your deletion request has been received. Your account and all associated data will be permanently deleted within 30 days. You will receive a confirmation email.',
      };
    } catch {
      return {
        success: false,
        message: 'Failed to submit deletion request. Please contact support@velvet.app.',
      };
    }
  }
}

export const gdprService = new GDPRService();
