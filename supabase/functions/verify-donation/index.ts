import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/**
 * Deterministic star position from a string seed.
 * Uses a simple hash to produce x (0..1), y (0..1).
 */
function seededPosition(seed: string): { x: number; y: number } {
  let hashX = 0;
  let hashY = 0;
  for (let i = 0; i < seed.length; i++) {
    hashX = ((hashX << 5) - hashX + seed.charCodeAt(i)) | 0;
    hashY = ((hashY << 7) - hashY + seed.charCodeAt(i) * 31) | 0;
  }
  const x = Math.abs(hashX % 10000) / 10000;
  const y = Math.abs(hashY % 10000) / 10000;
  return { x, y };
}

/**
 * Star size and brightness scale with donation amount.
 * $10 → size 0.7, brightness 0.5
 * $100+ → size 2.2, brightness 0.9
 */
function starProperties(amountCents: number): { size: number; brightness: number } {
  const dollars = amountCents / 100;
  const t = Math.min(1, Math.max(0, (dollars - 5) / 95));
  const size = 0.7 + t * 1.5;
  const brightness = 0.5 + t * 0.4;
  return { size, brightness };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve the checkout session with payment intent
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'customer'],
    });

    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ verified: false, reason: 'Payment not completed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

    if (!paymentIntentId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve payment intent' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate (idempotency)
    const { data: existing } = await supabase
      .from('donations')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existing) {
      // Already recorded — return the existing star data
      const { data: star } = await supabase
        .from('donations')
        .select('id, amount_cents, message, star_x, star_y, star_size, star_brightness, star_color, created_at')
        .eq('id', existing.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ verified: true, star, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract metadata
    const metadata = session.metadata ?? {};
    const userId = metadata.userId && metadata.userId !== 'guest' ? metadata.userId : null;
    const amountCents = parseInt(metadata.amountCents || String(session.amount_total ?? 0), 10);
    const message = metadata.message || null;

    const customerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null;

    const customerEmail = typeof session.customer === 'object' && session.customer
      ? (session.customer as Stripe.Customer).email
      : (session.customer_details?.email ?? null);

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: 'Could not determine donor email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate deterministic star properties
    const { x, y } = seededPosition(paymentIntentId);
    const { size, brightness } = starProperties(amountCents);

    const { data: donation, error: insertError } = await supabase
      .from('donations')
      .insert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_checkout_session_id: sessionId,
        email: customerEmail,
        amount_cents: amountCents,
        message,
        star_x: x,
        star_y: y,
        star_size: size,
        star_brightness: brightness,
      })
      .select('id, amount_cents, message, star_x, star_y, star_size, star_brightness, star_color, created_at')
      .single();

    if (insertError) {
      console.error('Failed to insert donation:', insertError);
      // Could be a race condition duplicate — try reading again
      const { data: retryExisting } = await supabase
        .from('donations')
        .select('id, amount_cents, message, star_x, star_y, star_size, star_brightness, star_color, created_at')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (retryExisting) {
        return new Response(
          JSON.stringify({ verified: true, star: retryExisting, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to record donation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ verified: true, star: donation, duplicate: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error verifying donation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
