# Memory engine evals

Two kinds of eval live here: a **retrieval** eval (what a chat turn injects) and a
**belief-revision** eval (what the write path does to stored memories). Each has a
small real-data set (ids anonymised) and a larger frozen synthetic set (invented data,
safe to publish). `docs/memory-engine-v4-spec.md` is the design they measure against.

| file | purpose |
|---|---|
| `eval_set.json` | 41 retrieval turns drawn from real conversations (2026-10-26). All ids are synthetic; see Privacy. |
| `fixtures/memory_items_2026-10-26.json` | Snapshot of the rows those cases refer to. |
| `synthetic/generate.mjs` | Deterministic generator for everything under `synthetic/`. Edit the tables in it, never the JSON. |
| `synthetic/fixture_synthetic.json` | 710 invented rows, 6 users, 11 companions; `DEV_FRIEND` holds 619 rows (the scale pair). Relative timestamps. |
| `synthetic/eval_retrieval_synthetic.json` | 157 retrieval turns (31 time-shifted, 47 with zero-tolerance expectations). |
| `synthetic/contradiction_suite.json` | 100 belief-revision cases: explicit, implicit, negated, temporal, unrelated (20 each). |
| `run_eval.mjs` | Retrieval runner: real `fetch_memories_for_turn` (or the validated `--mirror`) + the real `selectMemories()`; scores and reports zero-tolerance violations. |
| `run_contradiction_suite.mjs` | Runs the production extractor and the proposed verifier over the suite; reports verdict accuracy, destructive ops on unrelated rows, two-signal routing, cost. Writes nothing. |
| `run_extractor_eval.mjs` | Older write-path probe over the real-data fixture. |
| `lib/extractor_prompt.mjs` | Verbatim copy of chat-turn's extractor tool + prompt (`--check` diffs it against chat-turn). |
| `lib/pg_english.mjs` | JavaScript mirror of `to_tsvector('english')` (parser, stop list, Snowball stemmer), validated by `lib/pg_english.test.mjs` against 886 real Postgres outputs. |
| `extractor_cases.json` | 8 invented cases for `supabase/functions/extractor-eval`. |
| `results/` | Baselines: saved SQL-stage output and dated reports. |
| `REVIEW_2026-10-26.md` | The adversarial review this work answers. |
| `memory_engine.test.sql` | SQL regression for the migrations (scratch Postgres). |

Needs Node ≥ 22.6 (`--experimental-strip-types` imports `memoryEngine.ts` directly).

## Retrieval

```
# real-data set, saved SQL output (reproduces 28/41)
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --candidates scripts/memory-eval/results/candidates_2026-10-26.json

# synthetic set, no database needed (JS mirror of the SQL stage; reproduces the SQL stage exactly on the real-data set)
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --synthetic --mirror --as-of 2026-11-01T12:00:00Z

# synthetic set against a real Postgres: build a scratch DB with memory_engine.test.sql, load one shift at a time
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --synthetic --emit-load-sql --shift-days 0 | psql scratch
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --synthetic --db-url postgres://.../scratch --shift-days 0

# live project (never loads synthetic rows into production)
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --supabase [--embed]
```

Expectation keys: `include`, `include_any`, `exclude`, `exclude_users`, `no_relevant`,
`max_relevant`, `max_dupes`, `rank_before`; synthetic cases add `shift_days` (asked
that many days after the fixture's `as_of`) and `zero_tolerance` (`inject_denied_fact`,
`inject_expired_fact`). The runner also flags any selected row whose `valid_until` has
passed, whether or not a case lists it.

## Belief revision

```
ANTHROPIC_API_KEY=... node --experimental-strip-types scripts/memory-eval/run_contradiction_suite.mjs [--runs 3] [--embed]
```

For every stored row the verifier must say `entails`, `contradicts` or `unrelated`.
Zero tolerance: any destructive op (retract, update, close) on an `unrelated` row fails
the run. Rows marked 🔒 are protected by the two-signal rule (user-stated, confirmed
twice, or older than 7 days): one message may mark them disputed, never retire them.

## Baselines

| set | engine | result |
|---|---|---|
| real-data retrieval (41) | v3, SQL stage saved 2026-10-26, no vectors | 28/41 |
| real-data retrieval (41) | v3, `--mirror` pinned to the same time | 28/41 (same failing set) |
| synthetic retrieval (157) | v3, `--mirror`, as of 2026-11-01 | **121/157, 18 zero-tolerance violations** (all `inject_denied_fact`; 0 expired rows injected) |
| contradiction suite (100) | production extractor + reference verifier | see `results/contradiction_2026-10-27.md` and the spec §h |

Synthetic failures group into: denied facts still active (18 ZT violations: the
correction row exists but the denied row is not retired, so recency or a shared word
brings it back), identity facts older than the 500 newest rows in the scale pair (D02,
D05, D19, D20, S05, S12 and the dumps), lexical misses on paraphrased questions (A17,
A28, C22), stale rows named in the query (A30, B19), and a stale temporary state with
no expiry (E03). None of these is fixed by retiring rows by hand; they are the
mechanisms the v4 spec targets.

## Privacy

`eval_set.json` and its fixture started as a snapshot of production rows; every id was
replaced with a synthetic one before commit. Everything under `synthetic/` is invented.
Do not commit a fresh production snapshot with real ids or real text.
