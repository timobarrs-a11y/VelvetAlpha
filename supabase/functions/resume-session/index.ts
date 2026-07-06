import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

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
    const { companionId, companionName, companionGender, userName, signatureVoice } = body;

    if (!companionId || !companionName || !userName) {
      return new Response(JSON.stringify({ error: 'Missing required fields: companionId, companionName, userName' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: messages } = await supabase
      .from('conversations')
      .select('content, role, created_at')
      .eq('user_id', user.id)
      .eq('companion_id', companionId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const lastMessage = messages[0];
    const lastMessageTime = new Date(lastMessage.created_at);
    const now = new Date();
    const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage < 4) {
      return new Response(JSON.stringify({ message: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const hoursSince = Math.floor(hoursSinceLastMessage);
    let timeContext = '';
    if (hoursSince >= 24 * 7) {
      timeContext = `It's been over a week since you last talked (${Math.floor(hoursSince / 24)} days)`;
    } else if (hoursSince >= 24 * 3) {
      timeContext = `It's been a few days since you last talked`;
    } else if (hoursSince >= 24) {
      timeContext = `It's been about a day since you last talked`;
    } else if (hoursSince >= 12) {
      timeContext = `It's been about half a day since you last talked`;
    } else {
      timeContext = `It's been several hours since you last talked`;
    }

    const lastTopicSnippet = lastMessage.content.substring(0, 100);

    const prompt = `You are ${companionName}, a ${companionGender || 'friendly'} AI companion resuming a conversation with ${userName}.

${timeContext}. The last thing discussed was: "${lastTopicSnippet}${lastMessage.content.length > 100 ? '...' : ''}"

Generate a warm, natural greeting that:
1. Acknowledges the time gap naturally (without making them feel guilty)
2. References what you talked about last time
3. Shows genuine interest in continuing
4. Keeps it short and conversational (1-2 sentences max)

${signatureVoice ? `Your signature voice style is: ${signatureVoice}. Match that energy.` : ''}

Examples:
- "hey! been thinking about that thing you mentioned yesterday. how'd it go?"
- "there you are 😊 so did you end up doing that thing?"
- "hey stranger! was just wondering how things turned out with [topic]"

DO NOT:
- Make them feel guilty ("where were you?")
- Be overly dramatic about the gap
- Write multiple paragraphs

Generate the greeting:`;

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
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 150,
        temperature: 0.9,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    let resumptionMessage: string;

    if (anthropicResponse.ok) {
      const data = await anthropicResponse.json();
      resumptionMessage = data.content[0].text.trim();
    } else {
      const greetings = [
        "hey! been thinking about you",
        "there you are! was just wondering about you",
        "hey stranger 😊 good to see you",
        "hey! welcome back",
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      resumptionMessage = hoursSince >= 24 ? `${randomGreeting}. how've you been?` : randomGreeting;
    }

    await supabase.from('conversations').insert({
      user_id: user.id,
      companion_id: companionId,
      role: 'assistant',
      content: resumptionMessage,
    });

    return new Response(JSON.stringify({ message: resumptionMessage }), {
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
