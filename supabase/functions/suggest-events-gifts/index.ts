import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function callAnthropic(apiKey: string, prompt: string, maxTokens: number): Promise<string | null> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.content[0].text;
}

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
    const { type, companionId, recentConversations, recipient, occasion, conversationContext } = body;

    if (!type || !companionId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, companionId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    if (type === 'events') {
      if (!recentConversations) {
        return new Response(JSON.stringify({ error: 'Missing recentConversations for event suggestions' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const prompt = `Based on this conversation between a user and their AI companion, suggest 2-3 relevant events, reminders, or date ideas they might want to add to their calendar.

Consider:
- Mentioned appointments, deadlines, or commitments
- Hobbies or activities they're interested in
- Goals they want to achieve
- Date ideas based on their preferences
- Important dates they mentioned

Conversation:
${recentConversations}

Respond with a JSON array of suggestions:
[
  {
    "title": string (concise event title),
    "description": string (detailed description),
    "type": "reminder" | "appointment" | "date_idea" | "goal_deadline",
    "suggested_date": string (ISO date, can be null if no specific date mentioned),
    "reasoning": string (why you're suggesting this),
    "confidence": number (0-1, how confident you are this is relevant)
  }
]

Only suggest events with confidence > 0.6. If nothing relevant, return empty array.`;

      const text = await callAnthropic(apiKey, prompt, 1500);
      if (!text) {
        return new Response(JSON.stringify({ suggested: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ suggested: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      let suggested = 0;

      for (const suggestion of suggestions) {
        if (suggestion.confidence > 0.6) {
          await supabase.from('event_suggestions').insert({
            user_id: user.id,
            companion_id: companionId,
            suggested_title: suggestion.title,
            suggested_description: suggestion.description,
            suggested_type: suggestion.type,
            suggested_date: suggestion.suggested_date,
            reasoning: suggestion.reasoning,
            confidence_score: suggestion.confidence
          });
          suggested++;
        }
      }

      return new Response(JSON.stringify({ suggested }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (type === 'gifts') {
      if (!recipient || !occasion || !conversationContext) {
        return new Response(JSON.stringify({ error: 'Missing required fields for gift suggestions: recipient, occasion, conversationContext' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const prompt = `Based on this conversation context, suggest 3-5 thoughtful gift ideas for ${recipient} for their ${occasion}.

Consider:
- Their interests, hobbies, and preferences mentioned
- The occasion and its significance
- Price ranges from budget-friendly to premium
- Specific items with reasoning

Conversation context:
${conversationContext}

Respond with a JSON array:
[
  {
    "gift_idea": string (specific gift name),
    "reasoning": string (why this gift is perfect),
    "price_range": "budget" | "moderate" | "premium" | "luxury",
    "where_to_buy": string (suggested stores or online),
    "relevance": number (0-1, how relevant based on conversation)
  }
]`;

      const text = await callAnthropic(apiKey, prompt, 2000);
      if (!text) {
        return new Response(JSON.stringify({ suggested: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ suggested: 0 }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      let suggested = 0;

      for (const suggestion of suggestions) {
        await supabase.from('gift_suggestions').insert({
          user_id: user.id,
          companion_id: companionId,
          recipient,
          occasion,
          gift_idea: suggestion.gift_idea,
          reasoning: suggestion.reasoning,
          price_range: suggestion.price_range,
          where_to_buy: suggestion.where_to_buy,
          relevance_score: suggestion.relevance,
          based_on_context: conversationContext.substring(0, 500)
        });
        suggested++;
      }

      return new Response(JSON.stringify({ suggested }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid type. Must be "events" or "gifts"' }), {
      status: 400,
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
