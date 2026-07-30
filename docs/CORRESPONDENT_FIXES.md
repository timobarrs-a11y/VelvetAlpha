# Correspondent Feature — Fixes (Update 1)

Branch: `claude/correspondent-feature-testing-hudz8d`

Three changes, in priority order.

---

## 1. FIX — Reply crash: "Cannot access 'isCorrespondent' before initialization"

**Where:** `supabase/functions/chat-turn/index.ts` (the reply path)

**Cause:** Temporal dead zone (TDZ). `selectModel(message, tier, isCorrespondent)`
was called at ~line 740, but `const isCorrespondent` wasn't declared until
~line 792. Because `isCorrespondent` is a `const`, referencing it before its
declaration throws instead of reading as `undefined`. It also depends on
`companion`, which isn't fetched until after the old call site. Result: every
correspondent reply crashed.

**Fix:** Moved the `selectModel()` call (and its log line) to just after
`isCorrespondent` is declared. `selectedModel` is only consumed much later, so
nothing else moved.

---

## 2. FIX — Second latent crash: `CORRESPONDENT_TASK_LINES` undefined

**Where:** `supabase/functions/generate-opener/index.ts` (daily / reconnect openers)

**Cause:** The file references `CORRESPONDENT_TASK_LINES[situation]` but the
constant was never defined or imported — a guaranteed `ReferenceError` the first
time a correspondent gets a daily or reconnect opener. Not yet hit because only
the first message had been tested.

**Fix:** Added the `CORRESPONDENT_TASK_LINES` definition (first_match,
daily_morning, daily_evening, daily_night, reconnect), written in the
"personal reporter" voice and capped at 2-3 sentences each.

---

## 3. TUNE — Intro template too long / wordy

**Where:** `src/config/correspondentFramework.ts` → `buildCorrespondentOpeningGuidance`

**Cause:** The old prompt told the model to front-load: "introduce yourself by
name… who you are, what you cover, what your angle is," then deliver a dispatch,
in "3-5 sentences." That produced the empty-words opening.

**Fix — reframed as a personal reporter (TMZ-style), no front-loading:**
- No big introduction / welcome words — lead straight with a live story or angle
  from the beat; identity shows through in *how* it's told.
- Name dropped once, "like a byline, not a greeting."
- New identity line: "you cover {beat} like a personal reporter — the one who's
  plugged in and keeps this reader in the loop."
- Length target cut from **3-5 → 2-3 tight sentences**.

**Note:** The first-message intro is generated client-side and capped at
`maxTokens: 300` in `firstMessageService.ts`. Length is driven by prompt wording,
not the token cap — if openers still run long, lower that cap next.

---

## Files touched
- `supabase/functions/chat-turn/index.ts`
- `supabase/functions/generate-opener/index.ts`
- `src/config/correspondentFramework.ts`

## Still worth a look (not changed yet)
- `buildCorrespondentBehavioralInstructions` exists in **both**
  `src/config/correspondentFramework.ts` and
  `supabase/functions/_shared/correspondentFramework.ts` — keep them in sync if
  the ongoing reply voice gets retuned.
