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
| `synthetic/contradiction_suite.json` | 141 belief-revision cases: explicit, implicit, negated, temporal, unrelated (20 each) plus 41 targeting the review's gaps: past episode, other person, conditional / question, reported speech, sarcasm, quoted text, misplaced correction, fresh row (< 24 h), young row (1–7 d), thread mention. Every row carries its protection state and expected outcome. |
| `run_eval.mjs` | Retrieval runner: real `fetch_memories_for_turn` (or the validated `--mirror`) + the real `selectMemories()`; scores and reports zero-tolerance violations. |
| `run_contradiction_suite.mjs` | Runs the production extractor and the **shipping** verifier module (`memoryVerifier.ts`: prompt, `isProtectedRow`, `isExplicitCorrection`, `decideRevision`) over the suite; reports verdict and outcome accuracy, destructive ops applied to unrelated rows, cost. `--check` validates suite and wiring without model calls. Writes nothing. |
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
# no model calls: suite consistency, protection states, decision table, prompt rules, age_days/source wiring
node --experimental-strip-types scripts/memory-eval/run_contradiction_suite.mjs --check --verifier-ref origin/memory/revision-safety

# full run (costs model calls; never points at production data)
ANTHROPIC_API_KEY=... node --experimental-strip-types scripts/memory-eval/run_contradiction_suite.mjs \
    --verifier-ref origin/memory/revision-safety [--runs 3] [--embed] [--only M01,F03]
```

The runner imports the verifier from `supabase/functions/_shared/memoryVerifier.ts`
(the checkout's copy, or `--verifier-ref <git ref>` / `--verifier <path>` when, as on
this branch, the checkout has none) and calls `verifyMemory` with each row's `age_days`
and `source`, exactly as chat-turn does. There is no copy of the prompt in the runner.

For every stored row the verifier must return a verdict in the case's `expected.accept`
list (usually just the expected verdict; a few sarcasm cases accept `unrelated` as well
as `entails`). `expected.outcome` is what `decideRevision` must do with a confident
`contradicts` on that row, on this message alone: `apply` (retire / supersede / close),
`dispute` (flag only) or `none`. Rows are labelled `protected` (user-stated, confirmed
twice or older than 7 days), `fresh` (under 24 hours, protected as well) or `young`
(1–7 days, the only kind one message may retire). Zero tolerance: any destructive op
applied to an `unrelated` row fails the run. The runner also reports what the rules
alone would do on unrelated rows, since the deployed eval function may run only the
verifier.

Cases expected to be hard for the shipping prompt (see the PR description for why):
Q01, S01–S03, T21, Y03, M03, C01, P01, O01; and F02, T24, M01, M04 are deliberate
costs of the fresh-row and two-signal protections, not verifier errors.

## Baselines

| set | engine | result |
|---|---|---|
| real-data retrieval (41) | v3, SQL stage saved 2026-10-26, no vectors | 28/41 |
| real-data retrieval (41) | v3, `--mirror` pinned to the same time | 28/41 (same failing set) |
| synthetic retrieval (157) | v3, `--mirror`, as of 2026-11-01 | **121/157, 18 zero-tolerance violations** (all `inject_denied_fact`; 0 expired rows injected) |
| contradiction suite (100 of the 141) | production extractor + first-draft verifier prompt | 99% verdicts, 0 destructive on unrelated (`results/contradiction_2026-10-27.md`, spec §h). **Stale**: the shipping prompt and the 41 new cases have not been run yet. |

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
