export type SubscriptionTier = 'free' | 'trial' | 'essential' | 'plus' | 'elite';

export function normalizeSubscriptionTier(tier: string | null | undefined): SubscriptionTier {
  if (!tier) return 'free';

  // Map legacy tier names to new structure
  const legacyMap: Record<string, SubscriptionTier> = {
    unlimited: 'essential',
    starter: 'plus',
  };

  if (legacyMap[tier]) return legacyMap[tier];

  const validTiers: SubscriptionTier[] = ['free', 'trial', 'essential', 'plus', 'elite'];
  if (validTiers.includes(tier as SubscriptionTier)) {
    return tier as SubscriptionTier;
  }

  console.warn(`Unknown subscription tier "${tier}", defaulting to 'free'`);
  return 'free';
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number;
  stripeLink: string;
  stripePriceId?: string;
  features: string[];
  model: 'haiku' | 'sonnet';
  messageLimit?: number;
  marketingLabel?: string;
  isTrial?: boolean;
  maxCoaches: number;
  hasInsights: boolean;
  hasExpertBuilder: boolean;
  memoryDepthDays: number;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    stripeLink: '',
    features: [
      '1 AI coach with full memory',
      '30 messages per month',
      'Goal discovery and tracking',
      'Daily proactive check-ins',
      'Experience the coaching relationship',
    ],
    model: 'sonnet',
    messageLimit: 30,
    marketingLabel: 'Free',
    maxCoaches: 1,
    hasInsights: false,
    hasExpertBuilder: false,
    memoryDepthDays: 7,
  },
  trial: {
    tier: 'trial',
    name: 'Premium Trial',
    price: 0,
    stripeLink: '',
    features: [
      'Full Elite-level access for 3 days',
      'Unlimited coaches and AI experts',
      'Insights, calendar, and all premium features',
      'Deep memory and proactive check-ins',
      'No credit card required',
    ],
    model: 'sonnet',
    marketingLabel: 'Trial',
    messageLimit: 8000,
    isTrial: true,
    maxCoaches: 99,
    hasInsights: true,
    hasExpertBuilder: true,
    memoryDepthDays: 30,
  },
  essential: {
    tier: 'essential',
    name: 'Velvet Essential',
    price: 19,
    stripeLink: '',
    stripePriceId: '',
    features: [
      '1 AI coach with full Sonnet intelligence',
      '1,500 messages per month',
      'Goal tracking and proactive check-ins',
      '7-day conversation memory',
      'Signature Voice characters',
    ],
    model: 'sonnet',
    marketingLabel: 'Essential',
    messageLimit: 1500,
    maxCoaches: 1,
    hasInsights: false,
    hasExpertBuilder: false,
    memoryDepthDays: 7,
  },
  plus: {
    tier: 'plus',
    name: 'Velvet Plus',
    price: 49,
    stripeLink: '',
    stripePriceId: '',
    features: [
      'Up to 3 AI coaches',
      '3,000 messages per month',
      'Insights — pattern detection and reflection tools',
      'Calendar integration with smart event detection',
      '14-day conversation memory',
      'Signature Voice characters',
    ],
    model: 'sonnet',
    marketingLabel: 'Plus',
    messageLimit: 3000,
    maxCoaches: 3,
    hasInsights: true,
    hasExpertBuilder: false,
    memoryDepthDays: 14,
  },
  elite: {
    tier: 'elite',
    name: 'Velvet Elite',
    price: 99,
    stripeLink: '',
    stripePriceId: '',
    features: [
      'Unlimited AI coaches',
      '4,000 messages per month',
      'Custom Expert Builder — design your own specialist',
      'Advanced Insights with deep pattern analysis',
      '30-day conversation memory with semantic search',
      'Early access to new features',
    ],
    model: 'sonnet',
    marketingLabel: 'Elite',
    messageLimit: 4000,
    maxCoaches: 99,
    hasInsights: true,
    hasExpertBuilder: true,
    memoryDepthDays: 30,
  },
};

export const PAID_TIERS: SubscriptionTier[] = ['essential', 'plus', 'elite'];

export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'essential' || tier === 'plus' || tier === 'elite';
}

export function isPremiumTier(tier: SubscriptionTier): boolean {
  return tier === 'plus' || tier === 'elite' || tier === 'trial';
}

export function isEliteTier(tier: SubscriptionTier): boolean {
  return tier === 'elite' || tier === 'trial';
}
