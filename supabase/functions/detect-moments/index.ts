import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { companionId, messages } = body;

    if (!companionId || !messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: companionId, messages' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const conversationText = messages
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Companion'}: ${m.content}`)
      .join('\n');

    const prompt = `Analyze this conversation and identify any special moments worth capturing for the user's memory timeline. Look for:

- Funny or playful exchanges
- Heartfelt or vulnerable sharing
- Achievements or proud moments
- Deep, meaningful conversations
- Supportive interactions
- Milestones or celebrations
- Romantic or sweet moments
- Adventurous stories

Conversation:
${conversationText}

For each special moment found (max 3), respond with JSON:
[
  {
    "moment_type": "funny" | "heartfelt" | "milestone" | "achievement" | "vulnerable" | "supportive" | "playful" | "deep" | "romantic" | "adventurous",
    "title": string (short, catchy title for this moment),
    "description": string (what made this moment special),
    "excerpt": string (the key part of conversation, max 200 chars),
    "emotion": "happy" | "excited" | "loved" | "grateful" | "proud" | "vulnerable" | "sad" | "anxious" | "neutral" | "mixed",
    "importance": number (1-10, how significant is this moment),
    "tags": string[] (2-4 relevant tags)
  }
]

Only include moments with importance >= 6. If no special moments, return empty array.`;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicResponse.ok) {
      return new Response(JSON.stringify({ detected: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await anthropicResponse.json();
    const textContent = data.content[0].text;

    const jsonMatch = textContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ detected: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const moments = JSON.parse(jsonMatch[0]);
    let detected = 0;

    for (const moment of moments) {
      if (moment.importance >= 6) {
        await supabase.from('memory_moments').insert({
          user_id: user.id,
          companion_id: companionId,
          moment_type: moment.moment_type,
          title: moment.title,
          description: moment.description,
          conversation_excerpt: moment.excerpt,
          emotion: moment.emotion,
          importance_score: moment.importance,
          moment_date: new Date().toISOString(),
          user_favorited: false,
          tags: moment.tags,
        });
        detected++;
      }
    }

    return new Response(JSON.stringify({ detected }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
