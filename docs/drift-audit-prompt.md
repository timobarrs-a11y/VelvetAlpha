# Drift Detection & Correction Audit — Master Prompt

Paste everything below the line into a fresh session at the repo root. It is self-contained.

---

## ROLE

You are a principal ML-reliability engineer auditing **VelvetAlpha** (React/TS client, Supabase Postgres + pgvector, Deno Edge Functions, LLM-backed companions and coaches) for **drift detection and correction**. You are adversarial toward the current design. Your job is to find where drift can happen undetected, where it is detected but never corrected, and where "correction" itself causes harm. Do not praise. Do not speculate without evidence.

## GROUND RULES

1. **Evidence only.** Every finding cites `file:line` or a migration/table/column. If you can't find something, say "NOT FOUND (searched: <paths/patterns>)". Absence is a finding.
2. **Separate three states** for every mechanism: `EXISTS-AND-WIRED` (runs in prod path), `EXISTS-BUT-UNWIRED` (code/table present, nothing calls it or nothing reads its output), `ABSENT`.
3. **Trace the full loop** per drift type: signal → measurement → threshold → alert → decision → action → verification the action worked → rollback. Mark the first broken link.
4. **No code changes in this pass.** Output is an audit report plus a ranked remediation plan. Read-only.
5. Run what can be run (tests, type-check, SQL via migrations review). Do not invent metrics you did not compute.

## KNOWN STARTING POINTS (verify, don't trust)

These come from a first skim and `src/docs/memory-roadmap_(2).md`. Treat them as hypotheses:

- `src/services/voiceFidelityService.ts` + `supabase/migrations/20260624235012_add_companion_voice_drift_system.sql` + `supabase/functions/inspect-voice-fidelity`: a Voice Fidelity Score (VFS) with `DRIFT_THRESHOLD = 0.75`, per-dimension scores (tone, vocabulary, emotional, energy, boundary), `companion_drift_log`, `drift_needs_correction`, `clearDriftCorrection`. Questions: who consumes `drift_needs_correction`? Is the correction actually injected into `chat-turn`? Is the threshold calibrated or arbitrary? Who computes the score (LLM judge? embeddings?) and is the judge itself stable? Is the `voice_baseline` ever refreshed or versioned?
- `supabase/functions/chat-turn` is the live path (`USE_SERVER_PROMPT = true`), yet the roadmap claims most memory stores are written but never read on it. Memory/persona drift may be invisible because most of the memory system is off the live path.
- `semanticMemoryService.ts`, `backfill-embeddings`, `generate-embedding`, `embed-session`, `check-embeddable`, `match_memories` RPC: embedding model/version pinning, re-embedding on model change, index staleness.
- `summarize-memory`, `consolidate-memory`, `summarize-session`: lossy summarization, no versioning, concurrency races, `facts_learned.slice(0,30)` keeps oldest facts.
- `responseValidationService.ts` (764 lines), `systemPromptBuilder.ts`, `coachFramework.ts`, `sync-coach`, `src/services/__tests__/coachExpertParity.test.ts`: output validation, prompt assembly, coach/expert parity.
- `temporalAwarenessService.ts`, `uptime-monitor`, `article-refresh-scheduler`, `scrape-articles`, `fetch-news`, `local-explorer`: staleness of external context.
- `MessageRatingControls.tsx`, `FeedbackModal.tsx`: user feedback signals that could feed drift detection.

## PHASE 0 — INVENTORY (build the map first)

Produce a table of every place an LLM or embedding model is called: function, provider, **model ID and whether it's pinned to a dated snapshot or a floating alias**, temperature/params, prompt source (static, templated, DB-driven, user-editable), and what persisted state it reads/writes. Include judge/validator/summarizer/extractor calls, not only chat. Flag any floating alias, any hardcoded model string duplicated across functions, and any place the model ID is not logged with the output.

Then list every persisted artifact that can go stale or corrupt: voice baselines, companion persona text, memories (all tables), summaries, embeddings, user insights, emotional profiles, threads, cached articles, wallpapers/personalization, and system prompts stored in DB. For each: who writes, who reads on the **live** path, TTL/refresh policy, versioning (yes/no), provenance (which model/prompt version produced it).

## PHASE 1 — DRIFT TAXONOMY COVERAGE

For **each** drift type below, answer: (a) does it occur in this system, (b) is it detected, (c) how, (d) is it corrected, (e) is the correction verified, (f) rating 0–4 (0 = blind, 4 = closed-loop and tested).

### A. Classical ML drift (still applies to any scoring/ranking/classification you run)
1. **Data / covariate drift** — input feature or prompt-distribution shifts (language, topic mix, message length, new onboarding cohorts, age-gate changes, new features like games/coaching changing what users say).
2. **Concept drift** — relationship between input and "good output" changes (what users reward, what counts as appropriate).
3. **Label / prior drift** — rating/feedback distribution shifts (e.g. thumbs-up rate moves because UI changed, not quality).
4. **Prediction/output drift** — distribution of response length, refusal rate, sentiment, emoji use, tool-call rate, validator-failure rate.
5. **Upstream/pipeline drift** — schema, API, or null-rate changes; silent function failures that look like drift.

### B. LLM- and agent-specific drift (the frontier set — most likely unaudited)
6. **Provider/model drift** — silent snapshot updates behind floating aliases, deprecations, behavior change on version bump, changed safety filters, latency/token-count changes. *Is there a regression suite that runs on every model change?*
7. **Persona / voice drift** — companion gradually departs from its defined character over long conversations (the VFS system). Check for *self-conditioning*: does the model's own past replies, fed back as history, amplify the drift?
8. **Context / long-horizon drift** — instruction-following decays as context grows; system prompt dilution; summarization compounding (summary of a summary of a summary).
9. **Memory drift** — stale facts, contradicted facts never superseded, hallucinated facts promoted to `[VERIFIED]`, memory poisoning by one bad extraction, cross-companion leakage, unbounded growth, oldest-wins truncation.
10. **Retrieval / RAG drift** — embedding-model change without re-embed; query-vs-document distribution shift; index recall decay; top-k relevance decay; pgvector index params (ivfflat lists/probes, hnsw) tuned to old data size.
11. **Embedding-space drift** — distribution of live embeddings vs. baseline (centroid shift, MMD / Wasserstein / classifier two-sample test), per-cohort.
12. **Prompt drift** — edits to templates, `coachFramework`, `sync-coach` content, or DB-stored prompts without version tags, diff review, or eval gate; prompt/coach "parity" drift.
13. **Judge / evaluator drift** — the LLM-as-judge or validator (`responseValidationService`, `inspect-voice-fidelity`) itself changes behavior, is miscalibrated, position/verbosity-biased, or shares failure modes with the generator. *Who watches the watcher?*
14. **Safety / guardrail drift** — boundary adherence, age-appropriate content, crisis handling (CBT/reflection flows), refusal calibration. Slow erosion over a long relationship ("boundary" VFS dimension).
15. **Temporal / knowledge staleness** — time awareness, news/article freshness, dates in memories ("next Friday" resolved wrongly), scheduled callbacks and overdue-commitment sweeps.
16. **User-behavior & adversarial drift** — jailbreak patterns spreading, new slang, usage spikes, seasonality, cohort effects, bots.
17. **Feedback-loop drift** — system output shapes future training/memory/profile data (emotional profile, insights, ratings), creating self-reinforcing bias.
18. **Cost/latency/quality tradeoff drift** — model downgrades (e.g. Haiku for summarization) or token-budget cuts silently lowering quality.

## PHASE 2 — DETECTION QUALITY (are the detectors any good?)

For every detector found, audit the **statistics**, not just existence:

- **Baseline**: What is it, when was it set, is it versioned, does it include seasonality, is it refreshed (and does refresh hide slow drift — "boiling frog")?
- **Method fit**: PSI/KS/chi²/JS/KL for scalar/categorical; MMD / classifier two-sample test / Wasserstein-sliced for embeddings; ADWIN / Page-Hinkley / CUSUM / EWMA / DDM for streams. Is the method appropriate for the data type and dimensionality? (Flag KS on discrete data, PSI with arbitrary bins, univariate tests on 1536-dim vectors.)
- **Thresholds**: calibrated against a measured no-drift null (A/A or bootstrap) or just a magic number (e.g. 0.75, PSI 0.2)? Expected false-positive rate? Multiple-testing correction across dimensions/cohorts?
- **Sample size & window**: minimum n before alerting; window length vs. traffic per companion/user; does low-traffic companions produce noisy or never-firing signals? Is there per-user vs. global vs. per-cohort segmentation (Simpson's-paradox risk)?
- **Sampling bias**: does the drift check only sample certain messages (most recent N, only rated ones, only active users)? Survivorship bias from churned users?
- **Cadence**: `drift_checked_at` throttling — is the interval justified? Detection latency (time from onset to alert) — estimate it.
- **Judge reliability**: if an LLM scores VFS, what is its test–retest variance at temperature>0, agreement with human labels, sensitivity to the judge model version? Is there a frozen human-labeled gold set? Is judge output logged with judge model ID + prompt version?
- **Leading vs. lagging**: how many detectors rely on user complaints/ratings (lagging) vs. input/embedding/judge signals (leading)?
- **Alerting**: who gets paged, via what channel, with what runbook, dedup/suppression, alert-fatigue controls? Is there any alert at all, or only a DB row?
- **Observability**: are inputs/outputs/prompt version/model ID/retrieved memory IDs/latency/tokens traced per turn so an incident can be reconstructed? Privacy-safe (hash/redact PII — this is an intimate-conversation product)?

## PHASE 3 — CORRECTION QUALITY (does the fix work, and is it safe?)

For every correction mechanism (`drift_needs_correction`, re-grounding prompts, memory consolidation, re-embedding, prompt sync, retries in response validation):

- **Wired?** Trace from flag → consumer → prompt/behavior change. Prove it with the code path.
- **Proportional?** Soft nudge (re-inject persona anchor) → reset (truncate/summarize history) → memory repair → model/prompt rollback → traffic failover. Is there an escalation ladder or one blunt lever?
- **Verified?** After correction, is VFS/metric re-measured, and is `correction_applied` ever set truthfully? Is there a success criterion and a timeout?
- **Idempotent & race-safe?** Concurrent corrections, double-fires, last-writer-wins on memory rows.
- **Reversible?** Versioned memories/prompts/baselines with rollback. Any destructive overwrite (e.g. upsert-one-row summaries)?
- **Catastrophic forgetting / over-correction**: does correction erase legitimate user-specific evolution (a relationship is *supposed* to change)? How does the system distinguish **bad drift (persona decay)** from **healthy adaptation (relationship growth, user-requested customization via `CustomizationPanel`)**? This is the central design question — answer it explicitly.
- **Safe rollout**: shadow/champion-challenger, canary %, automatic rollback on regression, kill switch. Present or absent?
- **Replay/regression gate**: is there an offline eval set (golden conversations per companion, adversarial persona-break prompts, memory-recall probes) that runs in CI on every prompt/model/memory-logic change? Check `coachExpertParity.test.ts` as the only candidate and assess how much it truly covers.
- **Human in the loop**: review queue for high-impact corrections (memory deletions, persona rewrites).

## PHASE 4 — SYSTEMIC & GOVERNANCE CHECKS

- **Ownership**: named owner per detector/threshold; review cadence; documented runbook.
- **Change management**: any prompt, model alias, threshold, or baseline change without version, diff, and eval gate?
- **Data contracts**: schema validation on LLM JSON outputs (extractors/summarizers), null-rate and parse-failure monitoring (silent failure masquerading as drift).
- **Multi-tenant fairness**: drift or detection quality differing by language, age cohort, companion type, subscription tier.
- **Security/abuse**: memory poisoning, prompt injection via scraped articles into context, embedding inversion/privacy, RLS permitting client-side writes to memory/drift tables (the migration lets the browser INSERT drift logs — can a user forge or suppress their own drift record?).
- **Cost**: monitoring spend (judge calls per turn?) vs. value; sampling strategy.
- **Compliance**: retention of drift logs/transcripts, deletion on account removal, minors' data.
- **Extensibility**: can a new companion/coach get drift coverage automatically, or is it hand-wired?

## PHASE 5 — BENCHMARK AGAINST FRONTIER PRACTICE

Score the system (0–4) on each; say what's missing:

1. Pinned model snapshots + automated model-change regression suite
2. Golden-set + adversarial persona-break eval in CI
3. Embedding-distribution monitoring (MMD/Wasserstein/classifier-2ST) with per-cohort segmentation
4. Calibrated, null-tested thresholds with FPR budget
5. Calibrated LLM-judge (human-labeled gold, ensemble or cross-family judge, logged judge version)
6. Sequential/online detectors (ADWIN, Page-Hinkley, CUSUM/EWMA) on output metrics
7. Versioned memory with provenance, supersession/contradiction handling, and rollback
8. Closed-loop, escalating, verified correction (not just a flag)
9. Persona anchoring / periodic re-grounding that preserves healthy adaptation
10. Champion–challenger / canary / shadow deployment with auto-rollback
11. PEFT/LoRA or meta-learning adaptation *(note: likely N/A for API-hosted models — say so rather than recommending it)*
12. Retrieval health metrics (recall@k on probe queries, stale-index detection, re-embed on model change)
13. Per-turn trace logging (model ID, prompt version, retrieved items) enabling incident reconstruction
14. Alerting with runbooks, dedup, ownership

## PHASE 6 — EMPIRICAL CHECKS (run, don't just read)

Where feasible without prod access:
1. Type-check / lint / run the existing tests; report results.
2. Extract the VFS scoring logic and the validator rules; identify any dimension that cannot be measured from what is stored.
3. Write (in scratchpad only) a tiny synthetic experiment: inject known drift (e.g. shift a persona's vocabulary distribution, change message length) into mock data and show whether the current detector fires, with what latency and what false-positive rate on a no-drift control. If the detector can't be exercised offline, state exactly why.
4. Enumerate failure modes where the detector would **fail silently** (e.g. judge returns malformed JSON → no row → looks healthy).

## OUTPUT FORMAT

1. **Executive verdict** (≤10 lines): overall maturity 0–4, the three most dangerous blind spots, and whether the current "correction" actually changes model behavior.
2. **System map**: the Phase 0 inventory tables + a diagram (ASCII or mermaid) of signal → detector → decision → correction → verification, with broken links marked ❌.
3. **Coverage matrix**: 18 drift types × {occurs?, detected?, corrected?, verified?, score}.
4. **Findings**: numbered; each with `Severity (Critical/High/Med/Low)`, `Evidence (file:line)`, `State (WIRED / UNWIRED / ABSENT)`, `Failure scenario` (concrete inputs → wrong outcome), `Blast radius`, `Detection today? (how fast)`, `Recommended fix`, `Effort (S/M/L)`.
5. **Statistical-validity review** of each detector (Phase 2).
6. **Correction-safety review** (Phase 3), including the bad-drift vs. healthy-adaptation answer.
7. **Frontier benchmark scorecard** (Phase 5).
8. **Remediation roadmap**: ordered by (risk reduction ÷ effort), grouped in batches that each fit one session, each with acceptance criteria and the metric that proves it worked. Start with "make existing detection reach the live path" before adding new techniques.
9. **Quick wins (<1 day)**, **Do-not-do list** (techniques that look modern but don't fit an API-hosted-LLM product), and **Open questions for the owner** (things only a human with prod access can answer: real traffic volumes, historical VFS distribution, who reviews alerts).

Be concrete, terse, and falsifiable. If a claim above in "Known starting points" turns out wrong, say so prominently.
