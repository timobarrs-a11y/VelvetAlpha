# Goals and coaches: two different things

Velvet has been treating goals and coaching as one thing. They aren't:

- **A goal is something you want done.** Buy a home, finish a portfolio, run a 5K, see a game
  live. You don't need to be taught anything; you need the information, a plan, dates, and
  someone keeping track. **Atlas** handles goals.
- **A coach teaches you a skill over time.** Spanish, coding, interview technique, cooking.
  Lessons, practice and feedback. **Every coach teaches.**

A goal can have a coach attached when there's a skill to learn ("Hold a 10-minute conversation
in Spanish by June", taught by Sofia). Most goals don't need one.

## What's in the code today

- **Onboarding always ends by matching a coach**, even for a goal with nothing to learn
  (`supabase/functions/atlas-onboarding/index.ts`, the provisioning phase).
- **Goals sit under "Coaching"** on the home screen, next to Progress, Commitments, Plans and
  Library (`src/pages/HomeV3Page.tsx:204`).
- **The goal and plan tools belong to coaches only.** `create_goal`, `create_plan`,
  `add_step`, `create_commitment`, `create_artifact` and `show_in_tab`
  (`supabase/functions/_shared/coachTools.ts`) are exactly what Atlas needs, but only coaches
  have them. Atlas has just `add_calendar_event`.
- **Every commitment must belong to a coach**: `coaching_commitments.companion_id` can't be
  empty. Goals and plans don't have this problem (`user_goals` and `coach_plans` can stand
  alone).
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

## 1. Atlas: from information to a plan you can see

ChatGPT can tell you how to buy a home. Then you have to turn the answer into a plan, remember
it, and come back to it yourself. Atlas does that part, without being asked. That's what makes
it premium.

**When someone names a goal, Atlas:**
1. **Gives the useful information**, like any good assistant: how buying a home works, what it
   costs, what order things happen in. With web search, it's current.
2. **Turns it into a goal on screen** straight away, without being asked: phases, steps, the
   numbers that matter, and what to read or gather.
3. **Asks what he needs to tailor it**, one question at a time: budget, timeline, where they
   are now.
4. **Puts the first steps on the calendar** once they agree, and shows what this week looks
   like.
5. **Comes back on his own**: before a step is due, when a step is done, when something is
   overdue, and with anything new that changes the plan.

**Example: "I want to buy a home"**

| Phase | Steps Atlas lays out | What he adds on his own |
|---|---|---|
| Get the money ready | Check your credit score · Work out what you can afford · Save the down payment | A budget worksheet; a down payment target and a monthly saving amount from their numbers |
| Get pre-approved | Gather documents · Compare lenders · Get pre-approved for a mortgage | A checklist of documents |
| Search | Pick neighborhoods · Tour homes · Shortlist | Questions to ask on a tour |
| Offer and close | Make an offer · Inspection · Appraisal · Close | What each step costs and roughly how long it takes |

He works out the timeline from their answers ("At $600 a month you'll have the down payment by
next September"), and the goal shows it.

**The goal page is the visual.** `GoalDetailPage` becomes the board Atlas fills in:
- a timeline bar from start to estimated finish, with today marked
- phases, each with its steps, ticked off as they go
- **This week**: the commitments due in the next seven days
- the key numbers (target, saved so far, monthly amount)
- what he's made for them: worksheets, checklists, reading (the existing artifact types:
  `plan`, `checklist`, `worksheet`, `reading_material`, `resource_pick`, `routine`)

**What Atlas needs to do this:**
- The goal and plan tools coaches already have (`create_goal`, `create_plan`, `add_step`,
  `create_commitment`, `create_artifact`, `show_in_tab`), owned by Atlas instead of a coach.
- Web search (the Anthropic web search tool) in `atlas-agent` and `atlas-onboarding`, so the
  information is current. The "Searching the web…" state in `AtlasCanvas` then becomes real.
- Proactive follow-ups through what already exists: `proactive-check-in-scheduler` for
  nudges before and after due dates, and the morning brief for "today on your goals".

## 2. Setting up a goal: plan, commitments, progress, then the calendar

When a goal is mapped out (in onboarding or any time later), Atlas walks them through it in
this order. Each piece opens beside the chat as he explains it (`show_in_tab`), in a sentence
or two, and they can change it before moving on.

1. **Plan:** the breakdown. Phases and steps, from first to last. "Here's the whole road."
2. **Commitments:** what they're agreeing to do, and when. These are the steps with dates,
   starting with this week. "This is what you're signing up for; adjust anything that won't
   fit your week."
3. **Progress:** how they'll know it's working. What's measured (down payment saved, chapters
   written, runs done), where it shows, and how often Atlas checks in.
4. **Calendar, last:** the summary. The estimated finish date, how long it runs, and which
   days hold what.

> **Buy a home** · 12 months · estimated finish September 30
> Mondays: move $150 to the down payment fund · Saturdays: one hour on the next step
> This week: check your credit score (Thursday)

Only after they've seen all four does anything land on the calendar.

Small one-off plans don't need all this. "Pick a game and buy tickets on Saturday" is still a
single pencilled-in item, as in the onboarding plan.

## 3. Coaches teach

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

**Testing:** a script with a scripted learner for each coach checks that the first session
places them, that sessions contain an explanation, an example, an attempt and feedback, and
that practice ends up with dates.

## 4. Showing them apart in the product

- **Home menu:** split "Coaching" into **Goals** (your goals, each opening its board) and
  **Coaches** (your coaches and the Library).
- **Today:** goal steps and coach sessions look different. "Buy a home: check your credit
  report" with a target icon; "Spanish lesson with Sofia" with the coach's avatar.
- **Goal board:** "Taught by Sofia" when a coach is attached, with a link to the next lesson.
- **Onboarding:** after the goal is mapped, Atlas only offers a coach if there's a skill to
  learn. Otherwise it ends with the goal, its plan and its first steps.

## Data changes

| Change | Why |
|---|---|
| `coaching_commitments.companion_id` can be empty | So Atlas can own goal steps without a coach. Steps with no coach belong to Atlas. |
| `coach_plan_steps` gets `scheduled_for` (date) and `duration_minutes` | So the calendar can show which days hold what, and the plan can estimate a finish date. |
| The calendar and Today read commitments as well as `user_events` | So a goal's steps show up without being copied into events. |

## Build phases

| Phase | What ships | Size |
|---|---|---|
| G1 | **Data:** the three changes above. | Small |
| G2 | **Atlas gets the goal tools:** coach tools shared with Atlas as owner, the setup walkthrough (plan, commitments, progress, calendar) with `show_in_tab`, and the calendar summary. | Medium |
| G3 | **The goal board:** `GoalDetailPage` as timeline, phases, This week, key numbers and artifacts. | Medium |
| G4 | **Web search and follow-ups:** web search in Atlas, and goal nudges through the check-in scheduler and morning brief. | Medium |
| G5 | **Coaches teach:** the teaching loop, a "what you teach" section for each of the 20 coaches, and the scripted-learner test. | Medium–Large |
| G6 | **Show them apart:** Goals and Coaches in the home menu, Today labels, and the coach offer only for skills in onboarding. | Small |

## Decisions for Tim

1. **Web search:** worth adding to Atlas? It's what makes "buy a home" current and specific,
   and costs a little per search.
2. **Who checks in on a learning goal**, like Spanish: the coach only (recommended, so there's
   one voice per goal), or both Atlas and the coach?
