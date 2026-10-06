import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRESET_AMOUNTS = [500, 1000, 1500, 2500, 5000, 10000];

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { amountCents, message } = await req.json();

    if (!amountCents || amountCents < 100) {
      return new Response(
        JSON.stringify({ error: 'Invalid donation amount (minimum $1)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amountCents > 1000000) {
      return new Response(
        JSON.stringify({ error: 'Donation amount too large (maximum $10,000)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedMessage = typeof message === 'string' ? message.slice(0, 200) : undefined;

    // Try to identify the user — optional for guests
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userEmail: string | null = null;
    let customerId: string | null = null;

    if (authHeader) {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await supabaseAuth.auth.getUser();
      if (!error && user) {
        userId = user.id;
        userEmail = user.email ?? null;

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
        const { data: profile } = await supabaseAdmin
          .from('user_profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .maybeSingle();
        customerId = profile?.stripe_customer_id ?? null;
      }
    }

    // Create or reuse Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail ?? undefined,
        metadata: {
          supabase_user_id: userId ?? 'guest',
        },
      });
      customerId = customer.id;
    }

    const baseUrl = req.headers.get('origin') || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Support Velvet — Donation',
              description: 'A one-time gift to help Velvet grow. Thank you!',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/support?session_id={CHECKOUT_SESSION_ID}&donation=success`,
      cancel_url: `${baseUrl}/support?donation=cancelled`,
      metadata: {
        type: 'donation',
        userId: userId ?? 'guest',
        amountCents: String(amountCents),
        message: trimmedMessage ?? '',
      },
      // Pre-fill email for guests whose Stripe customer has no email on file.
      // For signed-in users, the customer already has their email.
      customer_email: !userEmail ? undefined : userEmail,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating donation session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
