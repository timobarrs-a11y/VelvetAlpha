import { SUBSCRIPTION_PLANS, SubscriptionTier, PAID_TIERS } from '../types/subscription';
import { X, Check } from 'lucide-react';
import { useState } from 'react';
import { createCheckoutSession } from '../services/stripeService';
import { toast } from '../shared/ui/Toast';

interface PricingPageProps {
  currentTier: SubscriptionTier;
  onClose: () => void;
}

export function PricingPage({ currentTier, onClose }: PricingPageProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    try {
      setLoading(tier);
      const url = await createCheckoutSession(tier);
      window.location.href = url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to start checkout: ${errorMessage}`);
      setLoading(null);
    }
  };

  const planOrder: SubscriptionTier[] = ['essential', 'plus', 'elite'];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-black to-rose-900 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="max-w-5xl w-full my-8">
        <div className="flex justify-end mb-8">
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <h1 className="text-5xl font-bold text-white text-center mb-4">
          An AI Coach That Actually Knows You
        </h1>
        <p className="text-gray-300 text-center mb-12 text-lg max-w-2xl mx-auto">
          A persistent AI coach that remembers your goals, tracks commitments, and checks in over time. Pick the plan that fits your journey.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {planOrder.map((tier) => {
            const plan = SUBSCRIPTION_PLANS[tier];
            const isCurrent = currentTier === tier;
            const isRecommended = tier === 'essential';
            const accentGradient = tier === 'essential'
              ? 'from-teal-500 to-cyan-600'
              : tier === 'plus'
                ? 'from-blue-500 to-indigo-600'
                : 'from-amber-500 to-orange-600';
            const borderColor = tier === 'essential'
              ? 'border-teal-500/50'
              : tier === 'plus'
                ? 'border-blue-500/50'
                : 'border-amber-500/50';
            const bgClass = tier === 'essential'
              ? 'bg-gradient-to-br from-teal-600/15 to-cyan-700/15'
              : tier === 'plus'
                ? 'bg-gradient-to-br from-blue-600/15 to-indigo-700/15'
                : 'bg-gradient-to-br from-amber-600/15 to-orange-700/15';
            const buttonBg = tier === 'essential'
              ? 'bg-teal-600 hover:bg-teal-700'
              : tier === 'plus'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-amber-600 hover:bg-amber-700';

            return (
              <div
                key={tier}
                className={`relative ${bgClass} backdrop-blur-lg rounded-2xl p-6 border-2 ${borderColor} ${isRecommended ? 'ring-2 ring-teal-400/30' : ''}`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-teal-500 text-white px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap uppercase tracking-wide">
                    Start Here
                  </div>
                )}
                <h2 className="text-2xl font-bold text-white mb-2">{plan.name}</h2>
                <div className="text-4xl font-bold text-white mb-4">
                  ${plan.price}<span className="text-sm text-gray-400 font-normal">/mo</span>
                </div>
                <ul className="space-y-3 mb-6 text-gray-200 text-sm">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="text-green-400 mt-0.5 w-4 h-4 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={isCurrent || loading !== null}
                  className={`block w-full ${buttonBg} disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition text-sm text-center`}
                >
                  {loading === tier ? 'Loading...' : isCurrent ? 'Current Plan' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-white font-semibold mb-0.5">Free Plan</h3>
            <p className="text-gray-400 text-sm">30 messages with full Sonnet intelligence. Experience memory and goal tracking before you commit.</p>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm transition-all whitespace-nowrap border border-white/10"
          >
            Continue Free
          </button>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-4">
          <p className="text-gray-400 text-sm">
            Your subscription renews automatically each month until you cancel. Cancel anytime from Billing; cancellation takes effect at the end of the current period.
          </p>
        </div>
        <p className="text-center text-gray-500 text-sm">
          All purchases are secure and encrypted. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
