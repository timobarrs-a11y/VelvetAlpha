# Arrival: getting to know people without a questionnaire

How a new person goes from sign-up to their coach. Replaces the earlier
"spread it over two weeks" plan: personal answers come first, because they change
the first conversation and the look of the app, and Atlas asks the rest himself,
in conversation.

## What's wrong today (found in the code)

1. **About 20 form screens before Atlas says a word.** The personal questionnaire
   (`personalBank.ts`) runs name → nickname → color → birthday → zodiac → gender → six
   interest screens → four "wavelength" questions → a swipe deck, plus 3 beat screens.
2. **Nothing is saved until the last screen.** `UserProfileQuestionnairePageV2` saves only in
   `handleComplete`. Quit at question 15 and everything is lost, and the Daily Feed can't fill
   until the end. (`saveUserLevelAnswers` writes every field at once, so it can't simply be
   called per answer; it needs a per-field save.)
3. **Favorite color does nothing in the chat.** Atlas loads it (`fetchUserProfile` selects
   `favorite_color`) but never uses it, and the Atlas page is hard-coded gold
   (`accent="#c9a961"`).
4. **Atlas only sees half the interests.** His prompt gets hobbies, sports and music, not
   entertainment, tech or lifestyle.
5. **Atlas's opening breaks his own rule.** The canned greeting asks four questions in one
   breath ("existing business? Starting a business? Learning a language? …this year?") and
   opens with "With your personal interests out of the way." His prompt says "ONE question at
   a time" and "never sound like a survey."
6. **The wavelength answers shape coaching but are asked as a form**: conflict, connection,
   decision style, motivation. They go into the coach's system prompt
   (`systemPromptBuilder.ts`), so they matter. They're just asked in the wrong place.

## The arrival, in two acts

### Act 1: a quick questionnaire, in this order (no AI, about 60 seconds)

Quick tap screens using the existing questionnaire shell, each answer saved the moment it's
given:

| # | Question | Notes |
|---|---|---|
| 1 | Name | |
| 2 | Favorite color | **The questionnaire re-skins to that color the moment they tap**, and stays that way for the rest of Act 1 and in Atlas's chat. |
| 3 | Nickname | optional; skip is one tap |
| 4 | Birthday | date wheel |
| 5 | Zodiac | worked out from the birthday and shown as a one-tap confirm ("Scorpio ♏, sound right?"); the cusp question appears only when the date is on a cusp |
| 6 | Gender | also sets how Atlas addresses them (see below) |
| 7 | Hobbies, interests, music | one screen with tabs, last, so the feed is ready the moment they finish |

### Act 2: Atlas introduces himself (the Alfred voice)

This is the first time anyone hears Atlas's voice. He has Act 1's answers, but he doesn't recite
them. He introduces himself, says what Velvet is for, and then asks a probing question.

**Atlas's voice, modeled on Alfred Pennyworth:**
- Impeccably courteous, warm underneath, never gushing.
- Dry, understated wit; a raised eyebrow, never a joke for its own sake.
- Quiet devotion: he is here to serve *their* ambition and takes pride in it.
- Short: one to three sentences, then one question.
- He never reads their answers back as a list ("Formula One, true crime, and teal"). That
  sounds like he's scanning a form. An interest only comes up inside a question that goes
  somewhere.
- Never cold assistant-speak. Banned: "I'm going to get you set up," "Great question," "I'd be
  happy to," "Absolutely!", "Let's dive in," "No worries," "As an AI," "Feel free to,"
  "journey," exclamation marks (almost always), emoji.
- No Batman references. He's Alfred in manner, not in name.

**How he addresses people:** "Master" + name for men and "Miss" + name for women, as Alfred
does. For anyone else, or anyone who'd rather not, it's just the first name. Early on he offers
once: "Shall I keep the formalities, or would you prefer plain Tim?" The answer is saved
(`address_style`) and every AI in Velvet respects it after that.

**Opening: who he is, what Velvet is for, then straight into a probing question** (with a
time-of-day greeting):

> Good evening, Master Tim. I'm Atlas. I look after things here at Velvet.
>
> Velvet exists to help people dream large and then actually see it through. Not just talking
> about it: putting it on the calendar, with someone in your corner until it's done.
>
> So let's find something worth planning. Basketball, I gather. When did you last see a game
> in person, rather than on a screen?

The question in the last paragraph is built from **one** interest, picked because it can lead
to something real (a game, a trip, a class). It is never a list. If nothing in Act 1 lends
itself to that, he asks what they've been meaning to do and haven't.

### Act 2, continued: probing for hidden goals

Atlas is discovering as much as learning. Most people don't arrive with a goal they can state.
They have things they enjoy but rarely do, things they used to do, and things they keep
meaning to do. Atlas's job is to find those and make them real.

**How he probes:**
- **The gap between enjoying and doing.** When did you last do it? Who with? What got in the
  way? What would make it great?
- **Listening for wishes.** "I keep meaning to…", "I used to…", "One day I'd like to…" are
  hidden goals. He picks them up and asks one more question about them.
- **One question at a time**, phrased in terms of what they just said, never a survey.
- **Bigger ambitions count too.** If they bring a big goal ("start a business", "lose 20
  pounds"), he follows it, and the trait questions below apply.

**Every probing thread aims to end in something tangible with a date:**

| They say | Atlas probes | Atlas proposes |
|---|---|---|
| Likes basketball; last saw a game "years ago" | "What kept you away? Tickets, time, or no one to go with?" | "Then let's fix that. Shall I pencil in Saturday to pick a game and buy the tickets?" |
| Likes hiking; "never have time" | "When's the last time you were properly outside for an hour?" | "A walk in the park on Sunday morning, then. Shall I put it down for nine?" |
| Single; mentions wanting to meet people | "What would a good evening out look like for you?" | "Shall I pencil in Thursday evening for it?" |
| "I keep meaning to finish my portfolio" | "How far off is it, honestly?" | "Then one section by Friday. Shall I put that in?" |

**Rules for proposals:**
- He **asks before adding anything** ("Shall I pencil it in?"). They can say yes, pick another
  day, or decline. No reply is a no.
- **One proposal per message**, and at most a few in the whole conversation.
- **No invented specifics.** He doesn't make up fixture dates, venues or prices. When the real
  detail isn't known, the calendar item is the next real step ("Pick a game and buy tickets"),
  not an imaginary event.
- The plan is written in their words, with the goal it serves, so on the day it's clear why
  it's there.

### From conversation to calendar

- `atlas-onboarding` gets the same `add_calendar_event` tool that `atlas-agent` already has
  (`supabase/functions/atlas-agent/index.ts:182`). It writes to `user_events` with
  `metadata: { source: "atlas", tentative: true, goal: "<their words>" }`.
- **Tentative** means Atlas proposed it and they said "pencil it in". It shows on the calendar
  and in Today straight away, marked as pencilled in, with **Confirm / Move / Drop**.
- Existing event types cover it: `task`, `date_idea`, `goal_deadline`, `appointment`,
  `reminder`. No migration is needed; `tentative` lives in `metadata`.
- After onboarding, the coach and the regular Atlas keep doing the same: any agreed plan with a
  date goes on the calendar.

### When a goal comes up: Atlas chooses the right question for it

Yes, Atlas can do this, and it's the right design. He doesn't ask the four "wavelength"
questions in a fixed order. After each answer he picks **the one that matters most for that
goal**, phrases it in terms of that goal, and skips anything he can already tell.

How it's built:

1. **A ledger each turn.** The `atlas-onboarding` function reads the person's
   `communication_profile` and puts what's still unknown into Atlas's prompt, with each trait's
   purpose and its two values:
   - `motivation`: internal / external. Whether the coach leans on accountability.
   - `decisionStyle`: intuitive / analytical. How much the coach lays out options.
   - `conflictResponse`: solutions / empathy. What the coach does when they're frustrated.
   - `connection`: deep / lively. How the coach talks to them.
2. **The choosing rule in his prompt:** "After their answer, pick the single unknown trait that
   would most change how a coach helps with *this* goal. Ask about it in the language of the
   goal. If their words already reveal a trait, record it without asking. Never ask two
   questions in one message."
3. **Recording:** when an answer clearly shows a value, Atlas adds a hidden marker the person
   never sees, `[PROFILE {"decisionStyle":"intuitive"}]`, the same pattern as today's
   `[GOAL_COMPLETE]`. The function checks it against the allowed values and saves it. Unclear
   answers aren't recorded; the coach picks them up later.
4. **Tap or type:** the two answers also appear as chips under his question, so it's one tap if
   they don't feel like typing.
5. **Model:** this conversation should run on **Sonnet**, not Haiku as it does today. Choosing
   the right question and holding a precise voice takes judgment, and it's about 10 turns once
   per person, so the cost is small.

**What that looks like** (the trait he picks first, and why):

| They say | Atlas picks | Atlas asks |
|---|---|---|
| "I want to write a book" | `decisionStyle` (outliner or discovery writer is *the* question for writers) | "A book. Splendid. Are you the sort who maps every chapter before writing a word, or do you prefer to discover the story as you go?" |
| then | `motivation` | "And when the middle chapters drag, as they always do, will your own resolve carry you, or would you like someone in your corner keeping count?" |
| "Lose 20 pounds" | `motivation` (accountability is the biggest lever in fitness) | "Twenty pounds. A worthy campaign. Tell me, does it go better when it's entirely yours, or when someone's expecting a report?" |
| then | `conflictResponse` | "On the mornings the scale refuses to cooperate, would you rather we fix the plan, or would you like to be heard out first?" |
| "Start a business" | `decisionStyle` | "A venture of your own. Are you one to trust your instincts on the big calls, or do you prefer every number in front of you first?" |
| "Learn Spanish" | `connection` (it decides what practice feels like) | "Ah, Spanish. When you practise, do you picture long, proper conversations, or quick back-and-forth to keep it lively?" |
| "I'm not sure" | none yet | He goes back to probing their interests (above) and asks no trait questions until there is a goal. |

**Testing before launch:** a script that runs about 15 made-up people through the real prompt
and checks every reply for:
- exactly one question
- a relevant trait choice
- no banned phrases
- no list of their answers read back to them
- correct markers
- the right form of address
- at least one dated proposal by the end of the conversation, and no calendar entry without a
  yes
- no invented fixture dates, venues or prices

It needs the Anthropic key the Supabase functions already use.

## Today: what they're working on, first thing on the home screen

Talking about a plan is one thing; seeing it every day is another. Every time they open the
app, the first thing on the home screen is what they're doing today. They shouldn't have to
open the calendar to find out.

**Where:** the top of `HomeV3Page`, above the Feed / Your Lens tabs (`src/pages/HomeV3Page.tsx`,
around line 322). The Daily Feed moves below it.

**What it shows**, in time order:
- Today's `user_events`, pencilled-in ones included (`calendarService.getUserEvents` with
  today's start and end).
- `coaching_commitments` that are still pending and due today or overdue (`due_date`).
- Each row has the time, the title, who set it up (Atlas, or the coach's name), and the goal
  it serves in a short line underneath.

**What you can do from it:**
- Tap the circle to mark it done (`completed` on events, `status` on commitments).
- Pencilled-in items show **Confirm / Move / Drop**.
- Tap the row to open it; "See all" opens `/calendar`.

**Shape:**
- At most five rows, then "+N more".
- A header with the date: "Today, Monday 26 October".
- An empty day isn't a blank box. It shows the next thing coming up ("Next: Saturday, pick a
  game and buy tickets"), and if there's nothing at all, one line inviting them to plan
  something with Atlas.
- It works with the calendar and commitments that already exist, so **it can ship before the
  rest of this plan**.

## Before and after

| | Today | Arrival |
|---|---|---|
| Questionnaire screens | ~20 | 7 quick taps |
| Saved if they quit halfway | nothing | everything they answered |
| Feed ready when they reach the lobby | only if they finished | the moment they finish Act 1 |
| Wavelength answers | a form, before the goal | asked by Atlas, chosen to fit the goal |
| Atlas's tone | assistant ("With your personal interests out of the way…") | Alfred |
| Atlas's opening | four questions at once | who he is, what Velvet is for, one probing question |
| What the chat produces | a coach match | a coach match and at least one dated plan on the calendar |
| Home screen | the feed first | Today first, the feed below it |
| Look | gold for everyone | their color from question 2 on |

## Build phases for Bolt

| Phase | What ships | Size |
|---|---|---|
| A0 | **Atlas's voice:** the Alfred style guide and the new opening in `atlas-onboarding` (introduction, what Velvet is for, one probing question built from one interest; no list of answers read back), a time-of-day greeting, `address_style`, and switching this conversation to Sonnet. | Small |
| A1 | **Act 1 order and saving:** reorder `personalBank.ts` to name → color → nickname → birthday → zodiac → gender → interests, with one tabbed interests screen. Save each answer as it's given (a per-field save from `onAnswer`) and resume at the first unanswered question. Move the four wavelength questions and the swipe deck out. Pass all six interest groups into Atlas's prompt. | Small |
| A2 | **Their color:** re-skin the questionnaire shell after question 2, and the Atlas chat (`--shell-*` tokens instead of the hard-coded gold). | Small |
| A3 | **Atlas picks the right question:** the trait ledger, the choosing rule, tap chips, and `[PROFILE …]` marker parsing and validation in `atlas-onboarding`, plus the 15-person test script. | Medium |
| A4 | Swipe deck as a daily feed card; the companion asks love language and "when it's hard" in week 1. | Small |
| A5 | **Today on the home screen:** the Today section above the feed in `HomeV3Page`, with done, confirm, move and drop. No dependencies, so it can go first. | Small–Medium |
| A6 | **Atlas makes plans:** the probing rules and proposal rules in his prompt, the `add_calendar_event` tool in `atlas-onboarding` with `tentative` in metadata, and the extra checks in the test script. | Medium |

## Decisions for Tim

1. **"Master" and "Miss":** keep them as the default with the one-time "shall I keep the
   formalities?" offer (recommended), or first names only?
2. **Sonnet for Atlas's onboarding chat:** about 10 turns once per person. Recommended; Haiku
   will struggle to pick the right question and hold the voice.
3. **Zodiac:** worked out from the birthday with a one-tap confirm (recommended), or asked outright?
4. **Atlas's plans:** go straight onto the calendar as pencilled in once they say yes
   (recommended, because it shows up immediately), or wait in a suggestions list until confirmed?
