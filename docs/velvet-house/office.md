# The office: content plan

*Design doc. The office is a second place Jordan goes to during the day, clearly unlike the house.*

## Rooms and what is in them

| Room | Things you can do there | Interactables |
|---|---|---|
| **Open plan** | Sit at your desk, work on tickets, check the team board | Jordan's desk, 8 cubicles, wall board, printer, plant, window blinds |
| **Meeting room** | Attend the board meeting (he disappears behind the door, comes back when it's done) | Long table, screen, whiteboard, chairs, water jug |
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
