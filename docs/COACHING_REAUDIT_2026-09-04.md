# Velvet Coaching Re-audit (2026-09-04)

**What changed since the first audit:** one commit on `main`, `00e7e09` "Fix Phase 0 bugs and coach persona", touching seven files: `goal-discovery-chat`, `chat-turn`, `_shared/personaBuilder.ts`, `consolidate-memory`, `summarize-memory`, `summarize-session`, and a new `supabase/config.toml`. No client files, no migrations, no tests. The other remote branches are all older forks of `main` and contain none of this work.

**Method:** merged `origin/main` into the audit branch, re-read every changed file, traced each of the original 26 findings against the merged tree, and re-ran typecheck, lint, and tests.

---

## 1. Verdict

**Still not release-ready.** Of the five blockers, one is fully closed (B1), two are partly closed (B3, B5), and two are untouched (B2, B4). Two high findings are closed (H1, H2), one is closed in a way that disables the feature (H4), and four remain open. The fix also introduced four new problems, one of which is user-visible on every coach reply that uses formatting.

| Bucket | Closed | Partial | Open |
|--------|--------|---------|------|
| Blocking (5) | B1 | B3, B5 | B2, B4 |
| High (7) | H1, H2 | H4 | H3, H5, H6, H7 |
| Medium (8) | none | none | M1–M8 |
| Low (4) | L4 | L1 | L2, L3 |

---

## 2. Finding-by-finding status

### Blocking

**B1 · Goal discovery API call — CLOSED.**
`goal-discovery-chat/index.ts` now passes `SYSTEM_PROMPT` as the top-level `system` parameter and maps only `user`/`assistant` roles into `messages`. This is the correct fix. No replay test was added, so the regression can recur silently; see B4.

**B2 · Missing `core_memories` / `session_summaries` / `match_memories` — OPEN.**
No migration was added. The three functions that write these tables were given auth checks (B5) but still target tables no migration creates. `contextAssembler.ts:28,64` still reads them on the legacy path. Decision still pending: ship migrations or delete the consumers.

**B3 · Commitment lifecycle — PARTIAL.**
The signal detector now returns a `commitmentUpdate` (completed / missed / renegotiated) and `chat-turn:700-714` applies it. That is the right shape. Four gaps remain:
- The detector never sees the stored commitments. It guesses `matched_description` from the last six messages and the update runs `ilike '%<guess>%'` against `description`. The stored text came from a different Haiku call, often days earlier and outside the six-message window, so the substring match will miss whenever wording differs ("run Tuesday" vs "go for a run on Tuesday"). Fix: pass the open commitments with ids into the detector prompt and have it return `commitment_id`.
- `completed_at` is never set, so completion timing is lost.
- Errors on the update are swallowed by `.catch(() => {})`, and the update chains `.limit(1)`, which PostgREST may reject on PATCH depending on version. If it does, the update silently no-ops forever. Log the error and drop the limit (or match by id).
- No overdue sweep and no reconciliation prompt when a due date passes without a report. Stale `pending` rows still accumulate.

**B4 · No green gate — OPEN, slightly worse.**
- Typecheck: 25 errors (same families as before, plus `AtlasCanvas.tsx` and `PricingPageRoute.tsx`).
- Tests: `chatService.test.ts` and `companionService.test.ts` still cannot load (Supabase env vars).
- Lint: 2 errors. The unused `goalText` in `sync-coach` remains, and the fix added a `prefer-const` error at `chat-turn/index.ts:801` (`let query` is never reassigned).

**B5 · Unauthenticated edge functions — PARTIAL.**
`consolidate-memory`, `summarize-memory`, and `summarize-session` now verify the JWT and require `user.id === user_id`. A `supabase/config.toml` sets `verify_jwt` per function. Remaining gaps:
- `verify_jwt = true` accepts the project's anon key, which is itself a valid JWT. It blocks unauthenticated calls, not anonymous ones. `generate-embedding`, `analyze-conversation`, and `morning-brief` still bind no user and can be driven with the public anon key alone for model spend.
- `embed-session`, `backfill-embeddings`, and `process-scheduled-callbacks` are explicitly `verify_jwt = false`. `backfill-embeddings` runs paid OpenAI embeddings across every user's `relationship_memories` and is now callable by anyone. Gate cron-only functions with a shared secret header.
- `config.toml` opens with `[project_id]` / `project_ref = ""`, which is not the Supabase CLI's schema (`project_id = "..."` is a top-level key). Confirm the CLI accepts the file; if it does not, none of the `verify_jwt` settings apply. These settings only take effect through CLI deploys, not dashboard edits.
- Regression: the client still calls `summarize-memory` and `summarize-session` with the anon key as the bearer (`contextAssembler.ts:214,232`). Those calls now always return 401. They sit on the legacy send path, so nothing user-visible breaks today, but the summarization trigger is dead until the client sends the session token.

### High

**H1 · Coaches inherit companion texting DNA — CLOSED on the edge.**
`personaBuilder.ts` now has a mentor branch: no texting rhythm, no "stay in character," no zodiac or favorite color, a coaching trait block, and a response rule of "as long as it needs to be, use markdown." `chat-turn` mirrors the length rule for mentors. Two follow-ons:
- The output budget for mentors is still `max(tier, 600)` tokens (`chat-turn:1001`). A free-tier coach now writes structured, multi-block answers into a 600-token ceiling, and the max-tokens trimmer cuts to the last sentence, which can slice a code block in half. Raise the mentor floor to 1200 and to 1500 when the user message contains a code fence.
- The client-side `systemPromptBuilder.ts` still injects the companion rules for mentors, but that is the legacy path only.

**H2 · Model routing — CLOSED.** Mentors get Sonnet regardless of message length. The log line still omits `isMentor`; cosmetic.

**H3 · Domain coverage (IT, language, fitness) — OPEN.** No catalog or schema changes.

**H4 · "Verified" facts leak across companions — CLOSED BY DISABLING.**
Facts for mentors are now filtered to rows whose companion is a mentor, and the row threshold rose from 0.4 to 0.6. The leak is gone. But `enhancedInsightsService.ts`, the only live writer of `user_insights`, never sets `confidence_score`, so every row carries the column default of 0.5 and fails the new threshold. `memoryBus.writeUserFact` (which writes 0.6) has no callers. Net effect: `[VERIFIED USER FACTS]` is empty for every coach. Fix: have the insights writer set `confidence_score` from the per-fact confidence it already computes (it filters at 0.6 but discards the number), and only label `[VERIFIED]` after user confirmation or a second sighting.

**H5 · Two onboarding paths fight each other — OPEN.** `sync-coach` still assigns a random name and gender; `IntentSelectPage` still hides "Coaches" when a mentor exists; `SignatureVoiceSelectionPage:85` can still create a second mentor.

**H6 · Proactive coaching only while the app is open — OPEN.** No scheduler, no delivery worker, `checkPendingMessages` still has no caller.

**H7 · Safety controls fail open — OPEN.**

### Medium

**M1** edge expert one-liners — OPEN. **M2** premium gating — OPEN. **M3** `coaching_sessions` never written — OPEN. **M4** discovery output lossy — OPEN. **M5** signal detection awaited (`chat-turn:1324-1326`) — OPEN. **M6** no history bridge — OPEN. **M7** chat cannot render markdown — OPEN, and now interacts with H1 (see N1). **M8** GDPR export — OPEN.

### Low

**L1** — PARTIAL: duplicate "Marcus" and the unused `goalText` remain. **L2** junk files (`lint_full.txt`, `scr_errors*.txt`, `.env.production`) — OPEN. **L3** UTC due-date math — OPEN. **L4** commitments from non-coach companions — CLOSED (`isMentor` guard on insert).

---

## 3. New issues introduced by the fix

**N1 · Coach replies will show raw markdown.** *User-visible on every formatted reply.*
The mentor persona and `chat-turn` now instruct coaches to "use markdown, lists, headers, and fenced code blocks." `ChatMessage.tsx:108` renders companion and coach messages as a plain `<span>{message.content}</span>`; only Atlas, Navi, and calendar cards go through `AtlasMarkdown` (lines 192, 258). Coaches will emit `**bold**`, `- lists`, and triple-backtick fences that display as literal characters. Fix: route `bot_source === 'companion'` messages from mentor companions through `AtlasMarkdown` (or a coach-specific renderer), or remove the markdown instruction until the renderer lands.

**N2 · Facts block is effectively disabled.** See H4.

**N3 · Client summarization triggers now always 401.** See B5. Dormant path today, but it means the memory tier cannot be re-enabled without a client change.

**N4 · Commitment updates can fail silently.** See B3: swallowed errors plus a fragile substring match plus a possibly rejected `.limit(1)` on PATCH.

**N5 · Lint regression.** `prefer-const` at `chat-turn/index.ts:801`.

**N6 · `config.toml` schema.** `[project_id]` table with `project_ref` is not the CLI format; verify before relying on `verify_jwt`.

---

## 4. Build health on the merged tree

| Check | First audit | Now |
|-------|-------------|-----|
| `npm run typecheck` | fails | fails, 25 errors |
| `npx vitest run` | 1 of 3 suites loads | 1 of 3 suites loads |
| `npm run lint` | 1 error | 2 errors |

---

## 5. What to do next, in order

1. **N1** Render markdown for mentor messages, or pull the markdown instruction. One-hour fix, and it is the only thing a user sees.
2. **B3** Feed open commitments with ids into the detector; match by id; set `completed_at`; log update errors; add the overdue sweep.
3. **H4 / N2** Set `confidence_score` in the insights writer so facts flow again.
4. **B5** Bind a user in `generate-embedding`, `analyze-conversation`, `morning-brief`; secret-gate `backfill-embeddings`, `process-scheduled-callbacks`, `embed-session`; fix the client bearer token in `contextAssembler.ts`; validate `config.toml`.
5. **B4** Fix the 25 type errors and the 2 lint errors; mock Supabase in tests; add a discovery replay test and a commitment-update test; run all in CI.
6. **H1 follow-on** Raise the mentor token floor to 1200.
7. **B2** Decide migrations vs. deletion for the missing memory tables.
8. Then resume the original plan at Phase 1 item 10 (shared expert catalog) and Phase 2 (sessions, domain packs, scheduler).

The original report with the full findings, domain assessment, and phased plan is `docs/COACHING_AUDIT_AND_HARDENING_REPORT.md`.
