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

A scenario is an ordered outline of a work day, 3 to 5 objectives, built from a small library of objective types using the same props in a different
order. Some objectives depend on an earlier one (you cannot print what you have not written). The first scenario can be the plain one; later days
draw from the rest and avoid repeating yesterday's.

| Scenario | Outline |
|---|---|
| **Presentation day** | Write the report (computer, timed) → print it (printer, tap) → go to the meeting to present (timed, unseen) → answer the call afterwards (phone, tap) |
| **Jam day** | Fix the printer (tap) → deal with the email pile (computer, timed) → lunch (timed, unseen) → afternoon meeting (timed, unseen) |
| **Client day** | Take the client's call (phone, tap) → prepare the slides (computer, timed) → print the handouts (printer, tap) → client meeting (timed, unseen) → sign the contract (desk, tap) |
| **Quiet day** | Catch up on email (timed) → fix the copier (tap) → team lunch (timed, unseen) |

- **Same prop, different job:** the printer is "fix the jam" in one scenario and "print the file you just wrote" in the next. The computer is
  "write the report" or "email the client". The meeting room is "the team meeting", "the presentation" or "the client". That is the variety, for the
  cost of a handful of objects.
- **Choosing a scenario:** by the day, weighted by career level (later days use the longer scenarios), with an easy first day.
- **Finishing a scenario** is a good day: a bonus, and progress up the career ladder. Each rung unlocks something in the office (a better desk, a
  window seat, a bigger meeting room).

### The objective library (13 types)

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

- **Short timers** (`coffee`, `chat`, `reply`) are 30 to 60 seconds; **long** ones (`work`, `meeting`, `lunch`) are one to three minutes.
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
6. **Objective types:** the thirteen in the library above, each on its prop. Start with the tap ones (`fix`, `answer`, `sign`, `file`, `restock`, `scan`), then
   the short timers (`coffee`, `chat`, `reply`), then the long ones (`work`, `print`, `meeting`, `lunch`).
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
