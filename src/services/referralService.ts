import { supabase } from '../shared/supabase/client';

const PENDING_CODE_KEY = 'velvet_pending_referral_code';

export interface ReferralSummary {
  code: string | null;
  inviteLink: string | null;
  invitedCount: number;
  qualifiedCount: number;
  pendingCount: number;
  rewardMessagesEarned: number;
}

export interface ReferralRow {
  referred_user_id: string;
  status: 'pending' | 'qualified';
  referrer_reward: number;
  created_at: string;
  qualified_at: string | null;
}

class ReferralService {
  captureRefFromUrl(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('ref');
      if (code && code.trim()) {
        localStorage.setItem(PENDING_CODE_KEY, code.trim().toUpperCase());
      }
    } catch {
      /* SSR / storage unavailable — non-fatal */
    }
  }

  getPendingCode(): string | null {
    try {
      return localStorage.getItem(PENDING_CODE_KEY);
    } catch {
      return null;
    }
  }

  async redeemPendingReferral(): Promise<void> {
    const code = this.getPendingCode();
    if (!code) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });
      if (error) return;

      const reason = (data as { reason?: string } | null)?.reason;
      if (reason) localStorage.removeItem(PENDING_CODE_KEY);
    } catch {
      /* network — keep stash, retry next boot */
    }
  }

  buildInviteLink(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/signup?ref=${encodeURIComponent(code)}`;
  }

  async getSummary(): Promise<ReferralSummary> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { code: null, inviteLink: null, invitedCount: 0, qualifiedCount: 0, pendingCount: 0, rewardMessagesEarned: 0 };
    }

    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from('user_profiles').select('referral_code').eq('id', user.id).maybeSingle(),
      supabase
        .from('referrals')
        .select('referred_user_id, status, referrer_reward, created_at, qualified_at')
        .eq('referrer_id', user.id),
    ]);

    const referrals = (rows ?? []) as ReferralRow[];
    const qualified = referrals.filter((r) => r.status === 'qualified');
    const code = profile?.referral_code ?? null;

    return {
      code,
      inviteLink: code ? this.buildInviteLink(code) : null,
      invitedCount: referrals.length,
      qualifiedCount: qualified.length,
      pendingCount: referrals.length - qualified.length,
      rewardMessagesEarned: qualified.reduce((sum, r) => sum + (r.referrer_reward || 0), 0),
    };
  }
}

export const referralService = new ReferralService();
