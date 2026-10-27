# Memory engine: making belief revision safe (plan, owners and prompts)

Goal: stop the engine from wrongly retiring, rewriting or closing memories, and make every destructive
change verified and reversible. Background and measured results:
`docs/memory-engine-handoff-2026-10-27.md`; harness in `scripts/memory-eval/`; review in
`scripts/memory-eval/REVIEW_2026-10-26.md`.

Agents: **Fable** (design, spec, evals, review) and **Sonnet** (implementation, measurement, deploys with
the owner's approval).

## Branches and PRs (do not share a branch)

| Branch | Owner | Contains | Touches |
|---|---|---|---|
| `memory/spec-and-evals` | Fable | spec doc, contradiction suite, frozen retrieval eval | `docs/`, `scripts/memory-eval/` only |
| `memory/revision-safety` | Sonnet | verifier, vector gate, two-signal rule, restore path | `supabase/functions/chat-turn`, `_shared/memoryEngine.ts`, one migration, UI button, tests |
| (later) `memory/time-and-scope` | Fable designs, Sonnet builds | time axis, scope propagation, retrieval overhaul, CI | separate plan |

Merge order: spec-and-evals first (no production code), then revision-safety. Merge `main` into your branch
before every push, because `chat-turn/index.ts` is a hot file and other agents are merging there too.
The 3-point shootout VS mode is a separate PR and is not part of this.

Rules for every agent: no real memory text in git (the repo is **public**); no production writes, migrations
or deploys without the owner's approval; keep commits small; never rewrite history.

## Steps

| # | Step | Owner | Needs | Output | Done when |
|---|---|---|---|---|---|
| 0 | Pre-flight: read the one 00:37 UTC message the owner approves, decide whether `b8e24ec9` was a correct retraction, freeze baseline numbers | Sonnet | owner OK to read one message | note in the handoff doc | question answered, baseline recorded |
| 1 | Spec | Fable | step 0 | `docs/memory-engine-v4-spec.md` | contracts, thresholds, schema, rollout all written |
| 2 | Evals | Fable (parallel to 3) | step 1 | 100-case contradiction suite, 150+ turn retrieval eval (5+ synthetic users, a 600-row pair, time-shifted queries) | frozen, synthetic, runs on the existing server runners |
| 3 | Verifier + vector gate | Sonnet (parallel to 2) | step 1 | second narrow call (entails / contradicts / unrelated + quote) and evidence-vs-target cosine gate in `chat-turn` | unit tests and probe pass |
| 4 | Two-signal rule + restore | Sonnet | step 3 | migration (disputed state, pending signal), restore action in `memory-mutate`, un-retire button in the memory panel | tested, reversible |
| 5 | Measure | Sonnet runs, Fable grades | steps 2 to 4 | before/after report | gates below met |
| 6 | Adversarial review | Fable, **fresh session** | step 5 | list of findings | every blocking finding fixed |
| 7 | Deploy in shadow mode, then enforce | Sonnet with owner approval | step 6 | migration applied, functions deployed with the verifier in log-only mode for 2 to 3 days, then enforcing | disagreement rate reviewed |

## Acceptance gates (from Fable's "A" definition)
- 0 destructive ops fire on unrelated messages across 50 probes.
- Verifier gets at least 95% of actions right on the 100-case contradiction suite.
- Every destructive op records a quote, a relatedness score and the verifier's verdict, and can be undone from the UI.
- Retrieval on the frozen eval at least 95%, with zero injections of a denied or expired fact.

## Prompts

### Prompt A: Fable, steps 1 and 2 (branch `memory/spec-and-evals`)
```
You are designing the safe belief-revision layer for the memory engine in timobarrs-a11y/VelvetAlpha.
Read first: docs/memory-engine-handoff-2026-10-27.md, scripts/memory-eval/REVIEW_2026-10-26.md,
scripts/memory-eval/README.md, supabase/functions/chat-turn/index.ts (extractMemoryServerSide and the
record_memory_ops tool), supabase/functions/_shared/memoryEngine.ts.

Work on a new branch memory/spec-and-evals from main. Touch only docs/ and scripts/memory-eval/ (and the two
eval edge functions memory-eval-run and extractor-eval if you must extend them). No production code.

Deliver:
1. docs/memory-engine-v4-spec.md: (a) the verifier contract: input = one target memory + the user message,
   output JSON {verdict: entails|contradicts|unrelated, quote, confidence}; only "contradicts" may retire or
   supersede; (b) the vector relatedness gate: embed the evidence quote, cosine with the target, and how to
   calibrate the threshold from data; (c) the two-signal rule for rows that are user_stated, confirmed twice or
   older than 7 days; (d) restore semantics: a "disputed" state kept retrievable for N days and an un-retire
   action; (e) schema changes and a migration plan; (f) shadow-mode rollout and how disagreement is measured;
   (g) cost per turn.
2. A frozen contradiction suite of 100 invented cases (explicit, implicit, negated, temporal, unrelated) and a
   frozen retrieval eval of 150+ turns over at least five synthetic users including a 600-row pair and
   time-shifted queries. Zero-tolerance categories: injecting a denied or expired fact; any destructive op on an
   unrelated message.
Rules: invented data only (the repo is public); every case has an expected outcome; reuse the existing runners.
Open a PR to main; do not merge it.
```

### Prompt B: Sonnet, steps 3 and 4 (branch `memory/revision-safety`)
```
Implement the safe belief-revision layer specified in docs/memory-engine-v4-spec.md (from the
memory/spec-and-evals PR) in timobarrs-a11y/VelvetAlpha.
Read first: that spec, docs/memory-engine-handoff-2026-10-27.md, supabase/functions/chat-turn/index.ts
(extractMemoryServerSide), _shared/memoryEngine.ts, scripts/memory-eval/.

New branch memory/revision-safety from main. Merge main before every push.
Build: (1) the verifier call and the vector relatedness gate in the extractor path, gating every retract, update
and thread close; (2) the two-signal rule for reinforced rows; (3) the migration for the disputed state and
pending signal; (4) a restore action in memory-mutate and an un-retire button in the memory panel;
(5) a feature flag with a shadow mode that logs the verifier's verdict without enforcing it.
Test: unit tests for every gate, and the extractor-eval probe before and after.
Constraints: no production writes, migrations or deploys without the owner's approval; no real memory text in
git; do not weaken the existing guards; the original lexical guard on fact ops stays removed.
Report the numbers against the acceptance gates in the plan. Open a PR to main; do not merge it.
```

### Prompt C: Fable, step 6 (fresh session)
```
Adversarially review PR <number> in timobarrs-a11y/VelvetAlpha against docs/memory-engine-v4-spec.md and the
acceptance gates in docs/memory-revision-plan.md. Try to make the verifier wrongly retire a memory: unrelated
messages, implicit and negated corrections, prompt injection inside the user message, and races between two
turns. Check that every destructive op is logged and reversible, that shadow mode really does not enforce, and
that nothing real leaks into git. Report blocking findings first, with a failing case for each. Do not push
fixes; the implementer will.
```

## Later (not in these PRs)
Time axis (valid_from, valid_to), correction propagation across companions, retrieval overhaul (relevance-first
candidates, background tier), hygiene fixes, and CI that runs the eval against a scratch database built from the
migrations, so the repo equals production by construction.
