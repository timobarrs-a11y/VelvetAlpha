export type SubscriptionTier = 'free' | 'trial' | 'unlimited' | 'starter' | 'plus' | 'elite';

export function normalizeSubscriptionTier(tier: string | null | undefined): SubscriptionTier {
  if (!tier) return 'free';

  const validTiers: SubscriptionTier[] = ['free', 'trial', 'unlimited', 'starter', 'plus', 'elite'];
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
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    stripeLink: '',
    features: [
      'Explore the Velvet experience',
      'Limited messaging',
      'See what AI companionship feels like'
    ],
    model: 'haiku',
    messageLimit: 15
  },
  trial: {
    tier: 'trial',
    name: 'Premium Trial',
    price: 0,
    stripeLink: '',
    features: [
      'Full Elite-level access for 3 days',
      'Velvet V2 — deepest AI available',
      'Signature Voice™ characters',
      'Insights, calendar, and all premium features',
      'No credit card required'
    ],
    model: 'sonnet',
    marketingLabel: 'Trial',
    messageLimit: 5000,
    isTrial: true
  },
  unlimited: {
    tier: 'unlimited',
    name: 'Velvet Essential',
    price: 24.99,
    stripeLink: 'https://buy.stripe.com/3cIaEWds25dSgVS9U54Vy00',
    stripePriceId: 'price_1SrhkAB8CmoO93RgA3U7Liqu',
    features: [
      '1,500 messages a month with Velvet V1 — no daily limits',
      'Fast, responsive AI companion',
      'Ask anything, learn anything, talk about everything',
      'Perfect for everyday chat'
    ],
    model: 'haiku',
    marketingLabel: 'Essential',
    messageLimit: 1500
  },
  starter: {
    tier: 'starter',
    name: 'Velvet Plus',
    price: 59,
    stripeLink: 'https://buy.stripe.com/bJe4gy1Jk49O8pmc2d4Vy01',
    stripePriceId: 'price_1SrhszB8CmoO93RgC3iGKI0c',
    features: [
      'Powered by Velvet V2 - deeper conversation, improved context, pattern insights',
      'Introducing Signature Voice™ - unique characters you won\'t find anywhere else',
      'Complex reasoning, creative thinking, real problem-solving',
      'Access to Insights',
      '2,000 messages a month with Velvet V2'
    ],
    model: 'sonnet',
    marketingLabel: 'Plus',
    messageLimit: 2000
  },
  plus: {
    tier: 'plus',
    name: 'Velvet Pro',
    price: 99,
    stripeLink: 'https://buy.stripe.com/8x2aEW9bM35KbBy8Q14Vy02',
    stripePriceId: 'price_1SrhvzB8CmoO93RgrjUVPsvw',
    features: [
      'Everything in Plus (Velvet V2, Insights, Signature Voice™)',
      '4,000 messages a month — room to go deep every day'
    ],
    model: 'sonnet',
    marketingLabel: 'Pro',
    messageLimit: 4000
  },
  elite: {
    tier: 'elite',
    name: 'Velvet Elite',
    price: 149,
    stripeLink: 'https://buy.stripe.com/eVqeVcds249O4961nz4Vy03',
    stripePriceId: 'price_1SrhxcB8CmoO93Rg9sT3NXxQ',
    features: [
      'Everything in Pro (Velvet V2, Insights, Signature Voice™)',
      '8,000 messages a month — our highest allowance',
      'Access to VIP Support',
      'Access to new features before release'
    ],
    model: 'sonnet',
    marketingLabel: 'Elite',
    messageLimit: 8000
  }
};
