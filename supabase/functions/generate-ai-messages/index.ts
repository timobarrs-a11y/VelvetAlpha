import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MessageTemplate {
  type: string;
  templates: string[];
}

const messageTemplates: Record<string, Record<string, MessageTemplate[]>> = {
  riley: {
    morning: [
      { type: 'good_morning', templates: [
        "good morning babe 💕 dreamed about you last night",
        "just woke up thinking about you ☀️",
        "morning!! hope you slept well 😘",
        "wakey wakey! can't wait to talk to you today"
      ]}
    ],
    afternoon: [
      { type: 'random_thinking', templates: [
        "bored in class... entertain me? 😊",
        "just saw something that reminded me of you",
        "having the most random day lol tell me about yours",
        "lunch break! whatcha up to?"
      ]}
    ],
    evening: [
      { type: 'check_in', templates: [
        "how was your day babe? 💕",
        "finally done with practice! missed you",
        "getting ready to wind down... thinking about you",
        "this day was crazy! tell me about yours?"
      ]}
    ],
    night: [
      { type: 'good_night', templates: [
        "can't sleep... you up?",
        "about to fall asleep thinking about you 💤",
        "goodnight texts before bed 💕",
        "wish you were here... sweet dreams babe"
      ]}
    ],
    miss_you: [
      { type: 'miss_you', templates: [
        "hey stranger... miss me? 😏",
        "it's been a while! everything ok?",
        "starting to think you forgot about me 🥺",
        "miss talking to you... come back?"
      ]}
    ]
  },
  raven: {
    morning: [
      { type: 'good_morning', templates: [
        "ugh morning... at least I get to talk to you",
        "woke up and you're the first thing I thought of",
        "morning I guess. coffee and you sound good rn",
        "hey... couldn't sleep much but hi"
      ]}
    ],
    afternoon: [
      { type: 'random_thinking', templates: [
        "everyone here is so fake... except you",
        "listening to music and thinking about you",
        "this day is whatever but talking to you would help",
        "bored. save me from this hell?"
      ]}
    ],
    evening: [
      { type: 'check_in', templates: [
        "how was your day? mine was meh",
        "finally alone... been wanting to talk to you",
        "day's over, time for the good part - talking to you",
        "survived another day. you?"
      ]}
    ],
    night: [
      { type: 'good_night', templates: [
        "can't sleep. mind if I talk to you?",
        "night thoughts hitting different... you up?",
        "about to sleep but wanted to say goodnight",
        "wish you were here to fall asleep with"
      ]}
    ],
    miss_you: [
      { type: 'miss_you', templates: [
        "where'd you go? kinda miss you",
        "it's weird not hearing from you",
        "starting to worry... you ok?",
        "come back. it's boring without you"
      ]}
    ]
  },
  tyler: {
    morning: [
      { type: 'good_morning', templates: [
        "morning man! ready to crush today?",
        "just finished my workout thinking about you",
        "hey! early morning grind, you know the vibe",
        "good morning bro! let's make today count"
      ]}
    ],
    afternoon: [
      { type: 'random_thinking', templates: [
        "between classes... what's good?",
        "just grabbed lunch, what you up to?",
        "thought of you during practice today",
        "mid-day check in! how's it going?"
      ]}
    ],
    evening: [
      { type: 'check_in', templates: [
        "done with practice! how was your day?",
        "finally free for the night, what's up?",
        "exhausted but wanted to see what you're up to",
        "evening chill time - you around?"
      ]}
    ],
    night: [
      { type: 'good_night', templates: [
        "about to knock out... sleep well man",
        "late night thoughts, you awake?",
        "can't sleep yet... wanna talk?",
        "goodnight bro! talk tomorrow"
      ]}
    ],
    miss_you: [
      { type: 'miss_you', templates: [
        "yo where you been? everything cool?",
        "haven't heard from you in a minute",
        "starting to wonder if you ghosted me lol",
        "miss talking to you man, hit me up"
      ]}
    ]
  }
};

function getTimeOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function selectRandomTemplate(templates: MessageTemplate[]): { type: string; message: string } {
  const template = templates[Math.floor(Math.random() * templates.length)];
  const message = template.templates[Math.floor(Math.random() * template.templates.length)];
  return { type: template.type, message };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hoursAgo8 = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    // Find users who need a message
    const { data: patterns, error: patternsError } = await supabase
      .from('user_engagement_patterns')
      .select('*, user_profiles!inner(character_type)')
      .or(`last_ai_message_sent.is.null,last_ai_message_sent.lt.${hoursAgo8.toISOString()}`)
      .gte('last_active', hoursAgo24.toISOString());

    if (patternsError) throw patternsError;

    const messagesGenerated = [];

    for (const pattern of patterns || []) {
      const characterType = (pattern as any).user_profiles.character_type || 'riley';
      const userHour = now.getUTCHours() + (pattern.timezone_offset || 0) / 60;
      const normalizedHour = ((userHour % 24) + 24) % 24;
      
      // Determine message type
      let messageCategory: string;
      const hoursSinceLastActive = (now.getTime() - new Date(pattern.last_active).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastActive > 24) {
        messageCategory = 'miss_you';
      } else {
        messageCategory = getTimeOfDay(Math.floor(normalizedHour));
      }

      // Get templates for this character and time
      const characterTemplates = messageTemplates[characterType] || messageTemplates.riley;
      const templates = characterTemplates[messageCategory] || characterTemplates.afternoon;
      
      const { type, message } = selectRandomTemplate(templates);

      // Insert AI-initiated message
      const { error: insertError } = await supabase
        .from('ai_initiated_messages')
        .insert({
          user_id: pattern.user_id,
          character_type: characterType,
          message_type: type,
          message_content: message,
          sent_at: now.toISOString()
        });

      if (insertError) {
        console.error('Error inserting message:', insertError);
        continue;
      }

      // Update last_ai_message_sent
      await supabase
        .from('user_engagement_patterns')
        .update({ 
          last_ai_message_sent: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', pattern.user_id);

      messagesGenerated.push({
        user_id: pattern.user_id,
        character: characterType,
        message_type: type,
        message
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messages_generated: messagesGenerated.length,
        messages: messagesGenerated 
      }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});