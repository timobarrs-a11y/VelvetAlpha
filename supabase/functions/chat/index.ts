import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Get user's subscription and message tracking
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier, messages_remaining, is_test_user')
      .eq('id', user.id)
      .maybeSingle();

    const isTestUser = profile?.is_test_user === true;
    const messagesRemaining = profile?.messages_remaining ?? 0;
    const tier = profile?.subscription_tier || 'free';

    if (!isTestUser && messagesRemaining !== -1 && messagesRemaining <= 0) {
      return new Response(
        JSON.stringify({
          error: 'No messages remaining',
          message: 'You have used all your messages. Please upgrade your subscription to continue.',
          tier,
          messagesRemaining: 0,
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { messages, systemPrompt, systemBlocks, maxTokens, model } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Server configuration error: API key not set');
    }

    const tokenLimit = maxTokens || 1024;
    const selectedModel = model || MODEL_CONFIG.SONNET;

    console.log('Sending to Anthropic API:');
    console.log('User:', user.id);
    console.log('Tier:', tier);
    console.log('Messages Remaining:', messagesRemaining);
    console.log('Model:', selectedModel);
    console.log('Max tokens:', tokenLimit);
    console.log('Using systemBlocks:', !!(systemBlocks && Array.isArray(systemBlocks) && systemBlocks.length > 0));
    console.log('Messages count:', messages?.length ?? 0);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('No messages provided');
    }

    const anthropicBody: Record<string, unknown> = {
      model: selectedModel,
      max_tokens: tokenLimit,
      messages: messages,
    };

    // Prefer structured systemBlocks for prompt caching; fall back to flat string
    if (systemBlocks && Array.isArray(systemBlocks) && systemBlocks.length > 0) {
      anthropicBody.system = systemBlocks;
    } else if (systemPrompt) {
      anthropicBody.system = systemPrompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    console.log('Got response from Anthropic');
    console.log('Cache creation tokens:', data.usage?.cache_creation_input_tokens ?? 0);
    console.log('Cache read tokens:', data.usage?.cache_read_input_tokens ?? 0);

    // Decrement message count server-side
    if (!isTestUser && messagesRemaining !== -1) {
      const newCount = Math.max(0, messagesRemaining - 1);
      await supabaseAdmin
        .from('user_profiles')
        .update({ messages_remaining: newCount })
        .eq('id', user.id);

      console.log('Message count decremented:', messagesRemaining, '->', newCount);
    }

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message.includes('Too many requests') ? 429 :
             error.message.includes('No messages remaining') ? 403 : 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
