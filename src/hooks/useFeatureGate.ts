import { SUBSCRIPTION_PLANS, SubscriptionTier, isPaidTier, isPremiumTier, isEliteTier } from '../types/subscription';

export function useFeatureGate(userTier: SubscriptionTier) {
  const plan = SUBSCRIPTION_PLANS[userTier];
  const messageLimit = plan.messageLimit ?? 0;

  const canSendMessage = (remaining: number) => {
    if (messageLimit === -1) return true;
    return remaining > 0;
  };

  const showUpgradePrompt = (feature: string) => {
    if (!isPaidTier(userTier)) return `Upgrade to unlock ${feature}`;
    return `Upgrade to a higher plan to unlock ${feature}`;
  };

  return {
    canSendMessage,
    isPaidTier: isPaidTier(userTier),
    isPremiumTier: isPremiumTier(userTier),
    isEliteTier: isEliteTier(userTier),
    showUpgradePrompt,
    currentPlan: plan,
    messageLimit,
    maxCoaches: plan.maxCoaches,
    hasInsights: plan.hasInsights,
    hasExpertBuilder: plan.hasExpertBuilder,
  };
}
