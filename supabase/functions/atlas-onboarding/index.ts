import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { webSearchTool, textOf, continuePausedTurn } from "../_shared/webSearch.ts";
import {
  CURATED_EXPERT_MAP,
  getCuratedExpert,
  type AccountabilityLevel,
} from "../_shared/coachFramework.ts";
import {
  buildGoalPrompt,
  buildOpening,
  buildPlanPrompt,
  checkReply,
  localToIso,
  nextWeekday,
  openingPath,
  parseReply,
  summarizePlan,
  todayFrom,
  validatePlan,
  type ArrivalProfile,
  type CommunicationProfile,
} from "../_shared/atlasArrival.ts";

// Atlas's onboarding conversation. Phases, in order:
//   goal         the conversation: opening, then Sonnet with the arrival prompt
//   confirm      read the conversation: the goal, and an assistant or a coach
//   provisioning create the assistant or coach, and the goal
//   plan         draft the plan for the walkthrough (writes nothing)
//   commit_plan  save the plan they saw: steps, commitments, weekly days, deadline
//   routing      the showrunner between setup flows (unchanged)
// Design: docs/onboarding/questionnaire-plan.md, docs/goals-and-coaches/plan.md.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TURNS = 10;

const CURATED_EXPERT_IDS = Object.keys(CURATED_EXPERT_MAP);

const NAMES_MALE = ["Marcus", "Derek", "James", "Andre", "Theo", "Kai", "Victor", "Sam", "Cole", "Ezra"];
const NAMES_FEMALE = ["Maya", "Sofia", "Nadia", "Elena", "Priya", "Zara", "Dana", "Liv", "Iris", "Nora"];

function pickHelperName(gender?: string | null): { name: string; gender: string } {
  const g = gender === "male" || gender === "female" ? gender : (Math.random() > 0.5 ? "male" : "female");
  const pool = g === "male" ? NAMES_MALE : NAMES_FEMALE;
  return { name: pool[Math.floor(Math.random() * pool.length)], gender: g };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// The untyped client, as the other functions use it.
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof createClient<any>>;

/** user_profiles stores some interests as text and some as arrays; read either. */
function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function asText(v: unknown): string | null {
  const list = asList(v);
  return list.length ? list.join(", ") : null;
}

async function fetchArrivalProfile(admin: Admin, userId: string): Promise<ArrivalProfile> {
  const { data } = await admin
    .from("user_profiles")
    .select("name, nickname, gender, favorite_color, address_style, hobbies, sports, music_genre, entertainment_interests, tech_interests, lifestyle_interests, sports_interests, someday, arrival_choices, communication_profile")
    .eq("id", userId)
    .maybeSingle();
  const p = (data ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    name: text(p.name),
    nickname: text(p.nickname),
    gender: text(p.gender),
    favorite_color: text(p.favorite_color),
    address_style: p.address_style === "formal" || p.address_style === "first_name" ? p.address_style : null,
    hobbies: asText(p.hobbies),
    sports: asText(p.sports),
    music_genre: asText(p.music_genre),
    entertainment_interests: asList(p.entertainment_interests),
    tech_interests: asList(p.tech_interests),
    lifestyle_interests: asList(p.lifestyle_interests),
    sports_interests: asList(p.sports_interests),
    someday: Array.isArray(p.someday) ? p.someday as ArrivalProfile["someday"] : [],
    arrival_choices: p.arrival_choices && typeof p.arrival_choices === "object" ? p.arrival_choices as ArrivalProfile["arrival_choices"] : {},
    communication_profile: p.communication_profile && typeof p.communication_profile === "object"
      ? p.communication_profile as CommunicationProfile : null,
  };
}

/** One call to Claude; the text of the reply, or null on any failure. */
async function callClaude(opts: {
  model: string;
  maxTokens: number;
  system?: string;
  messages: Array<{ role: string; content: string }>;
  /** Let the model search the web, up to this many times. */
  webSearches?: number;
}): Promise<string | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  let messages: Array<{ role: string; content: unknown }> = opts.messages;
  let text = "";
  // A long search can pause the turn; hand it back (at most twice) so it carries on.
  for (let round = 0; round < 3; round++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        ...(opts.system ? { system: opts.system } : {}),
        messages,
        ...(opts.webSearches ? { tools: [webSearchTool(opts.webSearches)] } : {}),
      }),
    });
    if (!response.ok) {
      console.error("[atlas-onboarding] Anthropic API error:", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    text += textOf(data.content);
    if (data.stop_reason !== "pause_turn") break;
    messages = continuePausedTurn(messages, data.content);
  }
  return text || null;
}

function parseModelJson(raw: string | null): unknown {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

function transcriptText(transcript: Array<{ role: string; content: string }>): string {
  return transcript.map(m => `${m.role === "atlas" ? "Atlas" : "User"}: ${m.content}`).join("\n\n");
}

const EXPERT_GOAL_TYPE: Record<string, string> = {
  fitness_hype: "health_fitness", fitness_drill: "health_fitness",
  wellness_guide: "habit", sleep_coach: "habit",
  interview_coach: "skill", finance_mentor: "habit", finance_tough: "habit",
  career_advisor: "skill", communication_coach: "skill",
  creative_muse: "creative", writing_collaborator: "creative", brainstorm_partner: "creative",
  study_partner: "skill", language_tutor: "skill", essay_architect: "creative",
  stem_tutor: "skill", code_mentor: "skill", data_coach: "skill",
  chef_coach: "habit", connection_coach: "habit", style_coach: "habit", home_coach: "habit",
};

// ─── Routing (unchanged) ─────────────────────────────────────────────────

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
    if (!authHeader) return json({ error: "Missing auth header" }, 401);

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const phase: string = body.phase || "goal";
    const today = todayFrom(body.localDate);
    const tzOffset = typeof body.tzOffset === "number" ? body.tzOffset : 0;

    // ── Phase: goal (the conversation) ──────────────────────────────────

    if (phase === "goal") {
      const messages: Array<{ role: string; content: string }> = Array.isArray(body.messages) ? body.messages : [];
      const profile = await fetchArrivalProfile(supabaseAdmin, user.id);

      if (messages.length === 0) {
        const localHour = typeof body.localHour === "number" ? body.localHour : null;
        const opening = buildOpening(profile, localHour);
        return json({ reply: opening.text, chips: opening.chips, turnCount: 0, isComplete: false, phase: "goal" });
      }

      const firstAnswer = messages.find(m => m.role === "user")?.content ?? "";
      const system = buildGoalPrompt(profile, openingPath(firstAnswer), today, MAX_TURNS);
      const turnCount = messages.filter(m => m.role === "user").length;
      const history = messages.map(m => ({ role: m.role === "atlas" ? "assistant" : "user", content: m.content }));
      const raw = await callClaude({ model: MODEL_CONFIG.SONNET, maxTokens: 400, system, messages: history });
      if (raw === null) return json({ error: "AI service error" }, 502);

      let parsed = parseReply(raw, today.date);
      // A reply that breaks a rule gets one retry, told what it broke. The
      // address it just settled on counts, so "Master Tim" after a yes to
      // first names is caught.
      const issuesOf = (p: typeof parsed) =>
        checkReply(p.text, { profile: { ...profile, address_style: p.address ?? profile.address_style } });
      const issues = issuesOf(parsed);
      if (issues.length > 0) {
        console.warn("[atlas-onboarding] Reply broke rules, retrying:", issues.join("; "));
        const retry = await callClaude({
          model: MODEL_CONFIG.SONNET,
          maxTokens: 400,
          system: `${system}\n\nYOUR DRAFT OF THIS REPLY BROKE THESE RULES:\n${issues.map(i => `- ${i}`).join("\n")}\n\nThe draft was:\n${raw}\n\nWrite the reply again, saying the same thing without breaking them.`,
          messages: history,
        });
        if (retry !== null) {
          const retried = parseReply(retry, today.date);
          if (issuesOf(retried).length <= issues.length) parsed = retried;
        }
      }

      // Traits: merge what's newly clear into what's known; never overwrite with nothing.
      if (Object.keys(parsed.traits).length > 0) {
        const merged: CommunicationProfile = { ...(profile.communication_profile ?? {}), ...parsed.traits };
        await supabaseAdmin.from("user_profiles").update({ communication_profile: merged }).eq("id", user.id);
      }
      if (parsed.address) {
        await supabaseAdmin.from("user_profiles").update({ address_style: parsed.address }).eq("id", user.id);
      }
      // Small plans they said yes to, pencilled in on their calendar.
      for (const plan of parsed.plans) {
        await supabaseAdmin.from("user_events").insert({
          user_id: user.id,
          title: plan.title,
          description: "",
          event_type: plan.type,
          event_date: localToIso(plan.date, plan.time, tzOffset),
          all_day: !plan.time,
          recurring: "none",
          completed: false,
          metadata: { source: "atlas", tentative: true, ...(plan.goal ? { goal: plan.goal } : {}) },
        });
      }

      const isComplete = (parsed.goalComplete && turnCount >= 2) || turnCount >= MAX_TURNS;
      return json({
        reply: parsed.text,
        chips: parsed.chips,
        pencilled: parsed.plans.map(p => ({ title: p.title, date: p.date })),
        turnCount: turnCount + 1,
        isComplete,
        phase: "goal",
      });
    }

    // ── Phase: confirm (the goal, and who carries it) ───────────────────

    if (phase === "confirm") {
      const transcript: Array<{ role: string; content: string }> = body.transcript || [];
      const expertIdList = CURATED_EXPERT_IDS.join(", ");
      const extractionPrompt = `You are an analysis engine. Read this conversation and decide the user's goal, and whether a coach or an assistant should carry it.

A COACH teaches a skill over time: lessons, practice, feedback. Use a coach only when there is a skill to learn (a language, coding, cooking, fitness technique, interview technique, writing craft).
An ASSISTANT helps get something done: information, a plan, dates and follow-up, with nothing to be taught (buying a home, planning a wedding, finishing a portfolio, seeing a game live, decluttering).

Curated coach IDs (only for coaches): ${expertIdList}
- fitness_hype / fitness_drill: fitness, exercise, weight loss
- wellness_guide: stress, mindfulness, self-care
- sleep_coach: sleep
- interview_coach: interview prep
- finance_mentor / finance_tough: budgeting, saving, debt
- career_advisor: career moves, promotion, job change
- communication_coach: public speaking, difficult conversations
- creative_muse: art, music, creative practice
- writing_collaborator: writing a book, blog, screenplay
- brainstorm_partner: idea generation
- study_partner: exam prep, study habits
- language_tutor: learning a language
- essay_architect: academic writing
- stem_tutor: maths and science
- code_mentor: programming
- data_coach: data science, SQL, analytics
- chef_coach: cooking
- connection_coach: social skills, dating
- style_coach: style and grooming
- home_coach: organizing, decluttering

Return a JSON object with exactly these fields:
{
  "goalText": "the goal in the user's own words, max 15 words",
  "kind": "coach" | "assistant",
  "accountabilityLevel": "gentle" | "moderate" | "firm",
  "genderHint": "male" | "female" | null,
  "expertId": a curated coach ID when kind is "coach" and one fits, else null,
  "domainLabel": "a short friendly label, e.g. 'language learning', 'buying your first home'"
}

- accountabilityLevel: "firm" if they want to be pushed, "gentle" if they want patience, else "moderate".
- genderHint: only if they asked for one.

Return ONLY the JSON object.`;

      const raw = await callClaude({
        model: MODEL_CONFIG.HAIKU,
        maxTokens: 300,
        messages: [{ role: "user", content: `${extractionPrompt}\n\n--- TRANSCRIPT ---\n${transcriptText(transcript)}\n--- END ---` }],
      });
      const parsed = (parseModelJson(raw) ?? {}) as Record<string, unknown>;

      const goalText = typeof parsed.goalText === "string" && parsed.goalText.trim() ? parsed.goalText.trim() : "Your goal";
      const kind: "coach" | "assistant" = parsed.kind === "coach" ? "coach" : "assistant";
      const level = parsed.accountabilityLevel;
      const accountabilityLevel: AccountabilityLevel = level === "firm" || level === "gentle" ? level : "moderate";
      const expertId = kind === "coach" && typeof parsed.expertId === "string" && getCuratedExpert(parsed.expertId) ? parsed.expertId : null;
      const domainLabel = typeof parsed.domainLabel === "string" && parsed.domainLabel.trim() ? parsed.domainLabel.trim() : goalText;
      const { name, gender } = pickHelperName(typeof parsed.genderHint === "string" ? parsed.genderHint : null);

      const recommendationText = kind === "coach"
        ? `I know just the person. ${name} will teach you, one lesson at a time, and keep you practising until it sticks.`
        : `I know just the person. ${name} will see this through with you: the plan, the dates, and anything you need to know along the way.`;

      return json({
        success: true,
        phase: "confirm",
        recommendation: {
          helperName: name,
          helperGender: gender,
          kind,
          expertDomain: domainLabel,
          expertId,
          isCustomExpert: kind === "coach" && !expertId,
          accountabilityLevel,
          goalText,
          recommendationText,
        },
      });
    }

    // ── Phase: provisioning (create who carries it, and the goal) ───────

    if (phase === "provisioning") {
      const transcript: Array<{ role: string; content: string }> = body.transcript || [];
      const rec = body.recommendation || {};
      const goalText: string = typeof rec.goalText === "string" && rec.goalText.trim() ? rec.goalText.trim() : "Your goal";
      const kind: "coach" | "assistant" = rec.kind === "coach" ? "coach" : "assistant";
      const accountabilityLevel: AccountabilityLevel = rec.accountabilityLevel === "firm" || rec.accountabilityLevel === "gentle" ? rec.accountabilityLevel : "moderate";
      const gender: string | null = rec.helperGender === "male" || rec.helperGender === "female" ? rec.helperGender : null;
      const helperName: string = (typeof body.helperName === "string" && body.helperName.trim()
        ? body.helperName.trim()
        : typeof rec.helperName === "string" && rec.helperName.trim() ? rec.helperName.trim() : pickHelperName(gender).name).slice(0, 40);
      const expertDomain: string = typeof rec.expertDomain === "string" ? rec.expertDomain : goalText;
      const curatedId: string | null = kind === "coach" && typeof rec.expertId === "string" && getCuratedExpert(rec.expertId) ? rec.expertId : null;
      // The look they kept (randomized, or changed by hand), within reason.
      const avatarConfig = body.avatarConfig && typeof body.avatarConfig === "object" && JSON.stringify(body.avatarConfig).length < 20_000
        ? body.avatarConfig : null;

      const baseHelper = {
        user_id: user.id,
        gender,
        custom_name: helperName,
        hobbies: [],
        sports: [],
        first_message_sent: false,
        is_active: true,
        last_message_at: new Date().toISOString(),
        atlas_goal_text: goalText,
        ...(avatarConfig ? { avatar_config: avatarConfig } : {}),
      };

      let helperId: string | null = null;
      let expertId: string | null = null;

      if (kind === "assistant") {
        // One assistant per goal, so each one's memory stays on its goal.
        const { data, error } = await supabaseAdmin
          .from("companions")
          .insert({ ...baseHelper, relationship_type: "assistant", signature_expert: null })
          .select("id")
          .maybeSingle();
        if (error || !data) {
          console.error("[atlas-onboarding] Failed to create assistant:", error);
          return json({ error: "Failed to create assistant" }, 500);
        }
        helperId = (data as { id: string }).id;
      } else {
        // A coach teaches one skill: reuse an active coach for the same skill.
        if (curatedId) {
          const { data: existing } = await supabaseAdmin
            .from("companions")
            .select("id")
            .eq("user_id", user.id)
            .eq("relationship_type", "mentor")
            .eq("signature_expert", curatedId)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (existing) helperId = (existing as { id: string }).id;
          expertId = curatedId;
        } else {
          const custom = await callClaude({
            model: MODEL_CONFIG.HAIKU,
            maxTokens: 200,
            messages: [{
              role: "user",
              content: `You are creating a coaching instruction for a custom AI coach who teaches the user: "${goalText}".

Write a 2-3 sentence instruction describing what the coach teaches, how (short lessons, practice, feedback on attempts), and a boundary (what they should NOT do). Return ONLY the instruction text.`,
            }],
          });
          const instruction = custom && custom.trim().length > 20
            ? custom.trim()
            : `You are a dedicated coach teaching the user: ${goalText}. Find their level, teach in short lessons, set practice and give feedback on their attempts. You are NOT a medical professional; redirect clinical questions.`;
          const { data: customExpert, error: expertError } = await supabaseAdmin
            .from("user_experts")
            .insert({
              user_id: user.id,
              name: `${goalText.slice(0, 30)} Coach`,
              domain: goalText.slice(0, 50),
              category: "lifestyle",
              description: `Custom coach for: ${goalText}`,
              instruction,
              check_in_style: "proactive",
              accountability_level: accountabilityLevel,
              is_active: true,
            })
            .select("id")
            .maybeSingle();
          if (expertError || !customExpert) {
            console.error("[atlas-onboarding] Failed to create custom expert:", expertError);
            expertId = "wellness_guide";
          } else {
            expertId = (customExpert as { id: string }).id;
          }
        }

        if (helperId) {
          await supabaseAdmin.from("companions").update({ atlas_goal_text: goalText }).eq("id", helperId);
        } else {
          const { data, error } = await supabaseAdmin
            .from("companions")
            .insert({
              ...baseHelper,
              relationship_type: "mentor",
              signature_expert: expertId,
              // chat-turn reads a custom coach's instruction only when this says "user".
              signature_expert_source: expertId && getCuratedExpert(expertId) ? "curated" : "user",
            })
            .select("id")
            .maybeSingle();
          if (error || !data) {
            console.error("[atlas-onboarding] Failed to create coach:", error);
            return json({ error: "Failed to create coach" }, 500);
          }
          helperId = (data as { id: string }).id;
        }
      }

      // The goal, linked to who carries it. A retry with the same goal reuses it.
      const { data: sameGoal } = await supabaseAdmin
        .from("user_goals")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .eq("title", goalText)
        .limit(1)
        .maybeSingle();
      let goalId: string;
      if (sameGoal) {
        goalId = (sameGoal as { id: string }).id;
        await supabaseAdmin.from("user_goals").update({ source_companion_id: helperId }).eq("id", goalId);
      } else {
        const { data: goal, error: goalError } = await supabaseAdmin
          .from("user_goals")
          .insert({
            user_id: user.id,
            title: goalText,
            goal_type: (expertId && EXPERT_GOAL_TYPE[expertId]) || (kind === "coach" ? "skill" : "project"),
            status: "active",
            source: "discovered",
            discovery_transcript: JSON.stringify(transcript),
            start_date: today.date,
            source_companion_id: helperId,
          })
          .select("id")
          .maybeSingle();
        if (goalError || !goal) {
          console.error("[atlas-onboarding] Failed to create goal:", goalError);
          return json({ error: "Failed to create goal" }, 500);
        }
        goalId = (goal as { id: string }).id;
      }

      return json({
        success: true,
        phase: "provisioning",
        helperId,
        helperName,
        kind,
        expertId,
        expertDomain,
        goalId,
        goalText,
      });
    }

    // ── Phase: plan (draft it for the walkthrough; writes nothing) ──────

    if (phase === "plan") {
      const transcript: Array<{ role: string; content: string }> = body.transcript || [];
      const helper = body.helper || {};
      const prompt = buildPlanPrompt({
        goalText: typeof body.goalText === "string" ? body.goalText : "Your goal",
        helper: {
          name: typeof helper.name === "string" ? helper.name : "Your assistant",
          kind: helper.kind === "coach" ? "coach" : "assistant",
          domain: typeof helper.domain === "string" ? helper.domain : "",
        },
        transcript: transcriptText(transcript),
        today,
      });
      const raw = await callClaude({ model: MODEL_CONFIG.SONNET, maxTokens: 1500, messages: [{ role: "user", content: prompt }], webSearches: 3 });
      const plan = validatePlan(parseModelJson(raw), today.date);
      if (!plan) return json({ error: "Couldn't draft the plan" }, 502);
      return json({ success: true, phase: "plan", plan, summary: summarizePlan(plan, today.date) });
    }

    // ── Phase: commit_plan (save the plan they saw) ─────────────────────

    if (phase === "commit_plan") {
      const goalId: string = typeof body.goalId === "string" ? body.goalId : "";
      const helperId: string = typeof body.helperId === "string" ? body.helperId : "";
      const plan = validatePlan(body.plan, today.date);
      if (!plan) return json({ error: "Invalid plan" }, 400);

      const [{ data: goal }, { data: helper }] = await Promise.all([
        supabaseAdmin.from("user_goals").select("id, title").eq("id", goalId).eq("user_id", user.id).maybeSingle(),
        supabaseAdmin.from("companions").select("id, relationship_type").eq("id", helperId).eq("user_id", user.id).maybeSingle(),
      ]);
      if (!goal || !helper) return json({ error: "Goal or helper not found" }, 404);
      const goalTitle = (goal as { title: string }).title;
      const source = (helper as { relationship_type: string }).relationship_type === "mentor" ? "coach" : "assistant";

      await supabaseAdmin.from("user_goals").update({
        target_date: plan.goal.targetDate,
        ...(plan.goal.measure ? {
          unit: plan.goal.measure.unit,
          target_value: plan.goal.measure.target,
          current_value: 0,
        } : {}),
      }).eq("id", goalId);

      const { data: planRow, error: planError } = await supabaseAdmin
        .from("coach_plans")
        .insert({
          user_id: user.id,
          companion_id: helperId,
          goal_id: goalId,
          title: goalTitle,
          description: plan.goal.measure ? `Progress: ${plan.goal.measure.what}` : null,
          cadence: plan.checkIns.slice(0, 60),
          status: "active",
        })
        .select("id")
        .maybeSingle();
      if (planError || !planRow) {
        console.error("[atlas-onboarding] Failed to create plan:", planError);
        return json({ error: "Failed to save the plan" }, 500);
      }
      const planId = (planRow as { id: string }).id;

      const stepRows = plan.phases.flatMap(p => p.steps.map(s => ({ ...s, phase: p.title })))
        .map((s, i) => ({
          plan_id: planId,
          title: s.title,
          coach_proposed_title: s.title,
          phase: s.phase,
          scheduled_for: s.scheduledFor,
          duration_minutes: s.durationMinutes,
          order_index: i,
          status: "pending",
        }));
      const { data: steps, error: stepError } = await supabaseAdmin
        .from("coach_plan_steps")
        .insert(stepRows)
        .select("id, title, order_index");
      if (stepError || !steps) {
        await supabaseAdmin.from("coach_plans").delete().eq("id", planId);
        console.error("[atlas-onboarding] Failed to create steps:", stepError);
        return json({ error: "Failed to save the plan" }, 500);
      }
      const stepList = (steps as Array<{ id: string; title: string; order_index: number }>).sort((a, b) => a.order_index - b.order_index);

      // Commitments come from steps: the matching step, else the first.
      for (const c of plan.commitments) {
        const step = stepList.find(s => s.title.toLowerCase() === c.description.toLowerCase()) ?? stepList[0];
        const { data: commit } = await supabaseAdmin
          .from("coaching_commitments")
          .insert({
            user_id: user.id,
            companion_id: helperId,
            goal_id: goalId,
            plan_step_id: step.id,
            description: c.description,
            due_date: localToIso(c.dueDate, "23:59", tzOffset),
            status: "pending",
            is_user_created: false,
          })
          .select("id")
          .maybeSingle();
        if (commit) {
          await supabaseAdmin.from("coach_plan_steps").update({ commitment_id: (commit as { id: string }).id })
            .eq("id", step.id).is("commitment_id", null);
        }
      }

      // The days that hold something every week, and the finish line.
      const events = [
        ...plan.weeklyRhythm.map(w => ({
          user_id: user.id,
          title: w.what,
          description: "",
          event_type: "task",
          event_date: localToIso(nextWeekday(today.date, w.day), null, tzOffset),
          all_day: true,
          recurring: "weekly",
          completed: false,
          metadata: { source, goal: goalTitle, goal_id: goalId, helper_id: helperId },
        })),
        ...(plan.goal.targetDate ? [{
          user_id: user.id,
          title: goalTitle,
          description: "",
          event_type: "goal_deadline",
          event_date: localToIso(plan.goal.targetDate, null, tzOffset),
          all_day: true,
          recurring: "none",
          completed: false,
          metadata: { source: "atlas", goal: goalTitle, goal_id: goalId },
        }] : []),
      ];
      if (events.length > 0) await supabaseAdmin.from("user_events").insert(events);

      return json({ success: true, phase: "commit_plan", planId });
    }

    // ── Phase: routing (showrunner between onboarding flows) ───────────

    if (phase === "routing") {
      const messages: Array<{ role: string; content: string }> = body.messages || [];
      const setupState = body.setupState || { hasCoach: false, hasCompanion: false };
      const userName = body.userName || null;

      if (messages.length === 0) {
        return json({ reply: buildRoutingGreeting(setupState, userName), isComplete: false, navigationIntent: null, phase: "routing" });
      }

      const rawReply = await callClaude({
        model: MODEL_CONFIG.HAIKU,
        maxTokens: 300,
        system: buildRoutingPhasePrompt(setupState, userName),
        messages: messages.map(m => ({ role: m.role === "atlas" ? "assistant" : "user", content: m.content })),
      });
      if (rawReply === null) return json({ error: "AI service error" }, 502);

      let navigationIntent: { destination: string; route: string } | null = null;
      let cleanReply = rawReply;
      if (rawReply.includes("[NAV:")) {
        const navMatch = rawReply.match(/\[NAV:\s*(\w+)\s*\]/);
        if (navMatch) {
          const navMap: Record<string, { destination: string; route: string }> = {
            coach: { destination: "coach chat", route: "/chat" },
            companion: { destination: "companion setup", route: "/companion-path" },
            companion_chat: { destination: "companion chat", route: "/chat" },
            coach_setup: { destination: "coach setup", route: "/atlas-onboarding" },
            lobby: { destination: "the lobby", route: "/lobby" },
          };
          navigationIntent = navMap[navMatch[1].toLowerCase()] || null;
        }
        cleanReply = rawReply.replace(/\[NAV:\s*\w+\s*\]/gi, "").trim();
      }

      return json({ reply: cleanReply, isComplete: !!navigationIntent, navigationIntent, phase: "routing" });
    }

    return json({ error: "Unknown phase" }, 400);
  } catch (err) {
    console.error("[atlas-onboarding] error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
