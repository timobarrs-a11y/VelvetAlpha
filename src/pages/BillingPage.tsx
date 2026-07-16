import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Crown,
  Check,
  CreditCard,
  Calendar,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Zap,
  Shield,
  ChevronRight,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { createCheckoutSession, createPortalSession } from '../services/stripeService';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';

interface BillingInfo {
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_expires_at: string | null;
  messages_used: number;
  messages_limit: number;
  messages_reset_at: string | null;
}

const TIER_ORDER: SubscriptionTier[] = ['free', 'trial', 'unlimited', 'starter', 'plus', 'elite'];

const TIER_STYLE: Record<string, { gradient: string; border: string; badge: string }> = {
  free:      { gradient: 'from-slate-600 to-slate-700',       border: 'border-white/20',      badge: 'bg-white/10 text-white/60' },
  trial:     { gradient: 'from-cyan-600 to-teal-700',         border: 'border-cyan-500/40',   badge: 'bg-cyan-500/20 text-cyan-300' },
  unlimited: { gradient: 'from-sky-600 to-blue-700',          border: 'border-sky-500/40',    badge: 'bg-sky-500/20 text-sky-300' },
  starter:   { gradient: 'from-green-600 to-emerald-700',     border: 'border-green-500/40',  badge: 'bg-green-500/20 text-green-300' },
  plus:      { gradient: 'from-amber-500 to-orange-600',      border: 'border-amber-500/40',  badge: 'bg-amber-500/20 text-amber-300' },
  elite:     { gradient: 'from-rose-500 to-pink-600',         border: 'border-rose-500/40',   badge: 'bg-rose-500/20 text-rose-300' },
};

export function BillingPage() {
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [changePlanLoading, setChangePlanLoading] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);

  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, stripe_customer_id, stripe_subscription_id, trial_expires_at')
        .eq('id', user.id)
        .maybeSingle();

      const { data: msgData } = await supabase
        .from('message_tracking')
        .select('messages_used, messages_limit, reset_at')
        .eq('user_id', user.id)
        .maybeSingle();

      const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
      const plan = SUBSCRIPTION_PLANS[tier];

      setBilling({
        subscription_tier: tier,
        stripe_customer_id: profile?.stripe_customer_id || null,
        stripe_subscription_id: profile?.stripe_subscription_id || null,
        trial_expires_at: profile?.trial_expires_at || null,
        messages_used: msgData?.messages_used || 0,
        messages_limit: msgData?.messages_limit || plan?.messageLimit || 15,
        messages_reset_at: msgData?.reset_at || null,
      });
    } catch (err) {
      console.error('Error loading billing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setErrorMsg(null);
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (tier: SubscriptionTier) => {
    setChangePlanLoading(tier);
    setErrorMsg(null);
    try {
      const url = await createCheckoutSession(tier);
      window.location.href = url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start checkout. Please try again.');
    } finally {
      setChangePlanLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!billing?.stripe_subscription_id) {
      handleManageSubscription();
      return;
    }
    setCancelLoading(true);
    try {
      const url = await createPortalSession();
      window.location.href = url;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to open cancellation portal.');
    } finally {
      setCancelLoading(false);
    }
  };

  const currentTier = billing?.subscription_tier || 'free';
  const currentPlan = SUBSCRIPTION_PLANS[currentTier];
  const currentStyle = TIER_STYLE[currentTier] || TIER_STYLE.free;
  const currentTierIndex = TIER_ORDER.indexOf(currentTier);
  const isPaid = currentTier !== 'free' && currentTier !== 'trial';
  const isTrial = currentTier === 'trial';

  const trialDaysLeft = billing?.trial_expires_at
    ? Math.max(0, Math.ceil((new Date(billing.trial_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const messagesUsedPct = billing
    ? Math.min(100, (billing.messages_used / (billing.messages_limit || 1)) * 100)
    : 0;

  const upgradePlans = Object.values(SUBSCRIPTION_PLANS).filter(p =>
    p.tier !== 'free' &&
    p.tier !== 'trial' &&
    TIER_ORDER.indexOf(p.tier) > currentTierIndex
  );

  const displayPlans = showAllPlans
    ? Object.values(SUBSCRIPTION_PLANS).filter(p => p.tier !== 'free' && p.tier !== 'trial')
    : upgradePlans;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4" />
          <p className="text-white/60">Loading billing info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)' }}>
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Subscription & Billing</h1>
            <p className="text-white/40 text-sm">Manage your plan, payments, and usage</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-red-400 text-sm" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)} className="text-red-300/60 hover:text-red-300 text-xs mt-1">Dismiss</button>
            </div>
          </div>
        )}

        {/* Current Plan Card */}
        <div className={`rounded-2xl border p-6 mb-6 ${currentStyle.border}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${currentStyle.badge}`}>
                  CURRENT PLAN
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mt-2">
                {currentPlan?.name || 'Free'}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {currentPlan?.price === 0
                  ? 'No charge'
                  : `$${currentPlan?.price}/month`}
              </p>
            </div>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${currentStyle.gradient}`}>
              <Crown className="w-7 h-7 text-white" />
            </div>
          </div>

          {isTrial && (
            <div className="mb-5 p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.20)' }}>
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div>
                <p className="text-cyan-300 text-sm font-medium">
                  {trialDaysLeft > 0 ? `${trialDaysLeft} days left in your trial` : 'Trial expired'}
                </p>
                <p className="text-cyan-400/60 text-xs">Upgrade now to keep full access</p>
              </div>
            </div>
          )}

          {/* Message usage */}
          <div className="mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />
                Messages this period
              </span>
              <span className="text-white font-medium">
                {billing?.messages_used?.toLocaleString() || 0} / {
                  billing?.messages_limit === 999999
                    ? (currentPlan?.messageLimit?.toLocaleString() || '?')
                    : (billing?.messages_limit?.toLocaleString() || currentPlan?.messageLimit?.toLocaleString() || '?')
                }
              </span>
            </div>
            <div className="w-full h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${messagesUsedPct}%`,
                  background: messagesUsedPct > 85
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : 'linear-gradient(90deg, #f43f6b, #fb923c)',
                }}
              />
            </div>
            {billing?.messages_reset_at && (
              <p className="text-white/30 text-xs mt-1.5 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Resets {new Date(billing.messages_reset_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Features */}
          {currentPlan?.features && (
            <div className="space-y-1.5 mb-5">
              {currentPlan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                  <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {isPaid && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #f43f6b, #e11d48)' }}
              >
                <CreditCard className="w-4 h-4" />
                {portalLoading ? 'Opening portal...' : 'Manage Billing'}
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </button>
            )}

            {currentTier === 'free' && (
              <button
                onClick={() => navigate('/pricing')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
                style={{ background: 'linear-gradient(135deg, #f43f6b, #e11d48)' }}
              >
                <Zap className="w-4 h-4" />
                Upgrade Plan
              </button>
            )}

            {isTrial && (
              <button
                onClick={() => navigate('/pricing')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #0284c7)' }}
              >
                <ArrowUpCircle className="w-4 h-4" />
                Upgrade Before Trial Ends
              </button>
            )}
          </div>
        </div>

        {/* Billing info card (paid users) */}
        {isPaid && (
          <div className="rounded-2xl border border-white/10 p-5 mb-6" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-white/50" />
              Billing Details
            </h3>
            <div className="space-y-3">
              <BillingRow label="Plan" value={currentPlan?.name || currentTier} />
              <BillingRow label="Billing" value="Monthly" />
              {billing?.stripe_customer_id && (
                <BillingRow label="Customer ID" value={billing.stripe_customer_id.slice(0, 14) + '…'} mono />
              )}
              <div className="pt-3 border-t border-white/10">
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {portalLoading ? 'Opening...' : 'View invoices & payment methods'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade / Change Plan section */}
        {(displayPlans.length > 0 || showAllPlans) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-rose-400" />
                {isPaid ? 'Change Plan' : 'Available Plans'}
              </h3>
              {upgradePlans.length === 0 && !showAllPlans && (
                <button
                  onClick={() => setShowAllPlans(true)}
                  className="text-xs text-white/40 hover:text-white/70 transition"
                >
                  View all plans
                </button>
              )}
              {showAllPlans && (
                <button
                  onClick={() => setShowAllPlans(false)}
                  className="text-xs text-white/40 hover:text-white/70 transition"
                >
                  Collapse
                </button>
              )}
            </div>

            <div className="space-y-3">
              {displayPlans.map(plan => {
                const planTierIdx = TIER_ORDER.indexOf(plan.tier);
                const isCurrentPlan = plan.tier === currentTier;
                const isUpgrade = planTierIdx > currentTierIndex;
                const style = TIER_STYLE[plan.tier] || TIER_STYLE.free;
                const isLoading = changePlanLoading === plan.tier;

                return (
                  <div
                    key={plan.tier}
                    className={`rounded-2xl border p-5 transition ${isCurrentPlan ? style.border : 'border-white/10 hover:border-white/20'}`}
                    style={{ background: isCurrentPlan ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold">{plan.name}</span>
                          {isCurrentPlan && (
                            <span className={`text-xs px-2 py-0.5 rounded-lg ${style.badge}`}>Current</span>
                          )}
                          {plan.tier === 'elite' && !isCurrentPlan && (
                            <span className="text-xs px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300">Most Popular</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1 mb-3">
                          <span className="text-2xl font-bold text-white">${plan.price}</span>
                          <span className="text-white/40 text-sm">/month</span>
                        </div>
                        <div className="space-y-1">
                          {plan.features.slice(0, 3).map((f, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs text-white/50">
                              <Check className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>

                      {!isCurrentPlan && (
                        <button
                          onClick={() => handleUpgrade(plan.tier)}
                          disabled={!!changePlanLoading}
                          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition disabled:opacity-50 ${
                            isUpgrade
                              ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500'
                              : 'bg-white/10 hover:bg-white/15 border border-white/10'
                          }`}
                        >
                          {isLoading ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-white" />
                          ) : isUpgrade ? (
                            <ArrowUpCircle className="w-4 h-4" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4" />
                          )}
                          {isLoading ? 'Loading...' : isUpgrade ? 'Upgrade' : 'Switch'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {upgradePlans.length === 0 && !showAllPlans && currentTier !== 'elite' && (
              <button
                onClick={() => setShowAllPlans(true)}
                className="w-full mt-3 p-3 rounded-xl text-sm text-white/40 hover:text-white/60 border border-white/10 hover:border-white/20 transition flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                View all plans <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {currentTier === 'elite' && (
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(244,63,107,0.08)', border: '1px solid rgba(244,63,107,0.20)' }}>
                <Crown className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                <p className="text-white font-medium text-sm">You're on the highest plan</p>
                <p className="text-white/40 text-xs mt-1">Elite gives you the full Velvet experience</p>
              </div>
            )}
          </div>
        )}

        {/* Cancel subscription */}
        {isPaid && (
          <div className="rounded-2xl border border-white/8 p-5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h3 className="text-white/60 font-medium text-sm mb-1">Cancel Subscription</h3>
            <p className="text-white/35 text-xs mb-4">
              You can cancel at any time. Your access continues until the end of your current billing period.
            </p>

            {cancelConfirm ? (
              <div className="p-4 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-red-300 text-sm font-medium">Are you sure?</p>
                </div>
                <p className="text-white/50 text-xs mb-4">
                  You'll lose access to premium features at the end of your billing period. This will redirect you to Stripe's billing portal.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm text-white/60 border border-white/10 hover:bg-white/5 transition"
                  >
                    Keep Plan
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelLoading}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelLoading ? 'Opening...' : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Proceed to Cancel
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCancelConfirm(true)}
                className="text-sm text-red-400/60 hover:text-red-400 transition flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Cancel subscription
              </button>
            )}
          </div>
        )}

        {/* Security note */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-1.5 text-white/25 text-xs">
            <Shield className="w-3.5 h-3.5" />
            Payments are processed securely by Stripe. We never store your card details.
          </div>
        </div>

      </div>
    </div>
  );
}

function BillingRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/40">{label}</span>
      <span className={`text-white/80 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
