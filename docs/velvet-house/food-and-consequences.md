# Food in the house, and why the player should care

Director's brief (2026-10-27): food arrives in a brown paper bag; the player opens it and drags the food into the
fridge; a **food bar** tracks how much food is in the house; neglect has a consequence through Maya. "She may get
upset and ask why haven't you gotten any food? Because it's live she can give really cool responses back to what the
player says: 'omg we're STARVING, can you order some food?', you say 'later', she responds in character. When the
house stats are good she's happy and content; when bills stop being paid, the house stops being cleaned, she reacts
in character. That's your consequence. Otherwise, why would a player care not to keep the fridge stocked?"

Decided by the director on 2026-10-27 (answers to the questions at the end): bond drops; nothing ends the game; a
**hard pass** exists where she refuses to talk until food is bought or the rent is paid; food is put away in Arrange
by moving it onto the fridge, which opens and takes it; a **fitness** bar follows the treadmill; the moving bars live
in an always-on HUD in the bottom-left; and the household's health, the companion's and the house's are **one
sliding system** that shapes how she responds.

**Built (PR #87):** the bag at the door, opened by a tap into a crate of food; dropping the food on the fridge in
Arrange puts it away (stock up, crate gone, fridge door swings); food grazes down one serving every eight game hours
besides meals; fitness (treadmill and weights raise it, time lowers it); the vitals panel bottom-left with Food,
Fitness, Tidy, Bills and the bond.

**Built (same PR, second push):** the concerns below and the hard pass. `state/concerns.ts` holds the rules (food,
bills, dishes, laundry; grace, a level per day ignored, hard pass for food and bills at level 3), the mood and the
bond drift; `systems/concerns.ts` ticks them every game minute, raises `concern.raised` / `concern.cleared` events,
and opens the chat with her line from the humor bank (`concern.<kind>.<level>`, `relief.<kind>`, every style, m/f).
`systems/chat.ts` shows the hard-pass line with the input closed, and passes the live concern and mood to the AI
persona. The bond row of the vitals panel shows the mood. Verified at level A (`concerns.test.ts`, bank
completeness) and S; not yet played (P). **Not built:** sparks and wishes pausing during a concern (they are not
wired yet at all), a resident putting food away herself in free play.

## What exists

- A food stock: `household.fridge.basic` and `.fresh`, shown as "N meals" / "Fridge empty" in the HUD. Residents eat
  from it (`consumeMeal`); hunger is a need that goes "starving" below 15.
- Groceries: ordered from Household ($40, 30 game minutes), arrive as a parcel at the door; a free resident fetches
  it and the stock goes up (`putaway` chain). Takeout likewise. Dez carries the parcel in once the story has
  introduced him.
- The live chat already receives the fridge counts, the dishes, the laundry pile, the power and the bills in its
  context (`PersonaContext`), and has in-voice canned replies when the AI is unavailable.
- Two unwired modules: **wishes** (she wants coffee, a dance, TV; a small objective with a reward) and **sparks**
  (every hour a chance she starts a conversation, weighted by the situation, dishes and money included).

## The design (the simplest thing that gives the brief what it asks)

### 1. The bag and the fridge
- Groceries arrive as a **paper bag** object at the door (replacing the parcel look). Tap it: it opens into one
  **food** piece (a crate of groceries). In Arrange, drag the food onto the fridge and Set it down: it goes in, the
  bag is gone, the stock goes up by the order's servings. (Dropping it elsewhere: it is just a crate on the floor,
  and the companion can notice that too.)
- The **food bar** replaces the "N meals" chip: a bar under the HUD, full at 10 servings, with the number.

### 2. Concerns: the house talks back through her
A **concern** is a rule about the house that the simulation evaluates, with a threshold, a cooldown and a severity:

| Concern | True when | First reaction (mild) | Escalation (after a day ignored) |
|---|---|---|---|
| no food | stock is 0 for 2 game hours, or anyone is starving | she comes over, `!`, opens the chat with the opener "we're starving, can you order some food?" (in her voice) | her mood drops a step; she stops cooking; the line gets sharper |
| bills overdue | a bill past due | she mentions it once (spark) | power cut is already built; mood drops |
| dishes piling | dishes ≥ 6 | a spark line | mood drops a step |
| laundry | pile ≥ 8 | a spark line | mood drops a step |
| mess | dirt level high (once wired) | a spark line | mood drops a step |

- **Mood** is one number the simulation owns (content → fine → worried → upset), moved only by concerns clearing or
  escalating and by good days. It drives her expression (the art already takes a mood), her idle lines, and what
  she will do for the player (an upset partner does not cook or make coffee for them).
- **Openers, not scripts.** A concern never waits on words. It hands the chat an opener hint and the concern's facts;
  the AI says it in her voice and keeps the conversation live. The player's "later" gets a reply in character because
  the concern stays active and is in the next turn's context. With no AI, the in-voice canned opener plays and the
  chat closes.
- **Clearing.** The concern clears when the house changes (stock > 0, bill paid, dishes washed), never when the
  player says something. Her mood recovers a step per cleared concern and a step per good day.
- **Cooldowns.** One concern conversation at a time; a concern nags at most once per game day unless it escalates;
  sparks pause while a concern is active, so she is not chirpy about a playlist while the fridge is empty.

This stays inside the boundary in the audit §4: the simulation owns the stock, the concern and the mood; the chat
only receives them and speaks.

## The hard pass (decided)

When a concern has escalated and been ignored for another day, she stops talking: opening the chat shows one line in
her voice ("I'm not talking to you till you buy us food" / "...till the rent's paid"), the input stays closed, and
every spark and wish pauses. It lifts the moment the house changes (food in the fridge, the bill paid), with a line
that acknowledges it. Bond falls a point per game hour a concern is escalated, never below 10, and recovers a point
per good hour. Nothing ends the game.

## Questions for the director (answered where marked)

1. **How hard do consequences bite?** Answered: bond drops; the hard pass above; nothing ends the game.
2. **Where does the food bar live:** Answered: an always-on panel in the bottom-left, with every moving bar together.
3. **Putting food away:** Answered: the player, in Arrange, by moving the food onto the fridge. [open: whether a
   resident may do it after an hour in free play; today nobody does]
4. **Does takeout also come in a bag**, eaten at once, no fridge? [yes, as today, in a bag]
5. **How does an upset companion look and sound** between conversations: a face only, or also idle lines in the log
   ("Maya looked in the empty fridge again")? [both]
