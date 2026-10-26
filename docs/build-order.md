# Build order: onboarding, Today, goals, assistants and coaches

One order for the phases in `docs/onboarding/questionnaire-plan.md` (A0–A9) and
`docs/goals-and-coaches/plan.md` (G1–G7). Things that show value soonest and depend on nothing
come first. All decisions are made (see the end).

## Status: all phases built

Everything below is built on one branch. Before deploying, apply the new migrations in order:

| Migration | What it adds |
|---|---|
| `20261029100000_real_people_birthday_year_known.sql` | `real_people.birthday_year_known` (birthdays are stored on `real_people`; year 2000 stands in when the year isn't known) |
| `20261029110000_goals_assistants_and_arrival.sql` | the `assistant` relationship type; `scheduled_for`, `duration_minutes`, `phase` on plan steps; `someday`, `address_style`, `arrival_choices` on profiles; the arrival setup steps |
| `20261029120000_user_profiles_taste_picks.sql` | `user_profiles.taste_picks` for "this or that" |

Then deploy the changed edge functions: `chat-turn`, `atlas-onboarding`, `atlas-agent`,
`coach-tools`, `generate-opener`, `proactive-check-in-scheduler`, `morning-brief`, `sync-coach`.

| # | Phase | What | Where |
|---|---|---|---|
| | A7, A5 | Repeating events; Today at the top of home | `calendarRecurrence.ts`, `features/today/` |
| 1 | A8 | Quick add in Today; birthdays with ages | `QuickAddSheet`, `PeopleSheet`, `birthdays.ts` |
| 2 | G1 | Assistant type, step dates, commitments on the calendar | migrations, `calendarService` |
| 3 | A0 | Atlas's Alfred voice and three-choice opening | `_shared/atlasArrival.ts` |
| 4–5 | A1, A2 | Act 1 order, per-answer saving, resume, Someday, their color | `personalBank.ts`, `QuestionnaireShell` |
| 6 | A9 | Avatar, house and billboard, town look, Continue to Atlas, highlights | `pages/arrival/`, `features/arrival/` |
| 7 | G2 | Assistants: role, framework, tools, Meet card | `_shared/assistantFramework.ts`, `MeetCard` |
| 8 | A3 + A6 + G3 | Atlas onboarding conversation and the setup walkthrough | `atlas-onboarding`, `AtlasConciergePage`, `PlanWalkthrough` |
| 9 | G4 | The goal board | `features/goals/`, `GoalDetailPage` |
| 10 | G5 | Web search for helpers and Atlas; the search button tied to a goal, commitment or step; nudges and today's steps in the brief | `_shared/webSearch.ts`, `features/search/`, scheduler, `morningBriefService` |
| 11 | G6 | Coaches teach: the teaching loop, what each coach teaches, the scripted learner | `coachFramework.ts` (both), `scripts/coach-teaching-eval.ts` |
| 12 | G7 | Goals and Your team in the menu, Coach and Assistant badges, Today icons | `SignedInWorkspace`, `relationshipType.ts` |
| 13 | A4 | "This or that" in the feed; the companion asks love language and "when it's hard" in week one | `features/feed/`, `_shared/companionWeekOne.ts` |

The two eval scripts need `ANTHROPIC_API_KEY` and call the live API:
`scripts/atlas-arrival-eval.ts` and `scripts/coach-teaching-eval.ts`.

## Later

- **Velvet Sims economy, free and paid:** free plays the game without the AI and works the Corner Market; paid gets the live AI companion, the five jobs and more side-job offers. Separate weekly bills (rent, electric, water, internet) paid by hand in a Bank app, five timed side jobs with progress bars, and an automatic daily routine. Plan: `docs/velvet-house/free-and-paid.md`.

## Decisions (made by Tim, 26 October)

| # | Decision | Answer |
|---|---|---|
| 1 | Atlas says "Master" and "Miss" by default, with a one-time offer to use first names | Yes |
| 2 | Atlas's onboarding chat runs on Sonnet, not Haiku | Yes |
| 3 | Zodiac worked out from the birthday with a one-tap confirm | Yes |
| 4 | The Someday screen in Act 1, or later in the first week | In Act 1 |
| 5 | Atlas's plans go straight onto the calendar as pencilled in once they say yes | Yes |
| 6 | Add web search | Yes, for assistants, Atlas and coaches |
| 7 | One assistant per goal, or one for all non-learning goals | One per goal, so each assistant's memory stays focused |
| 8 | Make the search button a paid feature | Later; `WEB_SEARCH_PRO_ONLY` turns it on |
