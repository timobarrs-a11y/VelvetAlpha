// ============================================================================
// ATLAS ARRIVAL: the pure logic behind Atlas's onboarding conversation.
//
// No I/O here, so it can be unit-tested (src/services/__tests__) and used by
// the reply-checking script. The edge function (atlas-onboarding) does the
// fetching and saving. Design: docs/onboarding/questionnaire-plan.md and
// docs/goals-and-coaches/plan.md.
// ============================================================================

export type AddressStyle = "formal" | "first_name";

export interface SomedayPick {
  tab: string;
  value: string;
  custom?: boolean;
}

export interface ArrivalChoices {
  avatar?: { field: string; value: string }[];
  house?: { style: string; color?: string; chosen: boolean };
}

/** The four "wavelength" traits, with the keys and values coach prompts already read. */
export interface CommunicationProfile {
  conflict?: string;
  connection?: string;
  decisionStyle?: string;
  motivation?: string;
}

export interface ArrivalProfile {
  name: string | null;
  nickname: string | null;
  gender: string | null;
  favorite_color: string | null;
  address_style: AddressStyle | null;
  hobbies: string | null;
  sports: string | null;
  music_genre: string | null;
  entertainment_interests: string[];
  tech_interests: string[];
  lifestyle_interests: string[];
  sports_interests: string[];
  someday: SomedayPick[];
  arrival_choices: ArrivalChoices;
  communication_profile: CommunicationProfile | null;
}

// ─── How Atlas addresses people ──────────────────────────────────────────

const PLACEHOLDER_NAMES = new Set(["babe", "there", ""]);

export function firstName(profile: Pick<ArrivalProfile, "name">): string | null {
  const raw = (profile.name ?? "").trim();
  if (PLACEHOLDER_NAMES.has(raw.toLowerCase())) return null;
  return raw.split(/\s+/)[0] || null;
}

/**
 * "Master Tim" for men and "Miss Ana" for women, as Alfred does, unless they
 * asked for plain first names. Anyone else is addressed by first name.
 */
export function formalAddress(profile: Pick<ArrivalProfile, "name" | "gender" | "address_style">): string | null {
  const first = firstName(profile);
  if (!first || profile.address_style === "first_name") return null;
  const g = (profile.gender ?? "").toLowerCase();
  if (g === "male" || g === "man") return `Master ${first}`;
  if (g === "female" || g === "woman") return `Miss ${first}`;
  return null;
}

/** What Atlas calls them: the formal address, else their first name, else nothing. */
export function addressName(profile: Pick<ArrivalProfile, "name" | "gender" | "address_style">): string | null {
  return formalAddress(profile) ?? firstName(profile);
}

/** The greeting for the hour where the user is. */
export function timeOfDayGreeting(hour: number | null | undefined): string {
  if (hour === null || hour === undefined || Number.isNaN(hour)) return "Good day";
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

// ─── The remark on what they made ────────────────────────────────────────

/** Avatar fields worth a remark, most distinctive first. */
const AVATAR_REMARKS: Array<[field: string, remark: string]> = [
  ["headwear", "A hat. Bold, and entirely correct."],
  ["glasses", "Splendid spectacles, if I may."],
  ["faceAccessory", "A distinguishing touch. I approve."],
  ["tattoo", "A tattoo. I shan't pry, though I suspect there's a story."],
  ["hairHighlight", "Those highlights are a statement. A good one."],
  ["necklace", "A fine necklace. Understated, as all the best things are."],
  ["earrings", "The earrings are a lovely touch."],
  ["nosePiercing", "A piercing. You've an eye for detail, I see."],
  ["lipPiercing", "A piercing. You've an eye for detail, I see."],
  ["facialHair", "A distinguished beard, if I may say so."],
  ["outfit", "You've dressed for the occasion. I notice these things."],
  ["hairColor", "That hair color suits you rather well."],
  ["hairStyle", "A fine choice of hairstyle."],
];

const HOUSE_NAMES: Record<string, string> = {
  standard: "a classic house",
  cottage: "a cottage",
  bungalow: "a bungalow",
  ranch: "a ranch house",
  cabin: "an A-frame cabin",
  craftsman: "a Craftsman",
  modern: "a modern house",
  colonial: "a brick colonial",
  victorian: "a Victorian",
  villa: "a villa",
  lighthouse: "a lighthouse",
  observatory: "an observatory",
  treehouse: "a treehouse",
  windmill: "a windmill",
  castle: "a castle",
};

function houseName(style: string): string {
  return HOUSE_NAMES[style.toLowerCase()] ?? "a house of your own";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * One light remark on something they chose by hand while making their avatar
 * or house. Nothing they chose (they randomized it all) gets a general line;
 * nothing recorded at all (they skipped this part) gets no remark.
 */
export function pickRemark(choices: ArrivalChoices | null | undefined): string | null {
  if (!choices || (!choices.avatar && !choices.house)) return null;
  const chosen = new Set((choices.avatar ?? []).map(c => c.field));
  for (const [field, remark] of AVATAR_REMARKS) {
    if (chosen.has(field)) return remark;
  }
  if (choices.house?.chosen && choices.house.style) {
    return `${capitalize(houseName(choices.house.style))}. A person of taste.`;
  }
  return "You've settled in nicely, I see.";
}

// ─── The opening ─────────────────────────────────────────────────────────

export type OpeningPath = "working" | "idea" | "none";

export const OPENING_CHIPS: Array<{ id: OpeningPath; label: string }> = [
  { id: "working", label: "I'm already working on something. I need it mapped out and finished." },
  { id: "idea", label: "I have an idea of what I want. I need help shaping it." },
  { id: "none", label: "I don't have a goal yet. I'd like help finding one." },
];

/**
 * Atlas's first words: a greeting, a remark on what they just made, who he
 * is, what Velvet is for, and "Where do things stand?" with three choices.
 * Written here rather than by the model, so it's instant and always in voice.
 */
export function buildOpening(profile: ArrivalProfile, localHour: number | null | undefined): { text: string; chips: string[] } {
  const name = addressName(profile);
  const remark = pickRemark(profile.arrival_choices);
  const greeting = `${timeOfDayGreeting(localHour)}${name ? `, ${name}` : ""}.${remark ? ` ${remark}` : ""}`;
  const text = [
    greeting,
    "I'm Atlas. I look after things here at Velvet.",
    "Velvet exists to help people dream large and then actually see it through. Not just talking about it: putting it on the calendar, with someone in your corner until it's done.",
    "So let's begin with you. Where do things stand?",
  ].join("\n\n");
  return { text, chips: OPENING_CHIPS.map(c => c.label) };
}

/** Which path their first answer chose. Typing a goal straight away counts as "working". */
export function openingPath(firstAnswer: string): OpeningPath {
  const text = firstAnswer.trim().toLowerCase();
  for (const chip of OPENING_CHIPS) {
    if (text === chip.label.toLowerCase()) return chip.id;
  }
  if (/\b(don'?t|do not) have a goal|no goal|not sure|no idea|help (me )?find/.test(text)) return "none";
  if (/\bhave an idea\b|\bshap(e|ing) it\b/.test(text)) return "idea";
  return "working";
}

// ─── The trait ledger ────────────────────────────────────────────────────

export const TRAITS: Record<keyof CommunicationProfile, { values: [string, string]; purpose: string; meaning: [string, string] }> = {
  motivation: {
    values: ["internal", "external"],
    purpose: "whether their coach or assistant leans on accountability",
    meaning: ["their own drive carries them", "someone counting on them gets them moving"],
  },
  decisionStyle: {
    values: ["intuitive", "analytical"],
    purpose: "how much the coach or assistant lays out options before a decision",
    meaning: ["they trust their gut", "they want every option and number first"],
  },
  conflict: {
    values: ["solutions", "empathy"],
    purpose: "what to do when they're frustrated",
    meaning: ["fix the problem", "be heard out first"],
  },
  connection: {
    values: ["deep", "lively"],
    purpose: "how the coach or assistant talks to them",
    meaning: ["long, proper conversations", "quick, lively back-and-forth"],
  },
};

/** The traits not yet known, in the order the ledger lists them. */
export function unknownTraits(profile: CommunicationProfile | null | undefined): Array<keyof CommunicationProfile> {
  return (Object.keys(TRAITS) as Array<keyof CommunicationProfile>).filter(k => !profile?.[k]);
}

/** Keeps only known traits with allowed values. Accepts conflictResponse as conflict. */
export function validTraits(raw: unknown): CommunicationProfile {
  const out: CommunicationProfile = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const k = (key === "conflictResponse" ? "conflict" : key) as keyof CommunicationProfile;
    const trait = TRAITS[k];
    if (trait && typeof value === "string" && trait.values.includes(value)) out[k] = value;
  }
  return out;
}

// ─── Markers in Atlas's replies ──────────────────────────────────────────

/** A small plan Atlas pencilled in after a clear yes ("pick a game and buy tickets"). */
export interface PencilledPlan {
  title: string;
  date: string;
  time: string | null;
  type: "task" | "date_idea" | "appointment" | "reminder";
  goal: string | null;
}

export interface ParsedReply {
  text: string;
  traits: CommunicationProfile;
  address: AddressStyle | null;
  plans: PencilledPlan[];
  chips: string[];
  goalComplete: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PLAN_TYPES = new Set(["task", "date_idea", "appointment", "reminder"]);

function validPlan(raw: unknown, today: string): PencilledPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim().slice(0, 120) : "";
  const date = typeof r.date === "string" ? r.date : "";
  if (!title || !DATE_RE.test(date) || date < today) return null;
  const time = typeof r.time === "string" && TIME_RE.test(r.time) ? r.time : null;
  const type = typeof r.type === "string" && PLAN_TYPES.has(r.type) ? r.type as PencilledPlan["type"] : "task";
  const goal = typeof r.goal === "string" && r.goal.trim() ? r.goal.trim().slice(0, 120) : null;
  return { title, date, time, type, goal };
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Pulls the hidden markers out of a reply and validates them. The person only
 * ever sees `text`. Unclear or invalid markers are dropped, never guessed at.
 */
export function parseReply(raw: string, today: string): ParsedReply {
  const traits: CommunicationProfile = {};
  const plans: PencilledPlan[] = [];
  let address: AddressStyle | null = null;
  let chips: string[] = [];

  let text = raw.replace(/\[PROFILE\s*(\{[^\]]*\})\s*\]/gi, (_m, json) => {
    Object.assign(traits, validTraits(parseJson(json)));
    return "";
  });
  text = text.replace(/\[PLAN\s*(\{[^\]]*\})\s*\]/gi, (_m, json) => {
    const plan = validPlan(parseJson(json), today);
    if (plan) plans.push(plan);
    return "";
  });
  text = text.replace(/\[ADDRESS\s+(formal|first_name)\s*\]/gi, (_m, style) => {
    address = style.toLowerCase() as AddressStyle;
    return "";
  });
  text = text.replace(/\[CHIPS\s+([^\]]*)\]/gi, (_m, body: string) => {
    chips = body.split("|")
      .map(c => c.trim().replace(/^["']|["']$/g, "").trim())
      .filter(c => c.length > 0 && c.length <= 80)
      .slice(0, 3);
    return "";
  });
  const goalComplete = /\[GOAL_COMPLETE\]/i.test(text);
  text = text.replace(/\[GOAL_COMPLETE\]/gi, "");
  // Anything left that looks like a marker is never shown.
  text = text.replace(/\[(PROFILE|PLAN|ADDRESS|CHIPS|NAV)[^\]]*\]/gi, "");

  return {
    text: text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    traits,
    address,
    plans,
    chips: chips.length >= 2 ? chips : [],
    goalComplete,
  };
}

// ─── Checking replies (the test script and unit tests use this) ──────────

export const BANNED_PHRASES = [
  "i'm going to get you set up",
  "great question",
  "i'd be happy to",
  "absolutely",
  "let's dive in",
  "no worries",
  "as an ai",
  "feel free to",
  "journey",
  "batman",
  "bruce wayne",
  "with your personal interests out of the way",
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** Interest words from their profile, for spotting a list read back to them. */
export function interestTerms(profile: ArrivalProfile): string[] {
  const parts = [
    ...(profile.hobbies ?? "").split(","),
    ...(profile.sports ?? "").split(","),
    ...(profile.music_genre ?? "").split(","),
    ...profile.entertainment_interests,
    ...profile.tech_interests,
    ...profile.lifestyle_interests,
    ...profile.sports_interests,
  ];
  return [...new Set(parts.map(p => p.trim().toLowerCase()).filter(p => p.length > 2))];
}

/**
 * What's wrong with a reply, if anything: more than one question, banned
 * phrases, exclamation marks, emoji, lists, reading their answers back, or
 * the wrong form of address.
 */
export function checkReply(text: string, opts: { profile?: ArrivalProfile } = {}): string[] {
  const issues: string[] = [];
  const lower = text.toLowerCase();
  const questions = (text.match(/\?/g) ?? []).length;
  if (questions > 1) issues.push(`asks ${questions} questions`);
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) issues.push(`banned phrase: "${phrase}"`);
  }
  if (text.includes("!")) issues.push("exclamation mark");
  if (EMOJI_RE.test(text)) issues.push("emoji");
  if (/^\s*([-*•]|\d+[.)])\s+/m.test(text)) issues.push("list");
  if (/\[[A-Z_]+/.test(text)) issues.push("marker left in the visible text");
  if (opts.profile) {
    const hits = interestTerms(opts.profile).filter(t => lower.includes(t));
    if (hits.length >= 3) issues.push(`reads back their answers (${hits.slice(0, 3).join(", ")})`);
    // "Master" / "Miss" only as their own address allows: never after they
    // asked for first names, never for anyone not addressed formally.
    const used = text.match(/\b(Master|Miss) [A-Z][a-z]+/);
    if (used && used[0] !== formalAddress(opts.profile)) issues.push(`wrong form of address: "${used[0]}"`);
  }
  return issues;
}

// ─── Dates and weekdays ──────────────────────────────────────────────────
// A model is unreliable at "which weekday is January 25th", so the server works it out: the dates
// the person mentions go into the prompt with their weekdays, and a reply that puts a wrong weekday
// beside a date is sent back to be rewritten.

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_WORDS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";
const MONTH_FIRST = new RegExp(`\\b(${MONTH_WORDS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4})\\b)?`, "gi");
const DAY_FIRST = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_WORDS})\\b(?:,?\\s+(\\d{4})\\b)?`, "gi");

export interface DateMention { start: number; end: number; text: string; iso: string; weekday: string }

function monthIndex(word: string): number {
  const w = word.toLowerCase();
  return MONTH_NAMES.findIndex(m => m === w || (w.length >= 3 && m.startsWith(w.slice(0, 3)) && w.length <= 4));
}

/** "January 25th" or "25th of January" in a text, as dates: the next one on or after today unless a year is given. */
export function dateMentions(text: string, todayIso: string): DateMention[] {
  const [ty] = todayIso.split("-").map(Number);
  const found: DateMention[] = [];
  const add = (m: RegExpExecArray, monthWord: string, dayStr: string, yearStr: string | undefined) => {
    const mi = monthIndex(monthWord);
    const day = Number(dayStr);
    if (mi < 0 || day < 1 || day > 31) return;
    const make = (y: number) => new Date(Date.UTC(y, mi, day));
    const valid = (d: Date) => d.getUTCMonth() === mi && d.getUTCDate() === day;
    let year = yearStr ? Number(yearStr) : ty;
    let d = make(year);
    if (!valid(d)) return;
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    if (!yearStr && iso(d) < todayIso) { year += 1; d = make(year); if (!valid(d)) return; }
    found.push({ start: m.index, end: m.index + m[0].length, text: m[0], iso: iso(d), weekday: WEEKDAYS[d.getUTCDay()] });
  };
  for (const m of text.matchAll(MONTH_FIRST)) add(m as RegExpExecArray, m[1], m[2], m[3]);
  for (const m of text.matchAll(DAY_FIRST)) add(m as RegExpExecArray, m[2], m[1], m[3]);
  return found.sort((a, b) => a.start - b.start);
}

/** The prompt lines for dates the person has written, with their weekdays; empty when there are none. */
export function dateNotes(userTexts: string[], todayIso: string): string {
  const lines = new Map<string, string>();
  for (const t of userTexts) {
    for (const d of dateMentions(t, todayIso)) lines.set(d.iso, `- ${d.text.trim()} is ${d.weekday}, ${d.iso}`);
  }
  return [...lines.values()].join("\n");
}

/** Replies that put a weekday beside a date that is not on that weekday. */
export function weekdayIssues(reply: string, todayIso: string): string[] {
  const issues: string[] = [];
  for (const d of dateMentions(reply, todayIso)) {
    const around = reply.slice(Math.max(0, d.start - 18), Math.min(reply.length, d.end + 24));
    const named = WEEKDAYS.filter(w => new RegExp(`\\b${w}s?\\b`, "i").test(around));
    if (named.length === 1 && named[0] !== d.weekday) {
      issues.push(`wrong weekday: ${d.text.trim()} is a ${d.weekday}, not a ${named[0]}`);
    }
  }
  return issues;
}

// ─── The plan Atlas sets up after the goal ───────────────────────────────

export interface PlanStep {
  title: string;
  scheduledFor: string | null;
  durationMinutes: number | null;
}

export interface ArrivalPlan {
  goal: {
    title: string;
    targetDate: string | null;
    measure: { what: string; unit: string | null; target: number | null } | null;
  };
  phases: Array<{ title: string; steps: PlanStep[] }>;
  /** This week's steps, with dates: what they're signing up for first. */
  commitments: Array<{ description: string; dueDate: string }>;
  /** The days that hold something every week, e.g. Monday: move $150 to savings. */
  weeklyRhythm: Array<{ day: string; what: string }>;
  /** How often their assistant or coach checks in, in words. */
  checkIns: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function futureDate(v: unknown, today: string, latest: string): string | null {
  return typeof v === "string" && DATE_RE.test(v) && v >= today && v <= latest ? v : null;
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

/**
 * Checks and tidies the plan the model wrote. Dates must be real and not in the
 * past; at most five years out. Commitments must fall within two weeks. Returns
 * null when there's nothing usable (no phase with a step).
 */
/** The JSON object in a model reply: a fenced block, or the last balanced {...} that parses. */
export function extractJson(raw: string | null): unknown {
  if (!raw) return null;
  // A fenced block first; otherwise every balanced {...} in the text, last one
  // first (after a web search the JSON can follow a sentence or two of prose).
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = fenced ? [fenced[1]] : [];
  const starts: number[] = [];
  let depth = 0, inString = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") { if (depth === 0) starts.push(i); depth++; }
    else if (ch === "}" && depth > 0) { depth--; if (depth === 0) candidates.push(raw.slice(starts[starts.length - 1], i + 1)); }
  }
  for (const c of candidates.reverse()) {
    try { return JSON.parse(c.trim()); } catch { /* try the next one */ }
  }
  return null;
}

export function validatePlan(raw: unknown, today: string): ArrivalPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const latest = addDays(today, 365 * 5);
  const g = (r.goal ?? {}) as Record<string, unknown>;
  const m = (g.measure ?? null) as Record<string, unknown> | null;
  const target = m && typeof m.target === "number" && Number.isFinite(m.target) && m.target > 0 ? m.target : null;

  const phases = (Array.isArray(r.phases) ? r.phases : []).slice(0, 6).map(p => {
    const ph = (p ?? {}) as Record<string, unknown>;
    const steps = (Array.isArray(ph.steps) ? ph.steps : []).slice(0, 8).map(s => {
      const st = (s ?? {}) as Record<string, unknown>;
      const minutes = typeof st.durationMinutes === "number" && st.durationMinutes >= 5 && st.durationMinutes <= 600
        ? Math.round(st.durationMinutes) : null;
      return { title: str(st.title, 120), scheduledFor: futureDate(st.scheduledFor, today, latest), durationMinutes: minutes };
    }).filter(s => s.title);
    return { title: str(ph.title, 80), steps };
  }).filter(p => p.title && p.steps.length > 0);
  if (phases.length === 0) return null;

  const commitments = (Array.isArray(r.commitments) ? r.commitments : []).slice(0, 5).map(c => {
    const cm = (c ?? {}) as Record<string, unknown>;
    return { description: str(cm.description, 160), dueDate: futureDate(cm.dueDate, today, addDays(today, 14)) ?? "" };
  }).filter(c => c.description && c.dueDate);

  const weeklyRhythm = (Array.isArray(r.weeklyRhythm) ? r.weeklyRhythm : []).slice(0, 7).map(w => {
    const wr = (w ?? {}) as Record<string, unknown>;
    const day = WEEKDAYS.find(d => d.toLowerCase() === str(wr.day, 12).toLowerCase()) ?? "";
    return { day, what: str(wr.what, 100) };
  }).filter(w => w.day && w.what);

  return {
    goal: {
      title: str(g.title, 120) || "Your goal",
      targetDate: futureDate(g.targetDate, today, latest),
      measure: m && str(m.what, 80) ? { what: str(m.what, 80), unit: str(m.unit, 30) || null, target } : null,
    },
    phases,
    commitments,
    weeklyRhythm,
    checkIns: str(r.checkIns, 80) || "Every few days",
  };
}

/** The calendar summary: estimated finish, how long it runs, and when the last step falls. */
export function summarizePlan(plan: ArrivalPlan, today: string): { finishDate: string; runTime: string } {
  const stepDates = plan.phases.flatMap(p => p.steps.map(s => s.scheduledFor)).filter((d): d is string => !!d);
  const latestStep = stepDates.sort()[stepDates.length - 1] ?? null;
  const finishDate = plan.goal.targetDate ?? latestStep ?? addDays(today, 28);
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = finishDate.split("-").map(Number);
  const days = Math.max(1, Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000));
  let runTime: string;
  if (days < 14) runTime = `${days} day${days === 1 ? "" : "s"}`;
  else if (days < 70) runTime = `${Math.round(days / 7)} weeks`;
  else if (days < 700) runTime = `${Math.round(days / 30.4)} months`;
  else runTime = `${Math.round(days / 365)} years`;
  return { finishDate, runTime };
}

// ─── The helper's first words ────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2027-06-01" as "June 1, 2027". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * What the coach or assistant says first, when the plan is saved: a short confirmation of the plan,
 * then a pointer to the objectives button in the top bar. Written here rather than by the model,
 * so it is instant and always says the same true things.
 */
export function buildHelperWelcome(input: {
  helperName: string;
  address: string | null;
  goalTitle: string;
  finishDate: string | null;
  firstStep: string | null;
  checkIns: string;
}): string {
  const { helperName, address, goalTitle, finishDate, firstStep, checkIns } = input;
  const plan = [
    `Hello${address ? `, ${address}` : ""}. I'm ${helperName}, and from here I'm your point person on this.`,
    `Your plan is saved: ${goalTitle}${finishDate ? `, with the finish line on ${longDate(finishDate)}` : ""}.${firstStep ? ` First up: ${firstStep}.` : ""}${checkIns.trim() ? ` I'll check in ${checkIns.trim().replace(/^[A-Z]/, c => c.toLowerCase())}.` : ""}`,
  ].join(" ");
  const objectives = "One more thing before you look around. See the button in the top bar, next to Add friend? Those are your objectives. Five to start you off, and each one takes you somewhere on Velvet. Finish them and a fresh set opens up every day, with medals to earn and a place on the leaderboard. Have a look.";
  return `${plan}\n\n${objectives}`;
}

// ─── Atlas's conversation prompt ─────────────────────────────────────────

const PATH_GUIDANCE: Record<OpeningPath, string> = {
  working: `THEY'RE ALREADY WORKING ON SOMETHING. Skip discovery. Find out what it is, how far along they are, what's left, and by when. Then wrap up.`,
  idea: `THEY HAVE AN IDEA TO SHAPE. Ask for the idea, however rough. Then shape it into a goal: what "done" looks like, and roughly by when.`,
  none: `THEY DON'T HAVE A GOAL YET. Help them find one, using the backup material below in order: their Someday picks first, then their interests. One item at a time.`,
};

function listOrNone(items: string[]): string {
  const clean = items.map(i => i.trim()).filter(Boolean);
  return clean.length ? clean.join("; ") : "(none)";
}

/** The system prompt for Atlas's onboarding conversation, after the opening. */
export function buildGoalPrompt(
  profile: ArrivalProfile,
  path: OpeningPath,
  today: { date: string; weekday: string },
  maxTurns: number,
  dateNotes = "",
): string {
  const first = firstName(profile);
  const formal = formalAddress(profile);
  const addressRule = formal
    ? `Address them as "${formal}" when you use their name.${profile.address_style === null && first
      ? ` Early on (in your first or second reply), offer once, lightly, as a remark rather than a question, so the message still asks only one: "I'll keep the formalities, unless you'd rather plain ${first}; just say the word." When they answer, add [ADDRESS formal] or [ADDRESS first_name] on its own line, and use their choice from then on. Never offer again.`
      : ""}`
    : first ? `Call them ${first}. Never "Master" or "Miss".` : "You don't know their name; don't invent one.";

  const someday = profile.someday.map(s => s.value);
  const interests = [
    profile.hobbies ? `hobbies: ${profile.hobbies}` : "",
    profile.sports ? `sports: ${profile.sports}` : "",
    profile.music_genre ? `music: ${profile.music_genre}` : "",
    profile.entertainment_interests.length ? `entertainment: ${profile.entertainment_interests.join(", ")}` : "",
    profile.tech_interests.length ? `tech: ${profile.tech_interests.join(", ")}` : "",
    profile.lifestyle_interests.length ? `lifestyle: ${profile.lifestyle_interests.join(", ")}` : "",
    profile.sports_interests.length ? `sports they follow: ${profile.sports_interests.join(", ")}` : "",
  ].filter(Boolean);

  return `You are Atlas, the host of Velvet. You've just introduced yourself and asked where things stand.

YOUR VOICE: Alfred Pennyworth in manner, never in name.
- Impeccably courteous, warm underneath, never gushing. Dry, understated wit; a raised eyebrow, never a joke for its own sake.
- Quiet devotion: you serve their ambition and take pride in it.
- One to three sentences, then ONE question. Never two questions in a message.
- Never use: "I'm going to get you set up", "Great question", "I'd be happy to", "Absolutely", "Let's dive in", "No worries", "As an AI", "Feel free to", "journey". No exclamation marks. No emoji. No lists or bullet points. No Batman references.
- Never read their answers back as a list. Mention at most one thing about them, inside a question that goes somewhere. Offering their interests as a choice ("painting, yoga or gardening") is still a list: name one.

HOW TO ADDRESS THEM: ${addressRule}

TODAY: ${today.weekday}, ${today.date}. Use it to work out dates; never guess them.
WEEKDAYS: name the weekday of a date only if it is listed below or you worked it out from today's weekday. If you are not certain, give the date without a weekday.${dateNotes ? `\nDATES THEY MENTIONED (the weekdays here are correct):\n${dateNotes}` : ""}

${PATH_GUIDANCE[path]}

WHERE GOALS COME FROM, IN ORDER:
1. The person. While they give you something to work with, follow it and bring up nothing else.
2. Their Someday picks (things they've always wanted to try): ${listOrNone(someday)}
3. Their interests (things they already do), last: ${listOrNone(interests)}
Move to 2 only if they're unsure or a couple of turns go by with nothing you can make into a plan; to 3 only if 2 is empty or nothing lands. Use one item at a time.

HOW YOU PROBE: listen for wishes ("I keep meaning to", "I used to", "one day"). For a Someday pick, ask what draws them to it and what's stopped them. For an interest, ask when they last did it and what got in the way.

WHAT YOU NEED, AND NOTHING ELSE: three things, each in the person's own words.
1. THE GOAL: what they want, broad is fine ("run a marathon", "buy a home").
2. THE DEADLINE: by when. Every goal needs one. If they have none, help them choose a realistic date and get a yes.
3. THE MISSION: why it matters to them, the thing it is for. One honest sentence from them is enough.
Do not draw up the plan, break the goal into steps, pick dates for steps, or ask about how they like to be coached. A plan is drafted for them straight after this conversation, and who will carry it is decided then. Never pencil anything in.

ENDING: as soon as you have all three (the goal, the deadline, the mission), say in one or two sentences that you have what you need (name the goal and the date), then add [GOAL_COMPLETE] on its own line. Do not say who will help or what happens next; the page says that. Reach it within ${maxTurns} exchanges; if it's going nowhere, settle on the most promising goal with a sensible deadline and end.`;
}

/** The prompt that turns the conversation into the plan Atlas walks them through. */
export function buildPlanPrompt(input: {
  goalText: string;
  helper: { name: string; kind: "coach" | "assistant"; domain: string; gender?: "male" | "female" | null };
  transcript: string;
  today: { date: string; weekday: string };
}): string {
  const { goalText, helper, transcript, today } = input;
  return `You plan goals for Velvet. Today is ${today.weekday}, ${today.date}.

The user's goal: "${goalText}". ${helper.name}, their ${helper.kind}, will carry it with them (${helper.domain}).${helper.gender === "male" ? ` ${helper.name} is a man: any pronoun for ${helper.name} is he/him/his.` : helper.gender === "female" ? ` ${helper.name} is a woman: any pronoun for ${helper.name} is she/her.` : ` Refer to ${helper.name} by name rather than with a pronoun.`}

From the conversation below, write a realistic plan. Use what they said about their situation, budget, time and deadline. Where they didn't say, choose sensible defaults for someone starting now. When a real date or fact shapes the plan (an event or race date, an application deadline, a typical lead time or price), you can search the web for it and use what you find. Never invent specifics you couldn't find; write the step that finds them out instead.

Return ONLY this JSON, no commentary:
{
  "goal": {
    "title": "the goal in their words, max 10 words",
    "targetDate": "YYYY-MM-DD, the realistic finish",
    "measure": { "what": "what shows progress, e.g. down payment saved", "unit": "e.g. $, chapters, runs", "target": 30000 } or null
  },
  "phases": [
    { "title": "short phase name", "steps": [ { "title": "one concrete action", "scheduledFor": "YYYY-MM-DD", "durationMinutes": 30 } ] }
  ],
  "commitments": [ { "description": "a concrete step for the next 7 days", "dueDate": "YYYY-MM-DD" } ],
  "weeklyRhythm": [ { "day": "Monday", "what": "what happens every week on that day" } ],
  "checkIns": "how often ${helper.name} checks in, in a few words, e.g. Every Monday and Thursday"
}

Rules:
- 2 to 5 phases, 2 to 6 steps each, in order. Each step is one action a person can do, with a date on or after today.
- 1 to 3 commitments, all within the next 7 days, small enough to actually happen.
- 1 to 3 weeklyRhythm entries: the days that hold something every week.
- All dates on or after ${today.date}, on the calendar the way a person would schedule them.

--- CONVERSATION ---
${transcript}
--- END ---`;
}

// ─── Dates in the user's own time zone ───────────────────────────────────
// The server runs in UTC, so the page sends its local date and its offset
// (Date.getTimezoneOffset(): minutes behind UTC, e.g. 420 in California).

/** The user's today, from what the page sent, else the server's. */
export function todayFrom(localDate: unknown): { date: string; weekday: string } {
  const date = typeof localDate === "string" && DATE_RE.test(localDate) ? localDate : new Date().toISOString().slice(0, 10);
  const [y, m, d] = date.split("-").map(Number);
  return { date, weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

/** A local date and time (HH:MM, or midnight) as an ISO timestamp. */
export function localToIso(date: string, time: string | null, tzOffsetMinutes: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time ? time.split(":").map(Number) : [0, 0];
  const offset = Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;
  return new Date(Date.UTC(y, m - 1, d, h, min) + offset * 60_000).toISOString();
}

/** The first date on or after `from` that falls on `weekday`. */
export function nextWeekday(from: string, weekday: string): string {
  const target = WEEKDAYS.indexOf(weekday);
  const [y, m, d] = from.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const diff = (target - start.getUTCDay() + 7) % 7;
  return addDays(from, diff);
}
