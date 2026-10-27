# Memory engine (v2)

Audit + upgrade, 2026-10-26. Covers the live path only: `chat-turn` reads and
writes `memory_items`; `dream-hygiene` cleans it nightly; `summarize-memory`
keeps the companion's prose summary. The older client-side
`semanticMemoryService` / `relationship_memories` stack is legacy (only reached
when `USE_SERVER_PROMPT` is off).

## What the audit found in live data

| Finding | Effect |
|---|---|
| 0 of 57 `memory_items` had an embedding | "Semantic" memory had no semantics |
| Facts picked by `last_recalled_at ASC LIMIT 12`, then keyword-ranked | A relevant fact past the 12th never reached the model (one pair already had 17) |
| `update_memory_recall` had no service-role fallback | Every recall write from chat-turn silently did nothing (`recall_count = 0` everywhere) |
| Exact-string dedup, and extraction re-read the last 4 user messages every turn | 7–9 paraphrases of the same fact ("Ice Cream Social book" ×7, "expanding their mindset" ×9) |
| Corrections overwrote in place; dream-hygiene and admin approve wrote the corrected text onto a row and then marked it `superseded` | The corrected fact vanished from retrieval |
| A wrong global fact ("User is an author") stayed active next to its correction, which was stored as a thread | Every companion was told something the user had denied |
| Every bookkeeping write bumped `version` | Optimistic concurrency conflicted constantly; `memory_history` filled with noise |
| `summarize-memory` wrote to `companion_memories`, but chat-turn reads `memory_items` kind `moment` | 3 companion summaries existed and 0 reached the model; each summary was also an LLM merge of the last one |
| Legacy client returned a zero vector when embedding failed | A zero vector has no direction; stored or searched with, it corrupts results |

## How it works now

### Write path (`chat-turn` → `extractMemoryServerSide`)
1. **Reconcile before write** (Mem0's ADD/UPDATE/DELETE/NOOP). The extractor
   sees the memories this turn retrieved, labelled F1…/T1…, and returns
   `add | update | confirm | retract` for facts and `add | update | close` for
   threads. It uses forced tool-use, so the output is structured, not
   regex-parsed JSON.
2. **Only the latest user message is a source.** Earlier turns and the
   companion's reply are context only. This removes the re-extraction loop that
   produced the duplicates.
3. **Evidence grounding** (from HaluMem's findings). Every op must quote the
   user's words. `isGroundedIn` checks that the quote really is in the message,
   and drops the op if not. The quote is stored in `evidence` for provenance.
4. **Injection guard.** Both the fact and its evidence go through
   `looksLikeInstruction`. Memories are rendered on a single line with fence
   tags stripped, so stored text can't break out of `<memory>`.
5. **Supersede, never overwrite.** `supersede_memory_item` inserts the
   corrected row and points the old one at it (`status='superseded'`,
   `superseded_by`). History stays intact, which mirrors Zep/Graphiti edge
   invalidation.
6. **Temporary facts expire.** `durability: temporary` sets `valid_until`
   ("has a girl over tonight" lasts 1–2 days, not forever).
7. **Reinforcement.** Re-stating a memory bumps `confirm_count` and
   `last_confirmed_at`, and never lowers confidence or importance.
8. Every new memory is embedded (`text-embedding-3-small`, with
   `embedding_model` stored per row).

### Read path (`fetch_memories_for_turn` → `selectMemories`)
1. **Hybrid retrieval in SQL** with calibrated relevance (v3):
   - Lexical score: the share of a memory's terms that the message mentions,
     with only half credit for a single shared word.
   - Semantic score: cosine rescaled so 0.25 maps to 0 and 0.60 maps to 1.
   - Relevance is the stronger of the two, plus a bonus when both agree.
   - v2 used reciprocal rank fusion. Rank-based scores made any match look
     relevant however weak, so the relevance gate did nothing.
2. **Blended score.** 0.55 relevance + 0.20 importance + 0.15 recency (30-day
   half-life since last said or confirmed) + 0.10 confidence, plus a bonus for
   user-stated memories (Generative Agents' recency × importance × relevance).
3. **MMR selection in TS** (λ=0.7). This gives relevant memories first and at
   most 5 "background" memories, with no near-duplicates, within ~900 tokens.
   Pinned memories (importance ≥ 9) always qualify.
4. **Dated, provenance-tagged lines.** For example,
   `- User lives in Boulder (user confirmed, as of Oct 19)`. The model can
   reason about staleness, and the block tells it to say "I don't remember"
   rather than guess (abstention, as tested by LongMemEval).
5. **Graceful degradation.** With no `OPENAI_API_KEY`, or if embedding takes
   more than 1.5 s, retrieval runs on full-text alone.
6. Vectors from different embedding models are never compared, so the model
   can change safely. Dream-hygiene re-embeds rows on the old model over a few
   nights.

### Nightly (`dream-hygiene`)
1. **Every user:** retire expired temporary memories (`retire_expired_memories`),
   and embed up to 200 rows that have no vector or an old-model vector.
2. **Deterministic dedupe** for recently active pairs. It folds
   near-paraphrases into the user-stated, most-reinforced, oldest row. It
   never merges:
   - across visibility (shared vs one companion);
   - when the texts differ by a negation or a number ("eats red meat" vs
     "doesn't eat red meat", "2 kids" vs "3 kids");
   - on a vector match alone: that also needs ≥75% word overlap.
3. **LLM pass:**
   - It never touches the companion summary, boundaries or text the user
     edited.
   - It auto-applies only two things: closing a thread past its follow-up
     date, and a correction the user made explicitly. Everything else waits
     in the review queue.
   - In "merge" proposals, the target is the redundant memory and
     `evidence[0]` is the memory that's kept.

### Companion summary (`summarize-memory`)
- Messages are claimed atomically (`claim_unsummarized_messages`), so two
  runs can't process the same batch. A failed run hands the batch back.
- The summary is grounded in the canonical fact list, and facts win over the
  rolling summary. The merge prompt says the newer chunk wins and nothing may
  be invented.
- The summary is published as the companion's `moment` row through the
  supersede chain, so chat-turn actually reads it (into the cached
  semi-stable block).

### Corrections, forgetting and clearing (v3)
- **One write path for corrections.** The extractor's `update` op writes
  them, and it must quote the user's words.
  - The post-response analyzer only logs correction and reference events.
  - It now sees each remembered fact's text, not just its id.
  - It may only name ids it was shown.
- **Forget** (`forget_memory_item`) scrubs the text from:
  - the memory and the earlier versions it replaced;
  - `memory_history`, `memory_events` and `memory_proposals`;
  - the companion summary written from it, which is retired and rebuilt
    later.
- **Clear memory** (Settings → `memory-mutate` → `clear_user_memory`) does the
  same for every memory the user has, plus all summaries and the legacy fact
  list. Before v3 this button updated `memory_items` from the browser, which
  RLS silently refused, so nothing was cleared.
- **Account deletion** cascades to `memory_items`, and the history trigger
  now erases each row's history instead of logging the deletion with the
  content.
- **Write lockdown.** Browsers can't execute any memory write RPC. Every
  write goes through an edge function that checks ownership; editing used to
  skip that check.
- **Atlas** reads shared memories from `memory_items`. It used to read
  `user_insights`, which is empty and was never corrected or cleared.

## Research checklist

✅ done in v2 · ◐ partial · ☐ not yet

| Technique | Status | Source |
|---|---|---|
| ADD/UPDATE/DELETE/NOOP reconcile against retrieved memories | ✅ | Mem0, arXiv 2504.19413 |
| Invalidate, don't delete; keep history; temporal validity | ✅ (`superseded_by`, `valid_until`, `memory_history`) | Zep/Graphiti, arXiv 2501.13956 |
| Full bi-temporal model (`valid_from` = when it became true in the world) | ☐ | Zep/Graphiti |
| Hybrid lexical + vector retrieval with RRF | ✅ | Anthropic "Contextual Retrieval"; pgvector docs |
| Recency × importance × relevance scoring | ✅ | Generative Agents, arXiv 2304.03442 |
| Decay with reinforcement on re-mention | ✅ | MemoryBank, arXiv 2305.10250 |
| MMR diversity and token budget | ✅ | Carbonell & Goldstein 1998 |
| Ground extractions in source text | ✅ | HaluMem, arXiv 2511.03506 |
| Abstain instead of guessing; dated memories | ✅ (prompted) | LongMemEval, arXiv 2410.10813 |
| Prompt-injection defenses (data fences, write-time filter, no fence breakout) | ✅ | Spotlighting, arXiv 2403.14720; OWASP ASI06 |
| Embedding model versioning and re-embed | ✅ | pgvector / Qdrant migration guides |
| HNSW instead of ivfflat built on an empty table | ✅ | pgvector README |
| Don't summarize summaries; ground summaries in the canonical store | ◐ (grounded; still a rolling merge) | "Compaction cliff" results* |
| Offline consolidation ("sleep-time compute") | ✅ (dream-hygiene, pre-existing) | Letta, arXiv 2504.13171 |
| Reranker (cross-encoder or LLM) over the top ~30 | ☐ (latency; MMR + threshold instead) | Anthropic Contextual Retrieval |
| Time-aware query rewriting ("last month" → date range) | ☐ | LongMemEval |
| End-to-end eval: recall, false-memory, stale-fact, leakage, abstention | ◐ (SQL regression + unit tests; LLM-judged probe suite is roadmap item 2) | LoCoMo, LongMemEval, STALE* |

\* Found through search summaries; the primary papers could not be fetched
while this was written. Treat their specific numbers as unverified.

## Tests

- `src/services/__tests__/memoryEngine.test.ts` (vitest, in `npm test`):
  dedup, MMR selection, grounding, the injection filter, formatting and
  embedding fallbacks.
- `scripts/memory-eval/memory_engine.test.sql`: 46 checks against a
  scratch Postgres with pgvector. They cover:
  - dedup, reinforcement and the duplicate-insert race;
  - recall tracking, calibrated ranking and expiry;
  - cross-companion and private scoping;
  - supersession and version conflicts;
  - embedding hygiene and cross-user isolation;
  - grants;
  - forget, clear and account deletion reaching every copy;
  - the summarization claim.

  ```
  createdb scratch && psql -d scratch -v ON_ERROR_STOP=1 -f scripts/memory-eval/memory_engine.test.sql
  ```

## Rollout notes

- v2 is live (applied 2026-10-26).
- **v3:** apply `20261031100000_memory_engine_v3.sql` *before* publishing.
  The new functions call RPCs that exist only after the migration. The
  currently deployed functions keep working against v3: they already use the
  service role, and the browser path v3 revokes never worked.
- Set `OPENAI_API_KEY` in the edge function secrets for vector retrieval.
  Without it everything still works on full-text search.
- The first nightly run embeds existing rows and folds strict duplicates. The
  20 pending proposals in `/admin/memory-proposals` (including the
  author-vs-reader contradiction) still need a human decision.
