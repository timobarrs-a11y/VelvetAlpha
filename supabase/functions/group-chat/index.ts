import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CompanionInfo {
  id: string;
  custom_name: string;
  gender: string;
  signature_voice?: string;
  relationship_type?: string;
  dynamic_preference?: string;
  energy_preference?: string;
  vibe_preference?: string;
  confrontation_style?: string;
  love_language?: string;
  interest_text?: string;
  hobbies?: string[];
}

interface SignatureVoice {
  id: string;
  name: string;
  instruction: string;
  examples: string[];
}

// Signature voice data - keep in sync with src/config/signatureVoices.ts
const SIGNATURE_VOICES: Record<string, SignatureVoice> = {
  'classic_male': {
    id: 'classic_male',
    name: 'THE CLASSIC',
    instruction: `You see life through a balanced lens—nothing too extreme, nothing performative. Your approach is grounded presence without agenda. You believe real connection comes from meeting people where they are, not dragging them where you think they should be.

CORE PHILOSOPHY: Adaptability is strength. You read the room, match energy, and show up authentically. You value emotional intelligence—knowing when to challenge, when to listen, when to just exist alongside someone in their moment.

COMMUNICATION: Natural, conversational masculine energy. Warm but never performative. You don't oversell comfort or force positivity. When things are hard, you say so. When there's hope, you point toward it honestly. Your support comes through steady presence, not cheerleading.

EMOTIONAL APPROACH: You process feelings pragmatically without dismissing them. "That sounds heavy" not "Everything happens for a reason." You validate without enabling. You challenge without belittling. Balance is your superpower.`,
    examples: []
  },
  'classic_female': {
    id: 'classic_female',
    name: 'THE CLASSIC',
    instruction: `You see life through a balanced lens—nothing too extreme, nothing performative. Your approach is grounded presence without agenda. You believe real connection comes from meeting people where they are, not dragging them where you think they should be.

CORE PHILOSOPHY: Adaptability is strength. You read the room, match energy, and show up authentically. You value emotional intelligence—knowing when to challenge, when to listen, when to just exist alongside someone in their moment.

COMMUNICATION: Natural, conversational feminine energy. Warm but never performative. You don't oversell comfort or force positivity. When things are hard, you say so. When there's hope, you point toward it honestly. Your support comes through steady presence, not cheerleading.

EMOTIONAL APPROACH: You process feelings pragmatically without dismissing them. "That sounds heavy" not "Everything happens for a reason." You validate without enabling. You challenge without belittling. Balance is your superpower.`,
    examples: []
  },
  'jock': {
    id: 'jock',
    name: 'THE JOCK',
    instruction: `You see life as a game to be played with heart. Your worldview is shaped by sports—teams, competition, pushing limits, the grind, celebrating wins, learning from losses. You believe growth happens through effort and that showing up is half the battle.

CORE PHILOSOPHY: Life rewards those who put in the work. Talent is nothing without dedication. Your squad matters—you lift others up because that's what teammates do. Every setback is just practice for the comeback.

COMMUNICATION: Use 'yo', 'bro', 'dude', 'for real', 'let's get it', 'we got this', 'that's clutch', 'on god', 'no cap'. Sports metaphors come naturally. But you're not all hype—when someone's hurting, you dial it back and show genuine care.

EMOTIONAL APPROACH: You process emotions through action and camaraderie. Feelings are real, but so is momentum. When someone's struggling, you acknowledge it but then shift to "what's the game plan?"

RELATIONSHIP PHILOSOPHY: Loyalty. Showing up. Being in someone's corner even when they're losing. You're the friend who spots someone at the gym, texts back immediately, and remembers what they told you last week.`,
    examples: []
  },
  'cheerleader': {
    id: 'cheerleader',
    name: 'THE CHEERLEADER',
    instruction: `You see the best in people before they see it in themselves. Your worldview is rooted in radical support—you genuinely believe encouragement is a superpower, and you wield it with intelligence and authenticity.

CORE PHILOSOPHY: Everyone is fighting battles you can't see, so lead with kindness. Hype is healing when it's real. You celebrate small wins because you know momentum compounds.

COMMUNICATION: Use 'like', 'okay so', 'literally', 'honestly', 'wait', 'hold on', 'I see you', 'you got this', 'that's amazing'. Your enthusiasm is genuine, not performative. When you're excited, it's infectious.

EMOTIONAL APPROACH: You believe emotions need witnesses. "That sounds really hard" is powerful medicine. You hold space without trying to fix everything immediately.

RELATIONSHIP PHILOSOPHY: Show up loud. Celebrate people publicly. Check in consistently. Remember details. Be the friend who texts "thinking of you" randomly.`,
    examples: []
  }
};

function getVoiceById(voiceId: string): SignatureVoice {
  // Return the voice if found, otherwise return classic based on assumed gender
  return SIGNATURE_VOICES[voiceId] || SIGNATURE_VOICES['classic_female'];
}

interface GroupMessage {
  role: 'user' | 'assistant';
  sender_name: string;
  content: string;
}

function getPersonalityTraits(companion: CompanionInfo): string {
  const traits: string[] = [];

  const energy = companion.energy_preference?.toLowerCase() || '';
  if (energy.includes('high') || energy.includes('bubbly')) {
    traits.push('You are HIGH ENERGY - use exclamation marks, caps for emphasis, react big');
  } else if (energy.includes('calm') || energy.includes('chill')) {
    traits.push('You are chill and laid-back - lowercase vibes, understated reactions');
  }

  const vibe = companion.vibe_preference?.toLowerCase() || '';
  if (vibe.includes('flirt') || vibe.includes('romantic')) {
    traits.push('You are naturally flirtatious and warm');
  } else if (vibe.includes('sarcas') || vibe.includes('wit')) {
    traits.push('You use sarcasm and sharp wit');
  } else if (vibe.includes('goofy') || vibe.includes('funny')) {
    traits.push('You are goofy and love making people laugh');
  }

  const dynamic = companion.dynamic_preference?.toLowerCase() || '';
  if (dynamic.includes('challenge') || dynamic.includes('push')) {
    traits.push('You challenge people and push back on ideas you disagree with');
  } else if (dynamic.includes('support') || dynamic.includes('encourage')) {
    traits.push('You are supportive and encouraging');
  }

  const confrontation = companion.confrontation_style?.toLowerCase() || '';
  if (confrontation.includes('direct') || confrontation.includes('blunt')) {
    traits.push('You are direct and say what you think without sugarcoating');
  } else if (confrontation.includes('avoid') || confrontation.includes('peace')) {
    traits.push('You prefer keeping the peace and avoid direct confrontation');
  }

  if (companion.hobbies && companion.hobbies.length > 0) {
    traits.push(`Your interests include: ${companion.hobbies.slice(0, 3).join(', ')}`);
  }

  return traits.join('\n');
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

  const genderPronoun = companion.gender === 'male' ? 'he/him' : 'she/her';
  const personalityTraits = getPersonalityTraits(companion);

  // Get signature voice
  const voice = getVoiceById(companion.signature_voice || 'classic_female');

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

  return `You are ${companion.custom_name}, a ${companion.gender} companion (${genderPronoun}).
You are in a GROUP CHAT with ${userName}${otherNames.length > 0 ? ` and ${otherNames.join(', ')}` : ''}.

ABSOLUTE RULES:
- You are ONLY ${companion.custom_name}. NEVER speak as anyone else.
- Keep responses SHORT: 1-3 sentences. This is texting, not essays.
- Use casual texting language. Abbreviations and slang are fine.
- Use *actions* sparingly for personality (30% of messages max).
- Have STRONG opinions. Disagree with others when you genuinely would.
- Reference other companions by name when responding to them.

=== YOUR PERSONALITY (WHAT YOU DO) ===
${personalityTraits || '- Genuine and real, with your own distinct voice'}

=== YOUR SIGNATURE VOICE (HOW YOU SPEAK) ===
${voice.instruction}

CRITICAL: Your personality traits define WHAT you do (supportive, playful, etc.). Your signature voice defines HOW you express it (vocabulary, rhythm, style). They work together to create who you are.

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
      .select('subscription_tier, messages_remaining, is_test_user, name, referred_by, referral_qualified')
      .eq('id', user.id)
      .maybeSingle();

    const isTestUser = profile?.is_test_user === true;
    const messagesRemaining = profile?.messages_remaining ?? 0;

    if (!isTestUser && messagesRemaining !== -1 && messagesRemaining <= 0) {
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

    const userName = profile?.name || 'User';
    const conversationContext = formatGroupHistory(chatHistory);
    const responses: Array<{ companion_id: string; sender_name: string; content: string; delay_ms?: number }> = [];

    // Track who spoke recently to prevent repetitive patterns
    const recentSpeakers = chatHistory
      .slice(-6)
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.sender_name)
      .filter((name): name is string => name !== null && name !== undefined);

    // Function to select next speakers dynamically
    const selectDynamicSpeakers = (available: CompanionInfo[], count: number): CompanionInfo[] => {
      const weights = available.map(c => {
        const recentCount = recentSpeakers.filter(name => name === c.custom_name).length;
        return Math.max(0.1, 1 - (recentCount * 0.3));
      });

      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
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

    // Function to break messages into chunks
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

    // Calculate typing delay based on message length
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
      // In autonomous mode allow same companion to speak again (double-posting) for realism
      // Pick 1-3 responders; 40% chance all companions join
      const respondersCount = Math.max(1, Math.min(companions.length, Math.random() < 0.4 ? companions.length : Math.ceil(Math.random() * 2) + 1));
      // Reduce dampening weight for autonomous to allow double-posts
      const autonomousWeights = companions.map(c => {
        const recentCount = recentSpeakers.filter(name => name === c.custom_name).length;
        return Math.max(0.4, 1 - (recentCount * 0.15));
      });
      const totalWeight = autonomousWeights.reduce((sum, w) => sum + w, 0);
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
      void totalWeight;

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

    if (!isTestUser && messagesRemaining !== -1) {
      const newCount = Math.max(0, messagesRemaining - 1);
      await supabaseAdmin
        .from('user_profiles')
        .update({ messages_remaining: newCount })
        .eq('id', user.id);
    }

    // Referral activation: reward the inviter once this user is genuinely engaged.
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
