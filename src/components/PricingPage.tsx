import React from 'react';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';
import { redirectToCheckout } from '../services/stripeService';

interface PricingPageProps {
  currentTier: SubscriptionTier;
  onClose: () => void;
}

export function PricingPage({ currentTier, onClose }: PricingPageProps) {
  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') return;
    await redirectToCheckout(tier);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold">Choose Your Plan</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600 mt-2">Unlock premium features and unlimited access</p>
        </div>

        <div className="p-6 grid md:grid-cols-3 gap-6">
          {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
            const isCurrent = plan.tier === currentTier;
            const isUpgrade = plan.price > SUBSCRIPTION_PLANS[currentTier].price;

            return (
              <div
                key={plan.tier}
                className={`rounded-xl p-6 border-2 relative ${
                  plan.tier === 'premium'
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-sky-50'
                    : 'border-gray-200'
                }`}
              >
                {plan.tier === 'premium' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-sky-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    {plan.price > 0 && <span className="text-gray-600">/month</span>}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">✓</span>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.tier)}
                  disabled={isCurrent || !isUpgrade}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isUpgrade
                      ? plan.tier === 'premium'
                        ? 'bg-gradient-to-r from-blue-500 to-sky-500 text-white hover:from-blue-600 hover:to-sky-600'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-6 bg-gray-50 border-t text-center text-sm text-gray-600">
          <p>Cancel anytime. No hidden fees. Test mode - use card 4242 4242 4242 4242</p>
        </div>
      </div>
    </div>
  );
}
