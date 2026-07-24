import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

type Tier = 'unlimited' | 'starter' | 'plus' | 'elite';

interface TierConfig {
  messages: number;
  haiku: boolean;
  sonnet: boolean;
}

// Monthly message allotment + model access per paid tier.
// Keep these in sync with src/types/subscription.ts (messageLimit per plan).
const TIER_CONFIG: Record<Tier, TierConfig> = {
  unlimited: { messages: 1500, haiku: true, sonnet: false },
  starter:   { messages: 2000, haiku: false, sonnet: true },
  plus:      { messages: 4000, haiku: false, sonnet: true },
  elite:     { messages: 8000, haiku: false, sonnet: true },
};

// Stripe Price ID -> tier. Mirrors stripePriceId in src/types/subscription.ts.
// Used to resolve the tier for subscription/invoice events (which don't always
// carry our metadata, e.g. plan changes made through the Stripe customer portal).
const PRICE_TO_TIER: Record<string, Tier> = {
  'price_1SrhkAB8CmoO93RgA3U7Liqu': 'unlimited',
  'price_1SrhszB8CmoO93RgC3iGKI0c': 'starter',
  'price_1SrhvzB8CmoO93RgrjUVPsvw': 'plus',
  'price_1SrhxcB8CmoO93Rg9sT3NXxQ': 'elite',
};

function isTier(value: string | null | undefined): value is Tier {
  return value === 'unlimited' || value === 'starter' || value === 'plus' || value === 'elite';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Webhook misconfigured: missing env vars');
    return json({ error: 'Server not configured' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // --- Verify signature ------------------------------------------------------
  let event: Stripe.Event;
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new Error('Missing stripe-signature header');
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', (err as Error).message);
    return json({ error: `Webhook Error: ${(err as Error).message}` }, 400);
  }

  console.log('Received Stripe webhook event:', event.type, event.id);

  // --- Helpers ---------------------------------------------------------------

  // Resolve our internal user id from a subscription's metadata, falling back to
  // a DB lookup by stored stripe ids. Returns null if we can't match a user.
  async function resolveUserId(opts: {
    metadataUserId?: string | null;
    subscriptionId?: string | null;
    customerId?: string | null;
  }): Promise<string | null> {
    if (opts.metadataUserId) return opts.metadataUserId;

    if (opts.subscriptionId) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('stripe_subscription_id', opts.subscriptionId)
        .maybeSingle();
      if (data?.id) return data.id;
    }

    if (opts.customerId) {
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('stripe_customer_id', opts.customerId)
        .maybeSingle();
      if (data?.id) return data.id;
    }

    return null;
  }

  // Set a user's balance to a fresh full allotment for the tier (renewals).
  async function applyTierRefill(userId: string, tier: Tier, subscriptionId?: string | null, customerId?: string | null) {
    const config = TIER_CONFIG[tier];
    const updates: Record<string, unknown> = {
      subscription_tier: tier,
      messages_remaining: config.messages,
      haiku_model_enabled: config.haiku,
      sonnet_model_enabled: config.sonnet,
    };
    if (subscriptionId) updates.stripe_subscription_id = subscriptionId;
    if (customerId) updates.stripe_customer_id = customerId;

    const { error } = await supabase.from('user_profiles').update(updates).eq('id', userId);
    if (error) throw error;
  }

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Initial purchase. Grants the tier and stores the Stripe ids.
      // Uses additive message logic so any leftover trial/previous balance is
      // preserved on first upgrade (existing behavior).
      // -----------------------------------------------------------------------
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;

        if (!metadata?.userId || !isTier(metadata?.tier)) {
          console.error('checkout.session.completed missing metadata:', metadata);
          return json({ error: 'Missing userId or valid tier in metadata' }, 400);
        }

        const userId = metadata.userId;
        const tier = metadata.tier;
        const config = TIER_CONFIG[tier];

        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('messages_remaining')
          .eq('id', userId)
          .maybeSingle();

        let newMessageCount = config.messages;
        if (currentProfile?.messages_remaining && currentProfile.messages_remaining > 0) {
          newMessageCount = currentProfile.messages_remaining + config.messages;
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier: tier,
            messages_remaining: newMessageCount,
            haiku_model_enabled: config.haiku,
            sonnet_model_enabled: config.sonnet,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: (session.subscription as string) || null,
          })
          .eq('id', userId);

        if (updateError) {
          console.error('checkout.session.completed update failed:', updateError);
          return json({ error: 'Failed to update user profile' }, 500);
        }

        console.log(`Upgraded user ${userId} to ${tier} (checkout)`);
        break;
      }

      // -----------------------------------------------------------------------
      // Recurring renewal (and the first invoice). Refills the monthly balance.
      // The very first invoice for a new subscription is skipped here because
      // checkout.session.completed already granted it — avoids a double grant.
      // -----------------------------------------------------------------------
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;

        // Only subscription renewals should refill. subscription_create is the
        // initial invoice, already handled by checkout.session.completed.
        if (invoice.billing_reason === 'subscription_create') {
          console.log('invoice.paid: initial invoice, skipping (handled by checkout)');
          break;
        }
        if (invoice.billing_reason !== 'subscription_cycle' && invoice.billing_reason !== 'subscription_update') {
          console.log(`invoice.paid: ignoring billing_reason=${invoice.billing_reason}`);
          break;
        }

        const subscriptionId = (invoice.subscription as string) || null;
        const customerId = (invoice.customer as string) || null;

        // Determine tier from the invoice line item's price, fall back to
        // subscription metadata.
        const priceId = invoice.lines?.data?.[0]?.price?.id ?? null;
        let tier: Tier | null = priceId && isTier(PRICE_TO_TIER[priceId]) ? PRICE_TO_TIER[priceId] : null;

        let metadataUserId: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          metadataUserId = (sub.metadata?.userId as string) || null;
          if (!tier) {
            const subPriceId = sub.items.data[0]?.price?.id ?? null;
            if (subPriceId && isTier(PRICE_TO_TIER[subPriceId])) tier = PRICE_TO_TIER[subPriceId];
            if (!tier && isTier(sub.metadata?.tier)) tier = sub.metadata.tier as Tier;
          }
        }

        if (!tier) {
          console.error('invoice.paid: could not resolve tier', { priceId, subscriptionId });
          return json({ error: 'Could not resolve tier' }, 400);
        }

        const userId = await resolveUserId({ metadataUserId, subscriptionId, customerId });
        if (!userId) {
          console.error('invoice.paid: could not resolve user', { subscriptionId, customerId });
          return json({ error: 'Could not resolve user' }, 400);
        }

        await applyTierRefill(userId, tier, subscriptionId, customerId);
        console.log(`Refilled user ${userId} to ${tier} (renewal)`);
        break;
      }

      // -----------------------------------------------------------------------
      // Plan change (upgrade/downgrade) or status change (past_due, paused...).
      // Re-syncs tier + model access from the current price. Does NOT change the
      // message balance here — mid-cycle refills happen on invoice.paid.
      // -----------------------------------------------------------------------
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const subscriptionId = sub.id;
        const customerId = (sub.customer as string) || null;

        // If the subscription is no longer active, treat like a downgrade to free.
        const inactive = ['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status);

        const userId = await resolveUserId({
          metadataUserId: (sub.metadata?.userId as string) || null,
          subscriptionId,
          customerId,
        });
        if (!userId) {
          console.error('customer.subscription.updated: could not resolve user', { subscriptionId, customerId });
          return json({ error: 'Could not resolve user' }, 400);
        }

        if (inactive) {
          await downgradeToFree(supabase, userId);
          console.log(`Downgraded user ${userId} to free (subscription ${sub.status})`);
          break;
        }

        const priceId = sub.items.data[0]?.price?.id ?? null;
        let tier: Tier | null = priceId && isTier(PRICE_TO_TIER[priceId]) ? PRICE_TO_TIER[priceId] : null;
        if (!tier && isTier(sub.metadata?.tier)) tier = sub.metadata.tier as Tier;

        if (!tier) {
          console.error('customer.subscription.updated: could not resolve tier', { priceId });
          return json({ error: 'Could not resolve tier' }, 400);
        }

        const config = TIER_CONFIG[tier];
        const { error } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier: tier,
            haiku_model_enabled: config.haiku,
            sonnet_model_enabled: config.sonnet,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', userId);
        if (error) throw error;

        console.log(`Synced user ${userId} to ${tier} (subscription updated)`);
        break;
      }

      // -----------------------------------------------------------------------
      // Cancellation / expiry. Reverts the user to the free tier.
      // -----------------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId({
          metadataUserId: (sub.metadata?.userId as string) || null,
          subscriptionId: sub.id,
          customerId: (sub.customer as string) || null,
        });
        if (!userId) {
          console.error('customer.subscription.deleted: could not resolve user', { subscriptionId: sub.id });
          return json({ error: 'Could not resolve user' }, 400);
        }

        await downgradeToFree(supabase, userId);
        console.log(`Downgraded user ${userId} to free (subscription deleted)`);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', (error as Error).message);
    // Return 500 so Stripe retries transient failures.
    return json({ error: (error as Error).message }, 500);
  }
});

// Revert a user to the free tier: no paid messages, no premium model access,
// and clear the subscription id so a future purchase starts clean.
async function downgradeToFree(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: 'free',
      messages_remaining: 0,
      haiku_model_enabled: false,
      sonnet_model_enabled: false,
      stripe_subscription_id: null,
    })
    .eq('id', userId);
  if (error) throw error;
}
