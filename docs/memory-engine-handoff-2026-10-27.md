# Memory engine: what was done in response to the adversarial review (2026-10-26/27)

For the reviewing agent to assess. Branch `claude/eager-turing-cv6622`. No PR opened yet. No real memory text is
reproduced here; rows are referred to by 8-character id prefix.

Review being answered: "Semantic memory engine adversarial review" (session `session_01B6DQuyKmUKqM8Ar9PYuLFa`,
branch `claude/dazzling-cori-w15pga`, never pushed). Its 13 findings and a 41-case retrieval eval were recovered from
that session's transcript.

## 1. State of production before any work

- v2 and v3 migrations were applied by hand. `main` carried v2 only; production ran v3 from an unmerged branch.
- Neither migration was recorded in `supabase_migrations.schema_migrations`.
- 0 of 47 active `memory_items` had an embedding; 0 superseded rows in 17 days; 0 companion summaries; `recall_count` 0.

## 2. Reconciliation (done)

- PR #63 merged v3 into `main` (`bf8f561`). `scripts`/docs/migrations on `main` now match production (all 9 v3 SQL
  function bodies hashed equal to the migration file, ignoring whitespace).
- Recorded in `schema_migrations`: `20261030100000` memory_engine_v2, `20261031100000` memory_engine_v3, and four other
  migrations that had run but were unrecorded (`20261024130000`, `20261024140000`, `20261027120000`,
  `20261029120000`), plus `20261027140000` push_notifications after it was run. Done by inserting rows, not by
  `supabase migration repair`.
- Write RPC lockdown verified live: `anon` and `authenticated` cannot execute upsert/supersede/forget/clear/scrub/
  retire/claim/update_recall; only `service_role` can.

## 3. Findings re-checked against production

| Review finding | Result |
|---|---|
| 1 Embeddings never written | Confirmed (0 of 47). Fixed, see 4. Cause not proven. |
| 2 Relevance gate almost never fires | Not changed yet (scoring untouched). |
| 3 Denied fact is global and uncorrectable | Data fixed by hand; code fix not done. |
| 4 Extractor misses implicit corrections | Probed (see 6): not reproduced on invented cases; prompt line added, unproven. |
| 5 Extractor closes/rewrites unrelated threads | Reproduced for thread UPDATE (see 6); guard added. |
| 6 Repo is not production | Closed (PR #63 + schema_migrations). |
| 8 Stale temporary facts | One stale row retired by hand; extractor expiry untouched. |
| 7, 9, 10, 11, 12, 13 | Not addressed. |

## 4. Embeddings

- The `OPENAI_API_KEY` secret existed (set 2026-02-05) and the key had $9 credit. OpenAI usage history showed
  **no embedding requests before 2026-10-27**, so requests never reached OpenAI (a failed key or empty balance
  would normally still appear). Root cause NOT established: the likeliest explanation is that the previously deployed
  function versions never made the call (the functions were redeployed to v3 at ~22:47 UTC on 10-26), but that is
  inference. An earlier theory (empty balance) was wrong.
- A diagnostic edge function (`embedding-check`) proved: the secret has no whitespace/quotes, an embeddings call
  returns 200 with 1536 dims, and running dream-hygiene's exact embed step succeeded for 44/44 rows.
  Result: **44/44 active rows embedded** (`text-embedding-3-small`).
- Automatic path verified: after a real chat turn, 4 new/updated rows were written with embeddings and the first
  production supersede occurred. Not yet verified: tonight's 03:00 UTC `dream-hygiene` run.
- Code: `embedTexts` (`_shared/memoryEngine.ts`) still returns null on failure but now logs the reason (missing key,
  OpenAI status + error code such as `insufficient_quota`, bad size, timeout). Never logs the key or text. Tested.
  **Not yet deployed** to `chat-turn` / `dream-hygiene`.

## 5. Data changes made in production (all reversible status changes, via direct UPDATE as service role)

Retired (`status='retired'`), 8 rows:
- `efd7fb30` global fact: the user denied twice; injected into every companion.
- `44edef98` fact: stale temporary state, no expiry.
- `77b1c5a7`, `baa86556`, `24f5007a` facts and `e9c1e030` thread: authorship claims the user denied.
- `522f5b7a` fact and `b3ed24ed` thread: "plans to read the series", superseded by completion.

Step 0 finding (corrects an earlier version of this note): fact `b8e24ec9` ("user finished the series") was retired
by the extractor at 00:37 UTC on 10-27 (`memory_history`: op UPDATE, actor `extractor`, no proposal), and that was
a **correct** retraction. The owner approved reading the one message: the stored correction event's evidence is
"I didn't finish the whole series yet", so the fact was false. It is not an example of a wrongful retirement.
Consequence: `522f5b7a` and `b3ed24ed` ("plans to read the series") were retired at 00:59 on the premise that the
series was completed. That premise was wrong (the user had said otherwise at 00:37). Impact is low, since both are
redundant with active rows `b93f6f3e` and `89da6782`, but they can be restored (status change, needs owner OK).

## 6. Code changes (commit on the branch)

`supabase/functions/_shared/memoryEngine.ts`:
- `memoryRelatesTo(memory, ...texts)`: true if the user's words share at least one stemmed content word with the
  memory. Tested (3 vitest cases).

`supabase/functions/chat-turn/index.ts` (extractor, not yet deployed):
- Thread `close` and thread `update` are dropped unless the evidence/new text relates to the thread
  (`memoryRelatesTo`).
- Extractor prompt: added "check every stored memory against what the user says, even when they don't say wrong;
  if several stored memories assert the same wrong thing, update or retract each"; thread-close line now says a
  message about something else never closes a thread.
- **Reverted after measurement:** a relevance guard on fact `retract` and fact `update`. The probe showed it
  blocked a correct retraction (the extractor retracting "User is an author" on "I'm just reading the series": no
  shared word, the link is semantic). Fact ops are therefore ungated, as before.

Probe (`supabase/functions/extractor-eval`, cases in `scripts/memory-eval/extractor_cases.json`, invented data,
8 cases x 2 prompts x 2 runs, `claude-haiku-4-5` forced tool use):
- Implicit correction (3 wrong stored rows): both prompts acted on 1 of 3 rows (F1 update/retract) and attempted
  a retract on the global "is an author" row; neither touched the third. New prompt did not differ from old.
- Off-topic message (new sister / flight): no closes in either prompt.
- Grief message with 2 unrelated open threads: **both prompts, all runs, issued `update` on both unrelated
  threads** (the guard blocks these). This is the reproduced part of finding 5.
- Real close ("I finished the series!"): update fact + close thread, correct in all runs.
- Plain correction, restatement, filler: correct in all runs.
- Caveat: only 2 runs per cell, 8 invented cases; the review's real-data cases (13 turns) were not re-run.

## 7. Eval harness (committed, ids anonymised)

`scripts/memory-eval/`: 41-case retrieval eval (`eval_set.json`), fixture snapshot, `run_eval.mjs`,
`run_extractor_eval.mjs`, saved candidates, `REVIEW_2026-10-26.md`, README. All uuids and the project ref were replaced
with synthetic ones (deterministic uuid5); the anonymised copy reproduces the original baseline exactly (28/41).
Real-id copies were kept out of git (the repo is **public**; this was verified and flagged to the owner).

`supabase/functions/memory-eval-run` scores the cases on the server against live data and returns only pass/fail and
8-char ids (never memory text). Its `engine.ts` is a copy of the selection helpers in `memoryEngine.ts`; refresh it when
that file changes.

### Retrieval scores (live)
| Point in time | Score | Failing |
|---|---|---|
| Review baseline (10-26, no vectors) | 28/41 | F01 F03 F05 F06 F09 F10 F13 F16 M04 M05 M11 R01 R03 |
| After retiring `efd7fb30`, `44edef98`, embedding all rows | 32/41 | F01 F02 F03 F05 F06 F09 F10 F13 F16 (same with and without query vectors) |
| After retiring 6 more wrong/stale rows | 38/41 | F02 F05 F13 |

Remaining failures: F02 and F13 expect `b8e24ec9` to be retrieved, but it is now correctly retired, so those two
expectations are stale (the eval has no as-of/time dimension; Fable's eval should add one). F05 ("in the mood
for some ice cream") selects 5 rows scored relevant against a limit of 2. The gain from 28 to 38 came from data
cleanup, not scoring changes; retrieval scoring (findings 2, 7, 8, 10) is untouched.
With vectors the relevance scores shift a lot (e.g. the correct series row from ~0.4 to 0.96) but the pass set did
not change until the data was cleaned.

## 7b. Deployed test functions in production (outside the repo's normal deploy)
`embedding-check` (diagnostic + embedding backfill), `memory-eval-candidates` (superseded), `memory-eval-run`,
`extractor-eval`. All reject callers that don't present the service credential. `embedding-check` and
`memory-eval-candidates` should be deleted; the latter two are committed to the repo.

### Frozen baseline (step 0, 2026-10-27, counts only)
- Retrieval eval live: 38/41 (F02, F13 stale expectations; F05 real).
- `memory_events`: correction 4, correction/retracted 1, correction/updated 1, reference 22, thread_closed 5.
- `memory_history` destructive ops: extractor to retired 14, extractor to superseded 3, dream to retired 4.
- `memory_items`: facts active 28 / retired 10 / superseded 1; threads active 13 / retired 9 / superseded 2.
- All 46 active rows have embeddings.

## 8. Not done / open for the reviewer
1. Retrieval scoring: rarity-weighted lexical relevance, relative gate, MMR normalisation, 500-newest candidate window,
   background tier (findings 2, 7, 8, 10).
2. Corrections following visibility: a correction in one companion's chat can't reach the other companions' copies
   (finding 3's mechanism); deterministic supersede from analyzer correction events (finding 4's fallback).
3. Hygiene: dedupe keys from `content_tsv`, forced tool use for its LLM pass, protecting goal rows (finding 9).
4. Fact retractions by the extractor are ungated: `b8e24ec9` turned out to be correct, but nothing verifies a
   retraction in general. Options: a verifier call, a second consistent signal, or proposals for reinforced rows.
5. Third-party/sensitive data (`sensitivity` column, scrubbing `memory_proposals.rationale`), companion summary
   trigger by time, trace observability (findings 11, 12, 13).
6. 20 pending proposals still await a human decision.
7. Deploy: `chat-turn` and `dream-hygiene` need redeploying for the logging and guard changes.
8. Verify tomorrow: the 03:00 UTC hygiene run keeps rows embedded.

## 9. Things the reviewer should challenge
- Is retiring rows by hand the right way to lift the eval score, given it measures data state, not code?
- Is `memoryRelatesTo` (single shared stemmed word) too weak or too strict for thread ops?
- Is the embedding root-cause explanation (older deployed functions never made the call) correct? The functions'
  prior deployed source was not inspected.
- Does the eval overfit to one conversation pair (the book series accounts 18 of 41 cases)?
