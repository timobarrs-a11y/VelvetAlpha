// Eval runner: scores retrieval cases against the live database and returns only pass/fail and short ids,
// never memory text. Only the project's own server credential may call it.
//
// Body: { embed?: boolean, cases: [{ id, user_id, companion_id, relationship_type, query, expect }] }
// where `expect` uses 8-character row ids (see scripts/memory-eval/README.md for the expectation keys).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { selectMemories, DEFAULT_FACT_SELECTION, DEFAULT_THREAD_SELECTION, isNearDuplicate, estimateTokens } from "./engine.ts";

const MODEL = "text-embedding-3-small";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

interface Expect {
  include?: string[]; include_any?: string[]; exclude?: string[]; exclude_user_ids?: string[];
  no_relevant?: boolean; max_relevant?: number; max_dupes?: number; rank_before?: [string, string][];
}
interface Case { id: string; user_id: string; companion_id: string; relationship_type: string; query: string; expect: Expect }
// deno-lint-ignore no-explicit-any
type Row = any;

function score(e: Expect, ids: string[], all: Row[], facts: Row[]) {
  const fails: string[] = [];
  const rank = (id: string) => ids.indexOf(id);
  const minRel = DEFAULT_FACT_SELECTION.minRelevance;
  const relevant = all.filter(r => r.relevance >= minRel);
  for (const id of e.include ?? []) if (!ids.includes(id)) fails.push(`missing ${id}`);
  if (e.include_any && !e.include_any.some(id => ids.includes(id))) fails.push(`none of ${e.include_any.join("/")} selected`);
  for (const id of e.exclude ?? []) if (ids.includes(id)) fails.push(`selected excluded ${id}`);
  if (e.exclude_user_ids) for (const r of all) if (e.exclude_user_ids.includes(r.user_id)) fails.push(`row from another user ${String(r.id).slice(0, 8)}`);
  if (e.no_relevant && relevant.length) fails.push(`${relevant.length} rows scored relevant: ${relevant.map(r => `${String(r.id).slice(0, 8)}@${r.relevance.toFixed(2)}`).join(", ")}`);
  if (e.max_relevant != null && relevant.length > e.max_relevant) fails.push(`${relevant.length} relevant rows > ${e.max_relevant}`);
  let dups = 0;
  for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) if (isNearDuplicate(facts[i].content, facts[j].content, "loose")) dups++;
  if (e.max_dupes != null && dups > e.max_dupes) fails.push(`${dups} near-duplicate fact pairs > ${e.max_dupes}`);
  for (const [a, b] of e.rank_before ?? []) if (rank(b) >= 0 && (rank(a) < 0 || rank(a) > rank(b))) fails.push(`${a} should rank above ${b}`);
  return { fails, dups, relevantCount: relevant.length };
}

Deno.serve(async (req: Request) => {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const allowed = [Deno.env.get("CRON_SECRET"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")].filter((v): v is string => !!v);
  if (!token || !allowed.includes(token)) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null) as { cases?: Case[]; embed?: boolean } | null;
  const cases = body?.cases ?? [];
  if (cases.length === 0) return json({ error: "no cases" }, 400);
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  let vectors: number[][] | null = null;
  if (body?.embed) {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ error: "no OPENAI_API_KEY" }, 500);
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: cases.map(c => c.query.slice(0, 8000)) }),
    });
    if (!res.ok) return json({ error: `openai ${res.status}` }, 500);
    vectors = new Array(cases.length);
    for (const r of (await res.json()).data) vectors[r.index] = r.embedding;
  }

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const { data, error } = await db.rpc("fetch_memories_for_turn", {
      p_user_id: c.user_id, p_companion_id: c.companion_id, p_relationship_type: c.relationship_type,
      p_budget_tokens: 1200, p_query_text: c.query,
      p_query_embedding: vectors ? `[${vectors[i].join(",")}]` : null,
      p_embedding_model: vectors ? MODEL : null, p_max_candidates: 40,
    });
    if (error) { results.push({ id: c.id, pass: false, fails: [`rpc: ${error.message.slice(0, 100)}`] }); continue; }
    const rows: Row[] = (data ?? []).map((r: Row) => ({ ...r, relevance: Number(r.relevance), score: Number(r.score), importance: Number(r.importance ?? 5) }));
    const candidates = rows.filter(r => r.kind !== "moment");
    const facts = selectMemories(candidates.filter(r => r.kind !== "thread"), DEFAULT_FACT_SELECTION);
    const threads = selectMemories(candidates.filter(r => r.kind === "thread"), DEFAULT_THREAD_SELECTION);
    const all = [...facts, ...threads];
    const ids = all.map(r => String(r.id).slice(0, 8));
    const s = score(c.expect, ids, all, facts);
    const tokens = all.reduce((a, r) => a + estimateTokens(String(r.content)), 0);
    results.push({ id: c.id, pass: s.fails.length === 0, fails: s.fails, facts: facts.length, threads: threads.length, relevant: s.relevantCount, dups: s.dups, tokens, sel: all.map(r => `${String(r.id).slice(0, 8)}@${r.relevance.toFixed(2)}`) });
  }
  return json({ embedded: !!vectors, passed: results.filter(r => r.pass).length, total: results.length, failing: results.filter(r => !r.pass).map(r => r.id), results });
});
