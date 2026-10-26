# Build order: onboarding, Today, goals, assistants and coaches

One order for the phases in `docs/onboarding/questionnaire-plan.md` (A0–A9) and
`docs/goals-and-coaches/plan.md` (G1–G7). Things that show value soonest and depend on nothing
come first. Each step lists the decisions it needs; a step waiting on a decision can't start.

## Done

| Phase | What | Where |
|---|---|---|
| A7 | Repeating events repeat; ticking one day off marks only that day; editing a repeat edits the series | `src/services/calendarRecurrence.ts`, `calendarService.getUserEvents` |
| A5 | Today at the top of the home screen | `src/features/today/TodayCard.tsx`, `HomeV3Page` |

## Next, in order

| # | Phase | What | Needs first | Decisions needed |
|---|---|---|---|---|
| 1 | **A8** | Quick add in Today (task, appointment, birthday, reminder, goal); My people birthdays with ages | A5, A7 (done) | none |
| 2 | **G1** | Data: `assistant` relationship type; dates and durations on plan steps; the calendar shows commitments (Today already does) | | none |
| 3 | **A0** | Atlas's voice: the Alfred style, the new opening with the three choices, time-of-day greeting, `address_style`, Sonnet | | 1, 2 |
| 4 | **A1** | Act 1 in the new order, saving each answer, resuming where they left off, the Someday screen | | 3, 4 |
| 5 | **A2** | Their color through Act 1 and the Atlas chat | A1 | none |
| 6 | **A9** | The first-session chain: avatar creator, house and billboard, a look around the town, Continue to Atlas, Atlas's remark on what they chose, home highlights | A1, A2 | none, but the avatar creator should be at the quality you want before this ships |
| 7 | **G2** | Assistants: the role, its framework, the goal tools, the "Meet Maya" card | G1 | 7 |
| 8 | **A3 + A6 + G3** | Atlas in `atlas-onboarding`, built together because it's one function: trait questions chosen for the goal, probing and where goals come from, proposals and pencilling in, then choosing an assistant or coach and the setup walkthrough (plan, commitments, progress, calendar), plus the reply-checking test script | A0, G2 | 5 |
| 9 | **G4** | The goal board on `GoalDetailPage` | G1, G3 | none |
| 10 | **G5** | Web search, and goal nudges through the check-in scheduler and morning brief | G2 | 6 |
| 11 | **G6** | Coaches teach: the teaching loop, each coach's curriculum, the scripted-learner test | | none |
| 12 | **G7** | Goals and Your team in the home menu, labels and badges | G2 | none |
| 13 | **A4** | Swipe deck as a feed card; the companion asks love language and "when it's hard" in week 1 | | none |

## Decisions still open

| # | Decision | Recommended |
|---|---|---|
| 1 | Atlas says "Master" and "Miss" by default, with a one-time offer to use first names | Yes |
| 2 | Atlas's onboarding chat runs on Sonnet, not Haiku | Yes |
| 3 | Zodiac worked out from the birthday with a one-tap confirm | Yes |
| 4 | The Someday screen in Act 1, or later in the first week | In Act 1 |
| 5 | Atlas's plans go straight onto the calendar as pencilled in once they say yes, or wait in a suggestions list | Straight on, pencilled in |
| 6 | Add web search | Yes, for assistants, Atlas and coaches |
| 7 | One assistant per goal, or one for all non-learning goals | One per goal |
