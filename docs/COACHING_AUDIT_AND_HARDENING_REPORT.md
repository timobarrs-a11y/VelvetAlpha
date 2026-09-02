# Velvet Coaching Audit & Hardening Report

**Scope:** the coaching ("mentor") mechanics, the brain behind them, and the memory engine they depend on. Audited against the three launch domains: IT coaching, language coaching, fitness coaching.
**Date:** 2026-09-02 · **Branch:** `claude/coaching-audit-hardening-a6js7y` · **Method:** static read of every file on the coaching path plus a local build-health run (typecheck, lint, tests). No production data was touched.

---

## 1. Executive summary

**Verdict: the coaching layer is not release-ready. The companionship core is solid and reusable; the coaching brain is a thin prompt layer on top of it, and the structured state it needs was designed but only half-wired.**

What is genuinely good and worth keeping:

- A clean, opinionated **coaching loop** (Anchor → Diagnose → Direct → Close the loop → Follow up) with accountability and check-in dials. It reads like real coaching practice, and it is enforced for mentors on both client and server.
- A **structured state design** that is exactly right for coaching: `user_goals`, `coaching_commitments`, `coaching_sessions`, confidence-scored facts, and a memory bus that surfaces them across surfaces (chat, rituals, morning brief).
- Server-side prompt assembly in `chat-turn` with prompt caching, moderation, rate limiting, tier gating, and a post-turn signal detector that already extracts commitments.
- A 20-expert catalog with a client/edge parity test.

What blocks launch (details in §5):

| # | Blocker | Effect today |
|---|---------|--------------|
| B1 | Goal discovery sends a `system` role inside `messages` to the Anthropic API | Every discovery turn after the greeting fails. No coach is auto-provisioned. |
| B2 | `core_memories`, `session_summaries`, `match_memories` are used by four edge functions and the context assembler but no migration creates them | The "long-term memory" tier of the engine is dead code unless it was created out-of-band. |
| B3 | Commitments are only ever inserted, never resolved | The coach's "follow up" step reads a list that only grows. Coaches will nag about finished work. |
| B4 | Typecheck fails (21 errors), 2 of 3 test suites cannot load, lint has 1 error | There is no green gate to protect a launch. |
| B5 | Eight edge functions accept a `user_id` from the request body with the service-role key and no auth check | Cost abuse and cross-user memory tampering with the public anon key. |

The bigger structural finding: **the semantic memory engine is not on the live coaching path.** The live turn (`chat-turn`) injects raw history, open commitments, active goals, and facts. Nothing vector-based, no session summaries, no core memory. The client-side memory stack (embeddings, clusters, temporal chains, threads, emotional profile, core memory) only runs on a legacy path that the app no longer uses for normal sends. For coaching that is survivable, because **coaching runs on structured state first and semantic recall second**. The launch plan in §7 is built around that ordering.

Domain readiness (details in §6):

| Domain | Catalog coverage | State model | Verdict |
|--------|-----------------|-------------|---------|
| Fitness | 2 coaches (hype, drill) + sleep, wellness, chef adjacent | none (no plan, no workout log, no screening) | prompt-only; needs a program + log + safety gate |
| Language | 1 generic tutor for all languages | none (no target language, level, vocab, or drill state) | prompt-only; re-asks level every session |
| IT | **none** (STEM tutor mentions "programming logic") | none | not present; chat cannot render code blocks |

---

## 2. How the coaching brain works today

### 2.1 Pipeline map

```
Welcome ─► /goal-discovery ──► extract-goal ──► sync-coach ──► user questionnaire ──► lobby
             (Velvet host,      (Haiku JSON →     (auto-creates a
              Haiku, ≤8 turns)   user_goals,       mentor companion:
                                 source=discovered) random name/gender,
                                                   expert by goal type)

Intent select ─► expert selection ─► expert questionnaire ─► createCompanion(mentor)
  ("Coaches",       (20 curated +        (6 questions:            ─► avatar ─► voice page
   hidden if a       custom experts)      gender, energy,              (can create a SECOND
   mentor exists)                         comms, support,               mentor, §5 H6)
                                          depth, name)

Live turn:  App.tsx ─► ChatService.sendMessageWithSignals ─► edge: chat-turn
```

### 2.2 The live turn (`supabase/functions/chat-turn/index.ts`)

The prompt for a mentor is assembled server-side in two cached layers:

**Frozen layer (1h prompt cache)**
1. Persona layer from `_shared/personaBuilder.ts`: role line ("expert coach… no romance"), trait block built from the questionnaire, voice block, "about the user" (hobbies, sports, music, favorite color, zodiac), texting rhythm, drift correction.
2. Coach behavioral block from `_shared/coachFramework.ts`: the coaching loop, accountability line, check-in line, the discovered goal, and the time-assumption guard.
3. Expert layer: the curated expert's instruction (compressed one-liner on the edge) or the sanitized user-authored instruction in a lower-privilege wrapper.
4. Memory rules and a "default short, like a real text" length rule.

**Volatile layer (no cache)**
5. Relationship duration, date, time-of-day bucket, last five user messages.
6. `[OPEN COMMITMENTS]` (this coach only, pending or missed, max 5), `[USER'S ACTIVE GOALS]` (max 5), `[VERIFIED USER FACTS]` (max 10, from `user_insights`).
7. A hallucination guard telling the coach to reference only what is listed.

**Conversation window:** the last 10 to 40 raw messages depending on tier. No summary bridges older history.

**Model and budget:** free and unlimited tiers always get Haiku. Paid tiers get Haiku when the message is "simple" (12 words or fewer, no question mark). Mentors get a floor of 600 output tokens.

**After the reply:** one more Haiku call detects a calendar event, a navigation intent, and a commitment. Commitments above 0.7 confidence are inserted into `coaching_commitments`. This runs for every companion type, not only mentors.

### 2.3 What writes memory on the live path

| Writer | Trigger | Destination | Read by the coach? |
|--------|---------|-------------|--------------------|
| `chat-turn` signal detector | every turn | `coaching_commitments` | yes, `[OPEN COMMITMENTS]` |
| `processEnhancedInsights` (client) | every 5th turn | `user_insights.facts_learned`, topics, goals_mentioned | yes, as `[VERIFIED USER FACTS]` |
| `inspectVoiceFidelity` (client) | every 10th turn | `companions.drift_*` | yes, drift correction |
| `extract-goal` | discovery only | `user_goals` | yes, goal anchor |

Nothing else. `MemoryService.extractAndStoreMemories`, `ConversationThreadService`, `EmotionalProfileService`, `SemanticMemoryService.clusterMemories`, `summarize-memory`, and `summarize-session` all live on `ChatService.sendMessage`, which the app only uses when there is no user profile or when regenerating a reply, or in the checkers game.

### 2.4 Proactive coaching

- **Daily rituals** (`dailyRitualService.ts`) fire only when the app is open on the chat screen, once per day per companion, with a four-hour gap rule. Mentors get `generate-opener` with coach-specific task lines, falling back to templated coach messages that include goals and open commitments. This is good content, but it never reaches a user who has not opened the app.
- **Nudges** written to `scheduled_messages` are never delivered: `checkPendingMessages` has no caller. `process-scheduled-callbacks` marks callbacks complete without sending anything.
- **Morning brief** includes open commitments. Good.
- **No server-side scheduler** exists for coaching. `pg_cron` is only used for trial expiry. No push notifications.

---

## 3. The memory engine: designed vs. wired

The intent-select page promises "the only AI memory system that gets sharper the more you talk." Here is what backs that claim on the coaching path.

| Component | Storage | Populated by | Read on live coach turn | Status |
|-----------|---------|--------------|-------------------------|--------|
| Raw history window | `conversations` | every turn | yes (10–40 msgs) | live |
| Goals | `user_goals` | discovery, goals UI | yes | live |
| Commitments | `coaching_commitments` | chat-turn signal detector | yes | live, never resolved (B3) |
| Coaching sessions | `coaching_sessions` | **nobody** | no | table only |
| Facts | `user_insights.facts_learned` | client insights every 5 turns | yes | live, mislabeled "verified" (H4) |
| Rolling prose memory | `companion_memories` | `summarize-memory` (legacy path only) | no | dormant |
| Core memory (6-section doc) | `core_memories` | `consolidate-memory` | no | **no migration creates the table** (B2) |
| Session summaries + embeddings | `session_summaries` (gte-small, 384-d) | `summarize-session` + `embed-session` | no | **no migration creates the table** (B2) |
| Episodic recall | RPC `match_memories` | context assembler (legacy path) | no | **RPC does not exist** (B2) |
| Relationship memories + vectors | `relationship_memories` (OpenAI, 1536-d) | `MemoryService` keyword extraction (legacy path) | no | dormant; needs `OPENAI_API_KEY` |
| Clusters and temporal chains | `memory_clusters`, `temporal_chains` | client, every 10th legacy turn | no | dormant |
| Conversation threads | `conversation_threads` | legacy path | no | dormant |
| Living-companion memories | `companion_memory` | daily experience | no (companions only) | live for companions |

Three engineering facts follow from this table:

1. **Two incompatible embedding spaces.** `relationship_memories` and `search_memories_by_similarity` are 1536-d OpenAI vectors. `embed-session` produces 384-d gte-small vectors. The client falls back to a zero vector on embedding failure, and a zero vector makes cosine similarity meaningless. Pick one model (recommendation: gte-small via `Supabase.ai`, no external key) and one table.
2. **The memory that matters for coaching is structured, and it is already half-built.** Goals, commitments, sessions, and facts with confidence are the right primitives. They need lifecycle (open/close/expire), provenance, and scoping, not more vectors.
3. **Semantic recall is a second-order feature for coaches.** Its job is "what did we say about X three weeks ago" and it should read from session summaries, not from raw message vectors. Once sessions exist (§7 Phase 2), one embedding column on `coaching_sessions.summary` gives 80 percent of the value.

---

## 4. Build health (run locally on this branch)

| Check | Result |
|-------|--------|
| `npm run typecheck` | **fails**, 21 errors in `analyticsService.ts`, `chatService.ts`, `modelSelector.ts`, `newsService.ts`, `youtubeService.ts` (undefined `error` identifiers, a missing `CostTracker.trackCacheHit`) |
| `npx vitest run` | 1 suite passes (`coachExpertParity`, 2 tests). `chatService.test.ts` and `companionService.test.ts` **cannot load** because the Supabase client throws without env vars. |
| `npm run lint` | **1 error** (`sync-coach/index.ts`: unused `goalText`), 274 warnings |

The only coaching test in the repo checks that expert ids and dials match between client and edge. It does not check instruction content, prompt output, or any behavior.

---

## 5. Findings

Severity: **Blocking** = launch cannot proceed. **High** = users will notice or the product promise is false. **Medium** = quality or maintenance debt. **Low** = hygiene.

### Blocking

**B1. Goal discovery is broken at the API boundary.**
`supabase/functions/goal-discovery-chat/index.ts:102` puts `{ role: "system" }` inside the `messages` array. The Anthropic Messages API accepts only `user` and `assistant` roles there, so every turn after the scripted greeting returns 400 and the page shows "Connection issue." Discovery never completes, `extract-goal` and `sync-coach` never run, and the auto-provisioned coach never appears. Fix: pass `SYSTEM_PROMPT` as the top-level `system` parameter. Add a test that replays a two-turn transcript against a mocked API.

**B2. The long-term memory tier references tables that do not exist in this repo.**
`consolidate-memory`, `summarize-session`, `embed-session` (as a writer), and `src/services/contextAssembler.ts:28,64` use `core_memories`, `session_summaries`, and RPC `match_memories`. No file under `supabase/migrations` creates them. Either they were created by hand in the hosted project (then they are undocumented and unreproducible) or these functions have been failing silently. Decide: ship migrations for them, or delete the functions and the context-assembler paths.

**B3. Commitment lifecycle has no close.**
`chat-turn/index.ts:673` inserts commitments. No code anywhere updates `status` to `completed`, `missed`, or `renegotiated`. The coach's fifth loop step ("Last time you said you'd X, where did that land?") reads `[OPEN COMMITMENTS]`, which only grows. Within two weeks a real user has a list of stale promises and a coach that keeps bringing them up. Fix in three parts: (a) extend the signal detector to return `commitment_updates` (completed, missed, renegotiated, with the matched commitment id) and apply them; (b) a daily sweep that marks `pending` past `due_date` + 48h as `missed`; (c) a reconciliation prompt on the first coach message after a due date passes.

**B4. No green gate.** See §4. Fix the 21 type errors, add a `.env.test` or mock the Supabase client in tests, fix the lint error, and make CI run all three.

**B5. Unauthenticated edge functions with service-role access.**
`summarize-memory:51`, `consolidate-memory:67`, `summarize-session:19`, `embed-session`, `generate-embedding`, `morning-brief`, `analyze-conversation`, and `process-scheduled-callbacks` read `user_id` or free text from the body and act with the service-role client without verifying a JWT. The public anon key is in the client bundle, so anyone can trigger paid model calls for any user, and `consolidate-memory` accepts `pinned_facts` that get written verbatim into another user's core memory. Fix: every function verifies the caller's JWT and derives `user_id` from it; internal fan-out uses a shared secret header checked server-side.

### High

**H1. Coaches inherit companion "texting DNA."**
`_shared/personaBuilder.ts:248` injects "Default SHORT, 1-3 sentences, like a real text… occasional typos, lowercase, fragments" for every relationship type, including mentors. `chat-turn` adds "RESPONSE LENGTH: Default short, like a real text." The persona also tells a coach to "stay in character… keep the conversation warm and natural" and lists the user's zodiac sign and favorite color. For an IT coach explaining a stack trace or a language tutor giving a correction ladder, this caps depth and makes the coach sound like a companion in a blazer. Fix: a mentor-specific persona builder (no texting rhythm, no zodiac/color, markdown allowed, "as long as it needs to be, never longer" length rule).

**H2. Model routing is wrong for coaching.**
`chat-turn/index.ts:220`: free and unlimited tiers always get Haiku; paid tiers get Haiku for messages of 12 words or fewer with no question mark. In coaching, the short messages ("done", "skipped it", "I'll do 3 sets", "yes") are the turns where the coach must reason over commitments, goals, and the plan. Fix: mentors get Sonnet regardless of message length; tier controls history depth and daily message count instead.

**H3. Domain coverage does not match the launch focus.**
- No IT coach exists. The closest is `stem_tutor`, which mentions "programming logic."
- One `language_tutor` covers every language and level with no stored target language, level, or vocabulary.
- Fitness has two persona variants but no program, log, or screening.
- `goal_type` has five values (`health_fitness`, `reading`, `creative`, `habit`, `deadline`). There is no `skill` or `learning` type, so "learn Python" or "reach B2 Spanish" becomes `habit`. `sync-coach/index.ts:48` then picks randomly among roughly eleven `habit` experts, including the chef and the style coach. An IT goal can be assigned to The Chef.

**H4. "Verified" facts are not verified, and they leak across companions.**
`chat-turn/index.ts:767-786` labels every fact `[VERIFIED]` if row confidence is at least 0.4. The column defaults to 0.5, and the client writer never sets it above 0.6. Facts are gathered from the five most recent `user_insights` rows across all companions, so a romantic companion's "love language: physical touch" can appear in the fitness coach's prompt as a verified fact. Fix: per-fact confidence and `last_confirmed_at`, label `[VERIFIED]` only when confirmed by the user or seen in two separate sessions, and filter by relevance category for mentors (goals, schedule, health, work, learning).

**H5. Two onboarding paths fight each other.**
The discovery path auto-creates a coach with a random name and gender the user never chose (`sync-coach/index.ts:66,133`), and the intent page then hides the "Coaches" option because a mentor exists (`IntentSelectPage.tsx:62`). A user who wanted the Drill Sergeant gets "Maya, The Hype Coach" and cannot pick again without deleting. Separately, the manual path can create two mentors: `ExpertQuestionnairePage` creates one, and `SignatureVoiceSelectionPage.tsx:85` creates another when `currentCompanionId` is missing from session storage. Fix: one path. Discovery ends in a recommendation card (top three experts for the goal) that the user confirms, names, and genders. Remove the voice-page creation branch.

**H6. Proactive coaching does not exist when the app is closed.** See §2.4. Accountability coaching without a scheduler is a chat bot that waits. Fix: a `pg_cron` job (or Supabase scheduled function) that evaluates due commitments and check-in cadence per coach, writes to `scheduled_messages`, and a delivery worker that inserts into `conversations` and sends a push (service worker is already registered).

**H7. Safety controls fail open.** Rate limit (`chat-turn:1204-1236`) and the moderation classifier both continue on error. Acceptable for a companion; for a fitness coach that may be asked about injury or extreme dieting, add domain safety (see §6.3) that fails closed.

### Medium

**M1. Edge expert instructions are compressed one-liners.** The client catalog has DOMAIN KNOWLEDGE, BEHAVIORAL FOCUS, and ACCOUNTABILITY sections; `_shared/coachFramework.ts` ships a single sentence per expert. The live coach runs on the thin version. The parity test does not catch this. Move the catalog to one shared JSON consumed by both sides, and extend the parity test to instruction content.

**M2. Premium expert gating is not enforced.** `canUseExpert` is never called; `ExpertSelectionPage` only shows a badge; `chat-turn` does not check tier against `premium`.

**M3. `coaching_sessions` is never written.** No open/close, so no per-session summary, no "last session" recap, and the memory bus's `includeSessions` always returns nothing.

**M4. Discovery output is lossy.** `extract-goal/index.ts:152,162` double-encodes the transcript into `jsonb` (stored as a JSON string). `accountabilityLevel` from discovery is used only to pick an expert and then discarded; the expert's own dial wins. No `target_value`, `unit`, or `target_date` is captured, so goals cannot show progress.

**M5. Signal detection is awaited despite `waitUntil`.** `chat-turn:1288-1290` adds a full Haiku round-trip to every reply's latency. Return the reply, then finish detection in the background and deliver signals through the message metadata or realtime.

**M6. History has no bridge.** Free-tier coaches see 10 raw messages and nothing older. Without session summaries the coach forgets the plan it made yesterday. Depends on M3.

**M7. Chat cannot render code or structured text.** Only Atlas has a markdown renderer. Coach replies with lists, tables, or code fences show as raw text. Required for IT and language (tables of conjugations).

**M8. GDPR export omits coaching data.** `gdprService.ts` exports none of `user_goals`, `coaching_commitments`, `coaching_sessions`, `user_insights`, `user_experts`.

### Low

**L1.** `sync-coach` name pool duplicates "Marcus"; the lint error is the unused `goalText`.
**L2.** `lint_full.txt`, `scr_errors*.txt`, and `.env.production` are committed. Remove and ignore.
**L3.** Commitment due dates and "days left" math use server UTC; the user's timezone is known and should be used.
**L4.** `detectPostResponseSignals` runs for romantic and friend companions and writes their promises into `coaching_commitments`.

---

## 6. Domain assessment against established coaching practice

The premise is right: all three skills have been taught remotely, asynchronously, and by text for decades, so an AI can do it. What the established platforms teach us is that **the value is in the state machine, not the chat.** Each of these platforms is a small database plus a cadence plus a feedback loop. The prompt is the last mile.

### 6.1 IT coaching

**What works remotely today:** mastery-based paths (Exercism, freeCodeCamp), structured exercise plus automated feedback (LeetCode, Codewars), async human code review (Exercism mentoring, Coding mentors on MentorCruise), project milestones with rubrics (Launch School), interview prep with spaced problem sets, and pair-programming style Socratic guidance.

**Transferable mechanics:** a skill graph with prerequisites; placement on entry; one concept per session; exercises with an explicit "what good looks like"; code review that comments on the learner's own code rather than rewriting it; spaced re-testing of weak concepts; portfolio milestones; a "ship something small weekly" cadence.

**Gaps in Velvet:**
- No IT expert. Add at least `it_foundations` (programming fundamentals, any language), `web_dev_coach`, `data_coach` (SQL/Python/analysis), `cloud_devops_coach`, and `tech_interview_coach` (DSA, system design, behavioral). Each with accountability defaults and a curriculum pointer.
- No learning state. Add `learning_paths` (domain, track, current module, mastery per concept) and `skill_assessments` (concept, score, assessed_at).
- No code surface. Enable markdown and fenced code in coach bubbles; allow a mentor to hand off to Co-Author for longer artifacts; a "review my snippet" turn type that raises max tokens to 1500.
- Response budget and model: Sonnet floor and 1200+ tokens for review turns (H1, H2).
- Integrity posture: guide rather than ghostwrite for coursework, like the essay architect already does.

### 6.2 Language coaching

**What works remotely today:** placement to CEFR level (Babbel, Busuu), spaced-repetition vocabulary (Anki, Memrise), comprehensible input at level plus one, conversation practice with correction (italki, Preply), streaks and short daily units (Duolingo), audio-first drilling (Pimsleur), and error correction that recasts rather than lectures.

**Transferable mechanics:** store target language, native language, level, and purpose once; keep a vocabulary ledger with SM-2 style scheduling; a native-to-target language ratio that rises with level; a correction ladder (recast → hint → explicit rule); role-play scenarios by level; weekly review of missed items; cultural notes attached to phrases.

**Gaps in Velvet:**
- The tutor asks language and level every session because nothing persists them and the history window is 10–40 messages. Add `language_profiles` (target_lang, native_lang, cefr_level, purpose, script_familiarity).
- No vocabulary or error ledger. Add `vocab_items` (term, gloss, example, ease, interval, due_at) and `learner_errors` (category, example, count, last_seen). Feed "due today" and "top recurring errors" into the volatile prompt block.
- No drill state. Add a `drill_type` and `scenario` to the session so "continue the café role-play" works after a break.
- One expert for all languages is fine as a persona, but the domain pack (levels, scripts, correction policy) must be per language. Split into a persona (patient, firm) and a language pack (Spanish, Japanese, and so on).
- Voice practice is out of scope for launch, but the state model above makes it additive later.

### 6.3 Fitness coaching

**What works remotely today:** program design by a coach with async check-ins (Future, Caliber), auto-progressed workouts from logged sets (Fitbod, Strong), adherence-first habit coaching (Noom), weekly metric check-ins (weight, sleep, energy, soreness), and explicit intake screening (PAR-Q) before prescribing anything.

**Transferable mechanics:** intake (experience, equipment, schedule, injuries, medical flags); a plan with a mesocycle; workouts logged as sets and reps; progressive overload computed from the log, not remembered from chat; rest and deload rules; a weekly check-in that adjusts the next week; red-flag phrases that stop coaching and refer.

**Gaps in Velvet:**
- No intake gate. Add a PAR-Q style intake on first session, stored in `fitness_profiles`, and require it before a program is prescribed.
- No plan or log. Add `workout_plans` (weeks, days, exercises, targets) and `workout_logs` (date, exercise, sets, reps, load, RPE). Inject "this week's adherence: 2 of 4 sessions" and "last squat: 3x5 @ 185" into the prompt so the coach never guesses.
- No safety rail beyond a sentence in the instruction. Add a fail-closed detector for injury and medical red flags (chest pain, dizziness, disordered-eating cues) that switches the coach into "stop and refer" mode for that turn and logs it.
- The Drill Sergeant's "push them slightly past what they think they can do" needs the log and the intake to be safe.
- Commitments should be generated from the plan ("Thursday: upper body") rather than only extracted from chat.

### 6.4 Cross-domain coaching science already reflected, and what is missing

Present in the coaching loop: goal anchoring (GROW's Goal and Reality), one next step (implementation intentions), closing on a commitment with a deadline, follow-up first. Missing and cheap to add: WOOP-style obstacle planning ("what will get in the way, and what's your if-then"), relapse handling scripts (miss once, never twice), a weekly review ritual that reads the session log, and a progress metric the user can see. Each of these needs the state in §7 Phase 2, not more prompt text.

---

## 7. Hardening plan for launch

Ordered so each phase is shippable on its own.

### Phase 0: stop the bleeding (days)
1. B1: pass the discovery system prompt as `system`; add a replay test.
2. B5: JWT verification in every edge function; internal calls use a shared secret.
3. B3: commitment updates in the signal detector; overdue sweep; reconciliation on coach open.
4. B2: ship migrations for `session_summaries` and `core_memories` and the `match_memories` RPC, or delete the consumers. Recommendation: ship `coaching_sessions`-based summaries instead (Phase 2) and delete `core_memories` and `consolidate-memory`.
5. B4: fix type errors, mock Supabase in tests, fix lint, run all three in CI on every PR.
6. H5: one onboarding path. Discovery ends in a confirmable recommendation; remove the voice-page coach creation; stop hiding "Coaches" on the intent page.

### Phase 1: make the coach sound and think like a coach (1–2 weeks)
7. H1: `buildMentorPersonaLayer` with no texting rhythm, no zodiac/color, markdown allowed, length rule "as long as it needs to be."
8. H2: Sonnet floor for mentors; tier controls history depth and daily quota.
9. M7: markdown and code rendering in the chat bubble.
10. M1: single shared expert catalog (JSON) for client and edge; parity test on full instruction text.
11. H4: per-fact confidence and confirmation; category filter for mentors; scope facts by companion type.
12. M5: return the reply before signal detection completes.
13. M2: enforce premium expert gating on the server.

### Phase 2: the coaching state engine (the actual brain, 2–4 weeks)
14. `coaching_sessions` lifecycle: open on first message after 4 hours idle, close after 30 minutes idle or explicit "that's it for today," Haiku summary with diagnosis, direction, commitment made, and next focus. Inject the last two summaries into the prompt.
15. Goal model v2: add `skill` goal type, `target_value`/`unit`/`target_date` capture in discovery, `plan_json` for domain packs, progress event log.
16. Domain packs, each a small schema plus an intake protocol plus prompt fragments:
    - IT: `learning_paths`, `skill_assessments`, code-review turn type, 5 experts.
    - Language: `language_profiles`, `vocab_items` with SM-2, `learner_errors`, drill state, per-language packs.
    - Fitness: `fitness_profiles` with PAR-Q, `workout_plans`, `workout_logs`, red-flag detector (fail closed), plan-generated commitments.
17. Proactive engine: cron evaluates due commitments and check-in cadence, writes `scheduled_messages`, delivery worker inserts into the thread and pushes. Rituals become one input to it rather than the mechanism.
18. Weekly review ritual per coach that reads sessions, commitments, and domain logs and produces a one-screen progress card.

### Phase 3: semantic memory as a second-order layer (1–2 weeks, after Phase 2)
19. One embedding model (gte-small via `Supabase.ai`, 384-d) and one vector column on `coaching_sessions.summary`. Retire the OpenAI 1536-d path or migrate it.
20. Retrieval into the volatile block for mentors: top three sessions by similarity to the current message, this coach only, with dates.
21. Delete or quarantine the client-side clustering, temporal chains, and keyword extraction until they have an owner and a test.

### Phase 4: prove it (continuous)
22. A coach evaluation harness (see §8) run in CI against a mocked model and weekly against the real one.
23. Cost and latency budgets per turn type; alert on drift.
24. Repo hygiene (L2), GDPR coverage (M8), timezone-correct due math (L3).

---

## 8. Acceptance tests: how to prove the system works

Run these before launch. Each is a pass/fail transcript test; most can be automated with a mocked model and all can be run manually against staging.

| # | Scenario | Pass criterion |
|---|----------|----------------|
| A1 | New user completes discovery in 3 turns | `user_goals` row with `source=discovered`; recommendation card shows 3 experts; user confirms one; exactly one mentor exists |
| A2 | User says "I'll run Tuesday and Thursday" | Two commitments with due dates in the user's timezone |
| A3 | Next session, user says "did Tuesday, skipped Thursday" | Tuesday `completed`, Thursday `missed`; coach acknowledges both without inventing a third |
| A4 | Commitment due date passes with no report | Sweep marks `missed`; the next coach opener asks about it first |
| A5 | Coach is asked to flirt, or user uses a pet name | Coach declines in character, stays professional, no pet names in reply |
| A6 | Free-tier user, short message "done" | Model is Sonnet; reply references the specific commitment |
| A7 | IT coach receives a 40-line snippet | Reply renders a fenced code block; max tokens ≥ 1200; the coach comments on the user's code rather than rewriting it |
| A8 | Language tutor, second session after 3 days | Coach does not re-ask language or level; resumes the drill type from the session summary; vocab due today appears |
| A9 | Fitness coach, first session | PAR-Q intake before any prescription; no program until intake stored |
| A10 | Fitness coach, user mentions chest pain during a workout | Fail-closed: coach stops the plan for the turn, gives referral language, logs the event |
| A11 | Romantic companion's "love language" fact exists | It does not appear in any coach prompt |
| A12 | Anonymous call to `summarize-memory` with another user's id | 401 |
| A13 | App closed at a check-in time | Scheduled message is inserted and a push is delivered |
| A14 | Client and edge expert catalogs diverge by one word of instruction | Parity test fails |
| A15 | `npm run typecheck && npm run lint && npx vitest run` | All green in CI |

---

## 9. Appendix: file map for the coaching path

| Concern | File |
|---------|------|
| Coaching loop, dials, openers (client) | `src/config/coachFramework.ts` |
| Coaching loop, expert one-liners (edge) | `supabase/functions/_shared/coachFramework.ts` |
| Expert catalog (client, rich) | `src/config/signatureExperts.ts` |
| Persona layer (edge) | `supabase/functions/_shared/personaBuilder.ts` |
| Live turn | `supabase/functions/chat-turn/index.ts` |
| Discovery | `supabase/functions/goal-discovery-chat/index.ts`, `extract-goal/index.ts`, `sync-coach/index.ts`, `src/pages/GoalDiscoveryPage.tsx` |
| Manual coach creation | `src/pages/IntentSelectPage.tsx`, `ExpertSelectionPage.tsx`, `ExpertQuestionnairePage.tsx`, `ExpertBuilderPage.tsx`, `SignatureVoiceSelectionPage.tsx` |
| Send path | `src/App.tsx` (`handleSendMessage`), `src/services/chatService.ts` (`sendMessageWithSignals`) |
| Memory bus | `src/services/memoryBus.ts`, `contextAssembler.ts` (legacy path only) |
| State tables | `supabase/migrations/20260422023037_add_user_goals.sql`, `20260617201807_add_ai_experts_system.sql`, `20260817170117_*_add_coaching_state_engine.sql`, `20260825134937_*_add_goal_discovery_columns.sql.sql` |
| Proactive | `src/services/dailyRitualService.ts`, `proactiveMessageService.ts`, `supabase/functions/generate-opener/index.ts`, `process-scheduled-callbacks/index.ts` |
| Facts | `src/services/enhancedInsightsService.ts`, `supabase/functions/analyze-conversation/index.ts` |
| Vector memory (dormant) | `src/services/semanticMemoryService.ts`, `memoryService.ts`, `supabase/functions/generate-embedding`, `embed-session`, `summarize-session`, `consolidate-memory`, `backfill-embeddings` |
| Tests | `src/services/__tests__/coachExpertParity.test.ts` |
