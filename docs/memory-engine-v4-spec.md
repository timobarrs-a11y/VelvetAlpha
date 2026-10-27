# Memory engine v4: safe belief revision

Status: **proposal**, nothing here is deployed. Companion to
`scripts/memory-eval/REVIEW_2026-10-26.md` (what is wrong) and
`docs/memory-engine-handoff-2026-10-27.md` (what was done since). This document
specifies the layer that decides when a stored memory may be retired, superseded
or closed, and ships the evals that will measure it:
`scripts/memory-eval/synthetic/contradiction_suite.json` (100 belief-revision
cases) and `scripts/memory-eval/synthetic/eval_retrieval_synthetic.json`
(157 retrieval turns over six invented users).

## Why a new layer

Today a destructive change to memory is a single Haiku tool call
(`record_memory_ops` in `chat-turn/extractMemoryServerSide`) that is also doing
extraction, deduplication, importance scoring and sharing decisions. Its
output is applied as soon as the quoted evidence can be found in the message.
Measured consequences (review findings 4 and 5, handoff §6):

- the extractor closed or rewrote **unrelated open threads** on roughly half of
  emotional or new-topic messages; a quote that is the whole message passes the
  grounding check whatever it is about;
- the extractor produced **no correction** for the user's real correcting
  sentence in 3 of 3 runs, while a wrong global fact stayed active for a week;
- retirement is a status flip with no way back from the product, and
  retrieval never looks at retired rows again.

The lexical guard added since (`memoryRelatesTo`, one shared stemmed word)
blocks the reproduced thread failures but was removed from fact ops because it
also blocked a correct semantic correction ("just reading" against "is an
author"). Word overlap is the wrong test for both directions. The right test
is the question the extractor is never asked directly: **does this message
make this specific memory false?**

v4 separates *proposing* a change (extractor, unchanged) from *authorising* it
(verifier + gates + two-signal rule), and makes every authorised destructive
change reversible for a window.

## a. Verifier contract

One call per (target memory, user message). It never sees the other memories,
so it cannot be distracted by them, and its output is small enough to audit.

**Input**

```
<stored_memory kind="fact|preference|person|thread|…" age_days="N" source="user_stated|inferred">
{content}
</stored_memory>

<latest_user_message>
{message, max 1500 chars, exactly as the extractor saw it}
</latest_user_message>
```

Earlier turns are not included. If a correction needs the previous turn to be
understood ("yes, exactly" after "so you are not the author?"), chat-turn
already prefixes short replies with the previous user message for retrieval;
the verifier receives the same prefixed text.

**Output** (forced tool use, `verify_memory`):

```json
{ "verdict": "entails" | "contradicts" | "unrelated",
  "quote": "exact words from the message, empty when unrelated",
  "confidence": 0.0-1.0,
  "reason": "one sentence (logged, never shown to the user)" }
```

**Semantics**

- `contradicts`: the message makes the memory false, outdated or no longer
  true. Includes implicit evidence (a new employer ends the old job), changed
  numbers or names, negations, and states or plans the message shows have
  ended ("finished the series" ends "plans to read it").
- `entails`: the message restates the memory or only makes sense if it is
  still true. Used as a reinforcement signal (`confirm`), never as a write.
- `unrelated`: anything else, explicitly including important or emotional
  messages about something else, filler, questions to the companion, and
  instruction-like text. Sharing a word is not relatedness.

**Rules the write path enforces, not the model**

1. Only `contradicts` may retire, supersede or close. `entails` may confirm;
   `unrelated` does nothing and is logged as an extractor error if the
   extractor had proposed a destructive op.
2. `quote` must pass `isGroundedIn(quote, message)` (≥80% of its words in the
   message). A `contradicts` with an ungrounded quote is downgraded to
   `unrelated`.
3. `confidence < 0.6` on `contradicts` is treated as `unrelated` for the
   purposes of writing and recorded as a weak signal (see c).
4. The verifier runs only for targets the extractor proposed a destructive op
   on, plus, for `update` ops, the *new* text is checked against the target
   the same way (an update whose new text is `unrelated` to the target is a
   disguised add, and is written as an add instead).
5. Prompt injection: the memory and the message are wrapped as data; the
   verifier has no tools other than `verify_memory` and no system access.
   `looksLikeInstruction` still runs on quote and new text before anything is
   written.

The reference implementation (prompt, tool schema, the four rules) is in
`scripts/memory-eval/run_contradiction_suite.mjs` so the suite can be scored
before any production code exists. §h reports what it does today.

## b. Vector relatedness gate

A second, model-free check. Every active row now has a `text-embedding-3-small`
vector; the write path embeds the verifier's `quote` (not the whole message)
in the same batch call that already embeds new facts, and computes cosine with
the target.

- `cos(quote, target) >= T_related`: the destructive op may proceed (subject to a and c).
- `cos < T_related`: the op is blocked and logged `gate=vector`, whatever the verifier said.

The gate is deliberately permissive: its job is to stop the catastrophic case
(a grief message closing a fitness thread, cosine typically < 0.2), not to
adjudicate contradictions, which it cannot do ("User is vegan" and "User is
not vegan" have cosine ≈ 0.9). That is why it is combined with the verifier
rather than replacing it.

**Calibration from data.** `run_contradiction_suite.mjs --embed` records
`cos(message, target)` and `cos(quote, target)` for every (row, message) in the
suite with the expected verdict. Choose `T_related` as the largest value such
that recall of `contradicts` rows stays at 100% on the suite (no true
correction blocked), then confirm the false-accept rate on `unrelated` rows.
Expected from the vocabulary of the suite: the lowest `contradicts` cosine is
an implicit one such as "my new manager at Globex is great" against "User
works at Acme Robotics"; the highest `unrelated` cosine is a same-domain
distractor such as "Priya passed her exam!" against "User bouldering twice a
week". If those overlap, keep the gate low (0.25–0.30) and let the verifier
carry the decision; the gate still removes the zero-overlap failures that
caused the reproduced data loss. Re-run the calibration whenever the
embedding model changes (the row stores `embedding_model`, so mixed models are
never compared).

Production shadow data (§f) replaces the suite for calibration once there are
≥ 200 logged ops: fit the threshold on logged `(cosine, human label)` pairs.

## c. Two-signal rule

A row is **protected** when any of: `source in (user_stated, user_edited)`,
`confirm_count >= 2`, or `age > 7 days`. Everything else is a fresh,
single-observation inference.

| target | authorised destructive op | effect |
|---|---|---|
| not protected | verifier `contradicts` + gate pass | `supersede` / `retire` / `close` as today |
| protected | first verifier `contradicts` + gate pass | row becomes **`disputed`** (still retrievable, see d); a `memory_events` row of type `dispute` records the quote, confidence and cosine |
| protected | second independent `contradicts` on the same row (different message, ≥ 1 minute apart) or an explicit user correction in the memory panel | `supersede` / `retire` / `close` |
| protected | explicit correction phrasing ("no", "that's wrong", "not X", "anymore") **and** confidence ≥ 0.9 | counts as both signals: applied at once, with the dispute event still written |
| any | `entails` | `confirm_count += 1`, `last_confirmed_at = now()`; clears a `disputed` state back to `active` if the entailing message is newer than the dispute |

The second-signal count is per row, not per message, so the extractor issuing
three ops against one row in one turn does not satisfy it. Hygiene
(dream-hygiene) may count as a signal only when it carries a `correction`
memory_event for that row; its own LLM pass never does.

Why these thresholds: in the live data every destructive mistake found so far
(the six-pack goal retired as "generic", the progressed thread folded into the
older one, the thread closes in the probe) targeted a row that was either older
than a week or confirmed more than once. A fresh inference that is wrong costs
little to retire and little to re-learn.

## d. Restore semantics

New `status` value **`disputed`**, alongside `active`, `superseded`, `retired`.

- **Retrievable for N = 14 days.** `fetch_memories_for_turn` treats `disputed`
  like `active`, and `formatMemoryLine` renders it as
  `- User is a vegetarian (disputed 3 days ago: "I just don't eat red meat")`,
  so the model can ask instead of asserting. After N days without a second
  signal the row returns to `active` with `importance - 1` (the dispute is
  kept in `memory_events`); after a second signal it is superseded or retired.
- **Un-retire.** `restore_memory_item(p_id, p_user_id)` (service role, called
  by `memory-mutate` action `restore`): sets `status = 'active'`, clears
  `superseded_by` on the row and, if it was superseded, marks the replacement
  `retired` with `memory_events.type = 'restored'`. Allowed for 30 days after
  the retirement; after that the row is history. The memory panel shows a
  "recently removed" list for that window.
- **Retired rows stay out of retrieval** (unchanged). `disputed` is the only
  new state retrieval sees.
- `forget_memory_item` / `clear_user_memory` are unaffected: forgetting is the
  user's decision and is final.

## e. Schema changes and migration plan

Migration `20261101100000_memory_engine_v4.sql` (name indicative):

1. `memory_items.status` check constraint gains `'disputed'`; partial indexes
   that say `status = 'active'` become `status IN ('active','disputed')`
   (`idx_memory_items_active_lookup`, `uq_memory_items_active_text`).
2. New columns: `disputed_at timestamptz`, `dispute_count int not null default 0`,
   `restorable_until timestamptz` (set on retire/supersede to `now() + 30 days`).
3. `memory_events.event_type` gains `dispute`, `restored`, `gate_blocked`,
   `verifier_rejected`; payload carries `{verdict, confidence, quote, cosine, model}`.
4. New RPCs (service role only): `dispute_memory_item(p_id, p_patch)`,
   `restore_memory_item(p_id, p_user_id)`, `resolve_disputes()` (nightly:
   expire disputes older than N days back to active).
5. `fetch_memories_for_turn`: `status IN ('active','disputed')` in `eligible`;
   returns a new `disputed_at` column; `formatMemoryLine` renders it.
6. Backfill: none required. Existing retired rows get `restorable_until = updated_at + 30 days`
   so recent retirements (including the eight done by hand on 10-27) are
   restorable from the panel.

Rollout order (each step independently deployable and reversible):

1. Apply the migration (additive; old functions keep working).
2. Deploy `chat-turn` with the verifier in **shadow mode** (§f). No behaviour change.
3. Review shadow disagreement for a week; calibrate `T_related` and the confidence floor.
4. Turn enforcement on for thread ops (the measured failure), then for fact ops.
5. Deploy `memory-mutate` `restore` and the panel list.
6. Remove `memoryRelatesTo` from the thread path once the gate is enforcing (keep the function; it is cheap and useful in the extractor-eval report).

Rollback is a flag flip (`MEMORY_VERIFIER_MODE = off | shadow | enforce`),
not a migration.

## f. Shadow mode and disagreement measurement

In shadow mode the extractor's ops are applied exactly as today, and for each
destructive op the write path additionally runs the verifier and the gate and
logs a `memory_events` row `event_type = 'shadow_verdict'`:

```json
{ "op": "retract|update|close", "target_kind": "thread",
  "verdict": "unrelated", "confidence": 0.82, "quote": "…", "cosine": 0.14,
  "protected": true, "would_have": "blocked|disputed|applied", "applied": true }
```

Disagreement is measured weekly from those rows:

| metric | definition | target before enforcing |
|---|---|---|
| block rate | ops with `would_have = blocked` / destructive ops | report only; expect 5–15% from the probe data |
| false block rate | blocked ops a human marks as correct corrections (sample 30/week in `/admin/memory-proposals`, new tab) | < 5% |
| missed destruction | applied ops a human marks wrong, where verdict was `contradicts` | < 2% |
| dispute rate | protected rows that would have been disputed rather than retired | report only |
| verifier/gate conflict | verifier `contradicts` with cosine below `T_related` | each one reviewed; calibrates b |
| latency | p50/p95 added ms per turn (verifier runs after the reply is sent, in the extraction step) | p95 < 1.5 s added to extraction, 0 added to the reply |

The human labels come from the existing proposals queue: shadow rows with
`would_have != applied` are surfaced there as read-only "verifier disagreed"
items with the quote and both texts. The handoff's open question
(`b8e24ec9`, "retired by the extractor") is exactly the kind of row shadow mode
would have logged as `contradicts`, confidence high, applied: a correct
retraction, visible as such.

Exit criteria for enforcement: two consecutive weeks with false block rate
< 5% and no missed destruction in the sample, and the contradiction suite at
the §h targets.

## g. Cost per turn

Measured with the reference implementation (`claude-haiku-4-5`, see §h for the
exact numbers from the run):

- Verifier: one short call per destructive op, measured ~1,250 tokens
  (tool schema and system prompt dominate; cacheable) and ~1.25 s. Destructive ops are rare: in the 10-26 live data 3 corrections and
  5 closes over 20 traced turns, i.e. well under one per turn on average; the
  worst realistic case is a correction message touching 3–4 rows.
- Embedding the quote: piggybacks on the batch call that already embeds new
  facts (one request per turn either way).
- Added latency is in the post-reply extraction step, so the user-visible reply
  time is unchanged.
- Token cost per turn at Haiku pricing is a rounding error next to the
  extractor's own ~2,300-token call; the budget to watch is **calls per turn**,
  capped at 6 verifier calls (further ops are queued as proposals, never
  dropped silently).

No new storage beyond the events rows (~300 bytes each).

## h. Baselines from the frozen suites (2026-10-27)

Filled from `scripts/memory-eval/results/contradiction_2026-10-27.md` and
`results/results_synthetic_2026-10-27.md`; see the README for how to re-run.

### Contradiction suite (100 cases, 2 runs each, 238 row-judgements)

Production extractor (`claude-haiku-4-5`, the prompt on `main`) and the reference
verifier (`claude-haiku-4-5`, prompt in `run_contradiction_suite.mjs`):

| category | rows | verifier accuracy | expected contradicts | extractor acted | verifier caught | protected rows the extractor would retire on one signal |
|---|---|---|---|---|---|---|
| explicit | 54 | 96% | 40 | 40 | 40 | 10 |
| implicit | 48 | 98% | 44 | 41 | 43 | 2 |
| negated | 40 | 100% | 24 | 24 | 24 | 2 |
| temporal | 40 | 100% | 26 | 26 | 26 | 18 |
| unrelated | 56 | 100% | 0 | 0 | 0 | 0 |
| **all** | 238 | **99% (235/238)** | 134 | 131 | 133 | 32 |

- **Destructive ops on unrelated rows.** The extractor *proposed* a close or
  update on 4 of 72 unrelated rows (all on the grief message, U02); chat-turn's
  `memoryRelatesTo` guard dropped all 4 because the quoted evidence shared no
  word with the thread. With the verifier in front, **0 of 72** regardless of
  the guard. In an earlier single run, 2 of those proposals were `update` ops
  whose new topic repeated the thread's own title, which the guard's new-text
  check would let through; the verifier rejected both. That is the hole the
  verifier closes and the word-overlap guard cannot.
- **Misses.** Verifier: one resolved thread judged `entails` (I19, 1 of 2 runs)
  and one `entails` judged `unrelated` (X05 B, "I'm not an author, I just read a
  lot" against "User enjoys mystery novels"). Neither can cause data loss (an
  `entails` miss only skips a confirmation; the I19 miss blocks one correct
  close, which the two-signal path still allows later). Extractor: missed 3 of
  134 contradictions (all implicit); the verifier caught 2 of those 3 when
  asked, which is why §f logs verifier verdicts for *all* retrieved rows in
  shadow mode, not only for proposed ops.
- **Two-signal rule.** 32 of the 134 correct contradictions target a protected
  row (user-stated, confirmed twice or older than 7 days); today each would be
  retired on the spot. Under §c they become `disputed` until a second signal.
  18 of the 32 are `temporal` (ended states such as "parents are visiting",
  "has the flu"), where a 14-day disputed window costs little.
- **Cost (measured).** Extractor call: ~1,980 tokens, 1.5 s. Verifier: ~1,250
  tokens and 1.25 s per (row, message), most of it the tool schema and system
  prompt, so prompt caching will cut the token count by roughly 70% in
  production; latency is on the post-reply extraction path.

### Synthetic retrieval (157 turns, v3 engine via the validated mirror)

**121 / 157 pass, 18 zero-tolerance violations**, all `inject_denied_fact`
(0 expired rows injected: the SQL `valid_until` filter works). Failure groups:
denied facts still active next to their correction (18 ZT), identity facts older
than the 500 most recently updated rows in the 619-row pair (D02, D05, D19,
D20, S05, S12 and the two dumps), paraphrased questions with no shared stem
(A17, A28, C22), stale rows named in the query (A30, B19), and a temporary
state with no expiry asked about 45 days later (E03). The belief-revision layer
removes the first group at its source (the correction retires or disputes the
denied row); the other groups are retrieval work listed in the review.

## Targets ("A" for this layer)

- Contradiction suite: verifier verdict accuracy ≥ 95% overall and ≥ 90% on
  `implicit` and `temporal`; **0 destructive ops on `unrelated` rows after the
  gate** (zero tolerance); ≥ 90% of expected contradictions acted on
  (extractor proposed and verifier confirmed); 0 protected rows retired on a
  single signal.
- Synthetic retrieval: **0 zero-tolerance violations** (denied or expired
  rows injected), ≥ 95% pass overall, every time-shifted case passing.
  Retrieval changes needed for that are out of scope here and listed in the
  review (findings 2, 7, 8, 10); the belief-revision layer removes the
  *source* of denied rows, the retrieval work removes the remaining stale
  ones.
- Both suites run in CI against a scratch Postgres built from the migrations
  (`memory_engine.test.sql` preamble + `run_eval.mjs --emit-load-sql`), so the
  repo and production cannot drift apart unnoticed again.
