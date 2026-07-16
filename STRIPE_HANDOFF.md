# Stripe Webhook Hardening — Handoff for Bolt

Self-contained deploy instructions to make the live Stripe integration safe for
recurring subscriptions. No git checkout required.

**What this fixes (all were broken before):**
1. **Renewals didn't refill messages** — subscriptions bill monthly but the
   webhook only handled the first payment. Now `invoice.paid` resets the message
   balance to the tier allotment each cycle.
2. **Cancellations/failures never downgraded** — now `customer.subscription.deleted`
   and `.updated` (canceled/unpaid) drop the user to free.
3. **`unlimited` tier gave infinite messages** — RESOLVED. The product moved off
   "unlimited" entirely to honest capped allowances (see the pricing/terms work).
   "Velvet Essential" is now a capped **1,500** Haiku messages/month.
4. **No idempotency** — Stripe retries could double-credit. Now every event id is
   recorded and repeats are ignored.

Renewal model chosen by the owner: **RESET** — each cycle SETS messages to the
tier amount (not additive rollover).

**Allowance ladder (decided — must match `src/types/subscription.ts` `messageLimit`):**
Essential 1,500 · Plus 2,000 · Pro 4,000 · Elite 8,000. No tier is "unlimited."
The frontend copy for these already ships with the build; this webhook is the
server-side enforcement of the same numbers.

Three parts: (1) migration, (2) replace the webhook, (3) **configure the Stripe
dashboard** — the code is useless if the events aren't enabled.

---

## PART 1 — Migration (idempotency table)

```sql
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  event_id text PRIMARY KEY,
  event_type text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the webhook (service_role) writes; service_role bypasses RLS.
```

---

## PART 2 — Replace `supabase/functions/stripe-webhook/index.ts`

Replace the ENTIRE file with:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

type PaidTier = 'unlimited' | 'starter' | 'plus' | 'elite';

// Entitlements per paid tier. MUST stay in sync with SUBSCRIPTION_PLANS in
// src/types/subscription.ts. Renewal model is RESET: each cycle SETS messages.
const TIER_ENTITLEMENTS: Record<PaidTier, { messages: number; haiku: boolean; sonnet: boolean }> = {
  unlimited: { messages: 1500, haiku: true, sonnet: false },  // "Velvet Essential" $24.99 (capped Haiku)
  starter:   { messages: 2000, haiku: false, sonnet: true },  // "Velvet Plus"      $59
  plus:      { messages: 4000, haiku: false, sonnet: true },  // "Velvet Pro"       $99
  elite:     { messages: 8000, haiku: false, sonnet: true },  // "Velvet Elite"     $149
};

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
    // constructEventAsync uses WebCrypto — required in the Deno edge runtime.
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    console.log('Received Stripe webhook event:', event.type, event.id);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Idempotency: insert-first, skip on duplicate.
    const { error: dupError } = await supabase
      .from('stripe_processed_events')
      .insert({ event_id: event.id, event_type: event.type });
    if (dupError) {
      console.log(`Event ${event.id} already processed or insert failed: ${dupError.message}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier as PaidTier | undefined;
        if (!userId || !tier) { console.error('Missing metadata:', session.metadata); break; }
        const config = TIER_ENTITLEMENTS[tier];
        if (!config) { console.error('Invalid tier:', tier); break; }

        const { error } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier: tier,
            messages_remaining: config.messages,
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
            messages_remaining: config.messages,
            haiku_model_enabled: config.haiku,
            sonnet_model_enabled: config.sonnet,
            last_message_reset: new Date().toISOString(),
          })
          .eq('id', profile.id);
        if (error) throw new Error(`Renewal update failed: ${error.message}`);
        console.log(`Renewed ${profile.id} (${profile.subscription_tier}) -> ${config.messages} msgs`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await downgradeBySubscription(supabase, sub.id);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
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
  if (!profile) { console.error('No profile to downgrade for', subscriptionId); return; }

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
```

Then **redeploy the `stripe-webhook` function.**

---

## PART 3 — Configure the Stripe dashboard (REQUIRED — the code alone does nothing)

In the Stripe dashboard → **Developers → Webhooks → your endpoint** (the one
pointing at `.../functions/v1/stripe-webhook`):

1. Confirm you are in **LIVE mode** (top toggle), not Test.
2. Under **"Listen to events"**, make sure ALL of these are enabled — the new
   handlers never fire otherwise:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
3. Confirm the endpoint's **signing secret** matches the `STRIPE_WEBHOOK_SECRET`
   set in Supabase (Edge Function secrets). If you rotate or recreate the
   endpoint, update the secret.
4. Confirm `STRIPE_SECRET_KEY` in Supabase is the **live** key (`sk_live_…`), and
   that the 4 `price_…` IDs in `src/types/subscription.ts` are **live-mode**
   prices on the same account.

---

## PART 4 — Verify (use Stripe TEST mode + a test clock first)

1. **Initial purchase:** buy a tier as a test user → profile flips to that tier
   with the right message count, `stripe_subscription_id` populated.
2. **Renewal:** in Stripe Test mode, create a subscription on a **test clock**
   and advance it one billing cycle → `invoice.paid` fires with
   `billing_reason: subscription_cycle` → messages reset to the allotment.
3. **Cancel:** cancel the subscription → `customer.subscription.deleted` → user
   drops to free (15 messages, sonnet disabled).
4. **Idempotency:** in the webhook page, "Resend" a `checkout.session.completed`
   event → the profile does NOT change a second time; a row exists in
   `stripe_processed_events`; the response says `duplicate: true`.

If renewals don't refill → event not enabled in the dashboard (Part 3.2) or the
test clock didn't advance. If nothing happens on any event → wrong signing
secret (Part 3.3).
