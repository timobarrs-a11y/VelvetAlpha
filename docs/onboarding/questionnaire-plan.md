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

## The whole arrival: what comes first, and what waits

Velvet asks a lot of a new person: a profile, Atlas, a coach, an avatar, a companion, a house,
community, games. Asked all at once, they quit before they see why any of it matters.

**Velvet is about getting your life back on track, today.** That is the line on the share link
("Get Your Life Back On Track Today") and the promise of the first minute. What keeps people is
the conversation, with Atlas and later with a coach or companion, not the forms, the avatar or the
game. In testing, most people skimmed the interest screens to get to the end. So everyone reaches
Atlas within a minute of signing in, and the rest of Velvet (your look, your home, the town, the
interests) comes after the plan, for those who choose it.

**Velvet is more than AI coaching; it's a community, and you're in it as yourself.** An avatar
represents you on community boards, in chats and on your billboard in town. That still matters,
and the full ramp (below) builds it, but after Atlas has helped, not before.

**The game is not part of onboarding.** Dez, "Town" and Velvet Sims stay out of the first
session; nothing in it is hosted by a game character. The game is something they find later.

**The rule for everything else: ask for something only at the moment it pays off.** Anything
not in the first session waits until they reach the feature that needs it, and nothing ever
blocks the way, because every setup has a good default.

**Value is three things**, and the first session shows all three:
1. **There are people here.** You have a look, a home on a street, neighbors, and spaces that
   match your interests.
2. **Atlas sets goals with you,** and someone (an assistant or a coach) carries them with you.
   Your first step is already in Today.
3. **There's plenty to do in between:** the town, games, companions.

### How it was wired before this plan (found in the code, 30 October)

Welcome screen ("Welcome to Town! You'll see your place in a bit") → the personal questions,
hosted by Dez, "Mayor of Town" → Atlas sets the goal → "Create my avatar" → your look → your home
→ back to Atlas for the coach, the plan walkthrough and the billboard → the lobby. The town
look-around was only reached when resuming. Atlas was cut in half by the avatar and house, and the
game's character asked for real birthdays.

### The first session: one card, then Atlas, then a choice

| # | Step | Time |
|---|---|---|
| 1 | Sign up | |
| 2 | **One card:** name, nickname (optional), birthday, gender. No host character, no welcome splash. | ~20 s |
| 3 | **Atlas:** the goal, in conversation (Act 2 below), with the Common goals dropdown | ~3 min |
| 4 | **Meet your assistant or coach,** generated for the goal | ~20 s |
| 5 | **The setup walkthrough:** plan, commitments, progress, then the calendar | ~1 min |
| 6 | **The choice:** "Your plan's set. Go to Today, or take a few minutes to build your place in town?" | |
| 7a | **Quick ramp:** Today, with their first step at the top and the coach's chat open | |
| 7b | **Full ramp:** interests and Someday (skipped if Atlas already asked them), your look, your home and billboard, a look around the town, then Today | ~6 min |

**Why the choice comes after Atlas:** both ramps start with Atlas, so asking first would put a
decision in front of them before any value. Asked once the plan is set, Velvet has already helped,
and anyone who picks the full ramp has opted into the questions and the creator.

**Quick ramp defaults:** the avatar is generated from gender (randomized), the house is a random
starter style, the billboard shows their name. The "Your first week" card offers the avatar, the
house and the interests later; nothing blocks anything.

**Full ramp, the creator steps:**

**Your look.** A short screen first:

> **Now, you.**
> In Velvet, you're not a profile picture. This is you on the community boards, in every
> chat, and on your billboard in town. It's not about looks; make it feel like you.

- The creator opens already set from the card: gender, and their favorite color on the outfit
  if they gave one. It never starts from a blank face. **Randomize** stays.

**Your home.**

> **Every member has a home on the street.**
> Your house is how the town sees you. Your billboard out front tells people who you are.

- **House:** the starter styles (`src/features/velvet-world/Customizer.tsx`), member and earned
  houses shown locked.
- **Billboard:** name, a one-line **headline** with tappable starters, the spaces from their
  interests, and their goal if they said yes to showing it during the walkthrough.

**A look around.** They land in the town (`/world`) on their own block, with three captions in
turn ("This is your block", "Tap any billboard", "Change anything, any time"), then **Go to
Today**. The town's own welcome popup (`WorldWelcome.tsx`) never shows for them.

**Velvet House is not part of onboarding**, on either ramp.

**What leaves the first session:** the Welcome splash, Dez as the host of the questions, the
coach avatar designer and background picker as compulsory steps, and the tour inside the coach
chat.

### What waits until it's needed

| Setup | When it's asked | Default until then |
|---|---|---|
| **A companion** | When they open Velvet House (the game inside a home you share with a companion), or from a Today card in the first week: "Someone to talk to between goals." | None. Velvet House shows the invite instead of borrowing the coach or assistant. |
| **Companion look, voice and background** | Inside the companion setup, as today. | |
| **Pricing** | After they've had value: their first completed step, or the first time they reach a paid feature. Not in the middle of creating a companion. | |
| **Birthdays of their people** | The one-time card in Today. | |

### Keeping them coming back between goals

- **A "Your first week" card** on the home screen, replacing `FinishSetupCard`. It lists five
  optional things: add a friend in town, say something in a space, play a game, meet a
  companion, add your people's birthdays. Each is one tap away and ticks off when done. It disappears once all five
  are done or the week is over.
- **Today always has something:** a goal step, a birthday, or a "between goals" suggestion
  (a game, a space that's busy, the companion).

## The arrival, in two acts

### Act 1: the one card, and the rest on the full ramp

The first session asks only **name, nickname, birthday and gender**, on one card, saved as they
go. Zodiac is worked out from the birthday, with the one-tap confirm shown on the card when the date
is on a cusp. The rest of the questions below (color, interests, Someday) are asked on the **full
ramp**, after Atlas, or by Atlas himself when someone has no goal (see "Where goals come from").
The screens, when shown, are quick taps in the existing questionnaire shell, saved per answer:

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

### Someday (the inline picker and the full ramp)

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
once, as a remark so the message still asks only one question: "I'll keep the formalities,
unless you'd rather plain Tim; just say the word." The answer is saved
(`address_style`) and every AI in Velvet respects it after that.

**The opening is a little small talk, then the segue.** Going straight to "What are you trying
to get done?" sounds like a form with a voice. Atlas opens the way a person would: a greeting by
name, who he is in a line, and one light, easy question about them, not about goals. He never says
the tagline ("get your life back on track"); from him it sounds canned.

> Good evening, Master Tim. I'm Atlas; I look after things here.
>
> How's the evening treating you so far?

**One or two exchanges of small talk, never more.** He answers what they actually said, briefly
and warmly, with a touch of dry wit, and asks at most one more light question if it flows. Small
openers he can draw on (one per conversation, chosen from what he knows):
- the time of day or the day of the week ("A Sunday evening sign-up. Planning the week, or
  avoiding it?");
- their birthday, when it's close ("Your birthday's in a fortnight, I see. Any plans?");
- their nickname, if it invites a question ("Ace. Earned, or bestowed?");
- simply how the day's going.

**Then the segue,** tied to what they just said, not a hard turn:
- "Tired, and you still signed up for something new. Something must be on your mind. What brought
  you here?"
- "Planning the week, then. Is there something in it you'd like to finally get moving on?"

**If they lead,** he follows: someone who opens with their goal ("I need to lose 20 pounds")
skips the small talk entirely, and someone who taps a Common goal goes straight to it. Small talk
is a way in, never a gate.

The wording varies with the time of day, the address style and what they say; the shape doesn't:
greeting, a little small talk, a segue into what they came for.

**Common goals.** Under the input, from the first message on, is a collapsed **"Most picked by the community"** dropdown.
Closed by default, so the question stays the focus. Opened, it shows 10 to 20 broad goals as
buttons, for example:

Lose weight · Get fit · Write a book · Learn a new skill · Learn a language · Change careers ·
Start a business · Save money · Get out of debt · Get organised · Sleep better · Eat better ·
Find a new job · Go back to school · Read more · Make more friends · Travel more · Start a side
hustle

The list starts hand-picked and is later ranked by what people actually tap. A button only opens
the topic; Atlas makes it specific, one question at a time: "A new skill. Which one did you have
in mind?" Then the conversation runs as below.

**No goal yet.** If they say they don't have one (typed, or the chip below), Atlas uses their
interests as the way in: "That's all right, most people don't arrive with one. What are you into?
We can start from there." and the interests picker opens inline in the chat (the same tabs as the
questionnaire screen, plus Someday). What they tap is saved as their interests, and Atlas picks
one thing from it to probe (see "Where goals come from").

Three chips appear with the segue question (they can just type instead):

| Chip | Who it's for | What Atlas does next |
|---|---|---|
| **"I'm already working on something. I need it mapped out and finished."** | They have a goal, often already under way. | "What is it, and how far along are you?" Then what's done, what's left and by when. No discovery; he goes straight to the next step and the calendar. |
| **"I have an idea of what I want. I need help shaping it."** | They know the direction but not the goal. | "Tell me the idea, however rough." Then he shapes it into a goal: what done looks like, and by when. |
| **"I don't have a goal yet."** | They want Atlas to help them find one. | The interests picker, inline, as above. |

If they type a goal instead of tapping, he treats it as the first chip. The person is always the
first stop: he never opens with an interest or a Someday pick.

### Act 2, continued: probing for hidden goals

Atlas is discovering as much as learning. Some people arrive with a goal they can state. Many
don't. They have things they keep meaning to do, things they've always been curious about, and
things they enjoy but rarely do. Atlas's job is to find those and make them real.

**Where goals come from, in order:**
1. **The person.** The opening asks where they stand. If they're working on something or have
   an idea, he follows that and brings up nothing else.
2. **Their Someday picks,** from the inline picker. If they said they don't have a goal yet, or a
   couple of turns go by with nothing he can turn into a plan, he picks up one thing from it: "You marked tech as something you've
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

**A real goal gets someone to carry it, then the full setup.** When the conversation lands on
a goal with more than one step:
1. **Atlas generates who'll carry it:** a **coach** if there's a skill to learn (Spanish,
   coding), otherwise an **assistant** (planning a wedding, buying a home). They get a
   randomized avatar and name, shown on a "Meet Maya" card with **Change anything** for anyone
   who wants to design them by hand.
2. **Atlas walks them through the setup** that person will run with them: **plan →
   commitments → progress → calendar**. The calendar comes last, as the summary: estimated
   finish date, how long it runs, and which days hold what.
3. **He asks once whether to show the goal on their billboard.**

The full design is in `docs/goals-and-coaches/plan.md`.

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
| What the chat produces | a coach match | a goal with its plan on the calendar, and an assistant or coach to carry it |
| Before Atlas | about 20 form screens | quick questions, then making their avatar and their home in town |
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
| A4 | Swipe deck as a daily feed card; the companion asks love language and "when it's hard" in week 1. | Small *Built:* the two questions left the companion setup and are asked in conversation in the first week (`_shared/companionWeekOne.ts`), saved from a hidden `[TRAIT …]` marker. The "this or that" feed card was built, then removed (26 October): it cluttered the feed and added little. `user_profiles.taste_picks` is left unused. |
| A5 | **Today on the home screen:** the Today section above the feed in `HomeV3Page`, with done, confirm, move and drop. No dependencies, so it can go first. | Small–Medium |
| A6 | **Atlas makes plans:** the probing rules, the order goals come from (them, then Someday, then interests) and the proposal rules in his prompt, the `add_calendar_event` tool in `atlas-onboarding` with `tentative` in metadata, and the extra checks in the test script. | Medium |
| A7 | **Repeating events that repeat:** the shared expand-repeats helper used by the calendar page and Today, done dates per occurrence, and all-day dates compared in local time. Fixes the calendar as it is today, so it should go before A8. | Small–Medium |
| A8 | **Their own plans and their people:** quick add in Today (task, appointment, birthday, reminder, goal), the My people birthday form and the one-time Today card, ages worked out from the birth year, and birthdays a week ahead in "coming up". | Medium |
| A9 | **The first-session chain:** the progress strip and saving at each step; the "Now, you" screen and the avatar creator set from Act 1, recording what was chosen by hand; the house and billboard step with headline starters; the scripted look around the town with **Continue to Atlas**; Atlas's remark on a hand-picked choice; meet your assistant or coach (randomized, with Change anything); the billboard goal question; Community and Games highlights on home; avatar-free companion and pricing timing as in "What waits". | Medium–Large |

## Decisions (made by Tim, 26 October)

1. **"Master" and "Miss"** are the default, with the one-time "shall I keep the formalities?"
   offer.
2. **Atlas's onboarding chat runs on Sonnet.**
3. **Zodiac** is worked out from the birthday, with a one-tap confirm.
4. **The Someday screen** is in Act 1, as screen 8. (Superseded 30 October: see below.)
5. **Atlas's plans** go straight onto the calendar as pencilled in once they say yes.

## Decisions (made by Tim, 30 October)

1. **The share-link line is "Get Your Life Back On Track Today"** (`index.html`).
2. **Atlas comes first for everyone,** after one card: name, nickname, birthday, gender.
3. **The quick-or-full choice comes after Atlas's plan**, not before.
4. **Dez and Town are out of onboarding.** The game is found later.
5. **Atlas does not repeat the tagline,** and he isn't blunt: a greeting by name, one or two exchanges
   of small talk, then a segue into the goal. If they lead with a goal, he follows.
6. **Common goals are labelled "Most picked by the community"**, starting from a hand-picked list.
7. **No goal yet → interests.** Atlas asks what they're into and the interests picker opens in the
   chat; interests are the ramp to a goal, not a form up front.
8. **Superseded from 26 October:** Someday is no longer a first-session screen; it's in the inline
   picker and on the full ramp. Atlas no longer opens with a remark on the avatar or house.
