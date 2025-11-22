import { loadStripe } from '@stripe/stripe-js';
import type { SubscriptionTier } from '../types/subscription';

const STRIPE_PUBLISHABLE_KEY = 'pk_test_PLACEHOLDER';

let stripePromise: ReturnType<typeof loadStripe> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
}

export async function createCheckoutSession(tier: SubscriptionTier): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ tier })
    });

    const { sessionId } = await response.json();
    return sessionId;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }
}

export async function redirectToCheckout(tier: SubscriptionTier) {
  const stripe = await getStripe();
  if (!stripe) {
    console.error('Stripe not loaded');
    return;
  }

  const sessionId = await createCheckoutSession(tier);
  if (!sessionId) {
    console.error('Failed to create checkout session');
    return;
  }

  const { error } = await stripe.redirectToCheckout({ sessionId });
  if (error) {
    console.error('Stripe redirect error:', error);
  }
}

export async function createPortalSession(): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    const { url } = await response.json();
    return url;
  } catch (error) {
    console.error('Error creating portal session:', error);
    return null;
  }
}
