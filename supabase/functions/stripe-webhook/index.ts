import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const body = await req.text();

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log('Received Stripe webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const metadata = session.metadata;
      if (!metadata?.userId || !metadata?.tier) {
        console.error('Missing required metadata:', metadata);
        return new Response(
          JSON.stringify({ error: 'Missing userId or tier in metadata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userId = metadata.userId;
      const tier = metadata.tier as 'unlimited' | 'starter' | 'plus' | 'elite';

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const tierConfig: Record<string, { messages: number, haiku: boolean, sonnet: boolean }> = {
        unlimited: { messages: 1500, haiku: true, sonnet: false },
        starter: { messages: 2000, haiku: false, sonnet: true },
        plus: { messages: 4000, haiku: false, sonnet: true },
        elite: { messages: 8000, haiku: false, sonnet: true }
      };

      const config = tierConfig[tier];
      if (!config) {
        console.error('Invalid tier:', tier);
        return new Response(
          JSON.stringify({ error: 'Invalid tier' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: currentProfile } = await supabase
        .from('user_profiles')
        .select('messages_remaining')
        .eq('id', userId)
        .maybeSingle();

      let newMessageCount = config.messages;
      if (currentProfile?.messages_remaining) {
        const currentMessages = currentProfile.messages_remaining === -1 ? 0 : currentProfile.messages_remaining;
        newMessageCount = currentMessages + config.messages;
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: tier,
          messages_remaining: newMessageCount,
          haiku_model_enabled: config.haiku,
          sonnet_model_enabled: config.sonnet,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string || null
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user profile:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update user profile' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Successfully upgraded user ${userId} to ${tier}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
