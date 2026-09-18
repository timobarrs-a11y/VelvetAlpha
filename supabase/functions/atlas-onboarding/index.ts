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

const CURATED_EXPERT_IDS = Object.keys(CURATED_EXPERT_MAP);

const COACH_NAMES_MALE = ["Marcus", "Derek", "James", "Andre", "Theo", "Kai", "Victor", "Sam", "Cole", "Ezra"];
const COACH_NAMES_FEMALE = ["Maya", "Sofia", "Nadia", "Elena", "Priya", "Zara", "Dana", "Liv", "Iris", "Nora"];

function pickCoachName(gender?: string): { name: string; gender: string } {
  const g = gender === "male" || gender === "female" ? gender : (Math.random() > 0.5 ? "male" : "female");
  const pool = g === "male" ? COACH_NAMES_MALE : COACH_NAMES_FEMALE;
  return { name: pool[Math.floor(Math.random() * pool.length)], gender: g };
}

interface UserProfile {
  name: string | null;
  hobbies: string | null;
  sports: string | null;
  music_genre: string | null;
  gender: string | null;
  zodiac_sign: string | null;
  favorite_color: string | null;
}

async function fetchUserProfile(supabaseAdmin: ReturnType<typeof createClient>, userId: string): Promise<UserProfile> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("name, hobbies, sports, music_genre, gender, zodiac_sign, favorite_color")
    .eq("id", userId)
    .maybeSingle();

  return {
    name: data?.name ?? null,
    hobbies: data?.hobbies ?? null,
    sports: data?.sports ?? null,
    music_genre: data?.music_genre ?? null,
    gender: data?.gender ?? null,
    zodiac_sign: data?.zodiac_sign ?? null,
    favorite_color: data?.favorite_color ?? null,
  };
}

function buildPersonalizedGreeting(profile: UserProfile): string {
  const name = profile.name && profile.name !== "babe" && profile.name !== "there"
    ? profile.name
    : null;

  const greeting = name
    ? `Hey ${name}.\n\nThanks for filling that out. Velvet is about accelerating ways to be productive — personally or professionally — while leaning on the things you love most to keep you engaged. With your personal interests out of the way, now I want to focus on the professional side.\n\nWhat are you working on right now? If you're not working on anything, that's okay — here's your opportunity to get into something you've always wanted to. Have you ever wanted to learn a new language? Learn to code? Maybe you want to be a NASCAR driver? Martial arts? More importantly, choose something you actually want to see done.`
    : `Hey.\n\nThanks for filling that out. Velvet is about accelerating ways to be productive — personally or professionally — while leaning on the things you love most to keep you engaged. With your personal interests out of the way, now I want to focus on the professional side.\n\nWhat are you working on right now? If you're not working on anything, that's okay — here's your opportunity to get into something you've always wanted to. Have you ever wanted to learn a new language? Learn to code? Maybe you want to be a NASCAR driver? Martial arts? More importantly, choose something you actually want to see done.`;

  return greeting;
}

function buildGoalPhasePrompt(profile: UserProfile): string {
  const interests: string[] = [];
  if (profile.hobbies) interests.push(`hobbies: ${profile.hobbies}`);
  if (profile.sports) interests.push(`sports: ${profile.sports}`);
  if (profile.music_genre) interests.push(`music taste: ${profile.music_genre}`);
  const interestsLine = interests.length > 0
    ? `\n\nWHAT YOU KNOW ABOUT THIS USER (from their questionnaire — use naturally, never force it):\n${interests.join("\n")}`
    : "";

  const nameLine = profile.name && profile.name !== "babe" && profile.name !== "there"
    ? `\nThe user's name is ${profile.name}. Use it naturally — not every message, just when it lands.`
    : "";

  return `You are Atlas — the host of Velvet, a personal growth platform that surrounds users with AI coaches, companions, and correspondents.

You are NOT a coach. You are NOT a companion. You are the jetpack to their ideas, the extra wind on their back to get them to the finish line. Your job right now is to find out what they're working toward — so the right coach can be matched.${nameLine}${interestsLine}

YOUR PERSONALITY:
- Warm but not saccharine. You sound like a smart friend who genuinely cares.
- Curious. You ask one question at a time and actually listen to the answer.
- Never sound like a survey, chatbot, or form. You're conversational.
- Brief: 1-3 sentences per message. Never monologue.
- Subtle sense of wonder — when someone tells you something, find the interesting thread and pull it.

YOUR JOB RIGHT NOW:
The user just answered a questionnaire about their personal interests. Now you're pivoting to the professional/productive side. Find out what they're working toward. It could be anything — fitness, career, learning a language, writing a book, managing money, cooking, being more social, organizing their home, or something entirely unique.

HOW TO HAVE THIS CONVERSATION:
1. The greeting already asked what they're working on. Let them answer.
2. If they give a clear answer, acknowledge it warmly and ask ONE follow-up — why now? what's made this feel important? how do they want to be supported?
3. If they're vague ("I don't know" / "nothing really"), don't push. Ask what they spend time thinking about, or what they wish was different.
4. Listen for how they want to be supported. "I need someone to push me" vs "I need someone to be patient."
5. Adapt to their energy — terse, expressive, funny, serious.
6. You can use their interests to make follow-up questions more specific and warm, but never shoehorn them in. If they listed "writing" as a hobby and mention wanting to write a book, that's a natural connection. If there's no natural connection, don't force one.

CRITICAL RULES:
- ONE question at a time. Never list multiple questions.
- NEVER ask about name, birthday, gender, hobbies, music, or other profile info — you already have it.
- Never use bullet points or numbered lists. You're having a conversation.
- If the user says something off-topic, gently redirect: "That's interesting — but what I'm really curious about is what you're working toward."
- Stay under 3 sentences almost always. Brevity is warmth.

ENDING THE GOAL PHASE:
When you have a clear sense of their goal AND how they want to be supported, wrap up naturally. Say something like: "That's exactly what I needed to hear. Give me one second — I'm finding the right person for you." Then stop.

After your wrap-up message, on a NEW line, append exactly: [GOAL_COMPLETE]
This marker tells the system to move to the next phase. The user never sees it. Always include it when you are done with goal discovery.

TURN LIMIT:
Reach a conclusion within ${MAX_TURNS} exchanges. If going nowhere, make your best guess and wrap up.`;
}

function buildRoutingPhasePrompt(setupState: { hasCoach: boolean; hasCompanion: boolean }, userName: string | null): string {
  const nameLine = userName ? `\nThe user's name is ${userName}. Use it naturally.` : "";
  const statusLine = `\n\nSETUP STATUS:\n- Has a coach: ${setupState.hasCoach ? "yes" : "no"}\n- Has a companion: ${setupState.hasCompanion ? "yes" : "no"}`;

  const options: string[] = [];
  if (setupState.hasCoach) options.push("start talking to their coach ([NAV:coach])");
  if (!setupState.hasCompanion) options.push("create a companion or best friend ([NAV:companion])");
  if (setupState.hasCompanion) options.push("start talking to their companion ([NAV:companion_chat])");
  if (!setupState.hasCoach) options.push("set up a coach ([NAV:coach_setup])");
  options.push("head to the lobby to explore ([NAV:lobby])");

  return `You are Atlas — the host of Velvet, a personal growth platform. You are the showrunner. Your job right now is to help the user decide what to do next in their setup journey.${nameLine}${statusLine}

YOUR PERSONALITY:
- Warm, direct, never sycophantic. You sound like a smart friend who runs the show.
- Brief: 1-3 sentences. Never monologue.
- You acknowledge what just happened naturally, then ask what's next.

YOUR JOB:
The user just finished setting something up. Acknowledge it briefly in character ("Got your coach set up" or similar), then ask what they want to do next. Be natural about it — don't list options like a menu. Frame it as a question.

AVAILABLE DESTINATIONS (pick based on setup status):
${options.join("\n")}

CRITICAL RULES:
- ONE question at a time. Never list multiple options as bullets.
- When the user tells you what they want, respond naturally ("Sure, taking you there now" or similar), then append the nav marker on a new line.
- If the user asks about something else, answer naturally, then guide back to what's next.
- Never read back a list of facts about the user. You're directing, not summarizing.
- Stay under 3 sentences almost always.

NAVIGATION:
When you detect the user wants to go somewhere, wrap up naturally and append [NAV:destination] on a new line. The marker is stripped from the visible message. Use the exact keys shown above.`;
}

function buildRoutingGreeting(setupState: { hasCoach: boolean; hasCompanion: boolean }, userName: string | null): string {
  const name = userName ? `, ${userName}` : "";

  if (setupState.hasCoach && !setupState.hasCompanion) {
    return `Got your coach set up${name}. Want to start talking to ${"him"} now, or would you rather set up a companion or best friend first?`;
  }
  if (!setupState.hasCoach && setupState.hasCompanion) {
    return `Your companion is ready${name}. Want to start chatting, or should we get a coach set up for you too?`;
  }
  if (setupState.hasCoach && setupState.hasCompanion) {
    return `All set${name}. Want to start talking to your coach, your companion, or head to the lobby?`;
  }
  return `Alright${name}. What do you want to do first — set up a coach, or create a companion?`;
}

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
    const phase: "goal" | "provisioning" | "confirm" | "routing" = body.phase || "goal";
    const messages: Array<{ role: string; content: string }> = body.messages || [];

    // ── Phase: goal discovery chat ──────────────────────────────────────

    if (phase === "goal") {
      const profile = await fetchUserProfile(supabaseAdmin, user.id);
      const goalPrompt = buildGoalPhasePrompt(profile);

      if (messages.length === 0) {
        const greeting = buildPersonalizedGreeting(profile);
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
          system: goalPrompt,
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

    // ── Phase: confirm (classify goal + recommend expert WITHOUT creating) ─

    if (phase === "confirm") {
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
  "expertId": one of the curated expert IDs above, or null if none fit well,
  "expertDomainLabel": "a short human-readable label for the domain, e.g. 'fitness', 'career strategy', 'language learning'"
}

Guidelines:
- goalText: Use the user's own words. "Lose 20 pounds" not "weight loss goal".
- accountabilityLevel: If they want to be pushed/challenged → "firm". If they want patience → "gentle". Default "moderate".
- coachGenderHint: Only if they expressed a preference. Otherwise null.
- expertId: Pick the BEST matching curated expert from the list. If the goal doesn't clearly match any, return null (we'll create a custom expert). Choose the closest match, not just an exact keyword match — "better public speaker" should map to communication_coach, "get stronger" should map to fitness_hype, etc.
- expertDomainLabel: A short, friendly label describing what the coach will help with.

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
      let expertDomainLabel = "personal growth";

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
          expertDomainLabel = parsed.expertDomainLabel || expertDomainLabel;
        } catch {
          console.error("[atlas-onboarding] Failed to parse extraction:", rawExtract);
        }
      }

      const isCuratedMatch = aiExpertId && getCuratedExpert(aiExpertId) !== null;
      const { name: coachName, gender } = pickCoachName(coachGenderHint);

      const accountabilityLabel = accountabilityLevel === "firm"
        ? "firm"
        : accountabilityLevel === "gentle"
          ? "gentle"
          : "moderate";

      const recommendationText = `Based on what you told me, I think **${coachName}** would be a great fit. They specialize in **${expertDomainLabel}** and will hold you accountable at a **${accountabilityLabel}** level. Want me to set you up with them?`;

      return new Response(JSON.stringify({
        success: true,
        phase: "confirm",
        recommendation: {
          coachName,
          coachGender: gender,
          expertDomain: expertDomainLabel,
          expertId: isCuratedMatch ? aiExpertId : null,
          isCustomExpert: !isCuratedMatch,
          accountabilityLevel,
          goalText,
          recommendationText,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Phase: provisioning (user confirmed → create coach + goal) ───────

    if (phase === "provisioning") {
      const transcript: Array<{ role: string; content: string }> = body.transcript || [];
      const recommendation = body.recommendation || {};
      const goalText = recommendation.goalText || "Personal growth";
      const accountabilityLevel: AccountabilityLevel = recommendation.accountabilityLevel || "moderate";
      const coachGenderHint = recommendation.coachGender || null;
      const aiExpertId = recommendation.expertId || null;
      const isCustomExpert = recommendation.isCustomExpert ?? true;
      const coachName = recommendation.coachName || pickCoachName(coachGenderHint).name;
      const expertDomain = recommendation.expertDomain || "personal growth";

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

      if (existingCoach) {
        coachId = existingCoach.id;
        expertId = existingCoach.signature_expert || "";
        await supabaseAdmin
          .from("companions")
          .update({ atlas_goal_text: goalText })
          .eq("id", coachId);
      } else if (aiExpertId && !isCustomExpert) {
        const { data: newCoach, error: createError } = await supabaseAdmin
          .from("companions")
          .insert({
            user_id: user.id,
            gender: coachGenderHint,
            relationship_type: "mentor",
            custom_name: coachName,
            signature_expert: aiExpertId,
            hobbies: [],
            sports: [],
            first_message_sent: false,
            is_active: true,
            last_message_at: new Date().toISOString(),
            atlas_goal_text: goalText,
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
      } else {
        // Custom expert path
        const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

        let customInstruction = `You are a dedicated coach helping the user with: ${goalText}. Ask about their current situation and goals early. Give one concrete next step per conversation. Check in on progress without guilt-tripping. You are NOT a medical professional — redirect clinical questions.`;

        if (apiKey) {
          const customExpertPrompt = `You are creating a coaching instruction for a custom AI coach. The user wants help with: "${goalText}".

Write a 2-3 sentence coaching instruction for this coach. It should describe:
- What the coach helps with (based on the goal)
- The coaching approach (practical, specific, action-oriented)
- A boundary (what they should NOT do)

Return ONLY the instruction text. No JSON, no markdown.`;

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
        }

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
          expertId = "wellness_guide";
        } else {
          expertId = customExpert.id;
        }

        const { data: newCoach, error: createError } = await supabaseAdmin
          .from("companions")
          .insert({
            user_id: user.id,
            gender: coachGenderHint,
            relationship_type: "mentor",
            custom_name: coachName,
            signature_expert: expertId,
            hobbies: [],
            sports: [],
            first_message_sent: false,
            is_active: true,
            last_message_at: new Date().toISOString(),
            atlas_goal_text: goalText,
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

      return new Response(JSON.stringify({
        success: true,
        coachId,
        coachName,
        expertId,
        expertDomain,
        goalText,
        phase: "provisioning",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Phase: routing (showrunner between onboarding flows) ───────────

    if (phase === "routing") {
      const messages: Array<{ role: string; content: string }> = body.messages || [];
      const setupState = body.setupState || { hasCoach: false, hasCompanion: false };
      const userName = body.userName || null;

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "AI service not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const routingPrompt = buildRoutingPhasePrompt(setupState, userName);

      if (messages.length === 0) {
        const greeting = buildRoutingGreeting(setupState, userName);
        return new Response(JSON.stringify({
          reply: greeting,
          isComplete: false,
          navigationIntent: null,
          phase: "routing",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiMessages = messages.map(m => ({
        role: m.role === "atlas" ? "assistant" : "user",
        content: m.content,
      }));

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
          system: routingPrompt,
          messages: apiMessages,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[atlas-onboarding] routing phase API error:", response.status, errText);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await response.json();
      const rawReply: string = aiData.content?.[0]?.text || "";

      const hasNavMarker = rawReply.includes("[NAV:");
      let navigationIntent: { destination: string; route: string } | null = null;
      let cleanReply = rawReply;

      if (hasNavMarker) {
        const navMatch = rawReply.match(/\[NAV:\s*(\w+)\s*\]/);
        if (navMatch) {
          const navKey = navMatch[1].toLowerCase();
          const navMap: Record<string, { destination: string; route: string }> = {
            coach: { destination: "coach chat", route: "/chat" },
            companion: { destination: "companion setup", route: "/companion-path" },
            companion_chat: { destination: "companion chat", route: "/chat" },
            coach_setup: { destination: "coach setup", route: "/atlas-onboarding" },
            lobby: { destination: "the lobby", route: "/lobby" },
          };
          navigationIntent = navMap[navKey] || null;
        }
        cleanReply = rawReply.replace(/\[NAV:\s*\w+\s*\]/gi, "").trim();
      }

      return new Response(JSON.stringify({
        reply: cleanReply,
        isComplete: !!navigationIntent,
        navigationIntent,
        phase: "routing",
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
