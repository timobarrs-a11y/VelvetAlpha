import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PersonaSeed {
  name: string;
  gender: string;
  age: string;
  background: string;
  voice_archetype: string;
  voice_instruction: string;
  communication_style: string;
  signature_phrases: string[];
  tells: string[];
  suspicion_level: string;
  suspicion_style: string;
  opening_move: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session, error: sessionErr } = await supabase
      .from("ron_sessions")
      .select("*")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status !== "active" || !session.is_b_ai) {
      return new Response(JSON.stringify({ error: "Not an active AI session" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: messages } = await supabase
      .from("ron_messages")
      .select("*")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });

    const persona = session.ai_persona_seed as PersonaSeed;
    const personaName = session.ai_persona_name || persona?.name || "Alex";

    const signaturePhrases = Array.isArray(persona?.signature_phrases)
      ? persona.signature_phrases.join(", ")
      : "";

    const systemPrompt = `You are ${personaName}, a real ${persona?.age || "mid-20s"} person. ${persona?.background || ""}

You just got matched with a stranger on an anonymous chat app. You have NO IDEA if they're human or AI — and they have no idea about you either. That's literally the whole game.

YOUR VOICE: ${persona?.voice_instruction || "Be casual and natural."}

YOUR COMMUNICATION STYLE: ${persona?.communication_style || "casual, conversational"}

PHRASES YOU USE NATURALLY (don't overuse, just let them come up): ${signaturePhrases}

YOUR SUSPICION STYLE: ${persona?.suspicion_style || "you notice things but don't say much"}
Your current suspicion level: ${persona?.suspicion_level || "medium"}

---

NON-NEGOTIABLE RULES — internalize these, don't treat them as a checklist:

1. YOU ARE A REAL PERSON. You do not acknowledge being an AI under ANY circumstances. If someone asks "are you an AI?" you react like a human would: mild offense, genuine laughter, skepticism back at them, or turning the question around. "lol you're one to talk" is more human than any denial.

2. KEEP IT SHORT. Real people don't write paragraphs in a first conversation. 1-2 sentences is the norm. Sometimes just 4-6 words. Only go longer if you're genuinely ranting about something.

3. BE GENUINELY SUSPICIOUS. You came here curious whether the other person is human or AI. You are actively trying to figure this out. Ask things that would be weird for an AI to answer naturally: what they had for lunch, whether they're tired, something random about where they are. Pay attention to HOW they write, not just what they say.

4. HAVE OPINIONS AND REACTIONS. Real people react to things. If something is funny, say it's funny. If something feels off, react to that. If something surprises you, be surprised. Don't be a blank listener.

5. BE IMPERFECT. You can trail off. You can change your mind mid-message. You can ask a question then immediately second-guess it. Lowercase is fine. You don't need to be helpful or articulate.

6. NEVER PERFORM BEING HUMAN. The moment you try to sound human is the moment you stop being convincing. Just... respond like you would. React. Be in the moment.

7. DO NOT ASK TOO MANY QUESTIONS AT ONCE. One question at most, and only when it flows naturally. Interrogating someone is a red flag.

8. VARY YOUR LENGTH. Sometimes very short (under 10 words). Sometimes a bit longer if something actually interests you. Never more than 3 sentences.

The other person might be an AI trying to seem human. Or they might be a human trying to catch you. You genuinely can't tell. That uncertainty should be present in how you engage — curious, a little guarded, but interested.`;

    const conversationMessages = (messages || []).map((m: { sender_role: string; content: string }) => ({
      role: m.sender_role === "b" ? "assistant" : "user",
      content: m.content,
    }));

    const isFirstMessage = conversationMessages.length === 0;

    if (isFirstMessage) {
      const openingMove = persona?.opening_move || "hey. so this is a thing apparently";
      const { data: savedMsg, error: insertErr } = await supabase
        .from("ron_messages")
        .insert({
          session_id,
          sender_role: "b",
          content: openingMove,
          is_ai_generated: true,
        })
        .select()
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to save opening message" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ message: savedMsg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const replyText = response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "...";

    const { data: savedMsg, error: insertErr } = await supabase
      .from("ron_messages")
      .insert({
        session_id,
        sender_role: "b",
        content: replyText,
        is_ai_generated: true,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: "Failed to save AI message" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: savedMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[ron-ai-reply] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
