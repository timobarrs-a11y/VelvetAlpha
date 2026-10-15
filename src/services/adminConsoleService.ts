import { supabase } from '../shared/supabase/client';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    throw new Error(error.message?.includes('forbidden') ? 'Owner access required.' : error.message);
  }
  return data as T;
}

export interface Overview {
  pending_reports: number;
  new_feedback: number;
  open_alerts: number;
  errors_24h: number;
  bot_errors_24h: number;
  banned_users: number;
  trials_ending_3d: number;
  signups_24h: number;
  pending_memory_proposals: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string | null;
  subscription_tier: string | null;
  user_role: string | null;
  is_super_user: boolean | null;
  is_banned: boolean;
  moderation_strikes: number;
  trial_expires_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface UserDetail {
  profile: AdminUserRow & { banned_at: string | null };
  companions: number;
  messages_total: number;
  messages_7d: number;
  last_message_at: string | null;
  posts: number;
  comments: number;
  reports_filed: number;
  referrals_made: number;
  feedback: { id: string; feedback_type: string; message: string; status: string; created_at: string }[];
  moderation_events: { category: string; created_at: string }[];
  recent_errors: { error_type: string; error_message: string; created_at: string }[];
  audit: { action: string; details: Record<string, unknown>; created_at: string }[];
}

export interface ReportRow {
  id: string;
  target_type: 'post' | 'comment' | 'board';
  target_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  reporter_name: string | null;
  content_author_id: string | null;
  content_author_name: string | null;
  content_title: string | null;
  content_body: string | null;
  content_is_bot: boolean;
  content_missing: boolean;
}

export interface FeedbackRow {
  id: string;
  user_id: string | null;
  email: string | null;
  user_name: string | null;
  feedback_type: string;
  message: string;
  page_url: string | null;
  status: 'new' | 'reviewed' | 'implemented' | 'dismissed';
  created_at: string;
}

export interface BotBoard {
  id: string;
  name: string;
  bot_enabled: boolean | null;
  post_frequency_hours: number | null;
  respond_frequency_hours: number | null;
  last_post_at: string | null;
  last_respond_at: string | null;
}

export interface BotOverview {
  boards: BotBoard[];
  runs: { id: string; bot_name: string; action: string; status: string; error_message: string | null; generated_title: string | null; created_at: string }[];
  runs_24h: number;
  errors_24h: number;
}

export interface AppSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_name: string | null;
}

export const adminConsole = {
  overview: () => rpc<Overview>('admin_overview'),

  searchUsers: (p: { query: string; tier: string; filter: string; limit?: number; offset?: number }) =>
    rpc<{ total: number; users: AdminUserRow[] }>('admin_search_users', {
      p_query: p.query, p_tier: p.tier, p_filter: p.filter, p_limit: p.limit ?? 50, p_offset: p.offset ?? 0,
    }),
  userDetail: (id: string) => rpc<UserDetail>('admin_user_detail', { p_user: id }),
  setBan: (id: string, banned: boolean, reason?: string) =>
    rpc<boolean>('admin_set_ban', { p_user: id, p_banned: banned, p_reason: reason ?? null }),
  extendTrial: (id: string, days: number) => rpc<boolean>('admin_extend_trial', { p_user: id, p_days: days }),
  resetStrikes: (id: string) => rpc<boolean>('admin_reset_strikes', { p_user: id }),
  setTier: async (id: string, tier: string) => {
    await rpc<boolean>('admin_set_subscription_tier', { p_target_user_id: id, p_tier: tier });
    await rpc<void>('admin_log_action', { p_action: 'user.set_tier', p_target_type: 'user', p_target_id: id, p_details: { tier } });
  },

  listReports: (status: string) => rpc<ReportRow[]>('admin_list_reports', { p_status: status }),
  resolveReport: (id: string, action: 'dismiss' | 'remove_content' | 'remove_and_ban') =>
    rpc<boolean>('admin_resolve_report', { p_report: id, p_action: action }),

  listFeedback: (status: string) => rpc<FeedbackRow[]>('admin_list_feedback', { p_status: status }),
  setFeedbackStatus: (id: string, status: FeedbackRow['status']) =>
    rpc<boolean>('admin_set_feedback_status', { p_id: id, p_status: status }),

  botOverview: () => rpc<BotOverview>('admin_bot_overview'),
  setBotBoard: (board: string, enabled: boolean, postHours: number, respondHours: number) =>
    rpc<boolean>('admin_set_bot_board', { p_board: board, p_enabled: enabled, p_post_hours: postHours, p_respond_hours: respondHours }),

  listSettings: async (): Promise<AppSetting[]> => {
    const { data, error } = await supabase.from('app_settings').select('key, value, description, updated_at').order('key');
    if (error) throw new Error(error.message);
    return (data ?? []) as AppSetting[];
  },
  setSetting: (key: string, value: unknown) => rpc<boolean>('admin_set_setting', { p_key: key, p_value: value }),

  listAudit: (limit = 100) => rpc<AuditRow[]>('admin_list_audit', { p_limit: limit }),
};
