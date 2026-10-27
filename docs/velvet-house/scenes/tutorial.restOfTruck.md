# Scene contract: the rest of the truck (`tutorial.ch7` to `tutorial.ch9`)

Status: **brief received 2026-10-27; partly built.** Sections 1 to 9 are the director's sequence as given; §13 holds
the questions that change what gets built, each with the working assumption the current build uses. The food
mechanic and the companion's consequences are specified in `docs/velvet-house/food-and-consequences.md` and are not
built yet.

## 1. Purpose and intended player experience

Director's words: "stop Dez from bringing in two lamps. Just one, then the plant, then the bed, which we then use to
show users how to take items upstairs or downstairs in Arrange mode. Go upstairs, set the bed, [a beat] before Dez
tells us to come downstairs. When we come down Dez has 3 more boxes on the floor: the fridge, the table, and a
basement item. Once the items have all been placed, another [beat] before Maya: since the fridge has been delivered,
want to order food."

One box per visit, one lesson per box, each teaching one thing: the lamp (place, turn on), the plant (alone, no
help), the bed (carry to another floor), the three boxes (the kitchen, and carrying down to the basement), then the
first order.

## 2. Initial conditions

| Condition | Tag | Today |
|---|---|---|
| `opening.done` (the couch stands at the TV wall) | Invariant | yes |
| A new house has no bed, fridge, dining set or treadmill: they arrive in boxes | Invariant | **built in this round** (starter copies removed for a new game) |
| The fridge starts empty, so there is a reason to order | Invariant | **built**: stock 0 for a new game (was 8 servings) |
| Boxed pieces can be carried between floors with Carry to, fridge included | Required | **built**: the heavy and fixed rules no longer block Carry to |
| Residents held for the whole chapter | Invariant | yes (`needs.hold`) |

## 3. Beats

| Beat | What happens | Tag | Exit condition | Resume-safe fallback |
|---|---|---|---|---|
| L1 | Dez brings **one** box: the lamp. "This one doesn't have a label!" Leaves. | Required | `box.lamp` exists | world |
| L2–L8 | The lamp lessons as in `opening.moveIn.md` Part B (open, the corner by the TV, her change of mind, beside the couch, the light). | Required | lamp lit beside the couch | world |
| P1 | Dez brings the **plant** box, sets it by the door, leaves. No lesson: a card says "You know the drill" and the player opens and places it anywhere on the main floor. | Required beat; place is Flexible | `box.plant` is a `plant`, set down | world |
| B1 | Dez brings the **bed** box. "Heavy one. Y'all figure out where it goes." Leaves. | Required | `box.bed` exists | world |
| B2 | Lesson: open it; card "Carry it upstairs: tap **Carry to → Upstairs** in the Arrange bar." | Required (guided) | `box.bed` is a `bed` on level 2 | world (level) |
| B3 | Upstairs: outline in the bedroom; card "Put it where it goes". Set it down. | Required (guided) | bed set down within tolerance of `upstairs.bed` | world |
| B4 | The room settles (a beat), then Dez, downstairs: "Y'all come on down, I got the rest!" The camera goes to him. | Required | line dismissed | `did.beat` |
| K1 | On the main floor, three boxes on the floor by the door: **fridge**, **dining set**, **basement item** (§13 q2). | Required | the three boxes exist | world |
| K2 | Lesson: the fridge into the kitchen outline. | Required (guided) | fridge set down at `kitchen.fridge` | world |
| K3 | Lesson: the dining set into the kitchen outline. | Required (guided) | dining set at `kitchen.table` | world |
| K4 | Lesson: the basement item; card "Carry it down: **Carry to → Basement**", then the outline. | Required (guided) | item set down at `basement.gear` on level 0 | world |
| K5 | Dez, before leaving: his card and the store ("anything y'all want, you order it, I'll bring it"). The store card. | Required | lines dismissed; store seen | `did.tab.shop` |
| F1 | A beat. Maya: the fridge is here and empty; let's order food (`fridgeEmpty`, humor × gender). Card: order groceries from Household. | Required | groceries ordered | `did.groceries.ordered` |
| F2 | Dez delivers the food in a **brown paper bag** at the door. | Required; the bag is a new asset (§12) | bag at the door | world |
| F3 | The bag opens into food; the player drags the food into the fridge; the food bar fills. | Required; **not built** (see food-and-consequences.md) | stock > 0 | world |

## 4. Presence

Residents held and on the main floor for L and K beats; the player's view follows the lesson (upstairs for B3, basement
for K4). Dez: in and out per visit; for B4 he waits at `entry.inside` on the main floor while the player is upstairs.

## 5. Presentation

One box per visit; Dez's line only once he has stopped; a beat (settle, turn, `!`, hold) before each of Maya's
reactions; cards without buttons; Set it down and Carry to in the Arrange bar.

## 10. Recovery

Every lesson waits on the world, so a reload resumes at the lesson; a box already opened or a piece already placed
passes at once. Boxes are given by id, never twice.

## 11. Acceptance (S/A/P)

1. Exactly one lamp arrives. (A: one `box.lamp`, no other `lamp` on level 1 besides the basement's)
2. One box per Dez visit, in the order lamp, plant, bed, then three at once. (A headless)
3. The bed can be carried upstairs with Carry to and set down in the outline; the lesson ends only then. (A e2e; P)
4. Dez's call down comes after a beat, with the camera on him. (P)
5. The fridge, table and basement item each end in their outline; the basement item via Carry to → Basement. (A e2e; P)
6. Maya's food prompt comes after a beat and only once all three are placed. (A)
7. The food arrives as a paper bag. (P)

## 12. Assets

Existing: `pbox` with contents, `bed`, `fridge`, `dining`, `tread`, `plant`, Carry to buttons, outlines, marks
`upstairs.bedroom`. New marks: `upstairs.bed`, `kitchen.fridge`, `kitchen.table`, `basement.gear`. New lines: Dez's
plant, bed and call-down lines. **New art:** a brown paper bag for groceries at the door (replaces the small box with
a sprig); food items as pieces that can be dragged (not built).

## 13. Questions for the director (working assumption in brackets)

1. **"Two lamps"**: what did you see, two lamp boxes, or a second floor lamp already in the room? There is one lamp
   box in the script; the basement has its own lamp from the start. [one box; nothing else changed until I know]
2. **Which basement item** is in the third box? [the treadmill, since the basement is the gym; the starter treadmill
   is removed from a new house so it arrives in the box]
3. **The fridge:** once placed, may the player move it again later, like any piece? It used to be fixed. [yes]
4. **The plant:** any lesson, or a plain "you know the drill" with no outline? [no outline; anywhere on the main floor]
5. **Dez's store card** (today's chapter 8): keep it as the moment before the food order, said while he is still in
   the house after the three boxes? [yes]
6. **Friend companions:** with no starter bed, the two single beds for roommates cannot be set up on day one until
   the bed is placed. Should the bed box become two single beds for a friend? [yes, when opened]
