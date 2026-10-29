# The office (Meridian Tech): work days as timed objectives

*Planning doc. Covers how the office is reached, how a work day plays (timed objectives and scenarios), and the layout and art it needs. It supersedes
the IT-specific parts of `../jobs.md`: the office is a general "businessman" workplace, not a help desk. The IT cast and tickets can come back as
flavour (see the open questions).*

## The idea in one line

A work day is **discovery**. The player sees a short list of 3 to 5 things to get done today, loosely connected so they tell a small story, and has to
work out which thing in the office does each one (the meeting room, the boss, the computer, the printer, the phone). Tapping a thing opens what you can do there; each
action takes a set amount of time, like a garden bed: you start it, a timer runs, and when it is finished the line on the list is ticked. The game never says
"scenario" to the player: it is just today's list.

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

## How a day plays: discovery

*Replaces the earlier "tap this prop for this objective" model and its fixed scenarios. The director's words: the scenarios "should play out like discovery"; the player is
told what needs doing and "figures out which tappable asset helps achieve that", which is "more or less common sense", but "the user [has] to initiate it".*

**Three parts, and nothing else:**

1. **Stations.** Every working prop in the office is a station. Tapping it opens a short menu of the **actions** you can take there (the desk computer: about 20 tasks; the
   phone: about 10 calls; the printer: print, scan, copy, fix the jam, restock paper; the meeting-room door: the kinds of meeting; the boss: the things you can talk to him about;
   the whiteboard, filing cabinet, cooler, coffee machine, vending machine, fridge and plant: one or two each). The player picks one.
2. **Actions.** An action is a small, timed piece of state, the same shape as a garden bed: `ready`, `running` (with a timer), `done`. Jordan walks to the station, does it
   using the animations the game already has (sit and type at the desk, stand at the printer, stand at the phone, walk to the door and go out of sight for a meeting), and
   when the timer ends it is done. Every action has **a set time**; the player can leave and do things at home while it runs, and a bar on Orders and Goals shows it, as the
   garden's does.
3. **Today's list.** On arriving, the player sees 3 to 5 lines in plain words. Each line is satisfied by **any action that matches it** (see "How a line matches", below). The
   line never says where to tap. The day is over when the list is done.

**Example day**, as the player reads it, and where they would find each:

| Today | What satisfies it | Where a player works it out |
|---|---|---|
| Sit in on the team meeting | a meeting (team) | the door under the Meridian sign |
| Talk to Dale about your idea | the boss: pitch an idea | Dale, in his office (sit in the visitor chair) |
| Write up that email | an email task | the computer on the desk |
| Get this paper scanned | the printer: scan | the copier in the corner |
| Call home | a call: home | the desk phone |

**Not always the same.** Days are drawn from a pool of **threads**: a thread is 3 to 5 line templates around one small story (the pitch, the audit, the client visit, the quiet
Friday), and the lines accept families of actions rather than one, so the same line can be met several ways ("get your idea down in writing" accepts an email, a report or a
slideshow). The same props therefore do different jobs on different days, and the player is never handed a fixed script.

**Rules**
- **The player starts everything.** No fixed appointments and no deadlines on the clock; a timer only runs once the player has started it. (The director's earlier decision.)
- **One thing at a time per person.** Jordan can run one action at a time; the others wait for the player. The companion is at home on a played day and takes orders there.
- **A set time per action.** Short ones are 30 to 60 seconds of real time at the default speed, long ones one to three minutes; the timer runs with the game speed and saves
  with the house, like the garden's.
- **Unseen means no animation:** only the meeting door is unseen. Jordan walks to it and goes out of sight, the sign glows red, and he walks back out when it ends. Everything
  else happens in view.
- **Doing something that is not on the list is allowed.** It takes its time and does what it does (a video game gives a little fun, a coffee a little energy) but it does not
  tick a line, and the day does not end until the list is done, so it costs the evening (see the stakes, below). Nothing is forbidden; the player is trading.
- **Visible from the list, not from the world.** The list says what is wanted; it does not highlight props. (Open question: a gentle hint after a long idle spell.)

### How a line matches

Every action carries **tags** (`write`, `slides`, `paper`, `call`, `home`, `boss`, `meeting`, `scan`, `food`, and so on) and a station. A list line wants one or more tags, and is
ticked by the first finished action carrying one of them. So "Write up that email" wants `email`; "Get your idea down in writing" wants any of `email`, `report`, `slides`;
"Call home" wants `call-home`. This is data, so a new thread is a few lines of text and tags, and a new action is one row in the registry; neither needs new code.

Some actions **leave something behind**, which later actions can use: a finished report, slides or flyer can be printed at the printer; a printed paper makes the next meeting
*prepared*; a resume lets a recruiter's call be returned; a scanned paper can be sent in an email. These are loose links to reward thinking ahead, never a requirement that blocks
the day.

### Computer actions (20)

| # | Action | Time | Tags | Leaves behind |
|---|---|---|---|---|
| 1 | Write an email | 45 s | `email`, `write` | |
| 2 | Reply to messages | 30 s | `email` | |
| 3 | Craft a PowerPoint | 2 min | `slides`, `write` | slides (printable) |
| 4 | Write a report | 2 min | `report`, `write` | report (printable) |
| 5 | Work on a project | 2.5 min | `project` | progress on the project |
| 6 | Update the spreadsheet | 1 min | `numbers` | |
| 7 | Work on your resume | 1.5 min | `resume`, `write` | resume (printable) |
| 8 | Book travel | 1 min | `travel` | |
| 9 | Research a competitor | 1.5 min | `research` | notes |
| 10 | Review a contract | 1.5 min | `contract` | contract (printable, signable) |
| 11 | File an expense report | 1 min | `numbers` | |
| 12 | Do an online training course | 2 min | `training` | |
| 13 | Schedule a meeting | 30 s | `meeting-prep` | |
| 14 | Pay a bill online | 45 s | `home-errand` | a home bill paid |
| 15 | Shop online | 1 min | `personal` | an order, money spent |
| 16 | Read the news | 30 s | `personal` | |
| 17 | Play a video game | 1.5 min | `game`, `personal` | a little fun |
| 18 | Chat with a friend | 45 s | `personal`, `social` | |
| 19 | Design a flyer | 1.5 min | `design`, `write` | flyer (printable) |
| 20 | Debug a problem | 2 min | `project`, `fix` | |

The `personal` ones (15 to 18) never satisfy a work line, but they are there on purpose: a player who wants to slack can, and a line like "take a break" can ask for them.

### Phone actions (10)

| # | Action | Time | Tags |
|---|---|---|---|
| 1 | Call home | 45 s | `call`, `call-home` (the companion at home is pleased) |
| 2 | Call a client | 1 min | `call`, `client` |
| 3 | Call family | 45 s | `call`, `personal` |
| 4 | Order lunch for the team | 30 s | `call`, `food` |
| 5 | Check voicemail | 30 s | `call`, `messages` |
| 6 | Call a repair person for the house | 1 min | `call`, `home-errand` |
| 7 | Call the bank | 1 min | `call`, `numbers` |
| 8 | Return a recruiter's call | 1 min | `call`, `resume` (best after the resume is written) |
| 9 | Make a sales call | 1.5 min | `call`, `client` |
| 10 | Book a table for dinner | 30 s | `call`, `personal` |

### The other stations

| Station | Actions (time) |
|---|---|
| Meeting-room door (unseen) | team meeting (2 min), present to the client (3 min), one-on-one (1.5 min), weekly review (3 min on Fridays) |
| Dale, the boss (visitor chair, only while he is in) | pitch an idea (1.5 min), give a progress update (1 min), ask for a raise or a day off (1.5 min), ask for feedback (1 min), small talk (30 s) |
| Printer | print (needs something printable, 45 s), scan (45 s), copy (30 s), fix the jam (45 s, offered only when it is jammed), restock paper (30 s) |
| Whiteboard | brainstorm (1 min) |
| Filing cabinet | find a document (45 s) |
| Water cooler | chat with a coworker (45 s) |
| Coffee machine | make a coffee (30 s) |
| Vending machine | buy a snack (30 s) |
| Fridge | have lunch (2 min) |
| Plant | water it (30 s; it wilts and perks up by the garden's rules) |

Meetings and talks to the boss are **timed actions with no animation**: the unseen meeting is only the walk and the sign; the boss talk is Jordan sitting in the visitor chair
for the time, using the sit pose the game already has.

### Stand-and-use poses (built, shared by the whole game)

The game had sit and type, and a few single-purpose stand poses. It now has seven reusable poses (`art/poseAnim.js`), each for a *kind of thing you work*, so every station here and every
appliance at home uses the same few animations:

| Pose | What it looks like | Used by (office / elsewhere) |
|---|---|---|
| `operate` | Taps the control panel, looks at the screen, waits, then takes what comes out (a sheet in hand) | printer print, scan and copy, vending machine / the fortune teller today, later washer, microwave, ATM |
| `dispense` | Holds a cup under a spout until it fills (a stream), then a sip | water cooler, coffee machine / making coffee at home today |
| `board` | Writes lines across a vertical surface with a marker, then steps back and points | whiteboard / later a chalkboard |
| `files` | Pulls a drawer, walks the fingers through it, draws out a folder and reads it | filing cabinet / later dressers and shelves |
| `talk` | A standing conversation: speaks with both hands, then listens and nods | the boss's office, the cooler chat / the companion's chat, hanging out and party chatter today |
| `handset` | Standing call on a wall or desk phone, the free hand gesturing | any wall phone |
| `deskcall` | The same call seated at the desk, the other hand taking notes | the desk phone, from the chair |

New props for them: `handset`, `sheet`, `folder`, `stream`. In the game these are already in use for making coffee (`dispense`), the companion's chat and hanging out (`talk`) and the
fortune teller (`operate`); the office actions pick the rest up as they are built. A pose is chosen by the action's `pose` field, so a new action costs one row.

### Choosing the day

- **Tier** follows the career rung: early days draw simple threads (3 lines, short actions); later ones draw 5 lines with more of the long actions.
- **Day one is a fixed thread** (a bit of everything); **every Friday** is the weekly-review thread; the rest are drawn at random from the tier, never the same thread twice in a row.
- **Light and weather can swap a line, not the day** (for example a clear-afternoon "deal with the glare" can become "water the plant" on a rainy day), using `state/daylight.ts` and
  `state/weather.ts`.
- **Finishing the list** is a good day: a bonus and progress up the career ladder.

### Where it lives in the code (to build)

- `content/office.ts`: the **action registry** (`id`, `station`, `label`, `minutes`, `tags`, `leaves`) and the **thread templates** (`id`, `tier`, `lines: [{ text, wants: tags }]`). Data only.
- `state/office.ts`: today's list, the running action and its timer (ticked with the game clock like `gardenTick`), what has been left behind, saved with the house. It is
  owned by this system; the companion chat only reads it and never ticks a line or moves an action along.
- `ui/`: the station menu (a small sheet over the tapped prop), the list on Orders and Goals, the timer bar (the garden's `growBar`).
- Not a story scene: nothing here is a script in `content/scripts.ts`, so no contract is needed; the first-day intro, if we write one, is a scene and does need one.

## Why finish: the stakes

The lock is on **Jordan**, not on the camera. The player can still go home and swap a wallpaper while a timer runs; what they cannot do is have Jordan
there.

1. **The workday ends when the work does.** Jordan comes home only when today's list is done. If lines remain at the usual end of shift he stays
   late, which shortens the evening: his free time, the companion's company and the hobbies.
2. **Home needs him.** While Jordan is away the companion keeps the house going, but some things are his: he cooks the big meal, and anything the
   player queues for him waits. Needs still drain at work, so a long shift brings him home hungry. A late finish costs the evening he would have spent
   on these.
3. **You choose when to start, and the order.** There are no set times. Nothing starts until the player starts it, and a timer then runs on its own,
   which is what lets them go and do other things. What the order changes is how well it goes: presenting after you have written and printed the
   slides is *prepared*; presenting without them is *unprepared*. The player decides, and thinks about what else to do while each timer runs.
4. **Quality tiers,** to be confirmed: a finished day is *prepared*, *rushed* or *unprepared*, and that sets the pay bonus, the weekly review and
   promotion. Autopilot keeps the plain wage and nothing more.

*Items 1 to 3 are my recommendation; item 4 is optional and still to confirm. There are no fixed appointments or deadlines on the clock.*

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
the one angle the room is designed for. **Scale and seats:** pieces are sized in tiles (`W`, `D`, `h` in `objects.ts`) and the office desk uses the home desk's own proportions: a 1.4 x 1.3 footprint with the chair
inside it, a seat spot (`pos` where the avatar sits, `stand` 0.6 tile in front where the chair is pulled out) and the game's `desk` pose. Each workstation needs about
1.9 tiles of depth, so five fit in two columns with an aisle. A `officework` activity (level 5 only, never picked on its own) shows Jordan walking up, sitting, working
with the screen lit, and standing, using the existing animation. The rest of the pieces have **no jobs yet**: no tap targets, no states, no people. A house saved before the office is given the pieces
once on load (`kernel/config.ts`), with the content version unchanged.

## The boss and the work clothes

- **Dale, the boss,** is a character who lives on the office floor (`state/boss.ts`, `content/characters.ts`). His desk is big, dark walnut, turned to face the room, with a rug under it
  in the back-right corner and a visitor's chair in front. He **hardly ever leaves his seat**: in office hours there is about a 2 percent chance an hour that he walks to the water
  cooler for five to ten minutes and comes back. **Nobody may sit in the visitor chair unless he is at his desk** (`world.bossIn`): the seat is refused while he is away.
- **Work clothes:** anyone from the household on the office floor is drawn in a navy blazer, burgundy tie and dark trousers (their saved wardrobe is untouched). Dale has a
  suit of his own, `bosssuit`: charcoal, double-breasted, gold buttons, a gold tie and a pocket square, with grey hair, so he is never mistaken for anyone else.
- **Layout (version 5):** four narrow desks in two rows with a 1.3 tile aisle between them, the whiteboard wall kept clear, the vending machine against the back wall beside the whiteboard, the
  water cooler beside the meeting door, the boss's corner at the back right, and the break area (counter, fridge) at the front right. A **navy aisle runner** (`officerunner`, 1.1 x 6.4) is laid from
  the meeting-room door straight down the open aisle. The **copier** stands in the bottom-right corner against the front wall, turned (rot 2) so its front (drawers, paper tray, control panel) faces into
  the room, where a person walks up and stands to use it. The camera sees that front only from behind, as with the boss's desk; the top (lid, glass, panel, buttons) is what shows. The break-room table is gone.
  **Every chair is a piece of its own** (`officechair`, `bosschair`, `visitorchair`), so it can be moved and turned like any other piece; the pieces are `fixed` against the player, who cannot
  rearrange the office. The boss's chair is dark leather and the visitor's chair charcoal fabric, so neither disappears into the red rug.
- **A staff desk** carries, all painted in one pass over the top so the depth order cannot tangle: the monitor (lit while someone sits), a **PC tower** (drive bay, power button and light, vents, a fan
  through its side panel; its light is green only while the desk is in use), the keyboard, a **mouse on its pad** and a **desk phone** (base and handset, pushed against the back of the desk to leave the front clear) for the later tappable actions. There is no mug or other loose prop.
  A house saved with an older layout has only its office pieces replaced once on load (`OFFICE_LAYOUT`).

## Status: stations (built)

- **Data:** `content/office.ts` holds the stations and every action (20 computer, 10 phone, 5 for Dale, 4 meetings, 4 printer, and one or two for each of the whiteboard, filing cabinet, cooler, coffee machine,
  vending machine, fridge and plant) with its time, tags and pose. Each is registered as an activity `o_<id>` on the office floor (`state/activities.ts`) and looks for its station's spot tag (`state/agents.ts`).
- **Spots:** every working piece carries its spot (`state/objects.ts`), so moving the piece in Arrange moves the spot with it. The whiteboard and the meeting door are part of the wall, so each has an invisible
  anchor piece (`officeboardspot`, `officedoorspot`) that cannot be moved. The filing cabinet is turned (rot 2) so its front faces the room. Layout version 7: the **coffee station** (`officecoffee`, a low cabinet with the machine, mugs and a tin) stands along the window wall under the first window (rot 3, its front toward the room), the **plant** is in the front-left corner beside the filing cabinet, and the break-room counter is plain scenery for now.
- **Taps:** `systems/interact.ts` (`showStation`) for pieces, `systems/input.ts` for Dale and the wall (`art.hitFeature`). The sheet is `ui/stationMenu.ts`: tabs where a station has two kinds of action (the desk:
  Computer and Phone), the time beside each action, closes on a pick, a tap outside, or Escape. The desk opens from the desk or its chair, and sits Jordan in that desk's own chair (`startActAt`).
- **The boss:** his sheet is greyed with "Dale isn't at his desk right now" while he is away, and the visitor's chair stays refused (the earlier rule).
- **Meetings:** Jordan walks to the door and is out of sight for the length of the meeting; the sign glows red while anyone is in there.
- **Not built yet:** the day's list and objective matching, what an action leaves behind, the jammed printer (so no "fix the jam"), and the cooler chat (there are no coworkers yet).

## Build order (pieces first; the day's list last)

The day's list is built from the pieces, so they wait until the pieces exist. Each step is its own small change, checked in the real game on desktop and
phone at all four camera turns before the next. A mockup of the target room is in `office-mock.html` (open it in a browser; add `?night=1` for night).

1. **The shell:** the level, the walls, the doorways, the meeting-room doors and the window wall, with an empty floor and the floor-bar entry. Old saves
   still load. *(Needs the director's word on the save change.)*
2. **The furniture:** the desk and computer, the chair, the printer, the phone, the water cooler, the plant, the break-room counter, fridge and coffee machine.
   Each with its states (the computer working, the printer printing or jammed, the phone ringing, the door shut with its sign lit).
3. **Light and weather:** ceiling light, window wall by day and night, dusk at a late finish, rain on the glass.
4. **People:** Jordan walking, sitting, typing, using the printer and the phone, and walking to a door and going out of sight; a few coworkers sitting still.
5. **Tappable stations (built):** tap a working piece (or the whiteboard, the door under the sign, or Dale) and a sheet lists what can be done there with the time each takes; picking one sends Jordan to do it for that long. The actions run as ordinary activities, so there is no objective list yet (step 7).
6. **The action engine:** the timed state, the tick, the bar on Orders and Goals, save and load. Tested with a fake action.
7. **The registry and the list:** the 20 computer actions, the 10 phone calls and the other stations as data; the thread templates and how a day is chosen; the line matcher.
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
11. **Hints:** the list never says where to tap. Should a line pulse its station after a long idle spell, or never?
12. **Off-list actions:** allowed, and they cost time without ticking a line. Should some give a real reward (a game, a coffee), or should the boss notice a long game (Dale is in the room most of the day)?
13. **Left-behind items:** are printable papers and a resume a single shared stack on the desk, or one item each? The first is much simpler.
14. **Animations for the actions:** answered. The stand-and-use poses are built (see above), so calls, printing, scanning, the whiteboard and the filing cabinet each have their own.
