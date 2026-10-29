# The office: content plan

*Design doc. The office is a second place Jordan goes to during the day, clearly unlike the house.*

## Rooms and what is in them

| Room | Things you can do there | Interactables |
|---|---|---|
| **Open plan** | Sit at your desk, work on tickets, check the team board | Jordan's desk, 8 cubicles, wall board, printer, plant, window blinds |
| **Meeting room** | Attend the board meeting (he disappears behind the door, comes back when it's done) | None: the inside is never shown, so nothing here is drawn or can be used |
| **Kitchen** | Make coffee, grab a snack, eat lunch from the fridge, wash a mug | Coffee machine, microwave, fridge, sink, vending machine, lunch table |
| **Lavatory** | Wash hands, a short break, check the phone | Sinks, mirror, hand dryer, stall doors |
| **Hallway** | Walk to the lift, catch a colleague, look at the notice board | Notice board, water cooler, lift, fire door |

## Objectives (timed, fill up in game time)

Each one is a bar that fills while Jordan is doing it. None of them is lost if he's away.

1. **Attend the board meeting.** 90 game minutes in the meeting room. Walks in, disappears, reappears with it done.
2. **Work on the project.** 180 game minutes at his desk. He can stop and resume.
3. **Clear the ticket queue.** Five tickets, each 20 game minutes at a cubicle or his desk.
4. **Take a break.** Kitchen or lavatory for 15 game minutes. Counts toward the day's end, not toward a bar.
5. **Do the morning check-in.** 10 game minutes at the team board, once a day.

## What the player can do while the bars fill

- Snap to Maya (or to a coworker) and watch what they're doing.
- Open the phone: check bills, call the designer, check on the plants at home.
- Use any interactable in the office for a short break.
- Nothing else is required. The day ends when the objectives are done.

## Coworkers (visitors, not household)

Five, using the visitor type the engine already has. Each has a desk, a place they go on a break, and a line when you pass.

| Name | Role | Where they are | Break habit |
|---|---|---|---|
| Dale | Boss | Meeting room, then his office | Coffee, then the board |
| Ozzie | Sysadmin | Cubicle by the server cupboard | Vending machine |
| Kayleigh | Intern | Cubicle near the window | Lavatory, every hour |
| Raven | Security | Cubicle by the fire door | Walks the hallway |
| Tony | Sales | Desk by the kitchen | Lunch at the table |

## Daily variety (so no two days are the same)

The day's mix is picked from this list, so each day has a different shape:

- **Mon:** board meeting at 10, then a long project block.
- **Tue:** ticket queue in the morning, a team check-in after lunch.
- **Wed:** a coworker asks Jordan for help; a short side-errand to the kitchen.
- **Thu:** project block, a surprise call from the designer's office.
- **Fri:** board meeting at 2, a long lunch, then tickets until five.
- **Weekend:** no work. The house and the beach.

## Build order

1. The open plan room: Jordan's desk, the cubicles and the board, with the five objectives wired to bars.
2. The meeting room with the disappear-and-return walk.
3. The kitchen and the lavatory as activities with their own animations.
4. The five coworkers, as visitors, with their desks and breaks.
5. The daily variety list, picked each morning.

## More things to do (each one is a real action, with a short animation and a result)

**Desk and computer**
- Answer emails: a short queue of messages; each one takes a few game minutes and some are urgent.
- Reply-all storm: a thread blows up, and Jordan has to choose: reply, ignore, or escalate.
- Update the spreadsheet: a long task that gives a small money bonus at the end of the week.
- Fix a bug: a ticket with three steps; the steps can be done in any order.
- Take a call: a customer on the line, three short choices.
- Make a presentation: slides fill in one at a time while he works on the next.
- Browse the staff directory: learn names, unlock a coworker's break habit.

**Team and social**
- Chat with Kayleigh by the printer: a short conversation with a choice of reply.
- Help Ozzie with the server room: he asks for a cable, the ladder, and a hand.
- Lunch with Tony: a meal at the table; Tony tells a story; Jordan's bond with Tony grows.
- Join the team photo: stand in line, smile for the camera, the photo goes on the board.
- Birthday cake in the kitchen: a shared snack, one slice each.
- Bring a plant for Dale's office: a small gift that changes his mood.

**Kitchen**
- Make a coffee (already planned) and a tea; different cups, different sizes.
- Heat up lunch in the microwave: a short timer, then eat at the table.
- Wash a mug at the sink: a tiny chore, nothing lost if skipped.
- Buy a snack from the vending machine: coins from his wallet.
- Fill the water jug for the meeting room.

**Lavatory**
- Wash hands and check the mirror.
- Take a break in a stall: a short, quiet timer with the phone.
- Fix the hand dryer: a small repair mini-task, with Raven's help if she's around.

**Hallway and building**
- Pin a note to the notice board.
- Walk to the lift and ride it to another floor: a short animation with a glance at the other floor.
- Check the fire-door drill sign: a quick walk with a chance to talk to Raven.
- Refill the water cooler.
- Look out of the window at the car park: a short pause that gives a bit of rest.

**Phone (any room)**
- Pay a bill, call the designer, check on the plants at home, read a message.

## Objectives, with a new one per room

Each day picks three from the full list, plus the board meeting when it falls on the day.

## Which actions can be objectives

An objective is an action with a bar that fills in game time. Anything not listed here is flavour: it can be done for
a moment, but it doesn't fill a bar.

| Objective | Where | Fills in (game min) | What counts as progress | Done when |
|---|---|---|---|---|
| Attend the board meeting | Meeting room | 90 | Sitting through it; he is out of sight | Bar full |
| Work on the project | Desk | 180 | Typing at the computer; he can stop and resume | Bar full |
| Clear the ticket queue | Desk | 100 (5 tickets × 20) | Each ticket closed | All five closed |
| Answer emails | Desk | 60 | Each message replied to | Inbox empty |
| Update the spreadsheet | Desk | 120 | Rows filled in | Sheet full |
| Make a presentation | Desk | 150 | Slides done in order | Last slide done |
| Fix a bug | Desk | 90 | Three steps, any order | All three steps |
| Take a call | Desk | 30 | Three choices made | Call ends |
| Help Ozzie with the server room | Server room | 45 | Cable, ladder, hand | All three |
| Lunch with Tony | Kitchen table | 40 | Eating and listening | Meal ends |
| Heat up lunch and eat | Kitchen | 30 | Microwave, then eating | Plate cleared |
| Fill the water jug | Kitchen | 10 | Jug filled | Jug full |
| Check on the plants at home | Phone | 15 | Looking at the house's plants | Viewed |
| Pay the bills | Phone | 5 | Each bill paid | None due |

Flavour only (no bar): reply-all storm (a choice, then gone), make tea, wash a mug, buy a snack, bring a plant to
Dale, the team photo, birthday cake, chat with Kayleigh, pin a note, ride the lift, check the fire-door sign, refill
the cooler, look out of the window, take a stall break, fix the hand dryer, and read messages.

Each day's three objectives come from the top of this table, and the board meeting falls on its own day.

## Work as scenarios (the variety comes from sequencing)

A **scenario** is a short chain of steps. Each step is a place plus one reusable action, and some steps have a timer.
The same places and step types are reused in many scenarios. That gives variety without a new bespoke action each time.

### Places (added: the boss's office)

- **Boss's office:** Dale's room. He sits at a desk with a window behind him. Jordan walks in, stands or sits in front, and
  the talk runs for a set time. Dale's mood and the project's status change with how the talk goes.
- The meeting room, desk, kitchen, lavatory, hallway, server room and printer alcove stay as before.

### Reusable step types

| Step | What the player does | Timer |
|---|---|---|
| **Go to a place** | Walk to a room or desk; the walk is the step's visible part | None |
| **Disappear behind a door** | Jordan walks through a door and is out of sight | Set by the step |
| **Sit and work** | At a desk or cubicle; the bar fills | Set by the step |
| **Talk** | Stand by someone; a short conversation with a choice | Set by the step |
| **Fix something** | Three steps in any order (printer, cable, jam) | Set by the step |
| **Help someone** | Go to a coworker, do one small job for them | Set by the step |
| **Break** | Kitchen or lavatory; short, nothing lost if skipped | Set by the step |

### Twenty scenarios

Each one is a short chain. Days pick three to five.

1. **Board day:** meeting room (disappear, return), then desk: work on the project.
2. **Board follow-up:** meeting room, then Dale's office to talk about the project, then desk.
3. **Morning with Dale:** Dale's office for a check-in, then tickets at a cubicle.
4. **Printer trouble:** printer alcove (fix the jam), then desk to finish the print run.
5. **Ozzie's cable:** server room with the ladder, then desk to log it.
6. **Kayleigh's mess:** Kayleigh's cubicle (help her with an error), then the kitchen for a coffee to calm down.
7. **Raven's walk:** hallway with Raven, then the fire-door sign, then desk.
8. **Tony's deadline:** Tony's desk (a call), then the desk to write it up.
9. **Lunch run:** kitchen (heat lunch), lunch with Tony, then desk.
10. **Email wall:** desk: answer emails, then a short talk with Kayleigh.
11. **Ticket queue:** a cubicle with five tickets; a break in the lavatory halfway through.
12. **Spreadsheet week:** desk: update the spreadsheet, then Dale's office to show it.
13. **Presentation:** desk: make the slides, then the meeting room to present them, then Dale's office for feedback.
14. **Bug hunt:** Ozzie's desk (look at the bug), then desk (fix it).
15. **Photo day:** hallway (line for the team photo), then the kitchen for cake.
16. **Plant for Dale:** kitchen (fill a cup of water), then Dale's office to give him the plant.
17. **Quiet morning:** desk: answer emails, then a break at the window.
18. **Fire drill:** hallway (walk to the door with everyone), then wait, then desk.
19. **Help desk call:** a cubicle with a caller; then the kitchen for a tea.
20. **Friday wrap-up:** Dale's office for the week's review, then desk for tidying tasks.

### Daily picking

- Each day picks one anchor scenario (the board meeting on its days) and two or three others.
- Days don't repeat the same chain. Each scenario has a set of days it can't sit on, so a scenario can't run two days in
  a row.
- The weekend has none of these.
