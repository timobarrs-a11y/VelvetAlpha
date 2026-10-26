// Anthropic's server-side web search tool. The API runs the searches itself;
// the reply comes back as text blocks (with citations) between
// server_tool_use / web_search_tool_result blocks. Design:
// docs/goals-and-coaches/plan.md (web search).

export function webSearchTool(maxUses = 3) {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses };
}

/** Guidance for a helper that can search. */
export const WEB_SEARCH_GUIDANCE =
  `WEB SEARCH: You can search the web. Use it when the answer depends on something current or specific you can't know for sure: prices, opening hours, dates of real events, venues, rules that change. Don't search for things you already know well. Say what you found plainly, in your own words, and mention where it came from when it matters ("the race site says entries close March 3"). Never make up a specific you didn't find. When a quick search would move one of their goals or commitments forward, offer it in a line ("Want me to look up beginner Python courses that fit your evenings?"). For general searches unrelated to what you help with, Atlas is the place.`;

type Block = { type?: string; text?: string };

/** All the text in a reply, joined; search results and tool blocks dropped. */
export function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as Block[])
    .filter(b => b?.type === "text" && typeof b.text === "string")
    .map(b => b.text as string)
    .join("");
}

/**
 * A long search turn can come back with stop_reason "pause_turn". Sending the
 * reply back as the assistant's turn lets the API pick up where it stopped.
 */
export function continuePausedTurn<M extends { role: string; content: unknown }>(messages: M[], content: unknown): M[] {
  return [...messages, { role: "assistant", content } as M];
}

// ─── The search button in a coach's or assistant's chat ─────────────────
// The user says what the search is for (a goal, a commitment, a plan step, or
// something else) before it runs, so the helper can search with that in hand.

/** Flip to true to make the search button a paid feature (mirrors src/features/search/searchTopics.ts). */
export const WEB_SEARCH_PRO_ONLY = false;

export type SearchKind = "goal" | "commitment" | "step";

export interface SearchRequest {
  query: string;
  about: { kind: SearchKind; id: string } | null;
}

/** The request from the client, or null if it isn't one. */
export function parseSearchRequest(raw: unknown): SearchRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const query = typeof r.query === "string" ? r.query.trim().slice(0, 300) : "";
  const a = r.about as Record<string, unknown> | null | undefined;
  const about = a && typeof a === "object" && (a.kind === "goal" || a.kind === "commitment" || a.kind === "step") && typeof a.id === "string"
    ? { kind: a.kind as SearchKind, id: a.id }
    : null;
  if (!about && !query) return null;
  return { query, about };
}

/** What the search is about, as found in the database for this user and helper. */
export interface SearchSubject {
  kind: SearchKind;
  title: string;
  /** Due date for a commitment, scheduled day for a step, target date for a goal. */
  date?: string | null;
  goalTitle?: string | null;
  planTitle?: string | null;
}

const KIND_WORD: Record<SearchKind, string> = { goal: "goal", commitment: "commitment", step: "plan step" };

/** The note added to their message so the helper searches straight away, with context. */
export function buildSearchBrief(query: string, subject: SearchSubject | null): string {
  const lines = ["[WEB SEARCH REQUEST — the user pressed the search button]"];
  if (subject) {
    const extras = [
      subject.date ? (subject.kind === "goal" ? `target ${subject.date}` : subject.kind === "step" ? `planned for ${subject.date}` : `due ${subject.date}`) : null,
      subject.planTitle ? `in the plan "${subject.planTitle}"` : null,
      subject.goalTitle && subject.kind !== "goal" ? `for the goal "${subject.goalTitle}"` : null,
    ].filter(Boolean);
    lines.push(`It's about their ${KIND_WORD[subject.kind]} "${subject.title}"${extras.length ? ` (${extras.join(", ")})` : ""}.`);
    lines.push(query
      ? `What they want looked up: "${query}".`
      : "They didn't say what to look up: choose the one search that would help most with this right now.");
    lines.push("Search the web now, before replying. Use what you know from the conversation and their plan to make the search specific (their level, location, budget, dates) instead of asking. Then answer briefly in your own words, say where it came from when it matters, and tie it back to this: what it means for the next step, and whether the plan or a commitment should change (offer to change it; don't change it without a yes).");
  } else {
    lines.push(`It isn't about one of their current goals. What they want looked up: "${query}".`);
    lines.push("Search the web now, before replying, and answer briefly in your own words. If it looks like the start of something they want to do, say how it could become a goal, without pushing.");
  }
  lines.push("Ask a question only if the search truly can't be done without the answer.");
  return lines.join("\n");
}
