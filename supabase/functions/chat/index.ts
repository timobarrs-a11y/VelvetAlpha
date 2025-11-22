import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { messages, systemPrompt, apiKey, maxTokens, model } = await req.json();

    if (!apiKey) {
      throw new Error('API key not provided');
    }

    const tokenLimit = maxTokens || 1024;
    const selectedModel = model || 'claude-sonnet-4-5-20250929';

    console.log('📤 Sending to Anthropic API:');
    console.log('Model:', selectedModel);
    console.log('Max tokens:', tokenLimit);
    console.log('System prompt length:', systemPrompt.length);
    console.log('Messages count:', messages.length);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: tokenLimit,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    console.log('📥 Got response from Anthropic:');
    console.log('Response keys:', Object.keys(data));
    console.log('Content array length:', data.content?.length);
    console.log('First content item:', JSON.stringify(data.content?.[0]));

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});