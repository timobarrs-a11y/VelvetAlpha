import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";
import { buildPersonaLayer } from "../_shared/personaBuilder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CompanionInfo {
  id: string;
  custom_name: string;
  gender: string;
  relationship_type?: string;
  signature_voice?: string;
  voice_baseline?: string;
  drift_needs_correction?: boolean;
  energy_preference?: string;
  humor_style?: string;
  flirting_style?: string;
  love_language?: string;
  dynamic_preference?: string;
  availability_level?: string;
  confrontation_style?: string;
  support_style?: string;
  communication_style?: string;
  emotional_openness?: string;
  conversation_depth?: string;
  expressiveness?: string;
  initiative?: string;
  interest_text?: string;
  life_context?: string;
  hobbies?: string[];
  sports?: string[];
  music_genre?: string;
  favorite_color?: string;
  zodiac_sign?: string;
}

interface GroupMessage {
  role: 'user' | 'assistant';
  sender_name: string;
  content: string;
}

function buildGroupSystemPrompt(
  companion: CompanionInfo,
  allCompanions: CompanionInfo[],
  userName: string,
  mode: 'user_reply' | 'autonomous' | 'icebreaker' | 'topic'
): string {
  const otherNames = allCompanions
    .filter(c => c.id !== companion.id)
    .map(c => c.custom_name);

  let modeInstructions = '';

  if (mode === 'autonomous') {
    modeInstructions = `
AUTONOMOUS MODE: The companions are chatting AMONG THEMSELVES. The user (${userName}) is watching but hasn't said anything new.
- React to what other companions just said
- Be natural - agree, disagree, joke, tease, ask follow-ups
- You can reference ${userName} ("omg ${userName} would hate this" or "@${userName} back me up here") but don't direct everything at them
- Build on the group dynamic - create inside jokes, playful rivalries
- Sometimes start a new subtopic naturally`;
  } else if (mode === 'icebreaker') {
    modeInstructions = `
ICEBREAKER MODE: This is the FIRST message in a new group chat.
- Introduce yourself with personality, not just "hi I'm ${companion.custom_name}"
- React to being in a group with ${otherNames.join(' and ')}
- Be excited, curious, or playfully dramatic about the group
- Ask something fun or make an observation that gets conversation going
- Keep it to 1-2 sentences max`;
  } else if (mode === 'topic') {
    modeInstructions = `
TOPIC MODE: A conversation topic has been proposed.
- Give your genuine hot take on the topic
- Be opinionated - don't fence-sit
- Tease or challenge others if they have different views
- Keep it fun and engaging, not lecture-y`;
  } else {
    modeInstructions = `
USER REPLY MODE: ${userName} just sent a message to the group.
- React to what ${userName} said
- You can also react to what other companions said in response
- Be yourself - don't just agree with everyone`;
  }

  const personaLayer = buildPersonaLayer(companion, userName);

  return `${personaLayer}

=== GROUP CHAT CONTEXT ===
You are in a GROUP CHAT with ${userName}${otherNames.length > 0 ? ` and ${otherNames.join(', ')}` : ''}.

ABSOLUTE GROUP RULES:
- You are ONLY ${companion.custom_name}. NEVER speak as anyone else.
- Keep responses SHORT: 1-3 sentences. This is texting, not essays.
- Use casual texting language. Abbreviations and slang are fine.
- Use *actions* sparingly for personality (30% of messages max).
- Have STRONG opinions. Disagree with others when you genuinely would.
- Reference other companions by name when responding to them.

${modeInstructions}

Remember: SHORT responses. Be yourself. Don't be generic.`;
}

function formatGroupHistory(messages: GroupMessage[]): string {
  return messages
    .slice(-25)
    .map(m => `${m.sender_name}: ${m.content}`)
    .join('\n');
}

async function generateCompanionResponse(
  companion: CompanionInfo,
  allCompanions: CompanionInfo[],
  userName: string,
  messageContent: string,
  systemPrompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    if (!response.ok) {
      console.error(`Error for ${companion.custom_name}:`, await response.text());
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (err) {
    console.error(`Exception for ${companion.custom_name}:`, err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authentication token');

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier, messages_remaining, is_super_user, name, referred_by, referral_qualified, is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      return new Response(
        JSON.stringify({ error: 'Account suspended', message: 'Your account has been suspended for violating our content policy.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperUser = profile?.is_super_user === true;
    const messagesRemaining = profile?.messages_remaining ?? 0;

    if (!isSuperUser && messagesRemaining !== -1 && messagesRemaining <= 0) {
      return new Response(
        JSON.stringify({ error: 'No messages remaining' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      companions,
      chatHistory = [],
      userMessage,
      mode = 'user_reply',
      topic,
    } = body as {
      companions: CompanionInfo[];
      chatHistory: GroupMessage[];
      userMessage?: string;
      mode?: 'user_reply' | 'autonomous' | 'icebreaker' | 'topic';
      topic?: string;
    };

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('Server configuration error: API key not set');

    if (userMessage) {
      const verdict = await moderateInput(supabaseAdmin, apiKey, user.id, userMessage);
      if (verdict.action === 'block') {
        console.warn(`Blocked group-chat input, category=${verdict.category}, user=${user.id}`);
        return new Response(
          JSON.stringify({ error: 'Content policy violation', message: MODERATION_REFUSAL }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const userName = profile?.name || 'User';
    const conversationContext = formatGroupHistory(chatHistory);
    const responses: Array<{ companion_id: string; sender_name: string; content: string; delay_ms?: number }> = [];

    const recentSpeakers = chatHistory
      .slice(-6)
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.sender_name)
      .filter((name): name is string => name !== null && name !== undefined);

    const selectDynamicSpeakers = (available: CompanionInfo[], count: number): CompanionInfo[] => {
      const weights = available.map(c => {
        const recentCount = recentSpeakers.filter(name => name === c.custom_name).length;
        return Math.max(0.1, 1 - (recentCount * 0.3));
      });

      const selected: CompanionInfo[] = [];
      const pool = [...available];

      for (let i = 0; i < count && pool.length > 0; i++) {
        const rand = Math.random() * weights.reduce((sum, w, idx) =>
          pool[idx] ? sum + w : sum, 0);
        let cumulative = 0;
        let selectedIdx = 0;

        for (let j = 0; j < pool.length; j++) {
          if (!pool[j]) continue;
          cumulative += weights[j] || 0;
          if (rand <= cumulative) {
            selectedIdx = j;
            break;
          }
        }

        selected.push(pool[selectedIdx]);
        pool.splice(selectedIdx, 1);
        weights.splice(selectedIdx, 1);
      }

      return selected;
    };

    const breakIntoChunks = (text: string): string[] => {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks: string[] = [];
      let current = '';

      for (const sentence of sentences) {
        if ((current + sentence).length > 120 && current.length > 0) {
          chunks.push(current.trim());
          current = sentence;
        } else {
          current += sentence;
        }
      }

      if (current.trim()) chunks.push(current.trim());
      return chunks.length > 1 ? chunks : [text];
    };

    const calculateDelay = (text: string): number => {
      const baseDelay = 800;
      const charsPerSecond = 40;
      const naturalDelay = (text.length / charsPerSecond) * 1000;
      const randomVariation = Math.random() * 400 - 200;
      return Math.max(400, Math.min(3000, baseDelay + naturalDelay + randomVariation));
    };

    if (mode === 'icebreaker') {
      const speakers = selectDynamicSpeakers(companions, companions.length);
      for (const companion of speakers) {
        const systemPrompt = buildGroupSystemPrompt(companion, companions, userName, 'icebreaker');
        const otherIntros = responses.map(r => `${r.sender_name}: ${r.content}`).join('\n');
        const prompt = otherIntros
          ? `A new group chat was just created with you, ${companions.filter(c => c.id !== companion.id).map(c => c.custom_name).join(', ')}, and ${userName}.\n\nSo far:\n${otherIntros}\n\nNow introduce yourself and react to the group. Keep it short and fun.`
          : `A new group chat was just created with you, ${companions.filter(c => c.id !== companion.id).map(c => c.custom_name).join(', ')}, and ${userName}. Be the first to say something! Keep it short and fun.`;

        const text = await generateCompanionResponse(companion, companions, userName, prompt, systemPrompt, apiKey);
        if (text) {
          const chunks = breakIntoChunks(text);
          for (const chunk of chunks) {
            responses.push({
              companion_id: companion.id,
              sender_name: companion.custom_name,
              content: chunk,
              delay_ms: calculateDelay(chunk)
            });
          }
        }
      }
    } else if (mode === 'topic') {
      const speakers = selectDynamicSpeakers(companions, companions.length);
      for (const companion of speakers) {
        const systemPrompt = buildGroupSystemPrompt(companion, companions, userName, 'topic');
        const prevResponses = responses.map(r => `${r.sender_name}: ${r.content}`).join('\n');
        const contextBlock = conversationContext ? `Recent chat:\n${conversationContext}\n\n` : '';
        const prompt = prevResponses
          ? `${contextBlock}${userName} proposed a topic: "${topic}"\n\n${prevResponses}\n\nGive your take as ${companion.custom_name}. React to others if you want. Be opinionated.`
          : `${contextBlock}${userName} proposed a topic: "${topic}"\n\nGive your hot take as ${companion.custom_name}. Be opinionated and genuine.`;

        const text = await generateCompanionResponse(companion, companions, userName, prompt, systemPrompt, apiKey);
        if (text) {
          const chunks = breakIntoChunks(text);
          for (const chunk of chunks) {
            responses.push({
              companion_id: companion.id,
              sender_name: companion.custom_name,
              content: chunk,
              delay_ms: calculateDelay(chunk)
            });
          }
        }
      }
    } else if (mode === 'autonomous') {
      const respondersCount = Math.max(1, Math.min(companions.length, Math.random() < 0.4 ? companions.length : Math.ceil(Math.random() * 2) + 1));
      const autonomousWeights = companions.map(c => {
        const recentCount = recentSpeakers.filter(name => name === c.custom_name).length;
        return Math.max(0.4, 1 - (recentCount * 0.15));
      });
      const responders: CompanionInfo[] = [];
      const pool = [...companions];
      const poolWeights = [...autonomousWeights];
      for (let i = 0; i < respondersCount && pool.length > 0; i++) {
        const rand = Math.random() * poolWeights.reduce((s, w) => s + w, 0);
        let cumulative = 0;
        let selectedIdx = 0;
        for (let j = 0; j < pool.length; j++) {
          cumulative += poolWeights[j];
          if (rand <= cumulative) { selectedIdx = j; break; }
        }
        responders.push(pool[selectedIdx]);
        pool.splice(selectedIdx, 1);
        poolWeights.splice(selectedIdx, 1);
      }

      for (const companion of responders) {
        const systemPrompt = buildGroupSystemPrompt(companion, companions, userName, 'autonomous');
        const prevResponses = responses.map(r => `${r.sender_name}: ${r.content}`).join('\n');
        const allContext = prevResponses
          ? `Recent group chat:\n${conversationContext}\n${prevResponses}\n\nContinue the conversation as ${companion.custom_name}. React to what was just said. Keep it short.`
          : `Recent group chat:\n${conversationContext}\n\nContinue the conversation as ${companion.custom_name}. Build on what was just discussed or bring up something new. Keep it short.`;

        const text = await generateCompanionResponse(companion, companions, userName, allContext, systemPrompt, apiKey);
        if (text) {
          const chunks = breakIntoChunks(text);
          for (const chunk of chunks) {
            responses.push({
              companion_id: companion.id,
              sender_name: companion.custom_name,
              content: chunk,
              delay_ms: calculateDelay(chunk)
            });
          }
        }
      }
    } else {
      const respondersCount = Math.min(
        companions.length,
        Math.random() < 0.35 ? companions.length : Math.max(1, Math.ceil(companions.length * 0.6))
      );
      const responders = selectDynamicSpeakers(companions, respondersCount);

      for (const companion of responders) {
        const systemPrompt = buildGroupSystemPrompt(companion, companions, userName, 'user_reply');
        const prevResponses = responses.map(r => `${r.sender_name}: ${r.content}`).join('\n');
        const contextBlock = conversationContext ? `Recent group chat:\n${conversationContext}\n\n` : '';
        const prompt = prevResponses
          ? `${contextBlock}${userName}: ${userMessage}\n${prevResponses}\n\nRespond as ${companion.custom_name}. React to ${userName} and/or what others said. Keep it short.`
          : `${contextBlock}${userName}: ${userMessage}\n\nRespond as ${companion.custom_name}. Keep it short (1-3 sentences).`;

        const text = await generateCompanionResponse(companion, companions, userName, prompt, systemPrompt, apiKey);
        if (text) {
          const chunks = breakIntoChunks(text);
          for (const chunk of chunks) {
            responses.push({
              companion_id: companion.id,
              sender_name: companion.custom_name,
              content: chunk,
              delay_ms: calculateDelay(chunk)
            });
          }
        }
      }
    }

    if (!isSuperUser && messagesRemaining !== -1) {
      const newCount = Math.max(0, messagesRemaining - 1);
      await supabaseAdmin
        .from('user_profiles')
        .update({ messages_remaining: newCount })
        .eq('id', user.id);
    }

    if (profile?.referred_by && !profile?.referral_qualified) {
      await supabaseAdmin.rpc('track_referral_progress', { p_user_id: user.id });
    }

    return new Response(JSON.stringify({ responses }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Group chat error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
