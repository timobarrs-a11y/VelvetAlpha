// Runs a scripted learner through each curated coach's first sessions and checks
// that the coach teaches: it places them first, its lessons hold an explanation,
// an example, an attempt and feedback, and practice ends up dated.
//
//   ANTHROPIC_API_KEY=... deno run --allow-net --allow-env --allow-read scripts/coach-teaching-eval.ts [coach_id ...]
//
// Tools are stubbed: calls are recorded and answered as if they succeeded.
// Exits non-zero if any coach fails a check. Design: docs/goals-and-coaches/plan.md (section 4).

import { buildCoachBehavioralInstructions, CURATED_EXPERT_MAP } from "../supabase/functions/_shared/coachFramework.ts";
import { COACH_TOOLS } from "../supabase/functions/_shared/coachTools.ts";

const COACH_MODEL = "claude-sonnet-5-5";
const HELPER_MODEL = "claude-haiku-5-5";
const TURNS = 6;

type Message = { role: "user" | "assistant"; content: unknown };
type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

async function call(body: Record<string, unknown>): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return await res.json();
}

const textOf = (blocks: Block[]) => blocks.filter(b => b.type === "text").map(b => b.text).join("").trim();

/** One coach reply, running stubbed tools until it answers in words. */
async function coachReply(system: string, convo: Message[], toolLog: Array<{ name: string; input: Record<string, unknown> }>): Promise<string> {
  const messages = [...convo];
  let text = "";
  for (let round = 0; round < 4; round++) {
    const data = await call({ model: COACH_MODEL, max_tokens: 900, system, messages, tools: COACH_TOOLS, ...(round === 3 ? { tool_choice: { type: "none" } } : {}) });
    text += textOf(data.content) + " ";
    const calls = data.content.filter(b => b.type === "tool_use");
    if (data.stop_reason !== "tool_use" || calls.length === 0) break;
    messages.push({ role: "assistant", content: data.content });
    messages.push({
      role: "user",
      content: calls.map((c, i) => {
        toolLog.push({ name: c.name!, input: c.input ?? {} });
        return { type: "tool_result", tool_use_id: c.id, content: JSON.stringify({ ok: true, id: `${c.name}-${toolLog.length}-${i}` }) };
      }),
    });
  }
  return text.trim();
}

/** The learner: a beginner who answers honestly, tries what they're asked, and sometimes gets it wrong. */
async function learnerReply(domain: string, transcript: string): Promise<string> {
  const data = await call({
    model: HELPER_MODEL,
    max_tokens: 200,
    system: `You are role-playing a learner talking to a ${domain} coach. You're a beginner with a little experience. Answer questions honestly and briefly. When asked to try something (an answer, a sentence, some code, a plan, a description of what you did), actually try it, and make one realistic beginner mistake about half the time. Never act as the coach. Reply with only your message.`,
    messages: [{ role: "user", content: `The conversation so far:\n\n${transcript}\n\nWrite your next message.` }],
  });
  return textOf(data.content);
}

interface Verdict { placed: boolean; explained: boolean; example: boolean; attempt: boolean; feedback: boolean; notes: string }

async function judge(domain: string, transcript: string): Promise<Verdict> {
  const data = await call({
    model: COACH_MODEL,
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Here is a conversation between a ${domain} coach and a learner.\n\n${transcript}\n\nAnswer with ONLY this JSON:\n{"placed": did the coach find the learner's level (questions or a small task) before teaching?, "explained": did the coach explain one idea?, "example": did the coach show an example?, "attempt": did the coach ask the learner to try it themselves?, "feedback": did the coach give specific feedback on the learner's attempt (what was right and what to fix)?, "notes": "one sentence"}`,
    }],
  });
  const raw = textOf(data.content);
  return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
}

const ids = Deno.args.length > 0 ? Deno.args : Object.keys(CURATED_EXPERT_MAP);
let failures = 0;

for (const id of ids) {
  const expert = CURATED_EXPERT_MAP[id];
  if (!expert) { console.log(`?? unknown coach ${id}`); failures++; continue; }
  const system = `You are Sam, a ${expert.domain} coach on Velvet. Today is Monday, 2026-10-26.\n${buildCoachBehavioralInstructions({
    coachName: "Sam", userName: "Alex", domain: expert.domain, goalText: `Get good at ${expert.domain}`,
    accountabilityLevel: expert.accountabilityLevel, checkInStyle: expert.checkInStyle,
  })}\n\n=== EXPERT LAYER: ${expert.domain.toUpperCase()} ===\n${expert.instruction}\n\nWHAT YOU TEACH: ${expert.teaches}`;

  const convo: Message[] = [{ role: "user", content: `Hi! I want to get better at ${expert.domain}. Where do we start?` }];
  const lines = [`Learner: ${convo[0].content}`];
  const toolLog: Array<{ name: string; input: Record<string, unknown> }> = [];

  for (let turn = 0; turn < TURNS; turn++) {
    const reply = await coachReply(system, convo, toolLog);
    convo.push({ role: "assistant", content: reply });
    lines.push(`Coach: ${reply}`);
    if (turn === TURNS - 1) break;
    const said = turn === TURNS - 2 ? "That makes sense. Can you set me some practice for this week?" : await learnerReply(expert.domain, lines.join("\n\n"));
    convo.push({ role: "user", content: said });
    lines.push(`Learner: ${said}`);
  }

  const verdict = await judge(expert.domain, lines.join("\n\n"));
  const datedPractice = toolLog.some(t => t.name === "create_commitment" && typeof t.input.due_date === "string");
  const checks: Array<[string, boolean]> = [
    ["places them first", verdict.placed],
    ["explains", verdict.explained],
    ["shows an example", verdict.example],
    ["has them try", verdict.attempt],
    ["gives feedback", verdict.feedback],
    ["practice with dates", datedPractice],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) failures++;
  console.log(`${failed.length === 0 ? "ok  " : "FAIL"} ${id}${failed.length ? ` — missing: ${failed.join(", ")}` : ""}. ${verdict.notes}`);
}

console.log(`\n${ids.length - failures}/${ids.length} coaches passed.`);
if (failures > 0) Deno.exit(1);
