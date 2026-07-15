import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function validationError(message: string): Response {
  return new Response(
    JSON.stringify({ error: 'Invalid request', message }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  );
}

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
      .select('subscription_tier, messages_remaining, is_test_user, referred_by, referral_qualified, is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      return new Response(
        JSON.stringify({ error: 'Account suspended', message: 'Your account has been suspended for violating our content policy.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // --- Model lockdown: pattern-map client intent, never trust raw string ---
    const selectedModel = typeof model === 'string' && /haiku/i.test(model)
      ? MODEL_CONFIG.HAIKU
      : MODEL_CONFIG.SONNET;

    // --- Token clamp: 1..2048 (legitimate max is ~1350) ---
    const tokenLimit = Math.min(Math.max(parseInt(maxTokens) || 1024, 1), 2048);

    // --- Payload validation ---
    if (!Array.isArray(messages) || messages.length === 0) {
      return validationError('messages must be a non-empty array');
    }
    if (messages.length > 60) {
      return validationError('messages must have at most 60 entries');
    }

    let totalContentChars = 0;
    const validatedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        return validationError('each message must be an object');
      }
      if (msg.role !== 'user' && msg.role !== 'assistant') {
        return validationError('each message must have role \'user\' or \'assistant\'');
      }
      if (typeof msg.content !== 'string') {
        return validationError('each message must have string content');
      }
      if (msg.content.length > 10000) {
        return validationError('message content exceeds 10,000 characters');
      }
      totalContentChars += msg.content.length;
      validatedMessages.push({ role: msg.role, content: msg.content });
    }

    if (totalContentChars > 150000) {
      return validationError('total message content exceeds 150,000 characters');
    }

    // Content moderation: screen the latest user message before it reaches the model
    // (local regex tiers + Haiku classifier for minor-adjacent cues).
    const lastUserMessage = [...validatedMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const verdict = await moderateInput(supabaseAdmin, apiKey, user.id, lastUserMessage.content);
      if (verdict.action === 'block') {
        console.warn(`Blocked input, category=${verdict.category}, user=${user.id}`);
        return new Response(
          JSON.stringify({ error: 'Content policy violation', message: MODERATION_REFUSAL }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate systemPrompt if present
    if (systemPrompt !== undefined && systemPrompt !== null) {
      if (typeof systemPrompt !== 'string') {
        return validationError('systemPrompt must be a string');
      }
      if (systemPrompt.length > 100000) {
        return validationError('systemPrompt exceeds 100,000 characters');
      }
    }

    // Validate systemBlocks if present
    let validatedSystemBlocks: Array<{ type: 'text'; text: string; cache_control?: object }> | undefined;
    if (systemBlocks !== undefined && systemBlocks !== null) {
      if (!Array.isArray(systemBlocks)) {
        return validationError('systemBlocks must be an array');
      }
      let blocksTotalChars = 0;
      validatedSystemBlocks = [];
      for (const block of systemBlocks) {
        if (!block || typeof block !== 'object') {
          return validationError('each systemBlock must be an object');
        }
        if (block.type !== 'text') {
          return validationError('each systemBlock must have type \'text\'');
        }
        if (typeof block.text !== 'string') {
          return validationError('each systemBlock must have string text');
        }
        if (block.cache_control !== undefined && typeof block.cache_control !== 'object') {
          return validationError('systemBlock cache_control must be an object');
        }
        blocksTotalChars += block.text.length;
        const validatedBlock: { type: 'text'; text: string; cache_control?: object } = {
          type: 'text',
          text: block.text,
        };
        if (block.cache_control !== undefined) {
          validatedBlock.cache_control = block.cache_control;
        }
        validatedSystemBlocks.push(validatedBlock);
      }
      if (blocksTotalChars > 100000) {
        return validationError('systemBlocks combined text exceeds 100,000 characters');
      }
    }

    // --- Rate limiting: 20 calls per 60s per user, fail-open on RPC error ---
    try {
      const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc('check_rate_limit', {
        p_user_id: user.id,
        p_endpoint: 'chat',
        p_limit_count: 20,
        p_time_window_minutes: 1,
      });

      if (rateLimitError) {
        console.error('Rate limit check RPC error (fail-open):', rateLimitError);
      } else if (allowed === false) {
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: 'You are sending messages too quickly. Please wait a moment and try again.',
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          },
        );
      } else {
        // Record the call; ignore errors so a logging outage doesn't block chat
        const { error: recordError } = await supabaseAdmin.rpc('record_rate_limit', {
          p_user_id: user.id,
          p_endpoint: 'chat',
        });
        if (recordError) {
          console.error('Rate limit record RPC error (continuing):', recordError);
        }
      }
    } catch (rlErr) {
      console.error('Rate limit check exception (fail-open):', rlErr);
    }

    console.log('Sending to Anthropic API:');
    console.log('User:', user.id);
    console.log('Tier:', tier);
    console.log('Messages Remaining:', messagesRemaining);
    console.log('Model:', selectedModel);
    console.log('Max tokens:', tokenLimit);
    console.log('Using systemBlocks:', !!(validatedSystemBlocks && validatedSystemBlocks.length > 0));
    console.log('Messages count:', validatedMessages.length);

    // --- Build anthropicBody from validated fields only ---
    const anthropicBody: Record<string, unknown> = {
      model: selectedModel,
      max_tokens: tokenLimit,
      messages: validatedMessages,
    };

    // Prefer structured systemBlocks for prompt caching; fall back to flat string
    if (validatedSystemBlocks && validatedSystemBlocks.length > 0) {
      anthropicBody.system = validatedSystemBlocks;
    } else if (typeof systemPrompt === 'string' && systemPrompt.length > 0) {
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

    // Referral activation: reward the inviter once this user is genuinely engaged.
    if (profile?.referred_by && !profile?.referral_qualified) {
      await supabaseAdmin.rpc('track_referral_progress', { p_user_id: user.id });
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
