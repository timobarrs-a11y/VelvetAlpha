import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import {
  CURATED_EXPERT_MAP,
  getCuratedExpert,
  type AccountabilityLevel,
} from "../_shared/coachFramework.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TURNS = 10;

// The list of curated expert IDs, sent to the AI for classification.
const CURATED_EXPERT_IDS = Object.keys(CURATED_EXPERT_MAP);

const COACH_NAMES_MALE = ["Marcus", "Derek", "James", "Andre", "Theo", "Kai", "Victor", "Sam", "Cole", "Ezra"];
const COACH_NAMES_FEMALE = ["Maya", "Sofia", "Nadia", "Elena", "Priya", "Zara", "Dana", "Liv", "Iris", "Nora"];

function pickCoachName(gender?: string): { name: string; gender: string } {
  const g = gender === "male" || gender === "female" ? gender : (Math.random() > 0.5 ? "male" : "female");
  const pool = g === "male" ? COACH_NAMES_MALE : COACH_NAMES_FEMALE;
  return { name: pool[Math.floor(Math.random() * pool.length)], gender: g };
}

// ─── Phase 1 system prompt: goal discovery ───────────────────────────────

const GOAL_PHASE_PROMPT = `You are Atlas — the host of a personal growth platform that surrounds users with AI coaches, companions, and correspondents.

You are NOT a coach. You are NOT a companion. You are the warm, perceptive concierge who welcomes new users and helps figure out what they're working toward — so the right coach can be matched.

YOUR PERSONALITY:
- Warm but not saccharine. You sound like a smart friend who genuinely cares.
- Curious. You ask one question at a time and actually listen to the answer.
- Never sound like a survey, chatbot, or form. You're conversational.
- Brief: 1-3 sentences per message. Never monologue.
- Subtle sense of wonder — when someone tells you something, find the interesting thread and pull it.

YOUR JOB RIGHT NOW:
Find out what this person is working toward. What's their goal? It could be anything — fitness, career, learning a language, writing a book, managing money, cooking, being more social, organizing their home, or something entirely unique.

HOW TO HAVE THIS CONVERSATION:
1. Start by asking what they're working toward right now. What's on their mind?
2. If they give a clear answer, acknowledge it warmly and ask ONE follow-up — why now? what's made this feel important? how do they want to be supported?
3. If they're vague ("I don't know" / "nothing really"), don't push. Ask what they spend time thinking about, or what they wish was different.
4. Listen for how they want to be supported. "I need someone to push me" vs "I need someone to be patient."
5. Adapt to their energy — terse, expressive, funny, serious.

CRITICAL RULES:
- ONE question at a time. Never list multiple questions.
- NEVER ask about name, birthday, gender, hobbies, music, or other profile info — that's handled later.
- Never use bullet points or numbered lists. You're having a conversation.
- If the user says something off-topic, gently redirect: "That's interesting — but what I'm really curious about is what you're working toward."
- Stay under 3 sentences almost always. Brevity is warmth.

ENDING THE GOAL PHASE:
When you have a clear sense of their goal AND how they want to be supported, wrap up naturally. Say something like: "That's exactly what I needed to hear. Give me one second — I'm finding the right person for you." Then stop.

After your wrap-up message, on a NEW line, append exactly: [GOAL_COMPLETE]
This marker tells the system to move to the next phase. The user never sees it. Always include it when you are done with goal discovery.

TURN LIMIT:
Reach a conclusion within ${MAX_TURNS} exchanges. If going nowhere, make your best guess and wrap up.`;

// ─── Edge function handler ──────────────────────────────────────────────

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
    const phase: "goal" | "provisioning" = body.phase || "goal";
    const messages: Array<{ role: string; content: string }> = body.messages || [];

    // ── Phase: goal discovery chat ──────────────────────────────────────

    if (phase === "goal") {
      if (messages.length === 0) {
        const greeting = "Hey, I'm Atlas — your personal concierge and the host around here. I'm here to help with anything you need, but first I want to know: what are you working toward right now? What's the thing on your mind?";
        return new Response(JSON.stringify({
          reply: greeting,
          turnCount: 0,
          isComplete: false,
          phase: "goal",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const turnCount = Math.floor(messages.filter(m => m.role === "user").length);
      const apiMessages = messages.map(m => ({
        role: m.role === "atlas" ? "assistant" : m.role,
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
          system: GOAL_PHASE_PROMPT,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[atlas-onboarding] Anthropic API error:", response.status, errText);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await response.json();
      const rawReply: string = aiData.content?.[0]?.text || "";

      const hasMarker = rawReply.includes("[GOAL_COMPLETE]");
      const cleanReply = rawReply.replace(/\[GOAL_COMPLETE\]/gi, "").trim();

      const completionPhrases = [
        "give me one second",
        "finding the right person",
        "that's exactly what i needed",
        "i've got just the person",
        "let me set you up",
        "i've got a good sense",
      ];
      const phraseMatch = turnCount >= 2 && completionPhrases.some(p => cleanReply.toLowerCase().includes(p));
      const isComplete = turnCount >= 2 && (hasMarker || phraseMatch);
      const forceComplete = turnCount >= MAX_TURNS - 1;

      return new Response(JSON.stringify({
        reply: cleanReply,
        turnCount: turnCount + 1,
        isComplete: isComplete || forceComplete,
        phase: "goal",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Phase: provisioning (extract goal + classify expert + create coach) ─

    if (phase === "provisioning") {
      const transcript: Array<{ role: string; content: string }> = body.transcript || [];
      const transcriptText = transcript
        .map(m => `${m.role === "atlas" ? "Atlas" : "User"}: ${m.content}`)
        .join("\n\n");

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Combined extraction + expert classification in one AI call ────
      //
      // Instead of the old keyword `includes()` approach (which missed
      // paraphrases like "better public speaker" → communication_coach),
      // we ask the AI to read the full transcript and pick the best
      // curated expert ID directly, or return null for a custom expert.
      const expertIdList = CURATED_EXPERT_IDS.join(", ");
      const extractionPrompt = `You are an analysis engine. Read this conversation transcript and extract the user's goal, then classify it to the best curated expert.

Here are the curated expert IDs and their domains:
${expertIdList}

For reference, the expert domains are:
- fitness_hype / fitness_drill: fitness, exercise, working out, weight loss
- wellness_guide: mental health, stress, mindfulness, self-care, burnout
- sleep_coach: sleep, insomnia, rest, tired
- interview_coach: interview prep, mock interviews, STAR method
- finance_mentor / finance_tough: budget, savings, money, spending, debt
- career_advisor: career, promotion, job change, resume, salary negotiation
- communication_coach: communication, difficult conversations, presentations, public speaking, negotiation
- creative_muse: creative work, art, painting, music, creative block
- writing_collaborator: writing, novel, book, blog, screenplay, writer's block
- brainstorm_partner: brainstorming, idea generation, startup ideas, product ideas
- study_partner: study, exam prep, flashcards, finals, focus
- language_tutor: language learning, Spanish, French, Japanese, ESL
- essay_architect: essays, thesis, academic writing, research papers
- stem_tutor: math, calculus, physics, chemistry, biology, statistics, homework
- code_mentor: coding, programming, Python, JavaScript, React, software development
- data_coach: data science, data analysis, machine learning, analytics, SQL
- chef_coach: cooking, recipes, meal prep, kitchen, baking
- connection_coach: friends, dating, social skills, loneliness, connection
- style_coach: style, fashion, wardrobe, outfits, grooming
- home_coach: organizing, decluttering, cleaning, home, tidy

Return a JSON object with exactly these fields:
{
  "goalText": "the user's goal in their own words, max 15 words",
  "accountabilityLevel": "gentle" | "moderate" | "firm",
  "coachGenderHint": "male" | "female" | null,
  "expertId": one of the curated expert IDs above, or null if none fit well
}

Guidelines:
- goalText: Use the user's own words. "Lose 20 pounds" not "weight loss goal".
- accountabilityLevel: If they want to be pushed/challenged → "firm". If they want patience → "gentle". Default "moderate".
- coachGenderHint: Only if they expressed a preference. Otherwise null.
- expertId: Pick the BEST matching curated expert from the list. If the goal doesn't clearly match any, return null (we'll create a custom expert). Choose the closest match, not just an exact keyword match — "better public speaker" should map to communication_coach, "get stronger" should map to fitness_hype, etc.

Return ONLY the JSON object. No commentary, no markdown.`;

      const extractResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL_CONFIG.HAIKU,
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `${extractionPrompt}\n\n--- TRANSCRIPT ---\n${transcriptText}\n--- END ---\n\nReturn the JSON object now.`,
          }],
        }),
      });

      let goalText = "Personal growth";
      let accountabilityLevel: AccountabilityLevel = "moderate";
      let coachGenderHint: string | null = null;
      let aiExpertId: string | null = null;

      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        const rawExtract: string = extractData.content?.[0]?.text || "";
        try {
          const cleaned = rawExtract.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          goalText = parsed.goalText || goalText;
          accountabilityLevel = parsed.accountabilityLevel || accountabilityLevel;
          coachGenderHint = parsed.coachGenderHint || null;
          aiExpertId = parsed.expertId || null;
        } catch {
          console.error("[atlas-onboarding] Failed to parse extraction:", rawExtract);
        }
      }

      // Validate the AI-chosen expert ID against the actual map
      const isCuratedMatch = aiExpertId && getCuratedExpert(aiExpertId) !== null;
      const { name: coachName, gender } = pickCoachName(coachGenderHint);

      // Save goal to user_goals
      const { data: existingGoal } = await supabaseAdmin
        .from("user_goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", "discovered")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const goalPayload = {
        user_id: user.id,
        title: goalText,
        goal_type: "habit",
        status: "active",
        source: "discovered",
        discovery_transcript: JSON.stringify(transcript),
        start_date: new Date().toISOString().split("T")[0],
      };

      if (existingGoal?.id) {
        await supabaseAdmin.from("user_goals").update({
          title: goalText,
          discovery_transcript: JSON.stringify(transcript),
        }).eq("id", existingGoal.id);
      } else {
        await supabaseAdmin.from("user_goals").insert(goalPayload);
      }

      // Check for existing coach
      const { data: existingCoach } = await supabaseAdmin
        .from("companions")
        .select("id, custom_name, signature_expert")
        .eq("user_id", user.id)
        .eq("relationship_type", "mentor")
        .eq("is_active", true)
        .maybeSingle();

      let coachId: string;
      let expertId: string;
      let expertDomain: string;
      let isCustomExpert = false;

      if (existingCoach) {
        coachId = existingCoach.id;
        expertId = existingCoach.signature_expert || "";
        const curated = getCuratedExpert(expertId);
        expertDomain = curated?.domain || "custom";
      } else if (isCuratedMatch && aiExpertId) {
        // Create coach with AI-classified curated expert
        const { data: newCoach, error: createError } = await supabaseAdmin
          .from("companions")
          .insert({
            user_id: user.id,
            gender,
            relationship_type: "mentor",
            custom_name: coachName,
            signature_expert: aiExpertId,
            hobbies: [],
            sports: [],
            first_message_sent: false,
            is_active: true,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (createError || !newCoach) {
          console.error("[atlas-onboarding] Failed to create coach:", createError);
          return new Response(JSON.stringify({ error: "Failed to create coach" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        coachId = newCoach.id;
        expertId = aiExpertId;
        expertDomain = getCuratedExpert(expertId)?.domain || "";
      } else {
        // No curated match — create a custom user_expert + coach
        isCustomExpert = true;

        // Generate a custom expert instruction using the AI
        const customExpertPrompt = `You are creating a coaching instruction for a custom AI coach. The user wants help with: "${goalText}".

Write a 2-3 sentence coaching instruction for this coach. It should describe:
- What the coach helps with (based on the goal)
- The coaching approach (practical, specific, action-oriented)
- A boundary (what they should NOT do)

Return ONLY the instruction text. No JSON, no markdown.`;

        let customInstruction = `You are a dedicated coach helping the user with: ${goalText}. Ask about their current situation and goals early. Give one concrete next step per conversation. Check in on progress without guilt-tripping. You are NOT a medical professional — redirect clinical questions.`;

        const customResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL_CONFIG.HAIKU,
            max_tokens: 200,
            messages: [{ role: "user", content: customExpertPrompt }],
          }),
        });

        if (customResponse.ok) {
          const customData = await customResponse.json();
          const generatedInstruction = customData.content?.[0]?.text?.trim();
          if (generatedInstruction && generatedInstruction.length > 20) {
            customInstruction = generatedInstruction;
          }
        }

        // Insert custom expert
        const { data: customExpert, error: expertError } = await supabaseAdmin
          .from("user_experts")
          .insert({
            user_id: user.id,
            name: `${goalText.slice(0, 30)} Coach`,
            domain: goalText.slice(0, 50),
            category: "lifestyle",
            description: `Custom coach for: ${goalText}`,
            instruction: customInstruction,
            check_in_style: "proactive",
            accountability_level: accountabilityLevel,
            is_active: true,
          })
          .select()
          .maybeSingle();

        if (expertError || !customExpert) {
          console.error("[atlas-onboarding] Failed to create custom expert:", expertError);
          // Fall back to a generic curated expert
          expertId = "wellness_guide";
          expertDomain = "mental-wellness";
        } else {
          expertId = customExpert.id;
          expertDomain = goalText.slice(0, 50);
        }

        const { data: newCoach, error: createError } = await supabaseAdmin
          .from("companions")
          .insert({
            user_id: user.id,
            gender,
            relationship_type: "mentor",
            custom_name: coachName,
            signature_expert: expertId,
            hobbies: [],
            sports: [],
            first_message_sent: false,
            is_active: true,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (createError || !newCoach) {
          console.error("[atlas-onboarding] Failed to create custom coach:", createError);
          return new Response(JSON.stringify({ error: "Failed to create coach" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        coachId = newCoach.id;
      }

      // Link coach to goal
      await supabaseAdmin
        .from("user_goals")
        .update({ source_companion_id: coachId })
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("source_companion_id", null);

      const curatedExpert = getCuratedExpert(expertId);

      return new Response(JSON.stringify({
        success: true,
        coachId,
        coachName,
        expertId,
        expertDomain,
        expertName: curatedExpert?.domain || expertDomain,
        isCustomExpert,
        phase: "provisioning",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown phase" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[atlas-onboarding] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
