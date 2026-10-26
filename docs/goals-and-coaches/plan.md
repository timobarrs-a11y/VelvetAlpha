# Goals, assistants and coaches

Velvet has been treating goals and coaching as one thing. They aren't. There are three roles:

- **Atlas sets things up.** He's the host: he finds out what someone wants, turns it into a
  goal, and brings in the right person to carry it.
- **An assistant helps you get something done.** Planning a wedding, buying a home, finishing a
  portfolio. You don't need to be taught; you need information, a plan, dates and someone
  keeping track. You don't need a wedding coach; you need an assistant.
- **A coach teaches you a skill over time.** Spanish, coding, interview technique, cooking.
  Lessons, practice and feedback. **Every coach teaches.**

Every goal gets one of them: a coach when there's a skill to learn ("Hold a 10-minute
conversation in Spanish by June", taught by Sofia), otherwise an assistant.

## What's in the code today

- **Onboarding always ends by matching a coach**, even for a goal with nothing to learn
  (`supabase/functions/atlas-onboarding/index.ts`, the provisioning phase). The coach's name
  is random (`pickCoachName`); its look is designed on a separate page (`/coach-avatar`).
- **There's no assistant role.** `companions.relationship_type` allows `friend`, `romantic`,
  `mentor` (coaches) and `correspondent`.
- **Goals sit under "Coaching"** on the home screen, next to Progress, Commitments, Plans and
  Library (`src/pages/HomeV3Page.tsx:204`).
- **The goal and plan tools already exist for coaches**: `create_goal`, `create_plan`,
  `add_step`, `create_commitment`, `create_artifact` and `show_in_tab`
  (`supabase/functions/_shared/coachTools.ts`). Assistants are the same kind of character, so
  these carry straight over. Atlas has only `add_calendar_event`.
- **Plan steps have no dates.** `coach_plan_steps` has an order but no day; dates only live on
  commitments (`due_date`).
- **The calendar doesn't show commitments**, only `user_events`.
- **Nothing can search the web.** The Atlas page shows "Searching the web…", but no function has
  a web search tool.
- **Coaches don't teach.** The shared coaching loop (`buildCoachBehavioralInstructions` in
  `supabase/functions/_shared/coachFramework.ts`) is anchor, diagnose, one next step,
  commitment, follow-up. That's accountability. There's no level check, no lesson, no practice
  and no feedback. Some coaches (the tough-love fitness and finance ones) are accountability
  only.

## 1. Choosing and meeting them

Once Atlas and the person have a goal, he decides who carries it, with one question: **is there
a skill to learn?**

| Goal | Who | Why |
|---|---|---|
| Learn Spanish | Coach | A skill, taught over time |
| Run a 5K | Coach | Form and training are taught |
| Plan my wedding | Assistant | Nothing to learn; lots to organise |
| Buy a home | Assistant | Information and a plan, not lessons |
| Finish my portfolio | Assistant | Doing, not learning |

**Meeting them is quick.** Their avatar and name are randomized (the avatar creator's existing
randomize, and a name pool like today's), and shown on a card:

> **Meet Maya, your assistant.**
> She'll keep your home search on track: the plan, the dates, and anything you need to know.
> [Continue] [Change anything]

**Change anything** opens the avatar creator and lets them rename her. Most people won't, and
nobody has to.

## 2. Assistants: from information to a plan you can see

ChatGPT can tell you how to buy a home. Then you have to turn the answer into a plan, remember
it, and come back to it yourself. An assistant does that part, without being asked. That's what
makes it premium.

**When a goal is handed to them, the assistant:**
1. **Gives the useful information**, like any good assistant: how buying a home works, what it
   costs, what order things happen in. With web search, it's current.
2. **Turns it into a goal on screen** straight away, without being asked: phases, steps, the
   numbers that matter, and what to read or gather.
3. **Asks what they need to tailor it**, one question at a time: budget, timeline, where they
   are now.
4. **Puts the first steps on the calendar** once they agree, and shows what this week looks
   like.
5. **Comes back on their own**: before a step is due, when a step is done, when something is
   overdue, and with anything new that changes the plan.

During onboarding, Atlas does the first round of this himself (the setup walkthrough below), so
the plan is there before they've even opened the assistant's chat.

**Example: "I want to buy a home"**

| Phase | Steps the assistant lays out | What they add on their own |
|---|---|---|
| Get the money ready | Check your credit score · Work out what you can afford · Save the down payment | A budget worksheet; a down payment target and a monthly saving amount from their numbers |
| Get pre-approved | Gather documents · Compare lenders · Get pre-approved for a mortgage | A checklist of documents |
| Search | Pick neighborhoods · Tour homes · Shortlist | Questions to ask on a tour |
| Offer and close | Make an offer · Inspection · Appraisal · Close | What each step costs and roughly how long it takes |

The timeline comes from their answers ("At $600 a month you'll have the down payment by next
September"), and the goal shows it.

**The goal page is the visual.** `GoalDetailPage` becomes the board the assistant (or coach)
fills in:
- a timeline bar from start to estimated finish, with today marked
- phases, each with its steps, ticked off as they go
- **This week**: the commitments due in the next seven days
- the key numbers (target, saved so far, monthly amount)
- what's been made for them: worksheets, checklists, reading (the existing artifact types:
  `plan`, `checklist`, `worksheet`, `reading_material`, `resource_pick`, `routine`)
- who's carrying it: "Maya, your assistant" or "Taught by Sofia", with a link to their chat

**What this needs:**
- An `assistant` relationship type, and an assistant framework alongside the coach one: the
  steps above as its working loop, with the same tone dials (`accountabilityLevel`,
  `checkInStyle`).
- The existing goal and plan tools, given to assistants as well as coaches, and to
  `atlas-onboarding` for the setup walkthrough.
- Web search (the Anthropic web search tool) for assistants, Atlas and coaches, so information
  is current. The "Searching the web…" state in `AtlasCanvas` then becomes real.
- Proactive follow-ups through what already exists: `proactive-check-in-scheduler` for nudges
  before and after due dates, and the morning brief for "today on your goals".

*Built (G5):* coaches and assistants get the web search tool in `chat-turn` (up to 3 searches a
reply, with guidance to search only for current or specific facts); Atlas's plan draft can look
up real dates; `atlas-agent` falls back to it when no Brave key is set. The scheduler adds
"step pencilled in today" and "due tomorrow" reasons after missed and due-today; the morning
brief now includes open commitments and today's plan steps.

**The search button.** Coach and assistant chats have a search button (the globe beside the
message box). Before it searches, it asks **"Is this search about…"** and lists what that helper
is carrying: its goals, open commitments (soonest first) and open plan steps, plus **Something
else** for searches that aren't tied to a goal yet (like looking into something before deciding
on one). The choice goes to `chat-turn` with the item's id; the server looks it up (only the
user's own, only this helper's) and adds a search brief to the message: the item, its dates,
its goal or plan, and the instruction to search first and use what it knows from the
conversation rather than asking. Typing what to look up is optional; left blank, the helper
picks the most useful search for that item. General searches belong to **Atlas**, and the sheet
says so with a link. Helpers can also offer a search themselves when it would move a goal
forward. `WEB_SEARCH_PRO_ONLY` (client `src/features/search/searchTopics.ts`, server
`_shared/webSearch.ts`) turns it into a paid feature later.

## 3. Setting up a goal: plan, commitments, progress, then the calendar

When a goal is mapped out and its assistant or coach is chosen (in onboarding or any time
later), Atlas walks them through it in this order. Each piece opens beside the chat as he
explains it (`show_in_tab`), in a sentence or two, and they can change it before moving on.

1. **Plan:** the breakdown. Phases and steps, from first to last. "Here's the whole road."
2. **Commitments:** what they're agreeing to do, and when. These are the steps with dates,
   starting with this week. "This is what you're signing up for; adjust anything that won't
   fit your week."
3. **Progress:** how they'll know it's working. What's measured (down payment saved, chapters
   written, runs done), where it shows, and how often their assistant or coach checks in.
4. **Calendar, last:** the summary. The estimated finish date, how long it runs, and which
   days hold what.

> **Buy a home** · with Maya · 12 months · estimated finish September 30
> Mondays: move $150 to the down payment fund · Saturdays: one hour on the next step
> This week: check your credit score (Thursday)

Only after they've seen all four does anything land on the calendar. Then he asks once whether
to show the goal on their billboard in town.

Small one-off plans don't need any of this. "Pick a game and buy tickets on Saturday" is still a
single pencilled-in item from Atlas, as in the onboarding plan.

## 4. Coaches teach

Every coach gets a shared **teaching loop** in `buildCoachBehavioralInstructions`, alongside
the existing coaching loop:

1. **Find their level.** A short placement at the start: a few questions or a small task, not a
   quiz. Revisit it as they improve.
2. **Lay out a curriculum.** The plan becomes a syllabus: units in order, each with what they'll
   be able to do afterwards (`create_plan`).
3. **Teach in small lessons.** Explain one idea, show an example, then have them try it.
4. **Give feedback on their attempt.** What's right, the one thing to fix, then try again.
5. **Set practice** between sessions (`practice_set` and `worksheet` artifacts), with dates as
   commitments so it shows in Today.
6. **Review what's fading.** Bring back earlier material at widening intervals.
7. **Check understanding** with them doing, not them saying "got it".

Each coach then gets a **what you teach** section in its own entry in `CURATED_EXPERT_MAP`: the
skill, how levels are judged, the order of units, and what a good lesson looks like in that
subject. A language tutor has them speak and corrects them; a code mentor has them write code
and reviews it; a fitness coach teaches form and programming, not just "keep going".

The tough-love coaches keep their style. Firm or gentle is how a coach talks (the existing
`accountabilityLevel` dial), not what it's for, so they teach too.

Both copies of the framework change together: `supabase/functions/_shared/coachFramework.ts`
and `src/config/coachFramework.ts` (the comment says to keep them in sync).

*Built (G6):* the teaching loop is in both copies of `buildCoachBehavioralInstructions`; every
curated coach has `teaches` in `CURATED_EXPERT_MAP`, added to its expert layer in `chat-turn` as
"WHAT YOU TEACH". `scripts/coach-teaching-eval.ts` runs the scripted learner (below).

**Testing:** a script with a scripted learner for each coach checks that the first session
places them, that sessions contain an explanation, an example, an attempt and feedback, and
that practice ends up with dates. A matching script for assistants checks that a named goal
gets a plan on screen without being asked, and that nothing is put on the calendar without a
yes.

## 5. Showing them apart in the product

- **Home menu:** split "Coaching" into **Goals** (your goals, each opening its board) and
  **Your team** (your assistants and coaches, and the Library).
- **Labels everywhere:** "Maya · Assistant" and "Sofia · Coach", with different badge colors.
- **Today:** "Buy a home: check your credit score" with a target icon and Maya's face;
  "Spanish lesson with Sofia" with a book icon.
- **Goal board:** who's carrying it, with a link to their chat.

## Data changes

| Change | Why |
|---|---|
| `companions.relationship_type` allows `assistant` | The new role, alongside `mentor` for coaches. |
| `coach_plan_steps` gets `scheduled_for` (date) and `duration_minutes` | So the calendar can show which days hold what, and the plan can estimate a finish date. |
| The calendar and Today read commitments as well as `user_events` | So a goal's steps show up without being copied into events. |

## Build phases

| Phase | What ships | Size |
|---|---|---|
| G1 | **Data:** the three changes above. | Small |
| G2 | **Assistants:** the role, its framework and working loop, the goal and plan tools for assistants, and the "Meet Maya" card with randomized look and name plus Change anything. | Medium |
| G3 | **The setup walkthrough** in `atlas-onboarding`: choosing assistant or coach, then plan, commitments, progress and the calendar summary with `show_in_tab`, and the billboard question. | Medium |
| G4 | **The goal board:** `GoalDetailPage` as timeline, phases, This week, key numbers, artifacts and who's carrying it. | Medium |
| G5 | **Web search and follow-ups:** web search for assistants, Atlas and coaches, and goal nudges through the check-in scheduler and morning brief. | Medium |
| G6 | **Coaches teach:** the teaching loop, a "what you teach" section for each of the 20 coaches, and the scripted-learner test. | Medium–Large |
| G7 | **Show them apart:** Goals and Your team in the home menu, labels and badges, and Today icons. | Small |

## Decisions (made by Tim, 26 October)

1. **Web search** is added, for assistants, Atlas and coaches.
2. **One assistant per goal.** Each assistant's memory and chat stay focused on one goal,
   which keeps what it has to remember small and relevant. A new goal without a skill to learn
   gets a new assistant; a goal with a skill gets a coach.
