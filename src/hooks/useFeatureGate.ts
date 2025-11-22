import { SUBSCRIPTION_PLANS, SubscriptionTier } from '../types/subscription';

export function useFeatureGate(userTier: SubscriptionTier) {
  const plan = SUBSCRIPTION_PLANS[userTier];

  const canSendMessage = (dailyCount: number) => {
    if (plan.limits.messagesPerDay === -1) return true;
    return dailyCount < plan.limits.messagesPerDay;
  };

  const canGenerateVideo = (dailyCount: number) => {
    if (plan.limits.videosPerDay === -1) return true;
    return dailyCount < plan.limits.videosPerDay;
  };

  const getContextWindow = () => plan.limits.contextWindow;

  const getModelAccess = () => plan.limits.modelAccess;

  const showUpgradePrompt = (feature: string) => {
    return `Upgrade to ${userTier === 'free' ? 'Basic' : 'Premium'} to unlock ${feature}`;
  };

  return {
    canSendMessage,
    canGenerateVideo,
    getContextWindow,
    getModelAccess,
    showUpgradePrompt,
    currentPlan: plan
  };
}
