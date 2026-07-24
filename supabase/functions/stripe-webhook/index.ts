import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

// Mirrors SUBSCRIPTION_PLANS in src/types/subscription.ts
const TIER_CONFIG: Record<string, { messages: number; haiku: boolean; sonnet: boolean }> = {
  unlimited: { messages: 1500, haiku: true,  sonnet: false },
  starter:   { messages: 2000, haiku: false, sonnet: true  },
  plus:      { messages: 4000, haiku: false, sonnet: true  },
  elite:     { messages: 8000, haiku: false, sonnet: true  },
};

// Must match stripePriceId values in src/types/subscription.ts
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SrhkAB8CmoO93RgA3U7Liqu': 'unlimited',
  'price_1SrhszB8CmoO93RgC3iGKI0c': 'starter',
  'price_1SrhvzB8CmoO93RgrjUVPsvw': 'plus',
  'price_1SrhxcB8CmoO93Rg9sT3NXxQ': 'elite',
};

type SupabaseClient = ReturnType<typeof createClient>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Resolve the internal user ID from webhook event objects.
 * Priority: subscription metadata.userId → DB lookup by stripe_subscription_id → DB lookup by stripe_customer_id.
 */
async function resolveUserId(
  supabase: SupabaseClient,
  opts: { subscriptionId?: string | null; customerId?: string | null; metadataUserId?: string | null },
): Promise<string | null> {
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

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<Response> {
  const metadata = session.metadata;
  if (!metadata?.userId || !metadata?.tier) {
    console.error('[checkout.session.completed] Missing metadata:', metadata);
    return json({ error: 'Missing userId or tier in metadata' }, 400);
  }

  const userId = metadata.userId;
  const tier = metadata.tier;
  const config = TIER_CONFIG[tier];

  if (!config) {
    console.error('[checkout.session.completed] Invalid tier:', tier);
    return json({ error: 'Invalid tier' }, 400);
  }

  // Additive: preserve any remaining trial/free balance so the user isn't punished for converting early.
  const { data: current } = await supabase
    .from('user_profiles')
    .select('messages_remaining')
    .eq('id', userId)
    .maybeSingle();

  const existing = current?.messages_remaining ?? 0;
  const carry = existing === -1 ? 0 : Math.max(0, existing);
  const newCount = carry + config.messages;

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: tier,
      messages_remaining: newCount,
      haiku_model_enabled: config.haiku,
      sonnet_model_enabled: config.sonnet,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: (session.subscription as string) || null,
    })
    .eq('id', userId);

  if (error) {
    console.error('[checkout.session.completed] DB update failed:', error);
    return json({ error: 'Failed to update user profile' }, 500);
  }

  console.log(`[checkout.session.completed] User ${userId} upgraded to ${tier}, messages_remaining=${newCount}`);
  return json({ received: true });
}

async function handleInvoicePaid(
  supabase: SupabaseClient,
  invoice: Stripe.Invoice,
): Promise<Response> {
  // The very first invoice is already handled by checkout.session.completed — skip it to avoid double-granting.
  if (invoice.billing_reason === 'subscription_create') {
    console.log('[invoice.paid] Skipping first invoice (subscription_create) — handled by checkout');
    return json({ received: true });
  }

  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;

  // Derive tier from the first line item's price ID.
  const priceId = invoice.lines?.data?.[0]?.price?.id ?? null;
  const tier = priceId ? PRICE_TO_TIER[priceId] : null;

  if (!tier) {
    console.warn('[invoice.paid] Unrecognised price ID, ignoring:', priceId);
    return json({ received: true });
  }

  const config = TIER_CONFIG[tier];

  const userId = await resolveUserId(supabase, { subscriptionId, customerId });
  if (!userId) {
    console.error('[invoice.paid] Could not resolve userId for subscription:', subscriptionId, 'customer:', customerId);
    return json({ error: 'User not found' }, 500);
  }

  // Renewal: set to the full monthly allotment (not additive — unused messages don't roll over).
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: tier,
      messages_remaining: config.messages,
      haiku_model_enabled: config.haiku,
      sonnet_model_enabled: config.sonnet,
    })
    .eq('id', userId);

  if (error) {
    console.error('[invoice.paid] DB update failed:', error);
    return json({ error: 'Failed to update user profile' }, 500);
  }

  console.log(`[invoice.paid] Renewed user ${userId} on ${tier}, messages_remaining reset to ${config.messages}`);
  return json({ received: true });
}

async function handleSubscriptionUpdated(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<Response> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;
  const metadataUserId = subscription.metadata?.userId ?? null;

  const userId = await resolveUserId(supabase, { subscriptionId, customerId, metadataUserId });
  if (!userId) {
    console.error('[customer.subscription.updated] Could not resolve userId for subscription:', subscriptionId);
    return json({ error: 'User not found' }, 500);
  }

  const canceledStatuses = ['canceled', 'unpaid', 'incomplete_expired'];
  if (canceledStatuses.includes(subscription.status)) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        subscription_tier: 'free',
        haiku_model_enabled: false,
        sonnet_model_enabled: false,
        stripe_subscription_id: null,
      })
      .eq('id', userId);

    if (error) {
      console.error('[customer.subscription.updated] DB downgrade failed:', error);
      return json({ error: 'Failed to update user profile' }, 500);
    }

    console.log(`[customer.subscription.updated] Downgraded user ${userId} to free (status: ${subscription.status})`);
    return json({ received: true });
  }

  // Active/trialing: sync tier from the current price.
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const tier = priceId ? PRICE_TO_TIER[priceId] : null;

  if (!tier) {
    console.warn('[customer.subscription.updated] Unrecognised price ID, ignoring:', priceId);
    return json({ received: true });
  }

  const config = TIER_CONFIG[tier];

  // Only sync tier + model flags; balance refill happens on invoice.paid.
  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: tier,
      haiku_model_enabled: config.haiku,
      sonnet_model_enabled: config.sonnet,
    })
    .eq('id', userId);

  if (error) {
    console.error('[customer.subscription.updated] DB sync failed:', error);
    return json({ error: 'Failed to update user profile' }, 500);
  }

  console.log(`[customer.subscription.updated] Synced user ${userId} to ${tier} (status: ${subscription.status})`);
  return json({ received: true });
}

async function handleSubscriptionDeleted(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
): Promise<Response> {
  const subscriptionId = subscription.id;
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null;
  const metadataUserId = subscription.metadata?.userId ?? null;

  const userId = await resolveUserId(supabase, { subscriptionId, customerId, metadataUserId });
  if (!userId) {
    console.error('[customer.subscription.deleted] Could not resolve userId for subscription:', subscriptionId);
    return json({ error: 'User not found' }, 500);
  }

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

  if (error) {
    console.error('[customer.subscription.deleted] DB update failed:', error);
    return json({ error: 'Failed to update user profile' }, 500);
  }

  console.log(`[customer.subscription.deleted] Cancelled user ${userId}, downgraded to free`);
  return json({ received: true });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return json({ error: 'Missing stripe-signature header' }, 400);
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    // constructEventAsync is the Deno-safe variant (uses WebCrypto instead of Node crypto).
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return json({ error: 'Invalid signature' }, 400);
  }

  console.log('[stripe-webhook] Event received:', event.type, event.id);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        return await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);

      case 'invoice.paid':
        return await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice);

      case 'customer.subscription.updated':
        return await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription);

      case 'customer.subscription.deleted':
        return await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription);

      default:
        // Acknowledge unhandled events so Stripe doesn't keep retrying them.
        console.log('[stripe-webhook] Unhandled event type, acknowledging:', event.type);
        return json({ received: true });
    }
  } catch (err) {
    // Return 500 so Stripe retries transient failures (DB timeouts, etc.).
    console.error('[stripe-webhook] Unhandled handler error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
