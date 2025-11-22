export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number;
  priceId: string;
  features: string[];
  limits: {
    messagesPerDay: number;
    videosPerDay: number;
    contextWindow: number;
    modelAccess: 'cheap' | 'premium' | 'both';
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    priceId: '',
    features: [
      'Text + voice conversations',
      '3-5 AI images per day',
      '1 video per day',
      'Basic memory (last 10 messages)',
      'Cheap AI model for most responses'
    ],
    limits: {
      messagesPerDay: 50,
      videosPerDay: 1,
      contextWindow: 10,
      modelAccess: 'cheap'
    }
  },
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 14.99,
    priceId: 'price_basic_test',
    features: [
      'Everything in Free',
      'Unlimited messages',
      '10 videos per day',
      'Full memory (last 50 messages)',
      'Mix of cheap + premium AI models'
    ],
    limits: {
      messagesPerDay: -1,
      videosPerDay: 10,
      contextWindow: 50,
      modelAccess: 'both'
    }
  },
  premium: {
    tier: 'premium',
    name: 'Premium',
    price: 29.99,
    priceId: 'price_premium_test',
    features: [
      'Everything in Basic',
      'Unlimited videos',
      'Advanced memory (vector search, unlimited)',
      'Always uses premium AI model',
      'Priority support',
      'Early access to new features'
    ],
    limits: {
      messagesPerDay: -1,
      videosPerDay: -1,
      contextWindow: -1,
      modelAccess: 'premium'
    }
  }
};
