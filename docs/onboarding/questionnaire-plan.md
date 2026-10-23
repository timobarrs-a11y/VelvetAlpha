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

## The idea: one continuous arrival, hosted by Atlas

No separate questionnaire. From the first screen it's a conversation with Atlas, in two acts.

### Act 1: "Who you are" (about 90 seconds, scripted, no AI)

Atlas asks each question as a chat message, and the answer UI appears **inside the chat**
as a tappable card (the existing questionnaire archetypes: tap, grid, scrub). Between
questions, Atlas reacts in a sentence before asking the next thing, so it never feels
like a form.

| # | Atlas asks | Answer card | Atlas reacts with | Saved instantly to |
|---|---|---|---|---|
| 1 | "Hey, I'm Atlas. I'm going to get you set up. What should I call you?" | text | uses the name right away | `name` (+ `nickname` if they give a short form) |
| 2 | "When's your birthday? I like to know when to make a fuss." | date wheel | the sign or the countdown ("Scorpio. That explains the confidence."); asks the cusp only if they're on one | `birthday`, `zodiac_sign` |
| 3 | "How should I refer to you?" | chips | none, just moves on (keep it quick and respectful) | `gender` |
| 4 | "Pick a color. This one's yours." | swatches | **the whole chat re-skins to that color, live**: "Better. This is your space now." | `favorite_color` |
| 5 | "What are you into? Tap everything that's you." | one grid with tabs: hobbies · sports · music · shows · tech · lifestyle | names one or two picks and **shows 3 real Daily Feed or Lens items appearing**: "F1 and true crime. Your feed's already filling up." | `hobbies`, `sports`, `music_genre`, `*_interests` |

Why it's scripted:
- **No waiting and no cost.** Reactions come from small pre-written banks per answer.
- **It can't go off the rails** in the most important 90 seconds.
- **It still feels alive.** The banks vary the wording and use what the person just said.

The two moments that sell it:
- **The chat turns their color** right after they pick it.
- **Their feed visibly fills in** right after they pick interests.

That's the game-designer move: every answer changes the screen.

### Act 2: "What you're working toward" (the existing Atlas AI chat, upgraded)

The AI takes over with everything from Act 1 in its prompt, all six interest groups included.
It does the goal discovery it does today, and **weaves in the four wavelength questions
where they naturally belong in a goal conversation**:

| Field (existing values) | How Atlas gets at it, after hearing their goal |
|---|---|
| `motivation` (internal / external) | "What gets you moving on something hard: wanting it for yourself, or someone counting on you?" |
| `decisionStyle` (intuitive / analytical) | "Are you a go-with-your-gut person or a weigh-every-option person?" |
| `conflictResponse` (solutions / empathy) | "When this gets frustrating, what helps more: help fixing it, or someone hearing you out first?" |
| `connection` (deep / lively) | "Do you like real heart-to-hearts, or quick back-and-forth?" (sets how the coach talks to them) |

Rules for Atlas:
- **React, then ask.** Every message is one or two sentences about what they said, then
  *one* question. Never two questions.
- **Skip what he already knows.** If "I just need someone to keep me accountable" already answers
  what motivates them, he doesn't ask it.
- **Quick replies:** each wavelength question shows its two answers as tap chips under his
  message, using the existing option values in `personalBank.ts`. Typing freely always works too.
- **Turn limit:** 10 exchanges (the existing `MAX_TURNS`). Unanswered wavelength
  questions are left for the coach to pick up later. Atlas never stretches the
  conversation to finish them.

How answers are saved:
- Atlas appends a hidden marker the user never sees, the same pattern as the existing
  `[GOAL_COMPLETE]`: `[PROFILE {"decisionStyle":"intuitive"}]`.
- The `atlas-onboarding` function strips it, checks the value against the allowed options,
  and saves it to `communication_profile` (`conflict`, `connection`, `decisionStyle`, `motivation`).
- Tapped chips save directly.

The opening greeting changes too. Instead of four questions in one, it becomes one line
that bridges from Act 1: "Okay, I've got a feel for you. Now the fun part: what's one thing
you'd love to be different a year from now?"

Why this is better than asking those questions later (the old plan): these four answers
pick the coach and set how the coach talks on day one. Asking them *during* the
goal conversation means the coach match and the first coaching session are already
tuned, and they're the most natural questions to ask there.

### What doesn't make the cut for arrival

| Question | Where it goes |
|---|---|
| Swipe "taste" deck | a one-swipe-a-day card on the Daily Feed (fun as a ritual, tiring as a block) |
| Nickname, if not given in #1 | Atlas or the companion picks it up naturally ("what do your friends call you?") |
| Love language, "when it's hard" (companion questions) | the companion asks in character during week 1 |
| Zodiac cusp | asked only when the birthday falls on a cusp (one tap, inside #2) |

## Before and after

| | Today | Arrival |
|---|---|---|
| Screens before Atlas speaks | ~20 | 0 (Atlas hosts from the start) |
| Questions answered | 17 + 6 swipes | 5 taps + the conversation |
| Saved if they quit halfway | nothing | everything they answered |
| Feed ready when they reach the lobby | only if they finished | from question 5 |
| Wavelength answers | form, before the goal | in context, during the goal |
| Chat look | gold for everyone | their color |

## Build phases for Bolt

| Phase | What ships | Size |
|---|---|---|
| A1 | **Save as you go:** a per-field profile save called from `onAnswer`, and resume at the first unanswered question. Pass all six interest groups into Atlas's prompt. Fix the greeting to one bridging question. | Small |
| A2 | **Atlas in their color:** set the chat's `--shell-*` color tokens from `favorite_color` (accent, accent-soft, user bubble) on the Atlas page, replacing the hard-coded gold. | Small |
| A3 | **Act 1 in the chat:** render Act 1's five questions as Atlas messages with inline answer cards (reusing the questionnaire archetypes) and reaction banks. Merge the six interest screens into one tabbed grid. Show the feed preview after interests. | Medium |
| A4 | **Act 2 wavelength:** prompt changes, quick-reply chips, `[PROFILE …]` marker parsing and validation in `atlas-onboarding`. | Medium |
| A5 | Swipe deck as a daily feed card; companion asks love language and "when it's hard" in week 1. | Small |

A1 and A2 are worth doing this week even if the rest waits.

## Decisions for Tim

1. **Act 1 inside the Atlas chat (recommended), or keep it as the separate questionnaire
   screen but faster and saving as you go?** The chat version is the bigger win, but it's more work (A3).
2. **Pronouns question (#3):** keep it in Act 1, or let Atlas infer and only ask when
   unsure? It's needed today for the profile-complete check and for pronouns.
3. **Feed preview after interests:** show real items (needs a fast feed fetch) or
   illustrated placeholders that become real later? Real is much stronger.
4. **Should Atlas's reactions in Act 1 be AI-written** (more alive, about a second of wait
   and a small cost per user) **or pre-written banks** (instant and free)?
   Recommendation: pre-written for launch.
