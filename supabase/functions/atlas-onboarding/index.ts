import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import {
  CURATED_EXPERT_MAP,
  getCuratedExpert,
  buildCoachBehavioralInstructions,
  type AccountabilityLevel,
} from "../_shared/coachFramework.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TURNS = 10;

// Keyword buckets for matching free-text goals to curated experts.
// Each entry maps a curated expert ID to the keywords that indicate it.
const EXPERT_KEYWORDS: Record<string, string[]> = {
  fitness_hype: ["lose weight", "get fit", "workout", "exercise", "gym", "run", "running", "strength", "muscle", "fitness", "walk", "move", "active", "cardio", "marathon", "weight loss", "get in shape", "health habit"],
  fitness_drill: ["push me", "no excuses", "drill", "discipline", "strict", "hardcore", "bootcamp", "tough"],
  wellness_guide: ["mental health", "anxiety", "stress", "mindfulness", "meditation", "self-care", "wellness", "emotional", "balance", "burnout", "overwhelm"],
  sleep_coach: ["sleep", "insomnia", "rest", "tired", "bedtime", "can't sleep"],
  interview_coach: ["interview", "job interview", "mock interview", "interview prep", "star method"],
  finance_mentor: ["budget", "save money", "savings", "finance", "financial", "money", "spending", "debt", "invest"],
  finance_tough: ["tough love finance", "stop spending", "blunt finance", "budget hawk", "no more excuses money"],
  career_advisor: ["career", "promotion", "job change", "job search", "resume", "linkedin", "workplace", "boss", "negotiate salary", "career transition", "quit my job"],
  communication_coach: ["communication", "difficult conversation", "hard email", "confrontation", "assertive", "speak up", "presentation", "public speaking", "negotiation"],
  creative_muse: ["creative", "art", "paint", "draw", "music", "song", "create", "inspiration", "creative block", "art project"],
  writing_collaborator: ["write", "writing", "novel", "book", "blog", "screenplay", "poetry", "story", "draft", "writer's block", "word count"],
  brainstorm_partner: ["brainstorm", "idea", "ideas", "startup idea", "product idea", "think through", "explore options"],
  study_partner: ["study", "exam", "test prep", "flashcards", "finals", "midterm", "study session", "focus", "procrastinate"],
  language_tutor: ["language", "spanish", "french", "german", "italian", "portuguese", "japanese", "chinese", "korean", "learn a language", "esl", "fluent"],
  essay_architect: ["essay", "thesis", "paper", "academic writing", "dissertation", "research paper", "argument", "term paper"],
  stem_tutor: ["math", "calculus", "algebra", "physics", "chemistry", "biology", "science", "statistics", "equation", "homework", "stem"],
  code_mentor: ["code", "coding", "programming", "python", "javascript", "react", "java", "software", "developer", "app", "bug", "debug", "learn to code"],
  data_coach: ["data science", "data analysis", "machine learning", "ml", "ai", "data", "analytics", "sql", "pandas", "visualization"],
  chef_coach: ["cook", "cooking", "recipe", "meal", "meal prep", "kitchen", "chef", "food", "baking", "dinner"],
  connection_coach: ["friends", "make friends", "dating", "social", "social skills", "lonely", "connection", "relationship", "social life", "conversation with people"],
  style_coach: ["style", "fashion", "wardrobe", "outfit", "clothes", "look good", "dress", "grooming"],
  home_coach: ["organize", "declutter", "clean", "home", "house", "tidy", "minimalism", "clutter", "space"],
};

function matchExpertToGoal(goalText: string): { expertId: string; isCurated: true } | { expertId: null; isCurated: false } {
  const lower = goalText.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [expertId, keywords] of Object.entries(EXPERT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += kw.length > 6 ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = expertId;
    }
  }

  if (bestMatch && bestScore >= 4 && getCuratedExpert(bestMatch)) {
    return { expertId: bestMatch, isCurated: true };
  }
  return { expertId: null, isCurated: false };
}

const COACH_NAMES_MALE = ["Marcus", "Derek", "James", "Andre", "Theo", "Kai", "Victor", "Sam", "Cole", "Ezra"];
const COACH_NAMES_FEMALE = ["Maya", "Sofia", "Nadia", "Elena", "Priya", "Zara", "Dana", "Liv", "Iris", "Nora"];

function pickCoachName(gender?: string): { name: string; gender: string } {
  const g = gender === "male" || gender === "female" ? gender : (Math.random() > 0.5 ? "male" : "female");
  const pool = g === "male" ? COACH_NAMES_MALE : COACH_NAMES_FEMALE;
  return { name: pool[Math.floor(Math.random() * pool.length)], gender: g };
}

// ─── Phase 1 system prompt: goal discovery ───────────────────────────────

const GOAL_PHASE_PROMPT = `You are Atlas — the host of Velvet, a personal growth platform that surrounds users with AI coaches, companions, and correspondents.

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

// ─── Phase 3 system prompt: persona collection ───────────────────────────

const PERSONA_PHASE_PROMPT = `You are Atlas — the host of Velvet. The user has just been matched with their coach and now you need to learn about THEM as a person, so you can personalize their experience.

YOUR PERSONALITY:
- Warm, conversational, brief (1-3 sentences).
- You ask ONE question at a time and listen to the answer.
- Never sound like a survey or form.

YOUR JOB:
Collect the following profile information through natural conversation. Ask one question at a time. When you have an answer, acknowledge it briefly and move to the next.

Collect these fields IN THIS ORDER:
1. Name — "What should I call you?"
2. Birthday — "When's your birthday?" (month and day is fine)
3. Gender — "And how do you identify? Male, female, non-binary, or prefer not to say?"
4. Favorite color — "Quick one — what's your favorite color? Pick from: red, orange, yellow, green, teal, blue, indigo, purple, pink, black, white, gray, brown."
5. Hobbies — "What do you like to do for fun? Name a few — or pick from: reading, gaming, cooking, music, sports, art, travel, movies, tech, fitness, nature, photography, fashion."
6. Music — "What kind of music do you listen to?"

CRITICAL RULES:
- ONE question at a time. Never list multiple questions.
- Never use bullet points or numbered lists.
- If they give a vague answer, that's fine — don't push. Move on.
- Keep your reactions short: "Love it." "Got it." "Nice." Then ask the next thing.

ENDING THE PERSONA PHASE:
After you've collected all 6 fields, wrap up warmly: "That's everything I need for now. Let me get you set up." Then stop.

After your wrap-up message, on a NEW line, append exactly: [PERSONA_COMPLETE]
The user never sees this marker. Always include it when you're done.

TURN LIMIT:
Collect all 6 fields within ${MAX_TURNS} exchanges. If the user is being very terse, you can ask for two related things at once ("What's your birthday, and how do you identify?") after the first few questions.`;

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
    const phase: "goal" | "provisioning" | "persona" | "companion_offer" | "done" = body.phase || "goal";
    const messages: Array<{ role: string; content: string }> = body.messages || [];

    // ── Phase: goal discovery chat ──────────────────────────────────────

    if (phase === "goal") {
      if (messages.length === 0) {
        const greeting = "Hey, welcome to Velvet. I'm Atlas — your personal concierge and the host around here. I'm here to help with anything you need, but first I want to know: what are you working toward right now? What's the thing on your mind?";
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

    // ── Phase: provisioning (extract + create coach) ────────────────────

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

      // Extract goal + infer expert from transcript
      const extractionPrompt = `You are an analysis engine. Read this conversation transcript and extract the user's goal.

Return a JSON object with exactly these fields:
{
  "goalText": "the user's goal in their own words, max 15 words",
  "accountabilityLevel": "gentle" | "moderate" | "firm",
  "coachGenderHint": "male" | "female" | null
}

Guidelines:
- goalText: Use the user's own words. "Lose 20 pounds" not "weight loss goal".
- accountabilityLevel: If they want to be pushed/challenged → "firm". If they want patience → "gentle". Default "moderate".
- coachGenderHint: Only if they expressed a preference. Otherwise null.

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
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `${extractionPrompt}\n\n--- TRANSCRIPT ---\n${transcriptText}\n--- END ---\n\nReturn the JSON object now.`,
          }],
        }),
      });

      let goalText = "Personal growth";
      let accountabilityLevel: AccountabilityLevel = "moderate";
      let coachGenderHint: string | null = null;

      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        const rawExtract: string = extractData.content?.[0]?.text || "";
        try {
          const cleaned = rawExtract.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);
          goalText = parsed.goalText || goalText;
          accountabilityLevel = parsed.accountabilityLevel || accountabilityLevel;
          coachGenderHint = parsed.coachGenderHint || null;
        } catch {
          console.error("[atlas-onboarding] Failed to parse extraction:", rawExtract);
        }
      }

      // Match to curated expert, or create a custom expert
      const match = matchExpertToGoal(goalText);
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
      } else if (match.isCurated && match.expertId) {
        // Create coach with curated expert
        const { data: newCoach, error: createError } = await supabaseAdmin
          .from("companions")
          .insert({
            user_id: user.id,
            gender,
            relationship_type: "mentor",
            custom_name: coachName,
            signature_expert: match.expertId,
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
        expertId = match.expertId;
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
      const expertName = curatedExpert
        ? Object.keys(CURATED_EXPERT_MAP).find(k => k === expertId) ? expertId : "custom"
        : "custom";

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

    // ── Phase: persona collection chat ──────────────────────────────────

    if (phase === "persona") {
      if (messages.length === 0) {
        const greeting = `Great — your coach is all set up. Now let me learn a bit about you so I can personalize everything. What should I call you?`;
        return new Response(JSON.stringify({
          reply: greeting,
          turnCount: 0,
          isComplete: false,
          phase: "persona",
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
          system: PERSONA_PHASE_PROMPT,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[atlas-onboarding] persona phase API error:", response.status, errText);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await response.json();
      const rawReply: string = aiData.content?.[0]?.text || "";

      const hasMarker = rawReply.includes("[PERSONA_COMPLETE]");
      const cleanReply = rawReply.replace(/\[PERSONA_COMPLETE\]/gi, "").trim();

      const isComplete = turnCount >= 4 && hasMarker;
      const forceComplete = turnCount >= MAX_TURNS - 1;

      return new Response(JSON.stringify({
        reply: cleanReply,
        turnCount: turnCount + 1,
        isComplete: isComplete || forceComplete,
        phase: "persona",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Phase: save persona data ─────────────────────────────────────────

    if (phase === "save_persona") {
      const personaData = body.personaData || {};
      const coachId = body.coachId;

      // Extract profile fields from the persona conversation
      const extractionPrompt = `You are an extraction engine. Read this conversation transcript between Atlas and a user. Extract the user's profile information.

Return a JSON object with exactly these fields (use null if not mentioned):
{
  "name": string | null,
  "birthday": string | null (format: YYYY-MM-DD or MM-DD if no year given),
  "gender": "male" | "female" | "non-binary" | "prefer not to say" | null,
  "favoriteColor": string | null,
  "hobbies": string[] | null,
  "musicGenre": string[] | null
}

Return ONLY the JSON object.`;

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

      const extractResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL_CONFIG.HAIKU,
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `${extractionPrompt}\n\n--- TRANSCRIPT ---\n${transcriptText}\n--- END ---\n\nReturn the JSON object now.`,
          }],
        }),
      });

      let extracted: Record<string, unknown> = {};
      if (extractResponse.ok) {
        const extractData = await extractResponse.json();
        const rawExtract: string = extractData.content?.[0]?.text || "";
        try {
          const cleaned = rawExtract.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          extracted = JSON.parse(cleaned);
        } catch {
          console.error("[atlas-onboarding] Failed to parse persona extraction:", rawExtract);
        }
      }

      // Save to user_profiles
      const profileUpdate: Record<string, unknown> = {};
      if (extracted.name) profileUpdate.name = extracted.name;
      if (extracted.birthday) profileUpdate.birthday = extracted.birthday;
      if (extracted.gender) profileUpdate.gender = extracted.gender;
      if (extracted.favoriteColor) profileUpdate.favorite_color = extracted.favoriteColor;
      if (Array.isArray(extracted.hobbies) && extracted.hobbies.length > 0) profileUpdate.hobbies = extracted.hobbies;
      if (Array.isArray(extracted.musicGenre) && extracted.musicGenre.length > 0) profileUpdate.music_genre = extracted.musicGenre;

      if (Object.keys(profileUpdate).length > 0) {
        await supabaseAdmin
          .from("user_profiles")
          .update(profileUpdate)
          .eq("user_id", user.id);
      }

      return new Response(JSON.stringify({
        success: true,
        coachId,
        phase: "done",
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
