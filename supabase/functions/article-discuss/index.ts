import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { buildPersonaLayer } from "../_shared/personaBuilder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_CHARS = 8000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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

    const { articleId, companionId, pastedText, priorTurns } = await req.json();

    if (!companionId || !pastedText || typeof pastedText !== 'string') {
      throw new Error('Missing required fields: companionId, pastedText');
    }

    let articleTitle: string | null = null;
    if (articleId) {
      const { data: article } = await supabaseAdmin
        .from('news_articles')
        .select('title')
        .eq('id', articleId)
        .maybeSingle();
      articleTitle = article?.title ?? null;
    }

    const { data: companion } = await supabaseAdmin
      .from('companions')
      .select('*')
      .eq('id', companionId)
      .maybeSingle();

    if (!companion) {
      throw new Error('Companion not found');
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    const userName = profile?.name || null;
    const personaLayer = buildPersonaLayer(companion, userName);

    let truncatedText = pastedText;
    let truncatedNote = '';
    if (pastedText.length > MAX_CHARS) {
      truncatedText = pastedText.slice(0, MAX_CHARS);
      truncatedNote = '\n\n[Note: the article was long, so I\'m responding to the first part that was pasted.]';
    }

    const articleContext = articleTitle
      ? `The article your friend is sharing is titled "${articleTitle}".`
      : 'Your friend is sharing an article with you.';

    const systemPrompt = `${personaLayer}

=== ARTICLE DISCUSSION MODE ===
${articleContext}
Your friend has pasted the full text of this article for you to read and discuss. This is a one-off discussion about this specific article — do not treat it as something you already knew, and do not claim to have read it before now.

Read the pasted text carefully and respond to the actual content. Reference specific points, arguments, or details from what was shared. Be genuine in your reaction — if something is surprising, say so; if you disagree with a point, engage with it directly.

This is NOT being saved to your long-term memory. Just have a natural conversation about the article.${truncatedNote}`;

    const messages: Array<{ role: string; content: string }> = [];

    if (priorTurns && Array.isArray(priorTurns) && priorTurns.length > 0) {
      for (const turn of priorTurns.slice(-6)) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
      messages.push({ role: 'user', content: `Here's the article text:\n\n${truncatedText}` });
    } else {
      messages.push({ role: 'user', content: `Here's the article text:\n\n${truncatedText}` });
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Server configuration error: API key not set');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.SONNET,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const replyText = data?.content?.[0]?.text ?? '';

    return new Response(JSON.stringify({ reply: replyText, truncated: pastedText.length > MAX_CHARS }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
