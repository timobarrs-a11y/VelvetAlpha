import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

type PaidTier = 'unlimited' | 'starter' | 'plus' | 'elite';

// Entitlements per paid tier. MUST stay in sync with SUBSCRIPTION_PLANS in
// src/types/subscription.ts (that file is what the UI advertises). The renewal
// model is RESET: each billing cycle SETS messages_remaining to `messages`.
const TIER_ENTITLEMENTS: Record<PaidTier, { messages: number; haiku: boolean; sonnet: boolean }> = {
  unlimited: { messages: 1500, haiku: true, sonnet: false },  // "Velvet Essential" $24.99 (capped Haiku, no longer unlimited)
  starter:   { messages: 2000, haiku: false, sonnet: true },  // "Velvet Plus"      $59
  plus:      { messages: 4000, haiku: false, sonnet: true },  // "Velvet Pro"       $99
  elite:     { messages: 8000, haiku: false, sonnet: true },  // "Velvet Elite"     $149
};

// What a user drops to when their subscription ends or fails.
const FREE_ENTITLEMENT = { tier: 'free', messages: 15, haiku: true, sonnet: false };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY not configured');
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });

    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new Error('Missing stripe-signature header');

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    console.log('Received Stripe webhook event:', event.type, event.id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // --- Idempotency: skip events we've already handled. Inserting first means a
    // concurrent duplicate delivery loses the race and is ignored. ---
    const { error: dupError } = await supabase
      .from('stripe_processed_events')
      .insert({ event_id: event.id, event_type: event.type });
    if (dupError) {
      // Unique-violation => already processed. Any other error we log but still ack
      // (Stripe would retry forever otherwise; the signature already proved authenticity).
      console.log(`Event ${event.id} already processed or insert failed: ${dupError.message}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (event.type) {
      // Initial purchase / upgrade. Sets the tier and grants the full allotment.
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier as PaidTier | undefined;

        if (!userId || !tier) {
          console.error('Missing userId/tier in checkout metadata:', session.metadata);
          break; // acked below; nothing we can do without identity
        }
        const config = TIER_ENTITLEMENTS[tier];
        if (!config) { console.error('Invalid tier:', tier); break; }

        const { error } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier: tier,
            messages_remaining: config.messages,       // reset model: set to allotment
            haiku_model_enabled: config.haiku,
            sonnet_model_enabled: config.sonnet,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: (session.subscription as string) || null,
          })
          .eq('id', userId);
        if (error) throw new Error(`Profile update failed: ${error.message}`);
        console.log(`Upgraded user ${userId} -> ${tier}`);
        break;
      }

      // Monthly renewal. Refill messages to the tier allotment. The FIRST invoice
      // (subscription_create) is already covered by checkout.session.completed, so
      // only act on recurring cycles.
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason !== 'subscription_cycle') {
          console.log(`invoice.paid ignored (billing_reason=${invoice.billing_reason})`);
          break;
        }
        const subscriptionId = invoice.subscription as string | null;
        if (!subscriptionId) break;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, subscription_tier')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();
        if (!profile) { console.error('No profile for subscription', subscriptionId); break; }

        const config = TIER_ENTITLEMENTS[profile.subscription_tier as PaidTier];
        if (!config) { console.error('Renewal for unknown tier', profile.subscription_tier); break; }

        const { error } = await supabase
          .from('user_profiles')
          .update({
            messages_remaining: config.messages,        // reset to monthly allotment
            haiku_model_enabled: config.haiku,
            sonnet_model_enabled: config.sonnet,
            last_message_reset: new Date().toISOString(),
          })
          .eq('id', profile.id);
        if (error) throw new Error(`Renewal update failed: ${error.message}`);
        console.log(`Renewed ${profile.id} (${profile.subscription_tier}) -> ${config.messages} msgs`);
        break;
      }

      // Cancellation (period end reached, or deleted). Downgrade to free.
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await downgradeBySubscription(supabase, sub.id);
        break;
      }

      // Status change — downgrade if the sub is no longer in good standing.
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const dead = ['canceled', 'unpaid', 'incomplete_expired'];
        if (dead.includes(sub.status)) {
          await downgradeBySubscription(supabase, sub.id);
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Non-2xx tells Stripe to retry. We only reach here on genuine processing
    // failures (signature/parse/db), which are worth retrying.
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function downgradeBySubscription(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
): Promise<void> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (!profile) { console.error('No profile to downgrade for subscription', subscriptionId); return; }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      subscription_tier: FREE_ENTITLEMENT.tier,
      messages_remaining: FREE_ENTITLEMENT.messages,
      haiku_model_enabled: FREE_ENTITLEMENT.haiku,
      sonnet_model_enabled: FREE_ENTITLEMENT.sonnet,
      stripe_subscription_id: null,
    })
    .eq('id', profile.id);
  if (error) console.error('Downgrade failed:', error.message);
  else console.log(`Downgraded ${profile.id} to free (subscription ${subscriptionId} ended)`);
}
