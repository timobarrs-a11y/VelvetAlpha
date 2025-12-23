import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';
import { X } from 'lucide-react';

interface PricingPageProps {
  currentTier: SubscriptionTier;
  onClose: () => void;
}

export function PricingPage({ currentTier, onClose }: PricingPageProps) {
  const handleSelectPlan = (stripeLink: string) => {
    if (stripeLink) {
      window.location.href = stripeLink;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-black to-rose-900 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="max-w-6xl w-full my-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={32} />
          </button>
        </div>

        <h1 className="text-5xl font-bold text-white text-center mb-4">
          Choose Your Velvet Experience
        </h1>
        <p className="text-gray-300 text-center mb-12 text-lg">
          Select the tier that fits your needs
        </p>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <div className="text-sm text-rose-300 font-semibold mb-2">EVERYDAY COMPANION</div>
            <h2 className="text-3xl font-bold text-white mb-4">
              {SUBSCRIPTION_PLANS.unlimited.name}
            </h2>
            <p className="text-gray-300 mb-6">
              Your everyday companion - always ready to talk
            </p>
            <div className="text-4xl font-bold text-white mb-6">
              ${SUBSCRIPTION_PLANS.unlimited.price}
              <span className="text-lg text-gray-400">/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-gray-200">
              {SUBSCRIPTION_PLANS.unlimited.features.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-400 mr-2">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelectPlan(SUBSCRIPTION_PLANS.unlimited.stripeLink)}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-lg transition"
            >
              {currentTier === 'unlimited' ? 'Current Plan' : 'Subscribe Now'}
            </button>
          </div>

          <div className="bg-gradient-to-br from-rose-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-8 border-2 border-rose-500/50 relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-rose-500 text-white px-4 py-1 rounded-full text-sm font-bold">
              PREMIUM QUALITY
            </div>
            <div className="text-sm text-rose-300 font-semibold mb-2">SOPHISTICATED COMPANION</div>
            <h2 className="text-3xl font-bold text-white mb-4">Velvet Pro</h2>
            <p className="text-gray-200 mb-6 italic">
              Your sophisticated companion evolved - deeper understanding, richer conversations. You can feel it.
            </p>
            <p className="text-sm text-gray-300 mb-6">
              Perfect for deep emotional conversations, work support, and complex problem-solving. Messages never expire.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleSelectPlan(SUBSCRIPTION_PLANS.starter.stripeLink)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold py-3 rounded-lg transition text-left px-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-300">Starter Pack</div>
                    <div className="text-xs text-gray-400">Try premium quality</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${SUBSCRIPTION_PLANS.starter.price}</div>
                    <div className="text-xs text-gray-400">{SUBSCRIPTION_PLANS.starter.messageLimit} messages</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelectPlan(SUBSCRIPTION_PLANS.plus.stripeLink)}
                className="w-full bg-rose-600 hover:bg-rose-700 border-2 border-rose-400 text-white font-bold py-3 rounded-lg transition text-left px-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm">Plus Pack</div>
                    <div className="text-xs opacity-90">Most popular ⭐</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${SUBSCRIPTION_PLANS.plus.price}</div>
                    <div className="text-xs opacity-90">{SUBSCRIPTION_PLANS.plus.messageLimit} messages</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelectPlan(SUBSCRIPTION_PLANS.elite.stripeLink)}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold py-3 rounded-lg transition text-left px-4"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-300">Elite Pack</div>
                    <div className="text-xs text-gray-400">For deep connections</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${SUBSCRIPTION_PLANS.elite.price}</div>
                    <div className="text-xs text-gray-400">{SUBSCRIPTION_PLANS.elite.messageLimit} messages</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-400 text-sm">
          All purchases are secure and encrypted. Test mode - use card 4242 4242 4242 4242
        </p>
      </div>
    </div>
  );
}
