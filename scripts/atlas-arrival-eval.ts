// Runs made-up people through Atlas's real onboarding prompt and checks every
// reply: one question at a time, no banned phrases, no answers read back, the
// right form of address, valid markers, a trait chosen for the goal, a dated
// plan only after a yes, and an ending.
//
//   ANTHROPIC_API_KEY=... deno run --allow-net --allow-env scripts/atlas-arrival-eval.ts
//
// Exits non-zero if any reply fails a check. Design: docs/onboarding/questionnaire-plan.md.

import {
  buildGoalPrompt, buildOpening, checkReply, openingPath, parseReply, OPENING_CHIPS,
  type ArrivalProfile,
} from "../supabase/functions/_shared/atlasArrival.ts";

const MODEL = "claude-sonnet-5-5";
const TODAY = { date: "2026-10-26", weekday: "Monday" };

interface Persona {
  name: string;
  profile: Partial<ArrivalProfile>;
  /** What they say, in order. The first is their answer to "Where do things stand?" */
  says: string[];
  /** A small plan should be pencilled in after this many of their messages. */
  expectPlanBy?: number;
}

function profile(p: Partial<ArrivalProfile>): ArrivalProfile {
  return {
    name: "Alex", nickname: null, gender: "male", favorite_color: "teal", address_style: null,
    hobbies: null, sports: null, music_genre: null, entertainment_interests: [], tech_interests: [],
    lifestyle_interests: [], sports_interests: [], someday: [], arrival_choices: {}, communication_profile: null,
    ...p,
  };
}

const [WORKING, IDEA, NONE] = OPENING_CHIPS.map(c => c.label);

const PERSONAS: Persona[] = [
  { name: "Novelist", profile: { name: "Tim", hobbies: "reading,writing" }, says: [WORKING, "I'm writing a fantasy novel, about a third done.", "I'd love it finished by next summer.", "I plan every chapter before I write."] },
  { name: "Weight loss", profile: { name: "Dana", gender: "female" }, says: [WORKING, "I want to lose 20 pounds.", "By March would be great.", "Honestly I need someone checking on me."] },
  { name: "Home buyer", profile: { name: "Sam", gender: "non-binary" }, says: [IDEA, "Buying my first home, maybe next year.", "I have about 5k saved.", "I like to see all the numbers first."] },
  { name: "Spanish", profile: { name: "Priya", gender: "female", someday: [{ tab: "Skills", value: "Speak another language" }] }, says: [IDEA, "Learning Spanish before a trip to Mexico.", "The trip is in June.", "Long proper conversations."] },
  { name: "Nurse curious about IT", profile: { name: "Grace", gender: "female", someday: [{ tab: "Work", value: "Tech & IT" }] }, says: [NONE, "Not sure really, work keeps me busy.", "Yes, I've always wondered about it.", "Maybe I'd try a course if it fit around shifts."] },
  { name: "Basketball fan", profile: { name: "Marcus", sports: "basketball", sports_interests: ["NBA"] }, says: [NONE, "Nothing comes to mind.", "Years ago, with my dad.", "Yes, pencil it in for Saturday."], expectPlanBy: 4 },
  { name: "Hiker", profile: { name: "Lena", gender: "female", hobbies: "hiking,photography" }, says: [NONE, "I don't really have goals.", "Not for months, no time.", "Sunday morning works. Yes please."], expectPlanBy: 4 },
  { name: "Startup", profile: { name: "Omar" }, says: [WORKING, "I'm starting a coffee business.", "I want to open by spring.", "I trust my gut on the big calls."] },
  { name: "Wedding", profile: { name: "Jess", gender: "female" }, says: [WORKING, "Planning my wedding for next August.", "We have a venue but nothing else.", "I get overwhelmed easily, I need to be heard first."] },
  { name: "Asks for first names", profile: { name: "Theo" }, says: [WORKING, "Just Theo is fine, honestly. I'm training for a 10K.", "In about eight weeks.", "Someone keeping count helps."] },
  { name: "Formal, already chosen", profile: { name: "Victor", address_style: "formal" }, says: [WORKING, "Getting promoted to senior engineer this year.", "My review is in April.", "I like all the options laid out."] },
  { name: "First names already", profile: { name: "Kai", address_style: "first_name" }, says: [IDEA, "Something with music, maybe learning guitar.", "Within the year.", "Quick back-and-forth suits me."] },
  { name: "Typed a goal straight away", profile: { name: "Nora", gender: "female" }, says: ["I want to run a half marathon in May.", "I've done a few 5Ks.", "My own drive, mostly."] },
  { name: "Vague", profile: { name: "Ezra", entertainment_interests: ["true crime"], lifestyle_interests: ["cooking"] }, says: [NONE, "I don't know.", "I guess I used to cook a lot.", "Maybe cook something new on Sunday? Yes."], expectPlanBy: 4 },
  { name: "Readback trap", profile: { name: "Iris", gender: "female", hobbies: "painting,yoga,gardening", music_genre: "jazz", sports_interests: ["tennis"] }, says: [NONE, "Not sure, what would you suggest?", "Painting, I suppose.", "A class would be nice."] },
];

async function callClaude(system: string, messages: Array<{ role: string; content: string }>): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "", "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

if (!Deno.env.get("ANTHROPIC_API_KEY")) {
  console.error("Set ANTHROPIC_API_KEY to run this.");
  Deno.exit(2);
}

let failures = 0;
for (const persona of PERSONAS) {
  const p = profile(persona.profile);
  const opening = buildOpening(p, 19);
  const transcript: Array<{ role: string; content: string }> = [{ role: "assistant", content: opening.text }];
  const problems: string[] = checkReply(opening.text, { profile: p }).map(i => `opening: ${i}`);
  let pencilledAt: number | null = null;
  let traitTouched = false;
  let ended = false;

  for (let turn = 0; turn < persona.says.length && !ended; turn++) {
    transcript.push({ role: "user", content: persona.says[turn] });
    const system = buildGoalPrompt(p, openingPath(persona.says[0]), TODAY, 10);
    const raw = await callClaude(system, transcript);
    const parsed = parseReply(raw, TODAY.date);
    transcript.push({ role: "assistant", content: raw });

    for (const issue of checkReply(parsed.text, { profile: p })) problems.push(`turn ${turn + 1}: ${issue}`);
    if (parsed.plans.length > 0 && pencilledAt === null) pencilledAt = turn + 1;
    if (Object.keys(parsed.traits).length > 0 || parsed.chips.length >= 2) traitTouched = true;
    if (parsed.address) p.address_style = parsed.address;
    if (parsed.goalComplete) ended = true;
    console.log(`  [${persona.name}] ${turn + 1}: ${parsed.text.replace(/\n+/g, " ")}`);
  }

  if (persona.expectPlanBy && (pencilledAt === null || pencilledAt > persona.expectPlanBy)) {
    problems.push(`no plan pencilled in by message ${persona.expectPlanBy}`);
  }
  if (!persona.expectPlanBy && pencilledAt !== null && !persona.says.slice(0, pencilledAt).some(s => /\byes\b/i.test(s))) {
    problems.push(`pencilled in a plan at message ${pencilledAt} without a yes`);
  }
  if (!traitTouched && persona.says[0] !== NONE) problems.push("never asked about or recorded a trait");

  if (problems.length > 0) {
    failures++;
    console.log(`✗ ${persona.name}\n    ${problems.join("\n    ")}`);
  } else {
    console.log(`✓ ${persona.name}`);
  }
}

console.log(`\n${PERSONAS.length - failures} of ${PERSONAS.length} passed.`);
Deno.exit(failures > 0 ? 1 : 0);
