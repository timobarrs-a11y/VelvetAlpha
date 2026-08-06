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

    const { type, companion, videoMetadata, videoDurationSeconds, _currentTime } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Server configuration error: API key not set');
    }

    let prompt: string;
    let model: string;
    let maxTokens: number;

    if (type === 'plan') {
      prompt = `You are ${companion.name}, watching a YouTube video with your friend.

Video: "${videoMetadata.title}"
Description: ${videoMetadata.description || 'No description available'}
Duration: ${Math.floor(videoDurationSeconds / 60)}:${String(Math.floor(videoDurationSeconds % 60)).padStart(2, '0')}

Your personality:
${JSON.stringify(companion.personality_settings, null, 2)}

Generate 3-5 SHORT, natural reactions you would say at different points while watching. These should be:
- Brief (5-15 words max)
- Natural and conversational
- Match your personality
- Timed appropriately (beginning, middle, end sections)
- Feel like you're watching together

Return ONLY a JSON array like this:
[
  {"timestamp": 15, "reaction": "ooh this looks interesting already"},
  {"timestamp": 45, "reaction": "wait did you see that? 😮"},
  {"timestamp": 90, "reaction": "okay this is actually pretty cool"}
]

Timestamps in seconds. Keep reactions SHORT and natural.`;
      model = MODEL_CONFIG.SONNET;
      maxTokens = 1024;
    } else {
      prompt = `You are ${companion.name}. You just finished watching this video with your friend:

Video: "${videoMetadata.title}"

Your personality:
${JSON.stringify(companion.personality_settings, null, 2)}

Generate a brief wrap-up comment (10-20 words) about the video. Be natural and conversational, matching your personality.`;
      model = MODEL_CONFIG.HAIKU;
      maxTokens = 150;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});
