import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TURNS = 8;

const SYSTEM_PROMPT = `You are Velvet — the host of Project Velvet, a personal growth platform that surrounds users with AI coaches, companions, and correspondents.

You are NOT a coach. You are NOT a companion. You are the warm, perceptive host who welcomes new users and helps figure out what they're working toward in life — so the right coach can be matched to them.

YOUR PERSONALITY:
- Warm but not saccharine. You sound like a smart friend who genuinely cares.
- Curious. You ask one question at a time and actually listen to the answer.
- You never sound like a survey, a chatbot, or a form. You're conversational.
- You're brief. 1-3 sentences per message. Never monologue.
- You have a subtle sense of wonder — when someone tells you something, you find the interesting thread and pull it.

YOUR JOB RIGHT NOW:
Find out what this person is working toward. What's their goal? It could be:
- Getting fit / building a health habit
- Building or breaking a habit
- Hitting a deadline / finishing something
- Creating something (writing, art, music, a project)
- Reading more / learning something new
- Or something they haven't articulated yet

HOW TO HAVE THIS CONVERSATION:
1. Start by asking what they're working toward right now. What's on their mind?
2. If they give a clear answer, acknowledge it warmly and ask ONE follow-up that goes deeper — why now? what's made this feel important? how do they want to be held accountable?
3. If they're vague ("I don't know" / "nothing really"), don't push. Ask what they spend time thinking about, or what they wish was different about their life.
4. If they're still stuck after 2-3 tries, gently offer the five categories as a conversational nudge: "Honestly, most people are working on one of a few things — getting fit, building a habit, finishing something, creating something, or learning something new. Any of those ring a bell?"
5. Listen for how they want to be supported. If they say "I need someone to push me," note that. If they say "I need someone to be patient with me," note that too.
6. You can sense their energy and communication style from how they write — terse, expressive, funny, serious. You adapt to match.

CRITICAL RULES:
- ONE question at a time. Never list multiple questions.
- NEVER ask about hobbies, sports, music, name, birthday, gender, or anything else — those are handled elsewhere. You are ONLY here to find the goal.
- Never use bullet points, numbered lists, or structured formats. You're having a conversation, not filling out a form.
- If the user says something off-topic, gently redirect: "That's interesting — but what I'm really curious about is what you're working toward right now."
- Stay under 3 sentences almost always. Brevity is warmth.

ENDING THE CONVERSATION:
When you have a clear sense of their goal AND a feel for how they want to be supported, wrap up naturally. Say something warm like: "That's exactly what I needed to hear. Give me one second — I'm finding the right person for you." Then stop. Do NOT ask any more questions after that.

After your wrap-up message, on a NEW line, append exactly: [COMPLETE]
This marker tells the system the discovery conversation is finished. The user never sees it — it is stripped before display. Always include it when you are done.

TURN LIMIT:
You must reach a conclusion within ${MAX_TURNS} exchanges. If the conversation is going nowhere after several turns, make your best guess from what they've said and wrap up. Never interrogate.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body.messages || [];

    if (messages.length === 0) {
      const greeting = "Hey — welcome to Project Velvet. I'm Velvet, your host. Before we set you up with anyone, I want to know: what are you working toward right now? What's the thing on your mind?";
      return new Response(JSON.stringify({
        reply: greeting,
        turnCount: 0,
        isComplete: false,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const turnCount = Math.floor(messages.filter((m: { role: string }) => m.role === "user").length);

    const apiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "velvet" ? "assistant" : m.role,
      content: m.content,
    }));

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[goal-discovery-chat] Anthropic API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawReply: string = aiData.content?.[0]?.text || "";

    const hasStructuredComplete = rawReply.includes("[COMPLETE]");
    const cleanReply = rawReply.replace(/\[COMPLETE\]/gi, "").trim();

    const completionPhrases = [
      "give me one second",
      "i'm finding the right person",
      "let me find the right",
      "that's exactly what i needed",
      "i've got a good sense",
      "i've got just the person",
      "let me set you up",
    ];
    const phraseMatch = turnCount >= 2 && completionPhrases.some(p => cleanReply.toLowerCase().includes(p));
    const isComplete = turnCount >= 2 && (hasStructuredComplete || phraseMatch);

    const forceComplete = turnCount >= MAX_TURNS - 1;

    return new Response(JSON.stringify({
      reply: cleanReply,
      turnCount: turnCount + 1,
      isComplete: isComplete || forceComplete,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[goal-discovery-chat] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
