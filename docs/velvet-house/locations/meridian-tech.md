# The office (Meridian Tech): work days as timed objectives

*Planning doc. Covers how the office is reached, how a work day plays (timed objectives and scenarios), and the layout and art it needs. It supersedes
the IT-specific parts of `../jobs.md`: the office is a general "businessman" workplace, not a help desk. The IT cast and tickets can come back as
flavour (see the open questions).*

## The idea in one line

A work day is a short **scenario** of 3 to 5 objectives. Some you tap and they are done; the rest are **timed**, like a garden bed: you start them,
a timer runs (one to three minutes), you go and do other things at home, and when you come back the objective is finished.

## Going to work: automatic, or yours

- **By default the household goes to work on its own.** On a workday both of them leave at the same time and both are home at the same time
  (`routineStep` leave and return, status "At work"). No scene opens and the shift pays the ordinary day's wage. A player who never touches it never
  sees the office.
- **The office is unlocked by choosing to take control of the commute.** The first time the player does ("Go to work with Jordan" at the leave hour),
  the office level appears in the floor bar for good. After that, any workday they can choose to play it or let it run.
- **When the player plays Jordan's day, the companion stays home.** On autopilot both go to work; once the player takes control of Jordan, only he goes,
  and the companion is at home to take the player's orders (plant seeds, water, buy and cook food, tend the garden and the trees). This is what the
  timer windows are for: Jordan is in a meeting, so the player directs the companion.
- **Playing a day pays more than autopilot** (a bonus per objective and per finished scenario), but autopilot never loses money.

## Timed objectives (the garden pattern)

An objective is a small piece of state, much like a garden bed: `ready`, `running` (with a timer), `done`. The garden system already gives us the
pieces: state that saves with the house, a tick that moves it on, a bar and a time-left line on Orders and Goals, and a collect button.

| Kind | How it plays | Example |
|---|---|---|
| **Tap** | Tap the thing in the office; a short animation; done | Fix the printer, answer the phone, sign the contract |
| **Timed, unseen** | Jordan walks to a door and goes in. You **do not see inside**. A timer of 1 to 3 minutes runs. He walks out when it ends | Attend the meeting, present to the client, lunch with Tony |
| **Timed, at the desk** | Tap the computer; he works and a shorter timer runs; the screen shows progress | Write the report, prepare the slides |

- **The timer runs while you are elsewhere.** The point of the timer is the window it gives the player: check on the companion, plant seeds, buy food,
  water the trees, and come back to a finished objective. The objective shows as a bar on Orders and Goals (the same growth bar the garden uses), with
  "ripe in about 2 min" style text and a notice when it ends.
- **Timer units:** game minutes, scaled so that one to three real minutes pass at the default speed. It runs at the game's speed settings like the
  garden does, and saves and loads with the house.
- **Where the player is does not matter.** An objective can be started from the office scene (tap the door or the printer) or from the objective
  card on Orders, so a player who is busy at home can keep the day moving.
- **Unseen means no animation.** Because we never see a meeting, we draw no meeting: only Jordan walking to the door, the door closing, a "meeting in
  progress" sign lit over it, and the door opening again. That is the whole cost of a meeting, and it is the reason a meeting can last three minutes.
- **Stakes, so there is a reason to finish** (the next section). The pay on autopilot is never taken away; what is at stake is Jordan's time and the quality of the day.

## Why finish: the stakes

The lock is on **Jordan**, not on the camera. The player can still go home and swap a wallpaper while a timer runs; what they cannot do is have Jordan
there.

1. **The workday ends when the work does.** Jordan comes home only when the scenario is done. If objectives remain at the usual end of shift he stays
   late, which shortens the evening: his free time, the companion's company and the hobbies.
2. **Home needs him.** While Jordan is away the companion keeps the house going, but some things are his: he cooks the big meal, and anything the
   player queues for him waits. Needs still drain at work, so a long shift brings him home hungry. A late finish costs the evening he would have spent
   on these.
3. **You choose when to start, and the order.** There are no set times. Nothing starts until the player starts it, and a timer then runs on its own,
   which is what lets them go and do other things. What the order changes is how well it goes: presenting after you have written and printed the
   report is *prepared*; presenting without it is *unprepared*. The player decides, and thinks about what else to do while each timer runs.
4. **Quality tiers,** to be confirmed: a finished scenario is *prepared*, *rushed* or *unprepared*, and that sets the pay bonus, the weekly review and
   promotion. Autopilot keeps the plain wage and nothing more.

*Items 1 to 3 are my recommendation; item 4 is optional and still to confirm. There are no fixed appointments or deadlines on the clock.*

## Scenarios (variety from the same assets)

A scenario is an ordered outline of a work day: 3 to 5 objectives from the library below, using the same props in a different order. The same prop does a
different job each time: the printer is `fix`, `print`, `scan` or `restock`; the computer is `work` or `reply`; the one door is every meeting.

| Scenario | Tier | Objectives, in order | Timers | Why it plays differently |
|---|---|---|---|---|
| **First day** | 1 | `answer` → `coffee` → `reply` → `meeting` | about 3.5 min | Fixed for day one: a bit of everything and one short meeting. Nothing depends on anything |
| **Quiet day** | 1 | `reply` → `fix` → `chat` → `lunch` | about 3.5 min | Easy, mostly short timers in view; a good day to run home errands during lunch |
| **Jam day** | 1 | `fix` → `work` → `lunch` → `meeting` | about 6 min | The printer fix comes first, then the email pile, then two unseen blocks |
| **Paperwork day** | 2 | `mail` → `reply` → `sign` → `shred` → `file` | about 0.75 min | Almost no waiting: the player stays in the office tapping. For someone who does not want to leave the desk |
| **Presentation day** | 2 | `work` → `restock` → `print` → `meeting` → `answer` | about 4 min | Write it, print it (the paper must be restocked first), present it, then the call |
| **Client day** | 2 | `answer` → `work` → `print` → `meeting` → `sign` | about 4 min | The call starts it and the contract ends it. Print before the meeting for a prepared meeting |
| **Brainstorm day** | 2 | `plan` → `work` → `scan` → `meeting` → `snack` | about 5.5 min | Starts at the whiteboard; a scan feeds the meeting and a snack breaks up the long blocks |
| **Audit day** | 2 | `file` → `scan` → `work` → `print` → `sign` | about 2 min | Every long block waits on a tap: the missing document comes first |
| **Hot afternoon** | 2 | `thermostat` → `blinds` → `work` → `lunch` → `chat` | about 4.75 min | Uses the weather: the glare slot becomes "water the plant" on a rainy day or in the evening |
| **Big client** | 3 | `answer` → `plan` → `work` → `print` → `meeting` | about 4.75 min | The long one: five objectives, two big timers, and the order is the whole puzzle |
| **Friday wrap-up** | 3 | `file` → `work` → `print` → `meeting` → `water` | about 4 min | Always Friday. The weekly review is the meeting; the plant gets its water before the weekend |

*Timers add up the waiting only (a long timer is two minutes, a short one three-quarters of a minute); taps take a moment. All eleven pass the rules below.*

**The rules every scenario follows** (checked when I wrote them):
- 3 to 5 objectives, none repeated, at least one tap and at least one timer, and at most two unseen blocks (`meeting`, `lunch`).
- Dependencies point forward: `print` comes after a `work`, `restock` comes before the `print` that needs paper, a `print` or `scan` comes before the `meeting` it feeds,
  and a `shred` comes after something that makes paper (`sign`, `file`, `mail`).
- Every one of the 20 types appears in at least one scenario, so no prop sits idle. (The checks above found one scenario with no tap, which I fixed.)

**Choosing the day**
- **Tier** follows the career rung: tier 1 for the first days, tier 2 once they are promoted, tier 3 after that; a higher rung still draws the easier ones sometimes.
- **Day one is always `First day`; every Friday is `Friday wrap-up`;** the other days are drawn at random from the tier, never the same scenario twice in a row.
- **Weather and light decide a slot, not the day:** `blinds` is only offered on a clear afternoon, so on a rainy or evening day that slot becomes `water`. The sun
  and rain already come from `state/daylight.ts` and `state/weather.ts`.
- **A player who wants no waiting** gets `Paperwork day` from time to time; one who loves leaving gets the long ones.
- **Finishing a scenario** is a good day: a bonus and progress up the career ladder. Each rung unlocks something in the office (a better desk, a window seat).

### The objective library (20 types)

| # | Type | Kind | Prop | Needs / notes |
|---|---|---|---|---|
| 1 | `fix` | Tap | Printer | Fix the jam |
| 2 | `print` | Tap | Printer | Needs a finished `work`; needs paper (see `restock`) |
| 3 | `answer` | Tap | Desk phone | The phone rings and a light shows |
| 4 | `sign` | Tap | Desk | Sign the contract |
| 5 | `work` | Timed, at the desk | Computer | Write the report or prepare the slides |
| 6 | `reply` | Timed, at the desk | Computer | Short: answer a message or email |
| 7 | `meeting` | Timed, unseen | Door under the sign | The team meeting, the presentation or the client |
| 8 | `lunch` | Timed, unseen | Break room | Lunch with a coworker |
| 9 | `coffee` | Timed, short | Coffee machine | A coffee run; the break room, in view, the machine fills a cup |
| 10 | `chat` | Timed, short | Water cooler | A cooler chat that builds a relationship with a coworker |
| 11 | `restock` | Tap | Printer paper | Must be done before a big `print`, or the printer runs out |
| 12 | `file` | Tap | Filing cabinet | Find a missing document that another objective needs |
| 13 | `scan` | Tap | Printer | Scan or fax: a second use for the printer |
| 14 | `plan` | Timed, short | Whiteboard | Brainstorm at the whiteboard; Jordan writes and draws on it |
| 15 | `snack` | Timed, short | Vending machine | Walk over, pick a snack; restores a little food, a pick of three |
| 16 | `shred` | Tap | Shredder | Shred the old papers; a quick satisfying tap, and some `sign` or `file` tasks leave papers to shred |
| 17 | `mail` | Tap | Mail cart | Sort and deliver the mail; the letters become a `reply` or `sign` later |
| 18 | `water` | Tap | Office plant | Water the plant; it grows or wilts like the garden (see below) |
| 19 | `blinds` | Tap | Window blinds | Fix the afternoon glare on the screens; uses the real sun (see below) |
| 20 | `thermostat` | Tap | Thermostat | Settle the argument about the temperature; a small comedy beat |

- **The office plant uses the garden's rules** (`water`): the same wetness and drying, slowed by night, so a plant left alone through a long weekend is droopy
  on Monday. It is the cheapest tie-in between the work week and the garden at home.
- **The blinds use the day and night system** (`blinds`): on a clear afternoon the sun on the window wall glares on the monitors, which is when the
  objective appears; on a rainy or evening shift it never does.
- **Vending and paper stock run out** and are refilled by `restock`, so one objective keeps coming back for a reason.
- **Short timers** (`coffee`, `chat`, `reply`, `plan`, `snack`) are 30 to 60 seconds; **long** ones (`work`, `meeting`, `lunch`) are one to three minutes.
- **Seen vs unseen:** only `meeting` and `lunch` take Jordan out of sight. The short ones happen in view, in the break room or at the desk, and need small
  animations (a cup filling, a typing loop).
- **Dependencies** are the planning the player does: `print` needs a finished `work` and paper, a big `meeting` goes better after `print`, and a `file` can
  unlock a `work`. Each dependency is only a requirement to start, never a clock.
a finished `work`), `meeting` (unseen, timed), `lunch` (unseen, timed). A scenario is a list of these with their order and any dependency.

## Layout: one meeting room, behind the sign

Same 10 x 8 tile floor as every level (`WX`, `WY`). The meeting room is **behind the back wall**, entered by a door right under the Meridian sign.
People walk up a carpet runner to that wall and vanish through the door. Because the door is straight ahead of the camera, in the middle of the
longest wall, the player sees exactly where they went. Nothing inside is drawn or animated, so there is no table, no chairs and no poses.

```
 back wall (y0)   printer   [ SIGN over DOOR ]   cooler        counter, coffee, fridge
                  x2.6-4.2     x4.7-5.8          x6.2            x7.2-9.9 (break room)
 left wall   desks x0.5-2.6 (5 desks)    runner carpet x4.5-5.9   small table x7.9
 (windows)   Jordan's desk at the front by the window
                                                        front edge (cut low)
```

- **The door and sign:** a wooden door in the back wall at x 4.7 to 5.8, with a long sign above it. The sign says MERIDIAN normally and glows red and
  reads IN A MEETING while someone is inside, which is also the visible timer cue. It is the one door, so every "meeting" objective ends there.
- **The runner:** a red carpet from the open office straight to the door, so the path is obvious and the walk-around check passes.
- **Open office:** five desks in two columns along the window wall, Jordan's at the front. Coworkers sit at the others, still.
- **Printer and water cooler** on the back wall either side of the door, so a tap on the printer is near the door too.
- **Break room:** open, along the right: counter with the coffee machine, the fridge, a small table. Lunch is unseen, so this is set dressing.
- **No interior walls** at all, so the camera sees the whole floor and nothing needs a cut-down mode. (A second door could join the back wall later
  if a scenario ever needs another room.)

## New pieces (far fewer)

| Piece | Footprint | States and use |
|---|---|---|
| Desk with computer | 1.8 x 1.4 | Idle, working (screen shows a progress bar). Use spot: sit and work |
| Office chair | 0.6 x 0.6 | |
| Printer | 1.2 x 0.8 | Idle, printing (paper slides out), jammed. The tap target for `fix` and `print` |
| Desk phone | on the desk | Ringing (a light, a small shake), idle. The tap target for `answer` |
| Meeting-room door and sign | in the back wall | Closed, open (someone walking through), the sign lit red while a meeting is on |
| Coffee machine and fridge | counter | Reuse the kitchen counter pieces. The machine fills a cup for `coffee` |
| Filing cabinet | 0.5 x 0.6 | Drawer opens for `file`. Already in the mockup |
| Printer paper | on the printer | A tray that empties and a ream to refill, for `restock` |
| Water cooler | 0.4 x 0.4 | The prop for `chat`: a coworker stands beside it |
| Whiteboard | wall, 2 x 1.2 | Blank, then written on while `plan` runs; saved scribbles stay on it |
| Vending machine | 0.7 x 0.7 x 1.8 | Lit front, a snack drops when used (`snack`); stock runs out and `restock` refills it too |
| Shredder | 0.5 x 0.4 | A tray that fills with strips (`shred`) |
| Mail cart | 0.7 x 0.5 | Letters on top (`mail`); the pile shrinks as it is sorted |
| Office plant | 0.5 x 0.5 | Wilts without water, perks up when watered (`water`) |
| Window blinds | on the window wall | Open, half drawn, shut (`blinds`) |
| Thermostat | on the window wall | A dial that the coworkers fight over (`thermostat`) |
| Plant, clock, notice board | small | Set dressing |
| Ceiling lights | | Flat office light, not lamp pools |

Static props like the printer, cooler and coffee machine are good candidates for the Meshy route (rendered to flat pictures). The printer's states need
a small code overlay for the paper and the jam.

## Art direction

- **Palette:** office beige, grey and a corporate-blue accent (the company logo on the wall); the break room warmer.
- **Light:** the lit-office look all day. The window wall follows the real daylight and weather (`state/daylight.ts`): a lit street at night, dusk
  orange at the end of a late shift, rain on the glass.
- **People:** Jordan walking, sitting and typing, using the printer and the phone, and the walk to a door. A few coworkers sitting still. No meeting
  poses, because the meeting is never drawn.

## What this reuses from the garden

The objective bar, the time-left text, the notices and the Orders and Goals rows come from the garden work (`growBar`, `treeEta`, the `timed` rows in the
HUD). The objective timer is the same shape as `gardenTick`: a list of items with a state and a time, ticked with the game clock and saved with the house.

## Status

**Step 1 and a first slice of step 2 are built** (the level and its pieces, as set dressing): a level 5 scene called Office in `state/scenes.ts`, its walls, four windows,
the whiteboard and the meeting door with its sign in `state/house.ts`, and nine pieces (desks, printer, cooler, cabinet, plant, counter, fridge, vending
machine, table) in `state/objects.ts` and `art/houseArt.js`. It is hidden from the floor bar until `flags.officeUnlocked`, which the demo sets. The camera is locked to
the one angle the room is designed for. The pieces have **no jobs yet**: no tap targets, no states, no people. A house saved before the office is given the pieces
once on load (`kernel/config.ts`), with the content version unchanged.

## Build order (pieces first; scenarios last)

Scenarios are built from the pieces, so they wait until the pieces exist. Each step is its own small change, checked in the real game on desktop and
phone at all four camera turns before the next. A mockup of the target room is in `office-mock.html` (open it in a browser; add `?night=1` for night).

1. **The shell:** the level, the walls, the doorways, the meeting-room doors and the window wall, with an empty floor and the floor-bar entry. Old saves
   still load. *(Needs the director's word on the save change.)*
2. **The furniture:** the desk and computer, the chair, the printer, the phone, the water cooler, the plant, the break-room counter, fridge and coffee machine.
   Each with its states (the computer working, the printer printing or jammed, the phone ringing, the door shut with its sign lit).
3. **Light and weather:** ceiling light, window wall by day and night, dusk at a late finish, rain on the glass.
4. **People:** Jordan walking, sitting, typing, using the printer and the phone, and walking to a door and going out of sight; a few coworkers sitting still.
5. **The objective engine:** the timed-objective state, the tick, the bar on Orders and Goals, save and load. Tested with a fake objective.
6. **Objective types:** the twenty in the library above, each on its prop. Start with the tap ones (`fix`, `answer`, `sign`, `file`, `restock`, `scan`, `shred`,
   `mail`, `water`, `blinds`, `thermostat`), then the short timers (`coffee`, `chat`, `reply`, `plan`, `snack`), then the long ones (`work`, `print`, `meeting`, `lunch`).
7. **Scenarios:** the outlines that combine them, and how a day is chosen.
8. **Taking control:** the prompt at the leave hour, the scene switch, the companion staying home, and the return.

## Open questions

1. **Where the player is during a timer:** a timed objective needs Jordan out of sight (in the meeting room). If the player is at home at the time,
   is Jordan simply "at work" in the usual hidden state, and the objective bar the only trace of him? (Proposal: yes. The office scene is only
   drawn while they are viewing it.)
2. **Autopilot vs played:** on autopilot both go to work (the companion's workplace is unseen), but once the player plays Jordan's day the companion
   stays home. Is that the intent, and how does the companion get home on a played day if she would otherwise have left for work?
3. **The prompt:** where does the "take control" choice appear (a card at the leave hour, a button on the Today page, both)? Does it time out into
   autopilot?
4. **Timers:** one to three real minutes at normal speed, running at higher speeds like the garden. Is that the pace you want, and should a
   timed objective be pausable?
5. **Rewards:** a bonus per objective and per finished scenario, and promotion on a number of good days. What are the numbers, and what does each
   promotion unlock?
6. **IT flavour:** keep the help-desk cast (Dale, Ozzie, Kayleigh, Raven, Tony, Barb) as the office's people, or write a generic businessman cast?
7. **One floor or two:** if the layout feels cramped at 10 x 8, a second floor (the larger meeting rooms) reached by stairs doubles the level work.
8. **Saves:** adding a level touches the save format, so we ask the director before changing `MIN_CONTENT_VERSION`. Old houses would load without the
   office, which fits "unlocked by taking control".
9. **Story scenes:** scripted moments (a first-day intro, the review, an outage) each need their own contract in `docs/velvet-house/scenes/` before
   they are built, so they are out of scope here.
10. **Name:** Meridian Tech is fine as a fictional name. Check it is not a real company before shipping.
