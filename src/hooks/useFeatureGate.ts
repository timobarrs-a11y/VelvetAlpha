import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';

export function useFeatureGate(userTier: SubscriptionTier) {
  const plan = SUBSCRIPTION_PLANS[userTier];
  const messageLimit = plan.messageLimit ?? 0;

  const canSendMessage = (remaining: number) => {
    if (messageLimit === -1) return true;
    return remaining > 0;
  };

  const isPaidTier = userTier !== 'free';

  const isHighTier = userTier === 'trial' || userTier === 'starter' || userTier === 'plus' || userTier === 'elite';

  const showUpgradePrompt = (feature: string) => {
    if (userTier === 'free') return `Upgrade to unlock ${feature}`;
    return `Upgrade to a higher plan to unlock ${feature}`;
  };

  return {
    canSendMessage,
    isPaidTier,
    isHighTier,
    showUpgradePrompt,
    currentPlan: plan,
    messageLimit,
  };
}
