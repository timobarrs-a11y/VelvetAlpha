# Project Velvet — Changes Made (for Bolt handoff)

Branch: `claude/splash-questionnaire-redesign-t9v3m0`
Commits: `6595280`, `148c6e7`, `b601597`, `c95a5ff`

## 1. Splash page — highlight Friend / Companion / Coach

**File:** `src/pages/SplashPage.tsx`

The three feature cards under the hero used to advertise generic product
features ("Built By You", "Semantic Memory Engine", "A World Built Around
You"). Replaced them with cards for the three actual bot paths the app
offers (these paths already exist and are defined in
`src/pages/IntentSelectPage.tsx`):

- **Friend** (icon: `Users`, blue accent) — "Platonic companions"
- **Companion** (icon: `Heart`, pink accent) — "Romantic + close bonds"
- **Coach** (icon: `Brain`, green accent) — "Expert agents"

Copy was adapted from the existing descriptions in `IntentSelectPage.tsx`
so the splash page and the actual selection screen say the same thing.
No layout/animation changes — same card component, same hero, same CTAs.

If asked to push this further: the splash page still doesn't literally
route to `/intent-select` when a card is clicked (cards are decorative,
same as before) — only the "Create Account" / "Enter Project Velvet"
buttons navigate. Worth asking the user if cards should become clickable
shortcuts straight into that path.

## 2. Friend-path questionnaires (new)

**Files:** `src/pages/QuestionnairePage.tsx`, `src/pages/CreateAdditionalCompanionPage.tsx`

**Bug being fixed:** the personality questionnaire picked its question
set (`GIRLFRIEND_QUESTIONS` / `BOYFRIEND_QUESTIONS`) based on gender
only, never on whether the user said they wanted a *friend* vs a
*romantic* connection. So a user who picked "Just a friend to talk to"
still got asked "Picture Your Dream Girl... Is She:" and "When She Likes
You, How Does She Show It?" — romantic framing for a platonic bot.

**Fix:** added two new question arrays per file —
`FEMALE_FRIEND_QUESTIONS` and `MALE_FRIEND_QUESTIONS` — that are
**structurally identical** to the romantic sets (same `id`s, same
answer options, same order, same field count) so none of the backend
personality-generation code needed to change. Only the **question text**
was reworded, and only on the 3 questions that assumed a romantic
relationship:

| Question id | Romantic wording | Friend wording |
|---|---|---|
| `energy` | "Picture Your Dream Girl/Guy... Is She/He:" | "Picture Your Ideal Friend... Is She/He:" |
| `flirtingStyle` | "When She/He Likes You, How Does She/He Show It?" | "When She's/He's Excited To Hang Out, How Does She/He Show It?" |
| `dynamic` | "In A Relationship, You Prefer:" | "In Your Friendship, You Prefer:" |

Everything else (humor style, confrontation style, availability, love
language, support style, life context, communication, emotional
openness, conversation depth, expressiveness, initiative, name) was left
as-is — those questions already read fine for a platonic relationship
and the user asked to keep the answers/options unchanged.

**Wiring:** both files now branch on the `connectionType` answer
("Just a friend to talk to" → friend set, "Something more..." →
romantic set) combined with the gender answer, instead of branching on
gender alone. This happens in two places per file (the question-list
builder and the last-question detector inside the submit handler) —
both had to be updated in lock-step or the progress bar / final-question
detection would use the wrong array length.

**Note:** pronouns were kept as he/she per the selected gender (not
switched to gender-neutral they/them) — that was a judgment call since
the original request was ambiguous on this point. Flag to the user if
they want it changed.

## 3. Bug fix — creating a 2nd bot reopened the 1st bot's chat

**Files:** `src/pages/CreateAdditionalCompanionPage.tsx`,
`src/routes/rootRedirect.tsx`, `src/pages/CreateUserAvatarPage.tsx`

**Symptom:** user creates a Coach, then later adds a Companion. After
finishing the companion-creation questionnaire, the app dropped them
back into the *coach's* chat instead of the new companion's. Had to
manually go to the lobby and pick the new companion to see it.

**Root cause:** Once a user has ≥1 bot, the lobby's "Add Companion"
button routes to `CreateAdditionalCompanionPage.tsx` (a separate,
simpler onboarding flow from the first-time one). Its
`createCompanionFromAnswers` function called `createCompanion(...)` but
**never stored the new companion's id anywhere** — it just discarded the
return value. Every downstream page (`SignatureVoiceSelectionPage`,
`CreateCompanionAvatarPage`) reads `sessionStorage.getItem('currentCompanionId')`
to know which bot it's currently working on. Since that flow never set
it, whatever id was already sitting in `sessionStorage` from the
*original* onboarding (the coach) was still there and got used —
so the voice got saved onto the coach, the avatar got saved onto the
coach, and the final "take me to chat" redirect opened the coach.

Compounding this: `rootRedirect.tsx` and `CreateUserAvatarPage.tsx` had
"cleanup" code that called `localStorage.removeItem('currentCompanionId')`
/ `localStorage.removeItem('matchAnswers')` — but those keys are only
ever written via `sessionStorage.setItem`, never `localStorage.setItem`.
Removing from the wrong storage is a silent no-op, so these onboarding
flags never actually got cleared and could persist in `sessionStorage`
for the entire browser tab session, ready to leak into the *next* bot
creation.

**Fix:**
1. `CreateAdditionalCompanionPage.tsx` — capture the `createCompanion(...)`
   return value; on success, `sessionStorage.setItem('currentCompanionId', companion.id)`
   and reset `sessionStorage.setItem('onboardingIntent', 'connection')`
   so later steps don't mistake this for a coach-creation flow. The
   submit handler now only navigates to `/voice-selection` if a
   companion was actually created (falls back to `/lobby` on failure,
   same pattern used elsewhere in the app).
2. `rootRedirect.tsx` and `CreateUserAvatarPage.tsx` — changed the 3
   stray `localStorage.removeItem(...)` calls on `currentCompanionId`/
   `matchAnswers` to `sessionStorage.removeItem(...)` so the flags are
   actually cleared once onboarding completes.

**How to verify manually:** create a Coach, finish onboarding, land in
its chat. From the lobby, add a Companion, finish that questionnaire —
you should land in the *new companion's* chat immediately, not the
coach's, and the coach's avatar/voice should be untouched.

## 4. Bug fix — bots hallucinating/misreporting the current time

**Symptom:** during a conversation, a companion said something like "you
were up at 5am" when it wasn't actually 5am for the user.

**Files:** `supabase/functions/chat-turn/index.ts`,
`supabase/functions/_shared/coachFramework.ts`, `src/services/chatService.ts`

**Root cause (confirmed by tracing the actual send path):** the chat UI's
message handler (`App.tsx`) calls `ChatService.sendMessageWithSignals`,
which posts to the **`chat-turn` Supabase Edge Function** — a
server-side Deno function, not the client-built-prompt path. That
function computed the time it hands to the model like this:

```ts
const currentDateTime = new Date().toLocaleString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  hour: "numeric", minute: "numeric", timeZoneName: "short",
});
```

With no `timeZone` option, `toLocaleString` uses the **server's own
clock** — on Supabase's edge runtime that's UTC — not the user's local
time. That value gets labeled `Current Date/Time: ...` and injected
straight into the system prompt as if it were the user's actual local
time. For any user not near UTC, this is off by several hours — e.g. a
user chatting at 9-10pm Pacific would have the model told it's
"5-6am," which is exactly the reported symptom.

This was compounded by a second bug: `user_profiles.timezone` defaults
to `'America/New_York'` (see migration
`20260213183213_add_timezone_to_user_profiles.sql`, which even says in
its own comment "Updated on user login if browser timezone differs")
but **nothing in the codebase ever actually updates it** — so even the
DB-stored fallback timezone was never trustworthy for non-Eastern
users.

A third, smaller contributor: the shared `BEHAVIORAL_INSTRUCTIONS`
prompt block (duplicated in both `chatService.ts` and
`chat-turn/index.ts`) has a "TIME AWARENESS" section that lists example
hour ranges as *tone* guidance (e.g. "Late night (10pm-3am): softer,
more intimate energy"). Nothing told the model these were just mood
buckets, not facts — so it had no barrier against echoing a
specific-sounding number like "5am" back to the user as if reporting
real time.

**Fix (three parts, all needed together):**

1. **`chat-turn/index.ts`** now accepts an optional `timezone` field in
   the request body (IANA string, e.g. `America/Los_Angeles`) and uses
   it as the `timeZone` option when formatting `Current Date/Time`,
   falling back to `profile.timezone` then `'America/New_York'` only if
   the client didn't send one. It also opportunistically writes the
   client-supplied timezone back onto `user_profiles.timezone` when it
   differs, so the stored value stays accurate for other things that
   read it (streaks, daily boundaries).
2. **`chatService.ts`** (client) now detects the browser's real
   timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and
   sends it as `timezone` on every request to `chat-turn`. It also uses
   this detected value (instead of the stale DB default) when building
   its own client-side temporal context, and likewise writes it back to
   the profile when it differs.
3. Added an explicit **"CRITICAL — DO NOT INVENT A CLOCK TIME"**
   instruction right above the TIME AWARENESS hour-range list in both
   `BEHAVIORAL_INSTRUCTIONS` copies, and a shorter version in
   `_shared/coachFramework.ts` (coaches use a different instruction
   block that didn't have this at all). All three now say: the hour
   ranges are tone calibration only, the literal `Current Date/Time`
   line is the only source of truth, and the model must never state a
   specific clock time unless it exactly matches that line — vague
   language ("pretty late", "up early") instead of invented numbers.

**⚠️ Deployment note — this will NOT take effect just by pushing to
git.** `chat-turn/index.ts` and `_shared/coachFramework.ts` are
Supabase Edge Functions. There's no CI/CD in this repo that deploys
them automatically (checked `.deployrc.json` and `.github/workflows` —
neither handles Supabase function deploys). Whoever owns the Supabase
project needs to run something like:

```
supabase functions deploy chat-turn
```

(and redeploy anything else that imports `_shared/coachFramework.ts`)
before this fix is live. The `src/services/chatService.ts` change ships
normally with the next frontend build/deploy.

**How to verify:** change your OS/browser timezone to something far
from Eastern time (e.g. a Pacific or international zone), start a
fresh chat, and ask the companion what time it thinks it is — it
should match your actual local clock, not a UTC-shifted guess.

## 5. Bug fix — coach responses cut off mid-sentence

**Symptom:** during conversations with a Coach, the reply would stop
abruptly partway through a sentence, as if something blocked it.

**File:** `supabase/functions/chat-turn/index.ts`

**Root cause:** this is the same edge function from fix #4. It sends
`max_tokens` straight from a tier lookup table to Anthropic and returns
whatever text comes back with **no check for whether the response was
actually cut off**:

```ts
function getMaxTokensForTier(tier: string): number {
  switch (tier) {
    case 'free': return 100;
    case 'unlimited': return 300;
    case 'starter': return 600;
    case 'plus': return 900;
    case 'elite': return 1200;
    ...
  }
}
```

Coaches are prompted to run a structured "ANCHOR → DIAGNOSE → DIRECT →
CLOSE THE LOOP" response pattern (see `_shared/coachFramework.ts`),
which is inherently longer than a casual companion reply. On the
common tiers (free = 100 tokens, unlimited = 300 tokens — the default
for most users), that structure routinely doesn't fit, Anthropic stops
generating exactly at the token ceiling, and whatever half-formed
sentence was mid-flight gets returned to the user verbatim — reading
like the bot just stopped talking.

**Fix (two parts):**
1. Coaches now get a **600-token floor** regardless of subscription
   tier: `const maxTokens = isMentor ? Math.max(getMaxTokensForTier(tier), 600) : getMaxTokensForTier(tier);`
   — free/unlimited-tier coaches jump from 100/300 to 600; starter and
   above are unaffected (already ≥600).
2. As a safety net for the cases that still hit the ceiling (very
   long/detailed coaching answers, or non-coach chats that also run
   long), added `trimToLastCompleteSentence()`: if Anthropic's
   response comes back with `stop_reason === 'max_tokens'`, trim the
   text back to the last `.`/`!`/`?` instead of returning the raw
   mid-word cutoff. It refuses to trim if that would gut more than 60%
   of the reply (protects against replies with no punctuation, e.g.
   lists) — in that rare case it returns the full untrimmed text rather
   than an empty message.

**Same deployment note as fix #4:** this lives in the `chat-turn` Edge
Function and needs `supabase functions deploy chat-turn` to go live —
pushing to git alone doesn't deploy it.

## 6. UX fix — chat input doesn't grow for longer messages (mobile)

**Symptom:** on mobile, typing a longer message kept it on one line —
the box didn't grow, so you couldn't see what you'd typed; had to
scroll sideways inside a tiny field. Modern chat apps (iMessage,
WhatsApp, etc.) grow the box as you type.

**File:** `src/components/ChatInput.tsx` (shared by both the main
companion/coach chat in `App.tsx` and the Co-Author panel), plus one
alignment tweak in `App.tsx`.

**Root cause:** the message field was a single-line `<input
type="text">`, which by definition never grows — long text just
scrolls horizontally inside the field.

**Fix:**
- Replaced the `<input>` with an auto-resizing `<textarea>` that grows
  with content up to ~5 lines (120px), then scrolls internally rather
  than growing forever.
- `Enter` sends the message, `Shift+Enter` inserts a newline (matches
  the "modern messaging app" convention you asked for).
- Height resets back to one line after sending.
- In `App.tsx`, changed the mobile toolbar row from
  `items-center` to `items-end` so the send button and the Mochi/style
  icons stay bottom-aligned as the box grows, instead of the whole row
  re-centering awkwardly (this already matched on desktop; mobile was
  the one still on `items-center`).

This is a pure frontend change — no edge function deploy needed, ships
with the next normal frontend build.

## Not changed / out of scope

- Did not touch `ExpertQuestionnairePage.tsx` / `ExpertSelectionPage.tsx`
  (the coach-creation flow) — it already sets `currentCompanionId`
  correctly and wasn't implicated in the reported bug.
- Did not change any Supabase schema/migrations.
- Did not change the friend/romantic *option text* — only question
  headers, per the original request ("the answers are the same").
