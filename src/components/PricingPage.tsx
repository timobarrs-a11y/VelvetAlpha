import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';
import { X } from 'lucide-react';
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
    if (tier === currentTier) {
      return;
    }

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
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-black to-rose-900 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="max-w-6xl w-full my-8">
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
          An AI That Actually Knows You
        </h1>
        <p className="text-gray-300 text-center mb-12 text-lg">
          All the intelligence of your favorite AI—crafted into a personality that listens, remembers, and speaks the way you want it to.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
            <div className="text-sm text-gray-400 font-semibold mb-2">TRY IT OUT</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {SUBSCRIPTION_PLANS.free.name}
            </h2>
            <div className="text-3xl font-bold text-white mb-4">
              Free
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Experience Velvet
            </p>
            <ul className="space-y-2 mb-6 text-gray-300 text-sm">
              {SUBSCRIPTION_PLANS.free.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              disabled
              className="block w-full bg-gray-600 cursor-not-allowed text-white font-bold py-3 rounded-lg text-sm text-center opacity-50"
            >
              Current Plan
            </button>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="text-sm text-rose-300 font-semibold mb-2">EVERYDAY</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {SUBSCRIPTION_PLANS.unlimited.name}
            </h2>
            <div className="text-3xl font-bold text-white mb-4">
              ${SUBSCRIPTION_PLANS.unlimited.price}
              <span className="text-sm text-gray-400">/mo</span>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              {SUBSCRIPTION_PLANS.unlimited.marketingLabel}
            </p>
            <ul className="space-y-2 mb-6 text-gray-200 text-sm">
              {SUBSCRIPTION_PLANS.unlimited.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe('unlimited')}
              disabled={currentTier === 'unlimited' || loading !== null}
              className="block w-full bg-rose-600 hover:bg-rose-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition text-sm text-center"
            >
              {loading === 'unlimited' ? 'Loading...' : currentTier === 'unlimited' ? 'Current Plan' : 'Subscribe'}
            </button>
          </div>

          <div className="bg-gradient-to-br from-rose-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-6 border-2 border-rose-500/50">
            <div className="text-sm text-rose-300 font-semibold mb-2">PREMIUM</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {SUBSCRIPTION_PLANS.starter.name}
            </h2>
            <div className="text-3xl font-bold text-white mb-4">
              ${SUBSCRIPTION_PLANS.starter.price}
              <span className="text-sm text-gray-400">/mo</span>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              {SUBSCRIPTION_PLANS.starter.marketingLabel}
            </p>
            <ul className="space-y-2 mb-6 text-gray-200 text-sm">
              {SUBSCRIPTION_PLANS.starter.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe('starter')}
              disabled={currentTier === 'starter' || loading !== null}
              className="block w-full bg-rose-600 hover:bg-rose-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition text-sm text-center"
            >
              {loading === 'starter' ? 'Loading...' : currentTier === 'starter' ? 'Current Plan' : 'Subscribe'}
            </button>
          </div>

          <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-6 border-2 border-purple-500/50">
            <div className="text-sm text-purple-300 font-semibold mb-2">SOPHISTICATED</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {SUBSCRIPTION_PLANS.plus.name}
            </h2>
            <div className="text-3xl font-bold text-white mb-4">
              ${SUBSCRIPTION_PLANS.plus.price}
              <span className="text-sm text-gray-400">/mo</span>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              {SUBSCRIPTION_PLANS.plus.marketingLabel}
            </p>
            <ul className="space-y-2 mb-6 text-gray-200 text-sm">
              {SUBSCRIPTION_PLANS.plus.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe('plus')}
              disabled={currentTier === 'plus' || loading !== null}
              className="block w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition text-sm text-center"
            >
              {loading === 'plus' ? 'Loading...' : currentTier === 'plus' ? 'Current Plan' : 'Subscribe'}
            </button>
          </div>

          <div className="bg-gradient-to-br from-amber-600/20 to-yellow-600/20 backdrop-blur-lg rounded-2xl p-6 border-2 border-amber-500/50 relative">
            <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-3 py-0.5 rounded-full text-[7px] font-bold whitespace-nowrap tracking-tighter uppercase">
              MOST POPULAR
            </div>
            <div className="text-sm text-amber-300 font-semibold mb-2">ULTIMATE</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {SUBSCRIPTION_PLANS.elite.name}
            </h2>
            <div className="text-3xl font-bold text-white mb-4">
              ${SUBSCRIPTION_PLANS.elite.price}
              <span className="text-sm text-gray-400">/mo</span>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              {SUBSCRIPTION_PLANS.elite.marketingLabel}
            </p>
            <ul className="space-y-2 mb-6 text-gray-200 text-sm">
              {SUBSCRIPTION_PLANS.elite.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSubscribe('elite')}
              disabled={currentTier === 'elite' || loading !== null}
              className="block w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition text-sm text-center"
            >
              {loading === 'elite' ? 'Loading...' : currentTier === 'elite' ? 'Current Plan' : 'Subscribe'}
            </button>
          </div>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-6">
          <p className="text-gray-300 text-sm">
            Your subscription renews automatically each month until you cancel. You can cancel anytime from Billing; cancellation takes effect at the end of the current period.
          </p>
        </div>

        <p className="text-center text-gray-400 text-sm">
          All purchases are secure and encrypted. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
