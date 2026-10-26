// A companion's first week: instead of a form during setup, the companion asks
// how they like to feel cared about and how to handle it when things get tense,
// in conversation, once each, when the moment fits. The answer comes back in a
// hidden marker that's saved to the companion and stripped from the reply.
// Design: docs/onboarding/questionnaire-plan.md (A4).

export const LOVE_LANGUAGES = ["words", "time", "gifts", "service"] as const;
export const WHEN_ITS_HARD = ["humor", "rational", "feelings", "direct"] as const;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface WeekOneCompanion {
  relationship_type?: string | null;
  created_at?: string | null;
  love_language?: string | null;
  confrontation_style?: string | null;
}

/** What's still unknown about them, during the companion's first week. */
export function weekOneQuestions(companion: WeekOneCompanion, now = new Date()): Array<"love_language" | "confrontation_style"> {
  if (companion.relationship_type === "mentor" || companion.relationship_type === "assistant") return [];
  const created = companion.created_at ? new Date(companion.created_at).getTime() : NaN;
  if (!Number.isFinite(created) || now.getTime() - created > WEEK_MS) return [];
  const out: Array<"love_language" | "confrontation_style"> = [];
  if (!companion.love_language) out.push("love_language");
  if (!companion.confrontation_style) out.push("confrontation_style");
  return out;
}

/** The prompt block for the first week, or "" when there's nothing to ask. */
export function weekOneBlock(open: Array<"love_language" | "confrontation_style">, userMessageCount: number): string {
  // Let the first few exchanges just be talk.
  if (open.length === 0 || userMessageCount < 3) return "";
  const asks: string[] = [];
  if (open.includes("love_language")) {
    asks.push(`- How they like to feel cared about (kind words, time together and real talk, little thoughtful gestures, or doing things for them). When you know, end your reply with [TRAIT love_language=words|time|gifts|service], choosing one.`);
  }
  if (open.includes("confrontation_style")) {
    asks.push(`- When things get tense between you two, how they'd want you to handle it (lighten it with humor, talk it through calmly, focus on feelings, or be direct and move on). When you know, end your reply with [TRAIT confrontation_style=humor|rational|feelings|direct], choosing one.`);
  }
  return `\n\nGETTING TO KNOW THEM (your first week together):
You don't know these yet. When a moment fits naturally (never in the middle of something heavy, never two at once, never as a survey), ask about one, in your own words:
${asks.join("\n")}
If what they said already answers it, don't ask; just add the marker. The marker is hidden from them.`;
}

export interface TraitUpdates {
  love_language?: (typeof LOVE_LANGUAGES)[number];
  confrontation_style?: (typeof WHEN_ITS_HARD)[number];
}

/** Pulls [TRAIT ...] markers out of a reply: the clean text, and valid values to save. */
export function takeTraitMarkers(reply: string): { text: string; updates: TraitUpdates } {
  const updates: TraitUpdates = {};
  const text = reply.replace(/\s*\[TRAIT\s+(love_language|confrontation_style)\s*=\s*([a-z]+)\s*\]/gi, (_m, key: string, value: string) => {
    const v = value.toLowerCase();
    if (key.toLowerCase() === "love_language" && (LOVE_LANGUAGES as readonly string[]).includes(v)) {
      updates.love_language = v as TraitUpdates["love_language"];
    }
    if (key.toLowerCase() === "confrontation_style" && (WHEN_ITS_HARD as readonly string[]).includes(v)) {
      updates.confrontation_style = v as TraitUpdates["confrontation_style"];
    }
    return "";
  }).trim();
  return { text, updates };
}

/** Their "this or that" picks from the feed, as one line for a companion. */
export function tastePicksLine(picks: unknown): string {
  if (!picks || typeof picks !== "object") return "";
  const lines = Object.entries(picks as Record<string, unknown>)
    .map(([pair, chosen]) => {
      const [a, b] = pair.split(" / ");
      if (typeof chosen !== "string" || !a || !b) return null;
      const other = chosen === a ? b : chosen === b ? a : null;
      return other ? `${chosen} over ${other}` : null;
    })
    .filter(Boolean);
  return lines.length ? `\n\nLITTLE PREFERENCES (from "this or that" in their feed; bring up only when it fits): ${lines.join("; ")}.` : "";
}
