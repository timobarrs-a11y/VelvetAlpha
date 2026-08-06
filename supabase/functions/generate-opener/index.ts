import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { buildPersonaLayer } from "../_shared/personaBuilder.ts";
import { getCuratedCorrespondent, buildCorrespondentBehavioralInstructions } from "../_shared/correspondentFramework.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type OpenerSituation =
  | 'first_match'
  | 'daily_morning'
  | 'daily_evening'
  | 'daily_night'
  | 'reconnect';

interface OpenerRequest {
  companionId: string;
  situation: OpenerSituation;
}

const TASK_LINES: Record<OpenerSituation, string> = {
  first_match:
    "This is the very first message after you and the user matched. Write a natural, authentic opener (2-3 sentences) that shows who you are, references something from their profile naturally, and opens the door for conversation. No interrogation — one question max.",
  daily_morning:
    "This is a morning check-in. Write a short, in-character good-morning message. If there's recent history, pick up the thread naturally — don't repeat what was already said. Keep it warm and brief.",
  daily_evening:
    "This is an evening check-in. Write a short, in-character how-was-your-day message. If there's recent history, pick up the thread naturally — don't repeat what was already said. Keep it warm and brief.",
  daily_night:
    "This is a late-night check-in. Write a short, in-character winding-down message. Softer, more intimate energy. If there's recent history, pick up the thread naturally — don't repeat what was already said.",
  reconnect:
    "The user is coming back after a break. Write a short, in-character welcome-back message that acknowledges the gap naturally. Don't guilt-trip — be warm and glad to hear from them again.",
};

const MENTOR_TASK_LINES: Record<OpenerSituation, string> = {
  first_match:
    "This is the very first message in a professional coaching relationship. Restate your purpose (your domain) and ask the one question you need to start. Professional, supportive, no romance or pet names.",
  daily_morning:
    "Morning coaching check-in. Ask about the one thing they want to move forward on today. Goal-oriented, professional, no romance.",
  daily_evening:
    "Evening coaching check-in. Ask how today went on their goals. Goal-oriented, professional, no romance.",
  daily_night:
    "End-of-day coaching check-in. Ask them to set tomorrow's one priority. Goal-oriented, professional, no romance.",
  reconnect:
    "The user is back after a break. Welcome them back professionally and ask what they want to focus on. No guilt-trip, no romance.",
};

const CORRESPONDENT_TASK_LINES: Record<OpenerSituation, string> = {
  first_match:
    "This is the first dispatch from a personal correspondent. Introduce your beat and immediately deliver a sharp, topical take. It should feel like a mini-column, not a dating-app opener. No romance, no pet names, no social small talk.",
  daily_morning:
    "Morning correspondent dispatch. Send a crisp angle on the beat that gives the user something to think about today. No romance, no pet names, no how-did-you-sleep energy.",
  daily_evening:
    "Evening correspondent dispatch. Send a concise recap or provocative angle from the beat. No romance, no pet names, no how-was-your-day small talk.",
  daily_night:
    "Late dispatch from the correspondent desk. Keep it thoughtful and topical, not intimate. No romance, no pet names, no 'babe', no 'what is keeping you up'.",
  reconnect:
    "The reader is back after a gap. Welcome them back to the dispatch and re-enter with a fresh angle from the beat. No guilt-trip, no romance, no pet names.",
};

function buildHistoryBlock(
  recent: Array<{ role: string; content: string }>
): string {
  if (recent.length === 0) return '';
  const last6 = recent.slice(-6);
  const lines = last6
    .map(m => `${m.role}: ${m.content.substring(0, 180)}`)
    .join('\n');
  return `\n\nRECENT CONVERSATION (don't repeat any of this — move the conversation forward):\n${lines}`;
}

function buildGapNote(hoursSince: number): string {
  if (hoursSince < 1) return '';
  if (hoursSince < 24) return `\n(Gap since last chat: ~${Math.round(hoursSince)} hours.)`;
  const days = Math.round(hoursSince / 24);
  return `\n(Gap since last chat: ~${days} day${days > 1 ? 's' : ''}.)`;
}

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

    const body: OpenerRequest = await req.json();
    const { companionId, situation } = body;

    if (!companionId || !situation) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: companionId, situation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const validSituations: OpenerSituation[] = [
      'first_match', 'daily_morning', 'daily_evening', 'daily_night', 'reconnect',
    ];
    if (!validSituations.includes(situation)) {
      return new Response(
        JSON.stringify({ error: 'Invalid situation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: companion } = await supabaseAdmin
      .from('companions')
      .select('*')
      .eq('id', companionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!companion) {
      return new Response(
        JSON.stringify({ error: 'Companion not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const userName = profile.name && profile.name !== 'there' ? profile.name : '';
    const isMentor = companion.relationship_type === 'mentor';
    const isCorrespondent = companion.relationship_type === 'correspondent' && companion.correspondent_id;
    const isFirstMatch = situation === 'first_match';

    // For non-first-match situations, pull recent history for continuity.
    let historyBlock = '';
    if (!isFirstMatch) {
      const { data: recentRows } = await supabaseAdmin
        .from('conversations')
        .select('role, content, created_at')
        .eq('user_id', user.id)
        .eq('companion_id', companionId)
        .order('created_at', { ascending: false })
        .limit(6);

      const recent = (recentRows || []).reverse().map(r => ({
        role: r.role as string,
        content: r.content as string,
      }));

      historyBlock = buildHistoryBlock(recent);

      if (recent.length > 0) {
        const lastCreatedAt = recentRows![0].created_at;
        const hoursSince = (Date.now() - new Date(lastCreatedAt).getTime()) / (1000 * 60 * 60);
        historyBlock += buildGapNote(hoursSince);
      }
    }

    const personaLayer = isCorrespondent && companion.correspondent_id
      ? (() => {
          const corr = getCuratedCorrespondent(companion.correspondent_id);
          if (!corr) return buildPersonaLayer(companion, userName);
          return buildCorrespondentBehavioralInstructions({
            correspondentName: companion.custom_name,
            userName,
            beat: corr.beat,
            voiceKey: corr.voiceKey,
            voiceDescription: corr.voiceDescription,
          });
        })()
      : buildPersonaLayer(companion, userName);

    const taskLine = isCorrespondent
      ? CORRESPONDENT_TASK_LINES[situation]
      : isMentor
        ? MENTOR_TASK_LINES[situation]
        : TASK_LINES[situation];

    // Sonnet for the one-time first message (max first impression);
    // Haiku for recurring daily/reconnect openers (cheap, persona keeps quality).
    // Correspondents always get Sonnet — writing quality is the whole point.
    const model = isFirstMatch || isCorrespondent ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;

    const maxTokens = isCorrespondent ? 300 : 200;

    const systemPrompt = `${personaLayer}${historyBlock}

=== YOUR TASK ===
${taskLine}

Write ONLY the message text — no quotation marks, no labels, no narration.`;

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Server configuration error: API key not set');
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: '[Begin now — send your opener.]' },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json().catch(() => ({}));
      console.error('[generate-opener] Anthropic error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Opener generation failed' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const data = await anthropicResponse.json();

    let message = '';
    if (data.content && Array.isArray(data.content)) {
      message = data.content
        .filter((c: any) => c.type === 'text' && typeof c.text === 'string')
        .map((c: any) => c.text)
        .join('')
        .trim();
    }

    // Strip wrapping quotation marks if the model added them.
    message = message.replace(/^["'`]+|["'`]+$/g, '').trim();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Empty opener generated' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[generate-opener] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
