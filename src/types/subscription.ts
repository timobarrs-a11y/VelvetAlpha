export type SubscriptionTier = 'free' | 'unlimited' | 'starter' | 'plus' | 'elite';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number;
  stripeLink: string;
  features: string[];
  model: 'haiku' | 'sonnet';
  messageLimit?: number;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    stripeLink: '',
    features: [
      '15 messages to try it out',
      'All characters available',
      'Basic conversations'
    ],
    model: 'haiku',
    messageLimit: 15
  },
  unlimited: {
    tier: 'unlimited',
    name: 'Velvet Unlimited',
    price: 24.99,
    stripeLink: 'https://buy.stripe.com/test_eVqbJ0fE0g744gocED',
    features: [
      'Unlimited messages',
      'All characters unlocked',
      'Fast, responsive conversations',
      'Perfect for daily check-ins'
    ],
    model: 'haiku',
    messageLimit: -1
  },
  starter: {
    tier: 'starter',
    name: 'Velvet Pro - Starter',
    price: 9.99,
    stripeLink: 'https://buy.stripe.com/test_5kQ6oGdvSdYW14c487',
    features: [
      '200 premium messages',
      'Deep emotional conversations',
      'Sophisticated understanding',
      'Messages never expire'
    ],
    model: 'sonnet',
    messageLimit: 200
  },
  plus: {
    tier: 'plus',
    name: 'Velvet Pro - Plus',
    price: 24.99,
    stripeLink: 'https://buy.stripe.com/test_eVq3cufE0aMK3ckfQP',
    features: [
      '1,000 premium messages',
      'Richer conversations',
      'Complex problem-solving',
      'Messages never expire'
    ],
    model: 'sonnet',
    messageLimit: 1000
  },
  elite: {
    tier: 'elite',
    name: 'Velvet Pro - Elite',
    price: 49.99,
    stripeLink: 'https://buy.stripe.com/test_00w8wOajGaMK28g9sr',
    features: [
      '3,000 premium messages',
      'For deep connections',
      'Work support included',
      'Messages never expire'
    ],
    model: 'sonnet',
    messageLimit: 3000
  }
};
