# Velvet House: Opening & Tutorial

*Design doc: new-game cold open through the end of the tutorial*

---

## The setting

**Honeysuckle Hollow** is a small Southern town, and the new house sits on
Maple Street. Everyone knows everyone, and nearly everyone is related to
the Duprees.

### Dez Dupree

**Desmond "Dez" Dupree** is a good ol' country boy, warm and loud, with a
handshake that lasts too long. He's the latest Dupree to run Honeysuckle
Hollow, and he wears every hat in town:

| Hat | What it means in the game |
|---|---|
| **Dupree Movin' & Haulin'** | Brings the moving boxes on day 1 |
| **Dupree Delivers** | Brings **everything you buy in the store**: groceries, takeout, furniture, decor. Every purchase arrives at the front door in Dez's arms. |
| **Dupree Construction** | Paint, floors, wallpaper and house upgrades. He mentions it in the tutorial and pays it off later. |
| **Mayor** | Town events, festivals, the welcome check. He mentions it in the tutorial and pays it off later. |

**The dynasty:** his great-great-granddaddy Beauregard Dupree founded the
town. Since then, a Dupree has run the mayor's office, the trucks and the
lumber yard. Dez plays it as a joke ("Folks call it a dynasty. I call it a
family business"), and he really is a sweetheart.

**Voice:** Southern and easygoing, with dropped g's and plenty of *y'all*,
*reckon*, *fixin' to* and *well I'll be*. He calls the player "neighbor"
or "friend" rather than sir/ma'am, so his lines work for any player.

**Catchphrase:** **"Get 'er done!"** He says it on his way out the door,
every visit.

**Why he matters to the system:** Dez is how the store becomes part of the
world. When you buy something, you don't just watch it appear. A knock comes
at the door, Dez walks it in, says a line, and leaves. Because every purchase
comes with a visit, he's the most recurring character in the game after your
partner.

---

## The core: a companion chat with a house around it

Everything in this doc (the house, Dez, the store, the tutorial) is a
**shell around a conversation**. At any moment, the player can tap their
partner and talk to them like a real person. The topic can be the couch,
their day, or anything else on their mind. The game is the setting, and the
relationship is the product.

### Memory rule

- **Coming in:** the player's and companion's **profile** from the Velvet app
  (name, look, personality, hobbies, favorite color, music). The in-game AI
  uses it to know who the player is and to respond in more tuned ways.
- **Built in the game:** everything the companion remembers, meaning what you
  did together and what you told them. It lives only in the game save.
- **Never goes out:** nothing from Velvet House reaches the main companion
  chat. No conversations, no memories, no moments.

### How it works (built)

| | |
|---|---|
| Chat backend (`velvet-game-turn`) | Stores nothing. Reads the profile only, never main-chat history or memories |
| Main companion chat | Never reads `velvet_house_saves`. Only the game page does |
| Memories from the app | Ignored. The game always starts the companion with no outside memories |
| Memories and moments going out | Removed. The game no longer posts them to the host page |
| What you say in a chat | When a chat closes, the AI summarizes up to 3 things worth remembering (what the player shared, plans, promises, feelings) and stores them as in-game memories |
| Memory budget | 40 memories (was 8), placed in the companion's system prompt so they're never cut off |
| The conversation itself | The last 16 messages are saved with the game, so a reload picks up where you left off |

---

## Part 1: The opening (as directed)

Notation: `{player}`, `{partner}`, `▼` = tap to advance. Partner lines come in
the four personality voices (W warm · C calm · B bubbly · D dry).

### 1. Cold open: waiting for the movers

It's day 1, 9:00 AM, in an empty living room. The clock is paused and input
is locked. {player} and {partner} are already inside, looking around.

> **{partner}:**
> W: "So this is it. Our place. It echoes, babe. Listen. Hellooo." ▼
> C: "It's quieter than I pictured. I like it. Feels like a page nobody's written on yet." ▼
> B: "Okay okay okay. We live here. We LIVE here. I'm going to cry, ignore me." ▼
> D: "Huh. Smaller without furniture. Or bigger. One of those." ▼

> **{partner}:**
> W: "Movers said nine. It's nine. If they're late I'm sitting on the floor in protest." ▼
> C: "The movers should be here any minute. Everything we own, on one truck. Strange thought." ▼
> B: "Where ARE they? I need the couch. I need the kettle. I need my plant babies." ▼
> D: "The movers are late. Our whole lives are in a truck somewhere. Very relaxing." ▼

A knock sounds at the door, and a **!** pops over {partner}'s head.

### 2. The mover

Dez walks in empty-handed with a clipboard. His intro text (as written):

> **Dez:** "Hey y'all! I'm Dez! Welcome to {town}! We're mighty glad to have the two of ya!" ▼
> **Dez:** "I'm the mayor of this quaint little town, but I'm also the mover! Not that ya asked, but I run the food delivery service too." ▼
> **Dez:** "Me and my family have lived here for ages, and we've started a few businesses 'round town, so don't hesitate to holler if ya need help!" ▼
> **Dez:** *(checks the clipboard)* "Now, this paper here says your names are {player} and {partner}." ▼
> **Dez:** "I've got some boxes in the truck with your names on 'em, so I'm gonna start bringing them in. Time to get 'er done!" ▼

`{town}` = Honeysuckle Hollow. `{player}` and `{partner}` are the names from
the setup screen.

Dez heads back out and returns carrying the first box (**COUCH**). He sets it
down with a thud and leaves again.

Once he's out the door, {partner} reacts:

> W: "Did the mayor just carry our couch? I love it here already." ▼
> C: "He seems… sweet. A lot. But sweet." ▼
> B: "THE MAYOR carried our COUCH. Best town. Best day." ▼
> D: "So one man runs the whole town. Cool. Cool cool cool." ▼

### 3. Touch: tap the box

The scene spotlights the box, and a system card appears:
*Tap anything in your home to see what you can do with it.*

Tapping the box opens a **radial menu** on it with one option, **Unpack**.
The game teaches that menus can have one option or several, depending on the
object.

### 4. Placement: put it where you're told

The couch comes out of the box already held. An outline on the floor marks
the target spot, against the wall and facing the TV.

> *System card: Drag to move · ⟳ to rotate · tap to set it down.*

### 5. The ask

The companion **reacts to the placement**. This is the first time the
action-detection system fires. {partner} sits, looks at the TV, then looks
at the window:

> W: "Okay, hear me out. What if it's under the window instead? Sunday mornings, coffee, sun on our feet." ▼
> C: "Can I ask something? I'd sit here more if the light hit it. Would you mind trying it by the window?" ▼
> B: "WAIT. The window! Look at that light! Can we put it there? I know I just said TV. I contain multitudes." ▼
> D: "So. The window. The light's good. The couch should be in it. I'm aware I just agreed to the TV wall." ▼

### 6. The first choice

> **[ Keep it by the TV ]**  **[ Move it to the window ]**

**Keep it** (`couch: 'mine'`):
> W: "Mm. Fine. FINE. But I'm stealing the window for something else, watch me."
> C: "Okay. That's fair. I'll find the light somewhere else."
> B: "TV couch! Also great. Everything's great. I'm putting a plant there though."
> D: "Bold. Wrong, but bold. I'll allow it."

**Move it** (`couch: 'theirs'`). Arrange mode reopens, with the window
outline in {partner}'s color, and the player moves the couch there.
> W: "Look at that. Look at US. Okay, that's perfect. Don't let it go to your head."
> C: "Thank you. Really. That's going to be my favorite spot."
> B: "AAAH. Okay sit, sit with me. Ten seconds. Then more boxes."
> D: "See? Better. I'd say I told you so, but I only told you thirty seconds ago."

From this point, the save is different for everyone.

---

## Part 2: The rest of the tutorial

### The idea

Each chapter teaches **one** system. A person in the world introduces it,
then the player does it, then the companion **reacts** (the action-detection
system from beat 5). That loop is the spine of the whole game, so the
tutorial repeats it until it feels natural.

The tutorial covers the rest of day 1. It ends when the move-in checklist is
done.

| Ch. | Name | Teaches | Delivered by | Checklist goal it completes |
|---|---|---|---|---|
| 7 | The Rest of the Truck | Unpacking alone · {partner} acts on their own | Dez (boxes) | `unpack` (keeps running in the background) |
| 8 | Dez's Card | The **store** · ordering · delivery wait | Dez (explains) | none |
| 9 | Echo Fridge | **Groceries** · Dez delivers · put away | Dez (groceries) | `food` |
| 10 | First Meal | **Needs** · multi-option radial (stove, sink) | {partner} | none |
| 11 | Sit Down With Me | **Talking** (free-text chat) | {partner} | `talk` |
| 12 | Primer White | **Paint/floors** · making a room yours · the companion's taste | {partner} + Dez (Construction) | `room` |
| 13 | Upstairs | **Floors & camera** | {partner} | none |
| 14 | Rent's Due Monday | **Money** · bills · work schedule | Dez (as mayor) | none |
| 15 | Get 'Er Done | Life goal · free will on · tutorial ends | Dez + {partner} | settles everything |

**Pacing:**
- From chapter 7 on, input is never locked. Chapters are prompts, not scenes.
- If a player wanders off to do something else, the next chapter waits for
  them.
- Each chapter is about 1–3 minutes, so the whole tutorial runs about 20
  minutes of play.

---

### Ch. 7: The Rest of the Truck

**Trigger:** the first choice is resolved.

Dez comes back with the next box, the **LAMP**. This time there's no
spotlight and no instructions. The player does the full loop (tap → Unpack →
place) alone.

> **Dez:** "Got your lamp here. Fragile-ish. Y'all know the drill by now." ▼
> **Dez:** "I'll stack the rest of 'em right by the door. Holler if you need me. Well, don't holler, I'll be in the truck." *(exits)* "Get 'er done!"

The remaining boxes appear stacked by the door, and the checklist shows
*Unpack every box (optional)*.

**What's new:** {partner} unpacks one box on their own and puts it **where
they want it**. The existing code already does this. A short log line points
it out:
> *{partner} unpacked the plant and put it by the window.*

> **{partner}:** (voiced) "I did one! Don't move it. …You can move it. But don't."

**Teaches:** your partner is a person who acts in the house too, not only
someone who reacts to you.

**Done when:** the lamp is placed.

---

### Ch. 8: Dez's Card

**Trigger:** the lamp is placed. Dez steps back inside before driving off.

> **Dez:** "Oh! 'Fore I forget." *(hands over a card)* "That there's how you reach me. Anything y'all want, you order it, and I'll bring it right on over." ▼
> **Dez:** "Groceries, furniture, paint, a whole dang porch swing. I got a truck for all of it." ▼

The **store panel** opens with a highlight on it, and a system card appears:
> *Everything in the store is delivered by Dez. Orders take a little while to
> arrive, so plan ahead.*

> **Dez:** "Now I'd start with groceries if I were you. Y'all look hungry, and that fridge looks emptier'n a church on Super Bowl Sunday." ▼
> **Dez:** "Get 'er done!" *(exits)*

**Teaches:** the store, and the fact that Dez is how purchases get to you.

**Done when:** the store panel has been seen. This leads straight into
chapter 9.

---

### Ch. 9: Echo Fridge

**Trigger:** chapter 8 ends.

The **Groceries** tab is highlighted. {partner} opens the fridge and closes
it again:

> W: "Babe. The fridge is empty. Like, echo empty."
> C: "We have nothing to eat. Let's order something in."
> B: "Fridge is EMPTY. I'm going to perish. Order snacks. Order everything."
> D: "The fridge contains one ice tray. No ice."

The player orders groceries. While the delivery is on its way:
- A **delivery chip** in the HUD shows a countdown ("Dupree Delivers · 30 min").
- A system card appears: *Time keeps moving while you wait. Use the speed
  controls to skip ahead.*

There's a knock at the door, and Dez walks in carrying grocery bags:

> **Dez:** "Dupree Delivers! Fresh from my cousin Darla's farm stand. Well, second cousin. Well, Darla." ▼
> **Dez:** *(sets the bags down)* "Y'all put them cold things away now, y'hear? Get 'er done!"

The player taps the bags, which open a radial with one option, **Put away**.
The food goes into the fridge.

**Teaches:** ordering, the delivery wait, time controls, and that a purchase
has to be dealt with when it arrives.

**Done when:** the groceries are put away. This checks off `food`.

---

### Ch. 10: First Meal

**Trigger:** the groceries are put away.

The **needs** bars light up for the first time, with {player}'s hunger
flashing:

> *System card: You and {partner} both get hungry, tired and bored. Keep an
> eye on these.*

> **{partner}:** (voiced) "Okay, now we have food. Who's cooking? …I'm looking at you."

The player taps the **stove/counter**. A radial opens with **several
options**:
- **Cook a meal**
- **Make coffee**
- **Grab a snack**

Choosing **Cook a meal** has {player} cook, and both of them eat. That leaves
dishes, and {partner} reacts:

> **{partner}:** (voiced) "That was good. …The dishes are your problem though."

The player taps the **sink**. Its radial changes with what's going on:
- **Wash dishes** (there are dishes now)
- **Turn on water** / **Turn off water** (switches depending on whether
  the tap is running)
- **Fill a glass**

If the player leaves the water running, {partner} notices (the
action-detection system again):

> **{partner}:** (voiced) "Are we running a waterfall? The bill comes Monday."

**Teaches:** needs, objects with several actions, and that an object's
actions change with its state (no dishes means no Wash dishes).

**Done when:** the dishes are washed.

---

### Ch. 11: Sit Down With Me

**Trigger:** the dishes are done.

{partner} walks over with a **!** bubble:

> *System card: Tap {partner} to talk. You can say anything, not just
> things about the house. {partner} remembers what you tell them.*

The free-text chat opens. {partner}'s first line comes from **the first
choice**:

- **Kept by the TV:** "So you and the TV. Should I be worried?"
- **Moved to the window:** "I keep looking at the couch. Thank you for that."

From there, the conversation is live AI. The first choice is passed in as
context, so the chat can keep building on it.

**Teaches:** talking, and that your partner remembers what you did.

**Done when:** the player has sent one message and said goodbye. This checks
off `talk`.

---

### Ch. 12: Primer White

**Trigger:** the talk ends.

> **{partner}:** (voiced) "These walls are so sad. Primer white. Can we make one room ours today? Just one."

The **Paint** tab is highlighted. Paint, wallpaper and floors come from
**Dupree Construction**:

> **Dez:** *(knock; Dez in a hard hat with paint cans)* "Dupree Construction, at your service! Same fella, different hat." ▼
> **Dez:** "Paint, floors, wallpaper, all the fixin's. Y'all pick it, my boys'll have it on the walls 'fore lunch." ▼
> **Dez:** "Get 'er done!"

The player picks a color and the room changes. {partner} **reacts with their
own taste**. Every new game shuffles their likes a little (existing system),
so the reaction differs from save to save:

- Likes it: "Okay, the {color}? Yes. Yes yes yes."
- Doesn't: *(a face they try to hide)* "…It's a choice."

> *System card: {partner} has their own taste. Pay attention to what they
> love, or ask them.*

If the player chose **window** in the first choice, {partner} hands this
decision over: "You let me have the window. You pick the color. I won't say a
word." *(They will say a word.)*

**Teaches:** room styling, that the companion has taste, and that you can ask
them about it in chat.

**Done when:** one room is painted, papered or floored. This checks off `room`.

---

### Ch. 13: Upstairs

**Trigger:** chapter 12 is done. {partner} heads upstairs on their own.

> **{partner}:** *(from off-screen)* "Come look at the bedroom! Up here!"

The **floor buttons** are highlighted (Basement · Main · Upstairs · Yard),
and so are the **⟲ ⟳** camera buttons.

> *System card: Switch floors here. Turn the camera with ⟲ ⟳ to see around
> corners.*

The player switches to Upstairs. {partner} is standing in the empty bedroom:

> **{partner}:** (voiced) "Bed's still in a box somewhere. We're sleeping on the floor tonight, aren't we."

That nudges the player toward the remaining boxes, so Ch. 7's `unpack` goal
pulls them back in.

**Teaches:** navigating the house, and the camera.

**Done when:** the player has visited the upstairs floor.

---

### Ch. 14: Rent's Due Monday

**Trigger:** late afternoon on day 1. Dez stops by one more time, as
**the mayor**, with a clipboard.

> **Dez:** "Evenin'! Mayor business this time. Just makin' the rounds, welcomin' new folks." ▼
> **Dez:** "Now, rent and utilities come due Monday. Pay it on time and the lights stay on. Don't, and, well, I gotta flip the switch. Ain't personal. It's the Dupree Power & Light." ▼
> **{partner}:** "…You own the power company too?" ▼
> **Dez:** "Granddaddy did. I just inherited it. Like the mustache." ▼

The **wallet** and **bill** chips are highlighted, along with the work
schedule:

> *System card: {player} works weekdays 8 AM to 3 PM, and {partner} has
> their own job. Paychecks come in, bills go out.*

**Teaches:** money, bills, the consequence of not paying (the power gets
cut), and jobs.

**Done when:** the dialogue ends.

---

### Ch. 15: Get 'Er Done

**Trigger:** the `food`, `room` and `talk` goals are done and the couch is
placed. This matches the existing "settled in" condition.

Dez makes one last visit with a welcome basket:

> **Dez:** "Well I'll be. Look at this place! Y'all made it a home in one day." ▼
> **Dez:** "Town of Honeysuckle Hollow'd like to give y'all a little welcome. *(hands over a check: +$100)* Don't spend it all at Dupree's. …Actually, do." ▼
> **Dez:** "Anything y'all need, you know who to call. Get 'er done!" ▼

The **life goal** choice appears: Career climber · Hopeless romantic ·
Homebody · Green thumb.

> **{partner}:** (voiced, reflecting the first choice) "So… what do we want
> this life to look like?"

**Free will turns on:**
> *System card: You and {partner} will now take care of yourselves when you're
> not giving orders. The tutorial is over. Make it yours.*

**Done when:** a life goal is picked. That ends the tutorial.

---

## Notes for the build

Only what this script needs:

- **Store purchases currently appear instantly**, and groceries/takeout
  arrive as a parcel with no NPC. Both need to route through Dez:
  - *Knock → walk in → line → drop → "Get 'er done!" → leave.*
  - Dez needs a pool of delivery lines per category (food, furniture, paint,
    decor), so later visits don't repeat.
- **The existing 9:02 AM auto-chat** on day 1 has to wait until chapter 11.
- **Moving the couch away from the TV** is currently scored as upsetting.
  That reaction has to be suppressed while the opening runs.
- **The game clock** pauses during scripted dialogue (Part 1) and runs freely
  from chapter 7 on.
- **The sink and stove** aren't tappable today. They need actions so they
  can open the radial menus in chapter 10.
- **The existing move-in checklist** stays. The chapters line up with its
  goals, so the checklist simply fills in as the player goes.
