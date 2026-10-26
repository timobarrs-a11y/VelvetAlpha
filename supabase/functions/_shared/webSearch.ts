// Anthropic's server-side web search tool. The API runs the searches itself;
// the reply comes back as text blocks (with citations) between
// server_tool_use / web_search_tool_result blocks. Design:
// docs/goals-and-coaches/plan.md (web search).

export function webSearchTool(maxUses = 3) {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses };
}

/** Guidance for a helper that can search. */
export const WEB_SEARCH_GUIDANCE =
  `WEB SEARCH: You can search the web. Use it when the answer depends on something current or specific you can't know for sure: prices, opening hours, dates of real events, venues, rules that change. Don't search for things you already know well. Say what you found plainly, in your own words, and mention where it came from when it matters ("the race site says entries close March 3"). Never make up a specific you didn't find.`;

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
