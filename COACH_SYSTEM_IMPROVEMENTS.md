# Coach System Improvements — Implementation Guide (for Bolt)

This document describes a set of backend changes that make **coaches (mentors)
feel distinct from companions (romantic/friend)** — starting with the very
first message. Apply these to the real build.

> TL;DR: A coach should open by **restating its purpose** and asking the one
> question it needs to start working — not by making companion-style small talk.
> And its ongoing conversations should run a real **coaching loop**, with tone
> driven by each coach's `accountability_level` / `check_in_style`.

---

## 1. The problem we're fixing

A newly-created coach named "Max" opened with:

> *"Hey TiMo, I'm Max. So what's going on with meeting new people right now—is it
> more that opportunities feel scarce, or you've got chances but something's
> getting in the way when it counts?"*

Two things are wrong:

1. **Wrong topic.** "meeting new people" is a last-resort fallback string. The
   coach's real domain/purpose never reached the first-message generator.
2. **Wrong feel.** Even after the intro, coaches were getting a near-empty
   system prompt on the live chat path — "companion minus flirting" — with no
   coaching structure. So the whole relationship felt like a muted companion,
   not a purpose-built coach.

### Root causes found

| # | Location | Bug |
|---|----------|-----|
| A | `src/App.tsx` → `sendFirstMessage()` | Called `generateFirstMessage(...)` **without** the coach's `expertDomain`/expert config, and derived relationship type from `sessionStorage` instead of the companion row. Result: `personalInterest` fell through to `'meeting new people'`. |
| B | `src/services/firstMessageService.ts` | Coach first-message prompt only knew a (bogus) `personalInterest`; it never used the coach's real domain or instruction, and never restated purpose. |
| C | `supabase/functions/chat-turn/index.ts` | The **live** chat path. For mentors it injected `''` where companions get `BEHAVIORAL_INSTRUCTIONS` — i.e. coaches got **no behavioral framework at all**. |
| D | `supabase/functions/chat-turn/index.ts` | `CURATED_EXPERT_MAP` was a hardcoded subset (~10 of 20 experts) that drifted from `src/config/signatureExperts.ts`. Coaches in the missing domains (interview prep, sleep, communication, language, cooking, social skills, style, home, academic writing, STEM) got **no expert layer**. |

Note: the live path is `ChatService.sendMessageWithSignals` → the `chat-turn`
edge function. The richer client `buildSystemPrompt` (in `systemPromptBuilder.ts`)
is only used by the fallback `ChatService.sendMessage`. Both are addressed below.

---

## 2. New shared modules (single source of truth)

Create two mirrored modules. They define **how a coach behaves** and the
**full curated-expert catalog**. Keep them in sync (client is TS/Vite, edge is
Deno — they can't import each other).

### 2a. `src/config/coachFramework.ts` (client)

Exports:

- `buildCoachBehavioralInstructions({ coachName, userName, domain, accountabilityLevel, checkInStyle })`
  → the coach system-prompt block (the "coaching loop").
- `buildCoachOpeningGuidance({ coachName, domain, instruction })`
  → guidance appended to the first-message generation prompt (restate purpose +
  ask one starter question + forbid small talk/flirting).
- `buildCoachOpeningFallback({ coachName, userName, domain })`
  → deterministic opener when no AI/voice is available.

The `accountability_level` dial maps to gentle / moderate / firm intensity, and
`check_in_style` to proactive / structured / responsive. Unset → gentle +
responsive.

### 2b. `supabase/functions/_shared/coachFramework.ts` (edge / Deno mirror)

Exports:

- `CURATED_EXPERT_MAP` — **all 20** curated experts as
  `{ domain, instruction, checkInStyle, accountabilityLevel }`, mirroring
  `src/config/signatureExperts.ts`. This replaces the inline partial map.
- `getCuratedExpert(id)`
- `buildCoachBehavioralInstructions({ coachName, userName, domain, accountabilityLevel, checkInStyle })`
  (concise edge version of the same coaching-loop block)
- types `AccountabilityLevel`, `CheckInStyle`, `CuratedExpert`

> ⚠️ **Drift risk:** whenever you add/edit a curated expert in
> `src/config/signatureExperts.ts`, update `CURATED_EXPERT_MAP` here too.
> (Long-term: move curated experts into a DB table or a build-shared JSON so
> there's literally one copy. Noted as follow-up, not required for this fix.)

*(Full source for both files is in this branch — copy them verbatim.)*

---

## 3. Wiring changes

### 3a. `src/services/firstMessageService.ts`

- Import `ExpertConfig` and the coach helpers.
- `generateFirstMessage(...)` gains two params:
  `expertConfig?: ExpertConfig | null` and
  `relationshipTypeOverride?: 'friend' | 'romantic' | 'mentor'`.
  - Relationship type now prefers the authoritative override (companion row)
    over `sessionStorage`.
  - `personalInterest` prefers `expertConfig.domain` over any derived interest.
- `generateAIFirstMessage(...)` gains `expertConfig?`. When mentor, it builds the
  prompt from `buildCoachOpeningGuidance` (restate purpose + one question, no
  flirting) instead of the companion "you matched" prompt. All failure fallbacks
  for mentors use `buildCoachOpeningFallback`.
- The old `isMentor && expertDomain` template block is replaced by a
  `buildCoachOpeningFallback` call (so a coach with no signature voice still
  restates purpose).

### 3b. `src/App.tsx` → `sendFirstMessage()`

Resolve the coach's expert config from the companion row and pass it through:

```ts
const expertConfig = companionData.signature_expert
  ? await resolveExpert(companionData.signature_expert, companionData.signature_expert_source, user.id)
  : null;

const firstMsg = await firstMessageService.generateFirstMessage(
  companionData.custom_name, companionData.gender, userName, matchData,
  companionData.signature_voice, userBirthday,
  expertConfig?.domain,
  expertConfig,
  companionData.relationship_type,   // authoritative relationship type
);
```

(`resolveExpert` is already imported in `App.tsx`.)

### 3c. `supabase/functions/chat-turn/index.ts`  ← the live path, highest impact

1. Import from `../_shared/coachFramework.ts`:
   `getCuratedExpert`, `buildCoachBehavioralInstructions`, `AccountabilityLevel`,
   `CheckInStyle`.
2. In the expert-resolution block, also capture the dials and hoist `domain`:
   - User experts: `select('instruction, domain, name, check_in_style, accountability_level')`
     and store `expertAccountability` / `expertCheckInStyle`.
   - Curated: resolve via `getCuratedExpert(id)` (full catalog) and read its
     `accountabilityLevel` / `checkInStyle`.
3. Replace the behavioral injection:

```ts
const behavioralBlock = isMentor
  ? buildCoachBehavioralInstructions({
      coachName: companionName,
      userName: profile.name,
      domain: expertDomain,
      accountabilityLevel: expertAccountability,
      checkInStyle: expertCheckInStyle,
    })
  : BEHAVIORAL_INSTRUCTIONS;
```

   Then use `${behavioralBlock}` in the system prompt where
   `${isMentor ? '' : BEHAVIORAL_INSTRUCTIONS}` used to be.
4. Delete the inline `CURATED_EXPERT_MAP`.

### 3d. `src/config/systemPromptBuilder.ts` (fallback path — keep it consistent)

- Import `buildCoachBehavioralInstructions`.
- After the `expertConfig` LAYER 3 block, inject the coach framework for mentors:

```ts
${isMentor ? buildCoachBehavioralInstructions({
  coachName: companionName,
  userName,
  domain: expertConfig?.domain,
  accountabilityLevel: expertConfig?.accountabilityLevel,
  checkInStyle: expertConfig?.checkInStyle,
}) : ''}
```

### 3e. `src/services/chatService.ts` (tiny type fix)

Widen the param so the mentor value type-checks (it was already passed at
runtime and read from the DB row):

```ts
static async sendMessage(message: string, companionId?: string,
  relationshipType: 'friend' | 'romantic' | 'mentor' = 'romantic'): Promise<string>
```

### 3f. Proactive / scheduled messages (coach variant)

The **live** proactive path is `dailyRitualService.checkAndTriggerRituals` →
`ProactiveMessageService.getScheduledMessage`, which returned companion-flavored
templates ("miss you", "sweet dreams babe") regardless of relationship type — so
coaches sent romantic check-ins.

- `src/services/proactiveMessageService.ts`: add `COACH_MESSAGES`
  (morning/evening/night, goal-oriented, no romance, `{domain}` slot) and
  `getCoachScheduledMessage(timeSlot, { domain })`. This variant skips the
  companion post-processing (no heart emojis, no appended "wyd?").
- `src/services/dailyRitualService.ts`: before sending, look up the companion's
  `relationship_type`. If `mentor`, resolve the coach's domain (best-effort) and
  call `getCoachScheduledMessage`; otherwise keep the existing companion path.

> The `supabase/functions/generate-ai-messages` edge function is **dead legacy**
> (keyed on the old `character_type` model, zero invocations, its
> `ai_initiated_messages` output is read nowhere). Leave it as-is or delete it —
> it is not part of the live proactive path.

### 3g. Drift guard test

`src/services/__tests__/coachExpertParity.test.ts` asserts the edge
`CURATED_EXPERT_MAP` matches `SIGNATURE_EXPERTS` (ids, domain, check-in style,
accountability level). If the two catalogs ever drift, this fails the build
instead of silently dropping a coach's expert layer.

---

## 4. What a coach should now sound like

**First message (Max, domain "finishing your project"):**

> *"Hey TiMo — I'm Max. I'm here to help you actually get this project across the
> finish line. Before we dig in: where does it stand right now, and what's the
> part that keeps stalling?"*

**Ongoing conversations** run the coaching loop: **anchor → diagnose → one
concrete next step → commitment → follow up next time**, with intensity set by
the coach's `accountability_level` (gentle / moderate / firm) and
`check_in_style` (proactive / structured / responsive). No romance, no pet
names, no aimless small talk.

---

## 5. Verification

- Client typecheck (`npm run typecheck`) introduces **no new** errors vs. the
  pre-existing baseline. (The repo does not currently pass `tsc` clean; the fix
  adds none of its own.)
- Unit tests pass: `coachFramework` rendering (accountability/check-in, opening
  guidance, fallback), coach proactive messages (domain interpolation, no
  romance), and the **client↔edge parity** guard.
- Manual: create a coach → confirm the first message names the coach, restates
  its domain/purpose, and asks exactly one starter question with no flirting.
  Then confirm ongoing replies stay goal-anchored and end with a next step, and
  that a scheduled/proactive coach message is a goal check-in, not "miss you".

## 6. Files touched

| File | Change |
|------|--------|
| `src/config/coachFramework.ts` | **NEW** — client coach framework |
| `supabase/functions/_shared/coachFramework.ts` | **NEW** — edge mirror + full 20-expert catalog |
| `src/services/__tests__/coachExpertParity.test.ts` | **NEW** — client↔edge drift guard |
| `src/services/firstMessageService.ts` | Coach-aware first message (restates purpose) |
| `src/App.tsx` | `sendFirstMessage` passes expert config + relationship type |
| `supabase/functions/chat-turn/index.ts` | Coach behavioral block on the live path + full curated map + reads dials |
| `src/config/systemPromptBuilder.ts` | Injects coach framework (fallback path) |
| `src/services/chatService.ts` | Widen `sendMessage` relationship type to include `mentor` |
| `src/services/proactiveMessageService.ts` | Coach proactive check-ins (`getCoachScheduledMessage`) |
| `src/services/dailyRitualService.ts` | Ritual path branches to coach messages for mentors |

## 7. Flag status

**Resolved in this change:**

- ✅ **Coach first message** restates purpose instead of "meeting new people".
- ✅ **Coach ongoing chat** runs a real coaching loop (live `chat-turn` path).
- ✅ **Curated-expert drift** — full 20-expert edge catalog + a parity test that
  fails the build on divergence.
- ✅ **Proactive/scheduled coach messages** — the live ritual path now sends
  goal-oriented coach check-ins for mentors.

**Deliberately deferred (with rationale):**

- **Fully collapsing the two prompt builders** (client `systemPromptBuilder` vs.
  edge `chat-turn`). The correctness concern is already solved — both derive
  coach behavior from the shared `coachFramework`, and the parity test guards the
  catalog. A full merge would mean rewriting the large companion prompt text
  shared by both, which is high-risk for no behavioral gain. Recommend doing it
  only as part of a broader prompt-architecture refactor, not this change.
- **Moving curated experts into a DB table / single cross-runtime source.** The
  parity test already makes drift a build failure, which delivers the safety
  benefit without a fragile client→`supabase/` import or a schema migration +
  backfill for existing coaches. Revisit if the catalog grows large or needs to
  be editable without a deploy.
- **Deleting the dead `generate-ai-messages` edge function.** Out of scope for a
  behavior change; safe to remove separately.
