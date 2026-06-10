import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';
import { X, ArrowLeft, Sparkles, Clock, CheckCircle2, Zap, Shield, Star, Crown } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { toast } from '../shared/ui/Toast';
import { motion } from 'framer-motion';

const TIER_ICONS: Record<string, React.ElementType> = {
  free: Star,
  trial: Sparkles,
  unlimited: Zap,
  starter: Shield,
  plus: Crown,
  elite: Crown,
};

const TIER_ACCENT: Record<string, string> = {
  free: 'from-slate-500 to-slate-600',
  trial: 'from-amber-400 to-orange-500',
  unlimited: 'from-teal-500 to-cyan-500',
  starter: 'from-blue-500 to-sky-500',
  plus: 'from-emerald-500 to-teal-500',
  elite: 'from-rose-500 to-pink-500',
};

const TIER_BORDER: Record<string, string> = {
  free: 'border-slate-600/50',
  trial: 'border-amber-400/60',
  unlimited: 'border-teal-500/50',
  starter: 'border-blue-500/50',
  plus: 'border-emerald-500/50',
  elite: 'border-rose-500/60',
};

const TIER_BG: Record<string, string> = {
  free: 'bg-slate-800/40',
  trial: 'bg-amber-900/20',
  unlimited: 'bg-teal-900/20',
  starter: 'bg-blue-900/20',
  plus: 'bg-emerald-900/20',
  elite: 'bg-rose-900/20',
};

const PAID_TIERS: SubscriptionTier[] = ['unlimited', 'starter', 'plus', 'elite'];

export function PricingPageRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/lobby';
  const { tier: currentTier, loading: subscriptionLoading } = useSubscription();
  const [activatingTrial, setActivatingTrial] = useState(false);

  if (subscriptionLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-medium">Loading pricing options...</p>
        </div>
      </div>
    );
  }

  const handleActivateTrial = async () => {
    try {
      setActivatingTrial(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Please sign in to start your trial');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('trial_used, subscription_tier')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.trial_used) {
        toast.error('You have already used your free trial.');
        return;
      }

      if (profile?.subscription_tier && PAID_TIERS.includes(profile.subscription_tier as SubscriptionTier)) {
        toast.error('You already have an active subscription.');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3);

      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'trial',
          trial_expires_at: expiresAt.toISOString(),
          trial_used: true,
          messages_remaining: 5000,
          haiku_model_enabled: false,
          sonnet_model_enabled: true,
        })
        .eq('id', user.id);

      if (error) {
        toast.error('Failed to activate trial. Please try again.');
        return;
      }

      toast.success('Your 3-day Premium Trial is now active!');
      navigate(returnTo);
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setActivatingTrial(false);
    }
  };

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    try {
      if (tier === 'free') {
        navigate(returnTo);
        return;
      }

      if (tier === 'trial') {
        await handleActivateTrial();
        return;
      }

      const plan = SUBSCRIPTION_PLANS[tier];

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast.error('Please sign in to upgrade your subscription');
        return;
      }

      if (!plan.stripePriceId) {
        toast.error('This subscription plan is not available yet. Please contact support.');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ tier, priceId: plan.stripePriceId })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          const errorMessage = errorJson.error || 'Failed to create checkout session';
          if (errorMessage.includes('STRIPE_SECRET_KEY')) {
            toast.error('Payment processing is currently unavailable. Please contact support.');
            navigate(returnTo);
            return;
          }
          throw new Error(errorMessage);
        } catch (e) {
          if (e instanceof Error && e.message.includes('Stripe is not configured')) return;
          throw new Error(`Failed to create checkout session: ${errorText}`);
        }
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'There was an error processing your request. Please try again.');
    }
  };

  const handleClose = () => navigate(returnTo);

  const isOnTrial = currentTier === 'trial';
  const isOnPaid = PAID_TIERS.includes(currentTier as SubscriptionTier);
  const hasUsedTrial = isOnTrial || isOnPaid;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-black to-slate-900 z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-slate-900/95 to-transparent backdrop-blur-sm p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button
            onClick={handleClose}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all text-white font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleClose}
            className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16 pt-4">
        {/* Hero */}
        <div className="text-center mb-14">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Choose Your Experience
          </h1>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            Unlock deeper connections, premium AI, and exclusive features.
          </p>
        </div>

        {/* Trial Hero Banner — only show if eligible */}
        {!hasUsedTrial && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative mb-12 rounded-2xl overflow-hidden border border-amber-400/40"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-900/40 via-orange-900/30 to-amber-900/40" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(251,191,36,0.15),_transparent_60%)]" />
            <div className="relative px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <h2 className="text-2xl font-bold text-white">3-Day Premium Trial</h2>
                    <span className="px-2.5 py-0.5 bg-amber-400/20 border border-amber-400/40 rounded-full text-amber-300 text-xs font-semibold uppercase tracking-wider">Free</span>
                  </div>
                  <p className="text-white/70 text-sm mb-3 max-w-lg">
                    Get full Elite-level access for 3 days. No credit card required. Automatically reverts to Free after your trial ends.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {['Velvet V2 AI', 'Signature Voice™', 'Insights & Calendar', '5,000 messages'].map((f) => (
                      <div key={f} className="flex items-center gap-1.5 text-amber-200 text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleActivateTrial}
                  disabled={activatingTrial}
                  className="px-8 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-base"
                >
                  {activatingTrial ? 'Activating...' : 'Start Free Trial'}
                </button>
                <div className="flex items-center gap-1.5 text-white/50 text-xs">
                  <Clock className="w-3 h-3" />
                  Expires automatically after 3 days
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Paid Plans */}
        <div className="mb-6">
          <h2 className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-6 text-center">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PAID_TIERS.map((tier, i) => {
              const plan = SUBSCRIPTION_PLANS[tier];
              const Icon = TIER_ICONS[tier] || Star;
              const isCurrent = currentTier === tier;
              const isPopular = tier === 'elite';

              return (
                <motion.div
                  key={tier}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className={`relative rounded-2xl border ${TIER_BORDER[tier]} ${TIER_BG[tier]} p-6 flex flex-col`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TIER_ACCENT[tier]} flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base leading-tight">{plan.name}</h3>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-white text-xl font-bold">${plan.price}</span>
                        <span className="text-white/40 text-xs">/mo</span>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-white/70 text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(tier)}
                    disabled={isCurrent}
                    className={`
                      w-full py-3 rounded-xl font-semibold text-sm transition-all
                      ${isCurrent
                        ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/10'
                        : `bg-gradient-to-r ${TIER_ACCENT[tier]} hover:opacity-90 hover:scale-[1.02] text-white shadow-md`
                      }
                    `}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Free tier row */}
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-white font-semibold mb-0.5">Free Plan</h3>
            <p className="text-white/50 text-sm">15 messages to explore the Velvet experience. No commitment.</p>
          </div>
          <button
            onClick={() => navigate(returnTo)}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm transition-all whitespace-nowrap border border-white/10"
          >
            Continue Free
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-8">
          All plans billed monthly. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
