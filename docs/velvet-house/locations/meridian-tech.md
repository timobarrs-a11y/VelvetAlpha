# Meridian Tech (IT Help Desk): layout and art plan

*Planning doc. Scope: how the office is reached, what you do there (objectives), and its layout and look. The ticket list and cast are in `../jobs.md`; where that doc says Maya stays home, this one supersedes it (see "Going to work").*

## Going to work: automatic, or yours

This is the rule that decides everything else.

- **By default the household goes to work on its own.** On a workday both of them leave at the same time, and both are home at the same time. No scene
  opens, the clock runs as it does today (`routineStep`: `leave` at the job's start, `return` at its end, status "At work"), and the shift pays the
  ordinary day's wage (`dayPay`). Nothing about the office is ever shown. A player who never touches it never meets it.
- **The office is unlocked by choosing to take control of the commute.** When the player takes over at the moment they leave ("Go to work with
  Jordan"), the office scene opens and the shift is played. This is the only way in. Declining costs nothing but the extras below.
- **Taking control is optional every day,** and the unlock is the first time they do it: the Meridian Tech level then appears in the floor bar for
  good, and the Help Desk job is theirs to progress in.
- **There is no walking out of the house to a street.** Both people leave through the front door in the existing "away" state, as now; if the
  player takes control, the scene switches to the office, and when the shift ends it switches back as they return together.

## Objectives (what you do when you take control)

A shift is a stream of tickets (the table in `../jobs.md`) against a performance meter. These objectives sit on top of it.
*These numbers are a proposal to confirm; the structure is what matters.*

| Level | Objective | Why it exists |
|---|---|---|
| **Per ticket** | Pick the right fix: turn it off and on again, check the cable, reset the password, or escalate. Right answer fast = full marks, wrong = a retry with a hit to the meter | The core loop |
| **Per shift** | Clear the day's quota (say 8 tickets) and keep the average response under the timer. Hit both = a **good shift** | The thing you are playing for |
| **Per shift, bonus** | One hidden "extra": help Kayleigh with a break, calm Dale before the review, or spot that it was Barb's cable again | Rewards paying attention without spoiling it |
| **Per week** | The Friday review: a score from the week's speed and accuracy. Over the bar = a raise, under = nothing lost | The pay and promotion gate |
| **Career** | Help Desk Tech, Senior Tech, Team Lead, Sysadmin, IT Director. Each needs a number of good shifts and a review score. Each step unlocks something in the office (a better desk, a window seat, a key to the server room, the corner office) | A reason to come back |
| **Set pieces** | Monday standup, Friday review, the all-hands server outage. Each fires once its conditions are met | The story beats |

What the player gets for taking control, over autopilot:
- **Autopilot pays the plain day's wage and nothing more.** No performance, no promotion, no bonuses, no relationships at the office.
- **A played shift adds** a bonus on a good shift, the weekly review raise, promotion up the ladder, and the story with the cast.
- **Nobody is punished for letting it run.** The household is always fed and paid. (Check this against the "skipping work" decision in `../jobs.md`.)

Needs still drain at work (`needs.ts` `away`), so a controlled shift also has Jordan eat in the break room and use the bathroom; that is a small objective
of its own (keep him from starving) and uses the break room we are building.

## What the engine gives us (and its limits)

- A scene is a level in `state/scenes.ts` with a `LevelDef` in `state/house.ts` (rooms, interior walls, wall features, anchor). Every level is the
  **same 10 x 8 tile floor** (`WX`, `WY`) with walls 2.6 high, drawn in the 2:1 isometric view with the four camera turns. Meridian Tech has to fit
  that box, as the house floors do.
- Rooms are rectangles inside it, split by interior walls with doorway gaps (the main floor does this today). Furniture is a `TYPES` entry
  (width, depth, height, blocking box, optional use spots) plus a painter in `houseArt.js`. Day and night, rain and the light pass already work
  on any level through `state/daylight.ts` and the deferred lighting.
- Adding a level changes the floor bar and every per-level array (`LEVELS`, `LEVEL_NAMES`, saves). That touches the save format, so we ask the
  director before changing `MIN_CONTENT_VERSION`, and add the level so old houses load with it simply absent.

## One floor, four rooms

Back walls are along the top edges on screen; the camera looks in from the front-right. Tile coordinates, x across, y deep.

```
 y0  +----------------+--+--------------+
     |   BOARDROOM    |  |  SERVER ROOM |   glass front, long table
     |  x0-4  y0-3.2  |HW|  x6.6-10     |   cold blue, racks, one door
 y3.2+------ door -----+  +----- door ---+
     |                    |             |
     |   CUBICLE FARM     |  BREAK ROOM |
     |   x0-6.2  y3.2-8   |  x6.2-10    |
     |   6 desks, 2 rows  |  y3.2-8     |
 y8  +--------------------+-------------+
     x0                 x6.2           x10
```

| Room | Tiles | Doorways | Feels like |
|---|---|---|---|
| Cubicle farm | 6.2 x 4.8, front left | Open to a hallway strip along its right, door to the boardroom | Beige carpet, low grey partitions, a window wall on the street side |
| Boardroom | 4.0 x 3.2, back left | One door to the hallway, glass front wall (half-height, so the camera sees in) | Dark wood table for six, a screen, a whiteboard |
| Server room | 3.4 x 3.2, back right | One door, always shut when no one is in | Cold blue light, racks with blinking LEDs, a floor vent, a fan |
| Break room | 3.8 x 4.8, front right | Open doorway to the hallway | Coffee machine, fridge, a small table, a microwave, Dale's mug |
| Hallway | 0.4 to 0.6 wide strip between | | Keeps every room reachable for the walk-around check |

The cubicle farm holds six desks (two rows of three), so Jordan's has neighbours: Ozzie, Kayleigh and the empty one Barb calls about.
Jordan's desk is the one nearest the window, with the sad plant and the mug.

## New pieces to build (each: a size, a blocking box, use spots)

| Piece | Footprint (tiles) | Notes |
|---|---|---|
| Cubicle desk with partition | 1.8 x 1.4 | Monitor, keyboard, mug. Colour and style customisable like the home desk. Use spot: sit and work |
| Office chair | 0.6 x 0.6 | Turns to the desk |
| Server rack | 0.9 x 0.9 x 2.2 | Blinking LEDs lit by the glow layer, a door that opens for a repair |
| Copier or printer | 1.2 x 0.8 | The "haunted printer"; a paper-jam state |
| Water cooler | 0.5 x 0.5 | Bubble animation |
| Boardroom table and chairs | 3.0 x 1.2 | Six seats, a table screen |
| Whiteboard, wall clock, notice board | wall pieces | Reuse the wall-lamp style hang system |
| Coffee station, fridge, microwave | counter pieces | Reuse the kitchen counter pieces where we can |
| Ceiling lights | | Fluorescent panels: the lit-room look, not lamps |

Static props like the server racks, copier and water cooler are the best fit for the Meshy route we discussed (rendered to flat pictures at the
game's angle). Cubicles and partitions are simple boxes and stay code-drawn so they can be recoloured.

## Art direction

- **Palette:** office beige, grey and a corporate blue accent (the "Meridian" logo on the wall), with the break room warmer and the server room
  cold. Distinct from the house's warm wood.
- **Light:** the lit-office look all day (flat white ceiling light), so no lamp pools. The window wall follows the real daylight: sun by day, a lit
  street at night (the lane's lamps and windows already exist). The server room has its own cold glow that does not change with the hour.
- **Day and night at work:** the shift runs 9 to 5, so most of it is daylight. At the end of a late day the windows go dusk-orange, which
  gives the Friday review its mood. The night guard (Raven) only appears after hours.
- **Characters:** the cast needs sprites and a work pose set: typing, on the phone, standing at the copier, sipping coffee. Raven in the server
  room only. Placement per room so the camera always has someone doing something.
- **Weather:** rain on the window wall, using the weather state, and the break room window shows snow in winter.

## Build order

1. **Register the scene and a bare floor:** a level with the four rooms, walls and doorways, an empty anchor path, no furniture. Check the
   camera, the four turns, the floor bar and that old saves still load. *(Needs the director's word on the save change.)*
2. **Furniture set 1:** cubicle desk, chair, partition, server rack. Check each at all four turns and the walk-around check passes.
3. **Furniture set 2:** copier, cooler, boardroom, break room pieces.
4. **Light and day or night:** window wall, ceiling light, server glow, dusk at the end of the shift.
5. **Cast placement and work poses.**
6. **Taking control:** the "go to work with Jordan" prompt at the leave step, the scene switch, the shift's end and the return. Then the objectives, one level at
   a time: tickets, the shift quota, the weekly review, the career ladder.

Each step is its own small change, and is checked in the real game on desktop and phone before the next.

## Open questions

1. **Maya's day:** the jobs doc has her staying home with chores, and you said both leave and return together. Does Maya have her own job and
   workplace (a second location to plan), or does she go somewhere unseen? Her needs and her texts to Jordan on break depend on it.
2. **Weekends and days off:** no work, so no prompt, as now. Does a sick day or a called-in day (`calledIn`) cancel the prompt?
3. **The prompt:** where does the choice appear (a card at the leave hour, a button on the Today page, both)? And does it time out into autopilot?
4. **Pay for a played shift vs autopilot:** confirm the split above, so taking control is a reward and not a chore.
5. **One floor or two:** if the four rooms feel cramped at 10 x 8, the server room and boardroom could be a second floor reached by stairs. That
   doubles the level work.
6. **Saves:** adding a level touches the save format, so we ask the director before changing `MIN_CONTENT_VERSION`. Old houses would load
   without the office, which fits "unlocked by taking control".
7. **Customisable:** which of the office pieces can the player recolour or rearrange? The jobs doc says "organize affects mood".
8. **Story scenes:** Monday standup, the Friday review and the server outage each need their own contract in `docs/velvet-house/scenes/` before they
   are built, so they are out of scope here.
9. **Name and brand:** Meridian Tech is fine as a fictional name. Check it is not a real company before shipping.
