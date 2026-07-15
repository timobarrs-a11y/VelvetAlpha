import { supabase } from '../shared/supabase/client';

const PENDING_CODE_KEY = 'velvet_pending_referral_code';

export interface ReferralSummary {
  code: string | null;
  inviteLink: string | null;
  invitedCount: number;      // people who redeemed your code
  qualifiedCount: number;    // people who activated (you got paid)
  pendingCount: number;      // redeemed but not yet activated
  rewardMessagesEarned: number;
}

export interface ReferralRow {
  referred_user_id: string;
  status: 'pending' | 'qualified';
  referrer_reward: number;
  created_at: string;
  qualified_at: string | null;
}

/**
 * Referral / invitation system — rewards are granted on ACTIVATION, not signup.
 * The invitee has to become a genuinely engaged user (send enough real messages)
 * before the referrer is paid, which removes the incentive to farm signups.
 */
class ReferralService {
  /** Read a ?ref=CODE off the current URL and stash it until the user signs up. */
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

  /**
   * Attempt to redeem any stashed code for the currently signed-in user.
   * Safe to call repeatedly (server no-ops if already referred), so it can run
   * both right after signup and on app boot. Clears the stash on a terminal result.
   */
  async redeemPendingReferral(): Promise<void> {
    const code = this.getPendingCode();
    if (!code) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; // no session yet (e.g. email confirmation) — retry on next boot

    try {
      const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });
      if (error) return; // transient — keep the stash and retry later

      const reason = (data as { reason?: string } | null)?.reason;
      // Any definitive outcome (redeemed, self, invalid, already referred) is terminal.
      if (reason) localStorage.removeItem(PENDING_CODE_KEY);
    } catch {
      /* network — keep stash, retry next boot */
    }
  }

  buildInviteLink(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/signup?ref=${encodeURIComponent(code)}`;
  }

  /** Everything the Invite page needs in one call. */
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
