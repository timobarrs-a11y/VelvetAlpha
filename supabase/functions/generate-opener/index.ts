import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { buildPersonaLayer } from "../_shared/personaBuilder.ts";

// Generates the AI's *opening* line — the first message after a match and the
// daily/reconnect check-ins — in the companion's real persona + Signature Voice
// (via buildPersonaLayer), instead of the old static templates. The client
// falls back to those templates if this ever fails, so it can never block.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Situation =
  | 'first_match'
  | 'daily_morning'
  | 'daily_evening'
  | 'daily_night'
  | 'reconnect';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildInstruction(situation: Situation, userName: string, isMentor: boolean): string {
  const u = userName || 'them';

  if (isMentor) {
    switch (situation) {
      case 'first_match':
        return `This is your very first message to ${u} as their coach. In one or two short sentences: greet them, make your purpose clear, and ask the single most useful question to get started. No romance, no filler small talk.`;
      case 'daily_morning':
        return `It's morning and you're reaching out first, before ${u} has said anything today. One short, goal-oriented nudge toward today's focus. At most one question.`;
      case 'daily_evening':
        return `It's evening. Check in on how today went and what progress ${u} made. One short message, at most one question.`;
      case 'daily_night':
        return `It's late. A brief wind-down check-in — nudge ${u} to name tomorrow's first step. One short message.`;
      case 'reconnect':
        return `${u} is back after some time away. Reconnect warmly but professionally and steer gently back toward their goal. One short message.`;
    }
  }

  switch (situation) {
    case 'first_match':
      return `This is your very first message to ${u} — you just matched. Open the conversation the way YOU would: fully in your own voice and character. Reference something real about them if you know it. Keep it to 1-2 short sentences and leave an easy opening for them to reply. Do not sound like a template.`;
    case 'daily_morning':
      return `It's morning and you're reaching out first, before ${u} has said anything today. Send a short, natural good-morning that feels like it's specifically from you. If your history gives you something real to reference, use it. One short message, at most one question.`;
    case 'daily_evening':
      return `It's evening and you're reaching out first. A short, warm check-in on ${u}'s day, in your voice. If you have something real to call back to, use it. At most one question.`;
    case 'daily_night':
      return `It's late night and you're reaching out first. A soft, low-key late-night check-in with ${u}, in your voice. Keep it short and easy.`;
    case 'reconnect':
      return `${u} is back after some time away. React to the gap the way you naturally would — warm, like you noticed they were gone — and pick things back up. One short message.`;
  }

  return `Reach out to ${u} first with one short, natural message in your own voice.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'No authorization header' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Invalid authentication token' }, 401);

    const { companionId, situation } = await req.json() as { companionId?: string; situation?: Situation };
    if (!companionId || !situation) return json({ error: 'companionId and situation required' }, 400);

    // Companion row (scoped to this user) — same shape buildPersonaLayer reads.
    const { data: companion } = await admin
      .from('companions')
      .select('*')
      .eq('id', companionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!companion) return json({ error: 'Companion not found' }, 404);

    const { data: profile } = await admin
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    const userName = profile?.name && profile.name !== 'there' ? profile.name : '';
    const isMentor = companion.relationship_type === 'mentor';

    // Continuity: for non-first openers, give the model a little recent history
    // + a gap note so it can reference and move things forward, not reset.
    let historyBlock = '';
    if (situation !== 'first_match') {
      const { data: convo } = await admin
        .from('conversations')
        .select('role, content, created_at')
        .eq('user_id', user.id)
        .eq('companion_id', companionId)
        .order('created_at', { ascending: false })
        .limit(6);

      if (convo && convo.length > 0) {
        const ordered = [...convo].reverse();
        const recap = ordered
          .map((m: { role: string; content: string }) =>
            `${m.role === 'user' ? (userName || 'them') : 'you'}: ${String(m.content).slice(0, 200)}`)
          .join('\n');
        const lastAt = new Date(ordered[ordered.length - 1].created_at).getTime();
        const gapH = Math.floor((Date.now() - lastAt) / 3600000);
        const gapNote = gapH >= 24
          ? `It's been about ${Math.floor(gapH / 24)} day(s) since you last spoke.`
          : gapH >= 1
          ? `It's been about ${gapH} hour(s) since you last spoke.`
          : `You spoke recently.`;
        historyBlock = `RECENT CONVERSATION (oldest first):\n${recap}\n\n${gapNote}\nDon't repeat what was just said — move things forward naturally.`;
      }
    }

    const personaLayer = buildPersonaLayer(companion, userName);
    const instruction = buildInstruction(situation, userName, isMentor);

    const systemPrompt = `${personaLayer}

${historyBlock}

=== YOUR TASK RIGHT NOW ===
${instruction}

Write ONLY the message text — no quotation marks, no labels, no narration.`;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'Server configuration error' }, 500);

    // The first message is a one-time, highest-impact impression → Sonnet.
    // Recurring daily/reconnect openers → Haiku (cheap; the rich persona keeps
    // quality high, same as the Velvet Rope personas).
    const model = situation === 'first_match' ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: '[Begin now — send your opener.]' }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[generate-opener] API error:', resp.status, err);
      return json({ error: 'Generation failed' }, 502);
    }

    const data = await resp.json();
    let message = '';
    if (Array.isArray(data.content)) {
      message = data.content
        .filter((b: { type?: string; text?: string }) => b?.type === 'text' && typeof b.text === 'string')
        .map((b: { text: string }) => b.text)
        .join('')
        .trim();
    }
    // Strip any wrapping quotes the model may have added.
    message = message.replace(/^["'“‘]+|["'”’]+$/g, '').trim();

    if (!message) {
      console.error(`[generate-opener] empty message, stop_reason=${data.stop_reason}`);
      return json({ error: 'Empty generation' }, 502);
    }

    return json({ message }, 200);
  } catch (e) {
    console.error('[generate-opener] error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
