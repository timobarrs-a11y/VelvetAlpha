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

### Act 1: a quick questionnaire, in this order (no AI, about 90 seconds)

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
| 7 | Hobbies, interests, music | one screen with tabs, so the feed is ready the moment they finish. This is what they already do and like. |
| 8 | Someday | one screen with tabs: things they've always wanted to try but haven't got round to. Optional. See below. |

### Act 1, screen 8: Someday

Interests map what people already do. The real treasure is what they'd like to do and haven't
got round to: the nurse who's always found IT interesting, the person who's meant to learn the
guitar for ten years. That isn't an interest; it's something they're interested *in*. Those are
the easiest goals to turn into plans, because the wish is already there.

The trouble is that nobody can recall these on the spot. Asked "what have you always wanted to
do?", most people go blank. So the screen doesn't ask them to think of anything. It shows them
words and lets them recognise what's theirs.

**The question:**

> **Things you've always been curious about**
> Not what you do now. What you'd try if someone handed you the time. Tap anything that makes
> you think "one day…"

**How it jogs their memory:**
- **Concrete options, starting with a verb.** "Learn to code", not "Technology"; "See the
  Northern Lights", not "Travel".
- **Tabs by part of life**, about ten options each, so each tab is quick to scan.
- **A one-line nudge at the top of each tab** that brings a memory forward.
- **No minimum.** Skip is one tap, and "Something else" takes free text.
- Each tap is saved straight away, like every other answer.

| Tab | Nudge | Options (examples) |
|---|---|---|
| Work | "Ever looked at someone's job and thought, I'd be good at that?" | A field I've always found interesting: Tech & IT, Healthcare, Teaching, Design, Law, Finance, Psychology & counselling, Trades (electrician, carpentry), Cooking professionally, Writing & media, Aviation, Fitness coaching. Also: Start my own business, Get a promotion, Go back to school. |
| Skills | "Something you watched someone do and thought, I could learn that" | Learn to code, Play an instrument, Speak another language, Cook properly, Learn to dance, Fix things around the house, Learn to swim, Drive, Photography |
| Body | "Something you'd do if you felt fitter" | Run a 5K, Do a pull-up, Learn a martial art, Try yoga, Hike a mountain, Get a good night's sleep, Climb |
| Places | "Somewhere you've said 'one day' about" | See the Northern Lights, Road trip, Visit where my family's from, Live abroad for a while, See a wonder of the world, Go somewhere on my own |
| Experiences | "Something you'd regret never doing" | See my team play live, Go to a festival, Skydive, Learn to sail, Do stand-up, Volunteer, Run a marathon |
| Creative | "Something you made as a kid and stopped" | Write a book, Paint or draw, Make music, Start a podcast or channel, Make a short film, Build something with my hands |
| Money & home | "Something you'd sort out if you had a free weekend" | Start investing, Buy a home, Pay off debt, Get organised, Grow my own food, Get a pet |
| People | "Someone you'd like to be closer to, or a crowd you'd like to belong to" | Make new friends, Find a partner, Reconnect with family, Find my people locally, Mentor someone |

**Storing it:** a new `someday` column on `user_profiles` (jsonb), a list of
`{ tab, value, custom }`. This is the only migration in the plan.

**Where it's used:** Atlas gets it in his prompt as things they'd like to try, ranked above
their interests (see "Where goals come from" below). Later it can feed the Daily Feed and Navi's
local suggestions too.

### Act 2: Atlas introduces himself (the Alfred voice)

This is the first time anyone hears Atlas's voice. He has Act 1's answers, but he doesn't recite
them. He introduces himself, says what Velvet is for, and then asks what *they* have in mind.

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

**Opening: who he is, what Velvet is for, then what they already have in mind** (with a
time-of-day greeting):

> Good evening, Master Tim. I'm Atlas. I look after things here at Velvet.
>
> Velvet exists to help people dream large and then actually see it through. Not just talking
> about it: putting it on the calendar, with someone in your corner until it's done.
>
> So let's begin with you. Where do things stand?

Three chips appear under the question (they can also just type):

| Chip | Who it's for | What Atlas does next |
|---|---|---|
| **"I'm already working on something. I need it mapped out and finished."** | They have a goal, often already under way. | "What is it, and how far along are you?" Then what's done, what's left and by when. No discovery; he goes straight to the next step and the calendar. |
| **"I have an idea of what I want. I need help shaping it."** | They know the direction but not the goal. | "Tell me the idea, however rough." Then he shapes it into a goal: what done looks like, and by when. |
| **"I don't have a goal yet. I'd like help finding one."** | They want Atlas to help them find it. | He goes to their Someday picks, then their interests (see "Where goals come from"). |

If they type a goal instead of tapping, he treats it as the first chip. The person is always the
first stop: he never opens with an interest or a Someday pick.

### Act 2, continued: probing for hidden goals

Atlas is discovering as much as learning. Some people arrive with a goal they can state. Many
don't. They have things they keep meaning to do, things they've always been curious about, and
things they enjoy but rarely do. Atlas's job is to find those and make them real.

**Where goals come from, in order:**
1. **The person.** The opening asks where they stand. If they're working on something or have
   an idea, he follows that and brings up nothing else.
2. **Their Someday picks.** If they tapped "I don't have a goal yet", or a couple of turns go by
   with nothing he can turn into a plan, he picks up one thing from screen 8: "You marked tech as something you've
   always been curious about. Is that idle curiosity, or something you'd act on, given a
   nudge?"
3. **Their interests,** last. Only if Someday is empty or nothing there lands: "Basketball, I
   gather. When did you last see a game in person?"

He uses one item at a time and never reads a list back to them.

**How he probes:**
- **Listening for wishes.** "I keep meaning to…", "I used to…", "One day I'd like to…" are
  hidden goals. He picks them up and asks one more question about them.
- **What pulls them toward it.** For a Someday pick: what is it about it? How long has it been
  on their mind? What's stopped them so far?
- **The gap between enjoying and doing,** for interests: when did you last do it? Who with?
  What got in the way?
- **One question at a time**, phrased in terms of what they just said, never a survey.
- **Bigger ambitions count too.** If they bring a big goal ("start a business", "lose 20
  pounds"), he follows it, and the trait questions below apply.

**Every probing thread aims to end in something tangible with a date:**

| Source | They say | Atlas probes | Atlas proposes |
|---|---|---|---|
| Them | "I keep meaning to finish my portfolio" | "How far off is it, honestly?" | "Then one section by Friday. Shall I put that in?" |
| Them | "Get fitter, I suppose" | "What would fitter look like by the new year?" | "Then a first run on Saturday morning. Shall I put it down for eight?" |
| Someday | A nurse, unsure of a goal; picked Tech & IT | "You marked tech as something you've always been curious about. What is it that pulls at you?" | "Then an hour on Thursday evening to look at beginner IT courses. Shall I pencil it in?" |
| Someday | Picked "Play an instrument" | "Which one have you always pictured yourself playing?" | "Half an hour on Saturday to find a teacher or a beginner course?" |
| Interests | Nothing from the above; likes basketball, last saw a game "years ago" | "What kept you away? Tickets, time, or no one to go with?" | "Then let's fix that. Shall I pencil in Saturday to pick a game and buy the tickets?" |

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

**A real goal gets the full setup first.** When the conversation lands on a goal with more than
one step, Atlas builds it on screen and walks them through it in order: **plan → commitments →
progress → calendar**. The calendar comes last, as the summary: estimated finish date, how long
it runs, and which days hold what. After that, he only offers a coach if there's a skill to
learn. The full design is in `docs/goals-and-coaches/plan.md`.

**A small one-off plan** ("pick a game and buy tickets on Saturday") is just pencilled in:

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
| "I'm not sure" | none yet | He moves to their Someday picks, then their interests (see "Where goals come from"), and asks no trait questions until there is a goal. |

**Testing before launch:** a script that runs about 15 made-up people through the real prompt
and checks every reply for:
- exactly one question
- a relevant trait choice
- no banned phrases
- no list of their answers read back to them
- the opening offers the three chips, and each choice leads to its own path (no discovery
  questions for someone already working on something)
- Someday picks and interests only come up once the person hasn't given him something to work
  with, and Someday before interests
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

### Their own plans in Today

Today isn't only for what Atlas and the coaches set up. A doctor's appointment, a bill, a
birthday, or a goal of their own shows up there too.

**Quick add:** a **+** in the Today header opens a short sheet. They type what it is, pick the
day (Today / Tomorrow / a date), optionally add a time, and pick a type with one tap: Task,
Appointment, Birthday, Reminder, Goal. One Save. It goes into `user_events` through
`calendarService.createEvent` with `metadata: { source: "user" }`, so it appears in Today and on
the calendar. The calendar's full form (`EventModal`) stays for anything more detailed.

**Goals of their own:** "Goal" in the same sheet creates a goal in `user_goals` with an
optional target date. The target date becomes a `goal_deadline` event, and Today shows it in
the days before ("Portfolio due Friday, 4 days").

**Repeating events need fixing first.** The calendar can save a repeat (daily, weekly, monthly,
yearly), but nothing repeats it. `calendarService.getUserEvents` only returns rows whose
original `event_date` falls in the range asked for, and neither the calendar page nor
`EventCard` expands repeats. So a yearly birthday only shows on the date it was first entered.
The fix is one shared helper used by both the calendar and Today:
- Fetch one-off events in the range, plus every repeating event that started on or before the
  end of the range.
- Expand each repeating event into its dates within the range.
- Ticking off one day of a repeating task marks that day done (a list of done dates in
  `metadata`), not every future one.

**All-day dates are dates, not moments.** Birthdays and all-day items are compared by month and
day in the person's own time zone. Otherwise a date saved as midnight UTC shows a day early for
anyone west of London.

### Birthdays of the people who matter

**Asking for them:** a one-time card in Today, "Never miss the birthdays that matter. Add your
people," and the same list under Profile → My people. The form is built for speed:
- Name
- Who they are, one tap: Best friend, Family, Partner, Friend, Colleague
- Month and day, plus the year if they know it (optional)
- "Add another" keeps the sheet open, so five people take under a minute.

**Storing them:** each person is a `birthday` event in `user_events` with `recurring: "yearly"`
and `all_day: true`. When they give the year, `event_date` is the actual birth date. When
they don't, `event_date` uses the current year and `metadata.birth_year_known` is `false`, so
no age is ever shown for them.
`metadata` also keeps the person's name and relationship. No migration is needed.

**Showing them:** with a year, Today works out the age: **"Queen's 57th birthday"**. They never
typed 57; it's this year minus the year they gave, with the right ending (1st, 2nd, 3rd, 11th,
12th, 13th, 21st, 22nd…). Without a year it's just "Queen's birthday". Someone born on 29
February shows on the 28th in other years.

**Seeing them coming:** birthdays also appear in Today's "coming up" line a week ahead
("Queen's 57th birthday, Saturday"), so there's time to plan something. The existing
`suggest-events-gifts` function can offer gift ideas from there later.

## Before and after

| | Today | Arrival |
|---|---|---|
| Questionnaire screens | ~20 | 7 quick taps |
| Saved if they quit halfway | nothing | everything they answered |
| Feed ready when they reach the lobby | only if they finished | the moment they finish Act 1 |
| Things they'd like to try but haven't | never asked | a Someday screen Atlas draws on when they're unsure of a goal |
| Wavelength answers | a form, before the goal | asked by Atlas, chosen to fit the goal |
| Atlas's tone | assistant ("With your personal interests out of the way…") | Alfred |
| Atlas's opening | four questions at once | who he is, what Velvet is for, then "Where do things stand?" with three chips |
| What the chat produces | a coach match | a coach match and at least one dated plan on the calendar |
| Home screen | the feed first | Today first, the feed below it |
| Their own appointments, tasks and goals | only on the calendar page | in Today, added in a few taps |
| Birthdays | a yearly birthday never repeats | every year, with the age worked out ("Queen's 57th birthday") |
| Look | gold for everyone | their color from question 2 on |

## Build phases for Bolt

| Phase | What ships | Size |
|---|---|---|
| A0 | **Atlas's voice:** the Alfred style guide and the new opening in `atlas-onboarding` (introduction, what Velvet is for, then "Where do things stand?" with the three chips and their three paths; no list of answers read back), a time-of-day greeting, `address_style`, and switching this conversation to Sonnet. | Small |
| A1 | **Act 1 order and saving:** reorder `personalBank.ts` to name → color → nickname → birthday → zodiac → gender → interests, with one tabbed interests screen. Save each answer as it's given (a per-field save from `onAnswer`) and resume at the first unanswered question. Move the four wavelength questions and the swipe deck out. Pass all six interest groups into Atlas's prompt. Add the Someday screen (8) and its `someday` column, and pass the picks to Atlas. | Small–Medium |
| A2 | **Their color:** re-skin the questionnaire shell after question 2, and the Atlas chat (`--shell-*` tokens instead of the hard-coded gold). | Small |
| A3 | **Atlas picks the right question:** the trait ledger, the choosing rule, tap chips, and `[PROFILE …]` marker parsing and validation in `atlas-onboarding`, plus the 15-person test script. | Medium |
| A4 | Swipe deck as a daily feed card; the companion asks love language and "when it's hard" in week 1. | Small |
| A5 | **Today on the home screen:** the Today section above the feed in `HomeV3Page`, with done, confirm, move and drop. No dependencies, so it can go first. | Small–Medium |
| A6 | **Atlas makes plans:** the probing rules, the order goals come from (them, then Someday, then interests) and the proposal rules in his prompt, the `add_calendar_event` tool in `atlas-onboarding` with `tentative` in metadata, and the extra checks in the test script. | Medium |
| A7 | **Repeating events that repeat:** the shared expand-repeats helper used by the calendar page and Today, done dates per occurrence, and all-day dates compared in local time. Fixes the calendar as it is today, so it should go before A8. | Small–Medium |
| A8 | **Their own plans and their people:** quick add in Today (task, appointment, birthday, reminder, goal), the My people birthday form and the one-time Today card, ages worked out from the birth year, and birthdays a week ahead in "coming up". | Medium |

## Decisions for Tim

1. **"Master" and "Miss":** keep them as the default with the one-time "shall I keep the
   formalities?" offer (recommended), or first names only?
2. **Sonnet for Atlas's onboarding chat:** about 10 turns once per person. Recommended; Haiku
   will struggle to pick the right question and hold the voice.
3. **Zodiac:** worked out from the birthday with a one-tap confirm (recommended), or asked outright?
4. **Someday screen:** in Act 1 as screen 8 (recommended, because it's Atlas's main backup
   when someone is unsure), or offered later in the first week to keep Act 1 shorter?
5. **Atlas's plans:** go straight onto the calendar as pencilled in once they say yes
   (recommended, because it shows up immediately), or wait in a suggestions list until confirmed?
