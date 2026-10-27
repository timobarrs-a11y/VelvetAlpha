# Memory engine evals

| file | purpose |
|---|---|
| `eval_set.json` | 41 retrieval turns with expectations, drawn from real conversations (2026-10-26). All ids are synthetic; see Privacy. |
| `fixtures/memory_items_2026-10-26.json` | Snapshot of all `memory_items` rows the cases refer to. Refresh it when the data changes; the runner refuses ids it cannot find. |
| `run_eval.mjs` | Runs each turn through the real SQL function and the real `selectMemories()`; scores and writes `results/results_<date>.{md,json}`. |
| `run_extractor_eval.mjs` | Offline write-path probe: runs chat-turn's extractor prompt against fixture rows and simulates the guards. Writes nothing. |
| `results/` | Baseline runs and the saved SQL-stage output used for them. |
| `REVIEW_2026-10-26.md` | The adversarial review: findings, evidence, proposed fixes, how to test each fix. |
| `memory_engine*.test.sql` | SQL regression for the migrations (scratch Postgres). |

Needs Node ≥ 22.6 (`--experimental-strip-types` imports `memoryEngine.ts` directly).

```
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --emit-sql            # SQL for the candidate stage
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --db-url "$DATABASE_URL"
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --supabase [--embed]   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
node --experimental-strip-types scripts/memory-eval/run_eval.mjs --candidates results/candidates_2026-10-26.json
ANTHROPIC_API_KEY=... node --experimental-strip-types scripts/memory-eval/run_extractor_eval.mjs --runs 3
```

Expectation keys per case: `include`, `include_any`, `exclude`, `exclude_users`,
`no_relevant`, `max_relevant`, `max_dupes`, `rank_before`. See the `_about`
field in `eval_set.json`.

## Privacy

These files started as a snapshot of production rows. Every id (users, companions, memory rows, events, project reference) was replaced with a synthetic one before they were committed, and results are identical (28 of 41 pass). Do not commit a fresh snapshot with real ids: anonymise it the same way, or keep it out of git.

## Baseline

v3 engine against `results/candidates_2026-10-26.json`: **28 of 41 pass**. Failing: F01 F03 F05 F06 F09 F10 F13 F16 M04 M05 M11 R01 R03. `results/results_2026-10-27.md` has the per-case injected lists.

## Live baseline (2026-10-27, after retiring two wrong rows and embedding every active row)

Scored on the server by `supabase/functions/memory-eval-run` (returns only pass/fail and 8-character ids, never memory text).
**32 / 41 pass**, with or without query vectors. Failing: F01 F02 F03 F05 F06 F09 F10 F13 F16, all in the book-series pair.
The remaining failures are mostly data the extractor should have corrected (denied authorship rows and a stale plan row
still active), not retrieval scoring; see REVIEW_2026-10-26.md findings 3, 4 and 8.
