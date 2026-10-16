# Velvet House: The Opening

*Design doc: new-game cold open, touch tutorial, and the first choice*

---

## 1. The pitch

Pokémon never tells you how to play. Your mom says something, a professor
walks in, and you learn by doing what the world asks of you. Velvet House
should open the same way. There's no menu and no tooltip wall. Two people
stand in an empty house, a mover comes through the door, and the game teaches
itself one tap at a time.

Then, about two and a half minutes in, the game does something Pokémon
doesn't. It asks you to choose between your own idea and your partner's, and
it remembers which one you picked. **From that moment on, no two saves are the
same house.**

Three rules hold for the whole opening:

1. **Show, then hand over.** Every mechanic is shown once with a spotlight,
   then the next time you do it alone. ("Now you try" is the Pokémon rhythm.)
2. **The companion teaches, not the UI.** Instructions come from people in the
   world. System text appears only where a person can't say it naturally.
3. **No wrong answers, only different doors.** The first choice changes what
   you get to see later. It never means you failed.

---

## 2. What already exists (build on it, not beside it)

The game is one file, `public/games/velvet-house/index.html`. Most of the
pieces are already in it:

| Need | Already in the code | Gap |
|---|---|---|
| Move-in start | `startMoveIn()` resets day 1, 9:00 AM, $600, and packs 12 items into a mover queue | Fires right after the setup form, with no scene in front of it |
| Mover NPC | `spawnMover` / `deliverNextBox` / `moverTick`: walks door → `PARCEL.stand`, drops box, leaves | Silent. Never speaks or faces anyone |
| Boxes | `pbox` objects, tap → `unpackOrder()` → `unpackBox()` | Tapping unpacks right away. No menu step |
| Tap menu | `showTray()`: a bottom-centered list. A single option fires instantly | Not radial, not anchored to the object, not state-aware |
| Placement | Arrange mode: `setArranging`, `moveHeld`, `placementOk`, `rotateHeld` | No target zone, and no way to lock to one object |
| Companion reacts to your actions | `noteMove` → `pendingEv` → `judge()` → `react()`, with `RL` line tables and `o.attach` / `o.grudge` | Lines are hard-coded for one voice (Maya, warm) and the timing is random (3–25 min of game time) |
| Personality | `PRESETS`: warm / calm / bubbly / dry, plus free-text `companion.bio` from the Velvet app | Presets only feed the Claude prompt. Scripted lines ignore them |
| Choices UI | `#pickRow` inside `#dialog` (used for shop picks) | No branching-choice component |
| Guided highlight | `updateGuide()` adds `.guide` to the next target | DOM buttons only, can't point at the canvas |
| One-off story beats | `MOMENTS` (id, when, run) plus `flags.events` | Runs on a time poll, not on player actions |
| Memory to the companion | `remember()` and `velvetOut('memory')` to the host app | Ready to use as is |

**Conflicts to fix along the way:**

- `goalsTick()` starts a Claude chat at 9:02 on day 1 (`flags.openedTalk`).
  That has to wait until the opening finishes.
- `judge()` marks a sofa moved away from the TV as **upset** (`RL.sofaTV`). In
  this script the companion is the one who *asks* for that, so the opening
  has to keep its scripted reaction out of `pendingEv`.
- The clock runs during dialogue. Scenes should pause it, as Arrange already
  does.
- The setup form offers **they/them**, but `P()` / `heSwap()` only handle
  `he`. Every scripted line below uses tokens (`{they}`, `{them}`, `{their}`)
  so all three pronoun sets work.

---

## 3. The sequence at a glance

```
NEW GAME ─▶ [Setup card] ─▶ 0 COLD OPEN ─▶ 1 THE MOVER ─▶ 2 TOUCH ─▶ 3 PLACE
                              (scene)        (scene)      (tutorial)  (tutorial)
                                                                         │
             ┌───────────────────────────────────────────────────────────┘
             ▼
        4 THE ASK ──▶ ◆ FIRST CHOICE ◆ ──▶ 5 NOW YOU TRY ──▶ 6 THE TAP
       (watcher)       mine / theirs       (box 2, no help)   (sink, multi-option)
                                                                  │
             ┌────────────────────────────────────────────────────┘
             ▼
        7 FIRST WORDS ──▶ 8 RELEASE ──▶ … day 1 free play … ──▶ 9 NIGHTFALL
        (free-text chat)  (checklist)                           (closing scene,
                                                                 staged on the couch
                                                                 wherever you put it)
```

Target timing: about **2:30 to the first choice**, about **6:00 to full
release**. No stretch of locked input lasts longer than ~20 seconds.

---

## 4. Beat by beat

Notation: `{player}`, `{partner}`, pronoun tokens, `▼` = tap to advance.
Partner lines are given in four voices (W = warm, C = calm, B = bubbly,
D = dry). When only one line appears, all voices share it.

### Beat 0: Cold open, "The Wait"

*Main floor, living room. Empty except the fixed kitchen and TV unit. Morning
light. Clock paused at 9:00 AM, Day 1. Input locked. Camera on the living
room.*

Fade in. Both characters already stand inside near the front door, looking
around. Short idle beat (1.5 s) with no text, just the room and the two of
them.

> **{partner}:** *(turns slowly, takes in the room)*
> W: "So this is it. Our place. It echoes, babe. Listen. Hellooo." ▼
> C: "It's quieter than I pictured. I like it. It feels like a page nobody's written on yet." ▼
> B: "Okay okay okay. We live here. We LIVE here. I'm going to cry, ignore me." ▼
> D: "Huh. Smaller without furniture. Or bigger. One of those." ▼

> **{partner}:**
> W: "Movers said nine. It's nine. If they're late I'm sitting on the floor and refusing to move." ▼
> C: "The movers should be here any minute. Everything we own, on one truck. Strange thought." ▼
> B: "Where ARE they? I need the couch. I need the kettle. I need my plant babies." ▼
> D: "The movers are late. Our entire lives are in a truck somewhere. Very relaxing." ▼

**{player}** has no lines. Like the Pokémon protagonist, the player is the
silent one, and their voice comes later in the free-text chat. Instead, they
turn to face {partner} (`faceToward`), and {partner} reacts to the look:

> **{partner}:** "…What? I'm allowed to be excited." *(emote: laugh)* ▼

A knock sounds on the door. Both characters snap toward it, and a **!** bubble
pops over {partner}'s head (the Pokémon "spotted" beat).

### Beat 1: The Mover

The mover enters through `DOOR` carrying the first box (labeled **COUCH**,
reusing `BOX_LABEL`) and walks to `PARCEL.stand`.

The mover gets a name, **Dez**, with a plate in the dialogue box. Dez is the
game's first NPC, and his job is to set the tone of the world: warm and a
little worn out.

> **Dez:** "Morning! Velvet Movers. You must be {player} and {partner}." ▼
> **Dez:** "Got the big one first, figured you'd want somewhere to sit." *(sets the box down with a thud; sparkle)* ▼
> **Dez:** "Rest of the truck's coming in a bit. Tap the box when you're ready, it won't bite." ▼
> **Dez:** *(on his way out, over his shoulder)* "Nice place. Good light in here." ▼

Dez's last line plants the window, so the companion's request in Beat 4 pays
it off. He leaves, and `moverQueue` stays **paused** until Beat 5.

> **{partner}:**
> W: "The couch! Okay, you do the honors. My back has opinions." ▼
> C: "Go ahead. You open it." ▼
> B: "COUCH. Open it open it open it." ▼
> D: "Well. Go on. It's not going to unbox itself. I checked." ▼

### Beat 2: Touch, "Tap to interact"

Input unlocks for the box only. A **spotlight** dims everything but the box
(a canvas vignette, drawn in `render()` after `lighting()`), and a pulsing
ring sits on the box's footprint.

A one-time **system card** appears (small, top of the stage, not a modal):

> *Tap anything in your home to see what you can do with it.*

The player taps the box, and the **radial menu** opens on it (see §6.2). It
has one petal: **Unpack**. The menu still opens even with one option, because
this tap teaches the player that menus exist. After the tutorial, a
single-option menu can fire straight away (the current behavior), but only
on objects the player has already opened once.

The player taps **Unpack**. {player} walks over and plays the existing
`unpack` act, and the couch appears with a sparkle.

The couch does **not** drop into its default spot. It appears *floating* in
the held state, which hands off straight into Beat 3.

### Beat 3: Place, "Put it where it lives"

Arrange mode turns on, locked to the couch (other objects can't be grabbed).
A **ghost footprint** shows the target: against the back wall, facing the TV.
That's the "correct" family-room layout, and the one `facesTV()` already
checks.

> **{partner}:**
> W: "TV wall, obviously. Line it up so we can see the screen." ▼
> C: "Facing the TV, I think? That's where the outline is." ▼
> B: "Right there, facing the TV! Movie nights! Every night!" ▼
> D: "The TV's over there. The couch should probably look at it. Radical, I know." ▼

> *System card: Drag to move · ⟳ to rotate · tap to set it down.*

Any valid placement that overlaps the ghost by at least 60% counts. The ghost
snaps it into place to forgive fat fingers. If the player sets the couch down
somewhere else, {partner} nudges once ("Close! Little more toward the TV.")
and the ghost pulses. The game never blocks, and after two misses it accepts
the placement anyway and skips ahead to Beat 4 with a variant line ("Oh, we're
doing it your way already. Okay.").

The player sets the couch down and Arrange turns off. Sparkles.

### Beat 4: The Ask (a scripted watcher)

This is the first time the **watcher system** fires (§6.4). The player has
just finished an action, and the companion has a response to it.

{partner} walks to the couch and sits for a beat (`drawSitting`), looks at
the TV, then turns to the window. A **thought** bubble rises (the existing
`thought()` draw call).

> **{partner}:**
> W: "Okay, hear me out. What if it's under the window instead? Sunday mornings, coffee, sun on our feet. Come on. Picture it." ▼
> C: "Can I ask something? I keep looking at that window. I think I'd sit here more if the light hit it. Would you mind trying it there?" ▼
> B: "WAIT. Wait wait wait. The window. Dez was right, the light! Can we put it there? Please? I know I just said TV. I contain multitudes." ▼
> D: "So. I've been staring at the window. The light's good. The couch should be in it. I'm aware I just agreed to the TV wall. People change." ▼

A second ghost appears under the window, in {partner}'s color.

### ◆ The First Choice

The dialogue box shows two large buttons. This is the Pokémon starter
moment, played as a relationship beat instead of a monster pick.

> **[ Keep it by the TV ]**  **[ Move it to the window ]**

A third, quieter option sits below them: *"Talk it out…"*. It opens the
free-text chat with this exact topic queued (`noticed.topic`). That's the
door to answers the script can't write. See §5.3.

**If the player keeps it (`couch: 'mine'`):**

> W: "Mm. Fine. FINE. But I'm stealing the window for something else, watch me." *(laugh)*
> C: "Okay. That's fair, you were here first with it. I'll find the light somewhere else."
> B: "Okay, TV couch! Honestly also great. Everything's great. I'm fine. I'm putting a plant there though."
> D: "Bold. Wrong, but bold. I'll allow it."

**If the player moves it (`couch: 'theirs'`):**

The game switches to Arrange with the window ghost. Moving a couch you've
already placed teaches *re-arranging*, which the checklist goal `arrange`
covers anyway. Once it's placed:

> W: "Look at that. Look at US. Okay, that's perfect. You're perfect. Don't let it go to your head."
> C: "Thank you. Really. That's going to be my favorite spot, I can tell already."
> B: "AAAH. Okay sit, sit with me. Ten seconds. Then more boxes."
> D: "See? Better. I'd say I told you so, but I only told you thirty seconds ago."

Both branches end on the same handoff line (so the flow can rejoin), voiced
by {partner}:

> "Okay. Rest of the truck. Let's go."

### Beat 5: Now you try

`moverQueue` resumes. Dez brings box 2, the **LAMP** (`lamp1`, which already
carries `attach: 0.8`, so it's a good thing to get attached to). This time
there's **no spotlight and no instruction**. Dez has one line:

> **Dez:** "Lamp. Fragile-ish. You know the drill by now."

The player taps the box, unpacks it, and places it however they like. The
placement step comes from Beat 3, so the game hands the player Arrange mode
with no ghost.

The watcher fires again, but this time the line comes from the existing
`judge()` system, re-voiced per personality (§6.5). This is the moment the
player realizes the companion *always* notices, and that Beat 4 wasn't a
one-off.

Then a one-time system card appears:

> *{partner} notices what you change. Not everything, but the things that matter to {them}.*

### Beat 6: The Tap, "One object, many things"

{partner} wanders to the kitchen.

> **{partner}:**
> W: "Babe. Do we even have water? Like, does the sink work?"
> C: "I'm going to check the water. New house, you never know."
> B: "I'm SO thirsty. Moving is cardio. Does the sink work??"
> D: "Moment of truth. Let's see if the previous owners left us plumbing."

The sink pulses, and the player taps it. The radial menu shows **3 petals**:

- **Run water** (turns into **Turn off water** while it's running)
- **Fill a glass** (Drink: a small food or energy bump)
- **Wash dishes** (greyed out with the hint *"No dishes yet"*)

The lesson here is that *the menu changes with the world*. Once the water is
running, the menu shows **Turn off water**. Leave it running for about 20
seconds of real time and a watcher fires:

> W: "Are we… running a waterfall? The bill comes Monday, babe."
> C: "Water's still on, love."
> B: "Oh no, the water, the WATER, the bill!"
> D: "I see we've chosen to support the local water company."

This beat introduces the *state-aware radial*, and it shows that watchers
cover more than furniture without adding a new rule.

### Beat 7: First Words

{partner} approaches (the existing `startAct(maya, 'approach')`) with the
**!** bubble.

> *System card: Tap {partner} to talk. You can say anything.*

This is the free-text Claude chat (`openChat`). The first line is scripted per
branch, so the AI conversation starts from the player's choice:

- `mine`: "So you and the TV. Should I be worried?"
- `theirs`: "Okay, I keep looking at the couch. Thank you for that."
- `talked`: "Thanks for actually hearing me out about the couch."

The choice also goes into `noticed.topic` / `remember()`, so Claude knows the
history and the whole conversation can keep building on it.

### Beat 8: Release

The rest of the boxes flow in. The existing `SETTLE` checklist appears. Its
first two entries (`couch`, `arrange`) are already checked, which feels great.
The guided highlight takes over, and free will stays off until settled, as it
does today. The opening is over, and the player is free to play.

### Beat 9: Nightfall (end of day 1, about 9 PM)

This short scripted scene closes the day and pays off the choice. It plays
**wherever the couch is**, because the couch is the stage.

- `theirs`: Both on the window couch, moonlight through the window (the
  existing `skyColor` / `lighting()`).
  > "Told you. Look at that. Best seat in the house."
- `mine`: Both on the TV couch. {partner} picks something to watch (this
  calls the existing `video` system and seeds `flags.watched`).
  > "Okay. I'll admit it. TV couch has perks."
  > *(if a plant or lamp ended up by the window)* "And my window has a plant now, so we both won."
- `talked`: one line generated live from the remembered conversation, with
  the matching branch line as the fallback.

Fade, then the first save.

---

## 5. Why the game is different for everyone after this

### 5.1 What the choice writes

```js
flags.intro = {
  step: 'done',
  couch: 'mine' | 'theirs' | 'talked',
  couchSpot: { x, y, rot },        // where it actually ended up
  ghostHits: 0..2,                 // did they follow the first instruction?
  waterLeftOn: true | false,       // did they leave the tap running?
  lampSpot: 'near-seat' | 'window' | 'other'
}
```

And in the existing systems:

| Branch | `bond` | couch `attach` | `remember()` | {partner}'s stance |
|---|---|---|---|---|
| `mine` | +0 | 0.3, normal | "{player} wanted the couch facing the TV. {partner} wanted the window and let it go." | `wantsWindow = true`: {partner} *will* fill the window spot with something {they} choose (the existing `buy_plant` / `buy_decor` acts, within the first 2 days) |
| `theirs` | +3 | 0.8, {partner} is attached and will *notice* if it moves | "{player} moved the couch to the window because {partner} asked." | `owesOne = true`: {partner} defers to the player on the first paint choice and says so |
| `talked` | +2 to +4 from Claude's `bond=` tag | depends on the outcome | Claude's own summary | whichever way the talk landed, plus `heardOut = true` |

### 5.2 Callbacks (where the divergence shows up)

These are new `MOMENTS` entries keyed on `flags.intro`:

- **Day 1 night:** the Nightfall scene (above).
- **Day 2 morning:** `theirs`: {partner} is on the window couch with coffee
  and pulls you over. `mine`: {partner} has put a chair or plant by the
  window and announces it with a grin.
- **First paint choice:** `theirs`: "You picked the couch spot, I mean, I
  picked, you let me. Your turn. Pick the color." The player picks and
  {partner} won't veto it. `mine`: {partner} has a strong opinion and the
  normal `judge()` rules apply.
- **Moving the couch later:** `theirs` makes it the highest-attachment object
  in the house, and moving it triggers a unique line ("…the window couch?
  Our window couch?"). `mine` has no special case.
- **The first argument (`firstfight`):** if it fires, its body references
  the couch in both branches. "It was never about the couch."
- **Velvet app memory:** `velvetOut('memory')` sends the couch moment back to
  the companion outside the game, so the same companion can bring it up in
  the main Velvet chat days later. *This is the strongest hook we have:
  a choice in the game shows up in the relationship outside it.*

### 5.3 Scripted vs. generated

The tutorial lines are **scripted**. They need to be instant and reliable, they
cost nothing, and they can't go off the rails at the moment we're teaching
controls.

Claude takes over at **"Talk it out…"** and **Beat 7**. Those are the places
where "different for everyone" becomes literal. The script gives every player
the same well-made skeleton, and the conversation is theirs.

---

## 6. Systems to build

All of these go in `index.html` beside the systems they extend. Each is small
on its own.

### 6.1 Scene runner

This is a data-driven list of beats. While a scene runs: the clock is paused
(the `update()` call is gated the way `arranging` gates it), free will is
off, and canvas taps go only to whatever the beat allows.

```js
const SCENE_COLD_OPEN = [
  { do: 'camera', room: 'Living room' },
  { do: 'place',  who: 'player',  at: [1.4, 5.6], face: 'room' },
  { do: 'place',  who: 'partner', at: [1.8, 6.4], face: 'room' },
  { do: 'wait',   s: 1.5 },
  { do: 'say',    who: 'partner', line: 'open.echo' },        // keys into VOICE tables
  { do: 'say',    who: 'partner', line: 'open.movers' },
  { do: 'face',   who: 'player',  to: 'partner' },
  { do: 'say',    who: 'partner', line: 'open.allowed', emote: 'laugh' },
  { do: 'sfx',    id: 'knock' },
  { do: 'bang',   who: 'partner' },                           // the "!" bubble
  { do: 'mover',  box: 'sofa', hold: true },                  // walk in, stop at PARCEL.stand
  { do: 'say',    who: 'mover', line: 'dez.hello' },
  // …
  { do: 'tutorial', step: 'touch' }                           // hands off to §6.3
];
```

Beat types: `camera`, `place`, `walk` (uses `planRoute`), `face`, `say`,
`emote`, `bang`, `wait`, `sfx`, `mover`, `choice`, `flag`, `tutorial`. The
runner itself is about 80 lines on top of `moveAlong` / `faceToward` /
`setLine`.

### 6.2 Radial menu (replacing `showTray`)

- It opens **on the object**: the center sits at the object's screen
  position (`iso(...objCenter(o))`), with petals at evenly spaced angles and
  a radius of about 64 px. Petals flip inward near the stage edges.
- **1 to 4 petals.** If an object would have more than 4, a 5th "More…"
  petal opens a second ring. (No object should need it today.)
- **State-aware.** Each action declares `show(o)` and `enabled(o)` with a
  reason string. A disabled petal shows the reason on long-press or hover.
  Example: Wash dishes → "No dishes yet."
- **Teach once, then speed up.** The first time an object type is tapped,
  the radial always opens, even with one option. After that, single-option
  objects act on a tap, and **long-press** always opens the radial.
- **Fixed objects need hooks.** Sink (`counter` / `vanity`), fridge and TV
  are fixed, and most of them aren't tappable today. They need `spots`, or a
  `FIXED_ACTS` map, so the sink can offer Run water / Turn off / Fill a glass
  / Wash dishes.
- The petal icons reuse `ACT_ICON`.

### 6.3 Tutorial steps

A small state machine on `flags.intro.step`, with these steps:

`cold_open → mover → touch → place → ask → choice → (rearrange) → try_alone → tap → first_words → done`

Each step defines:

- `allow(x, y, obj)`: which taps go through. Everything else gets a soft
  "not yet" wobble on the spotlight target, never a dead tap.
- `target()`: the thing to spotlight, either on the canvas or in the DOM. The
  existing `updateGuide()` gets a canvas branch for this.
- `enter()` / `exit()`
- `done()`: what advances the step

It saves after every step, so quitting during the tutorial resumes at the
same step, not at the start.

### 6.4 Watchers (the action → comment system)

This generalizes what `noteMove` → `judge` → `react` already does. A watcher
is `{ id, on: 'place' | 'unpack' | 'act' | 'state', match(ev), delay, once, run(ev) }`.

- While the opening runs, **scripted watchers** come first and take the
  event. That's how Beat 4 always fires exactly once, right away, and stays
  out of `pendingEv` (so the `sofaTV` upset line can't fire).
- After the opening, the same pipe carries the existing `judge()` reactions.
  New watchers (water left on, lights left on in empty rooms, the first meal
  cooked) become easy one-liners to add.
- The real-time delay is **short in the tutorial (0.8 s)** so cause and
  effect are obvious, then shifts back to the existing randomized game-time
  delay.

### 6.5 Voice tables (personality-grounded lines)

```js
const VOICE = {
  'open.echo': {
    warm:   "So this is it. Our place. It echoes, babe. Listen. Hellooo.",
    calm:   "It's quieter than I pictured. I like it…",
    bubbly: "Okay okay okay. We live here. We LIVE here…",
    dry:    "Huh. Smaller without furniture. Or bigger. One of those."
  },
  // …
};
const say = (key, vars) => fillPronouns(P(VOICE[key][voiceOf(companion)]), vars);
```

`voiceOf(companion)`:

- **Game-made partner:** returns `companion.preset`.
- **Velvet-app companion** (free-text `bio`): scores the bio against keyword
  sets, the same approach as the existing `STYLE_WORDS` / `wordsToStyle`.
  - *tease, sarcastic, playful, banter* → warm
  - *calm, gentle, thoughtful, quiet* → calm
  - *energetic, bubbly, excited, chaotic* → bubbly
  - *dry, deadpan, witty, guarded* → dry
  - Default is warm. The result is cached once in the save.
- **Optional polish (phase 2):** for Velvet companions, ask
  `velvet-game-turn` to rewrite the *next* scripted line in the companion's
  voice while the current line types out. Use it only if it comes back within
  ~1.2 s, and always fall back to the table. That way the tutorial never
  waits on the network.

The existing `RL` reaction tables move into `VOICE` over time, so ordinary
in-game reactions also stop sounding like one Maya.

### 6.6 Dialogue box: script mode

This reuses `#dialog`, with a few changes in script mode:

- The speaker plate changes per line ({partner} / Dez / system), with each
  speaker's color dot.
- The text input is hidden. A blinking ▼ shows on the last line, and tapping
  anywhere on the stage advances.
- Tapping while text is still typing completes the line (the standard
  Pokémon behavior).
- `choice` beats render 2 or 3 full-width buttons in `#pickRow`.
- There's a `Skip ⏭` button, shown only to players who have already finished
  the opening once on this device (`localStorage` flag). It jumps straight
  to the end state with `couch: 'mine'` defaults, or asks which way they want
  it.

---

## 7. Edge cases

- **Returning players / existing saves:** `loadGame()` hits skip the opening
  entirely. Old saves without `flags.intro` count as `step: 'done'`.
- **Craftsman house:** the room coordinates differ, so the scene needs
  per-house anchors (living room, window ghost, `DOOR`, `PARCEL`). Store
  them on `HOUSES[...]` next to the existing data.
- **The window ghost is blocked** (an earlier misplacement covers it): run
  `nearestFree` / `spotNear` around the window and pick the closest valid
  footprint.
- **Restart from New Game:** the opening plays again, and Skip is available.
- **Reduced motion:** no camera easing, no spotlight pulse, and lines appear
  in full (`usePrefersReducedMotion` equivalent: the CSS media query already
  exists).
- **Claude unavailable during "Talk it out…" or Beat 7:** fall back to the
  scripted `mine` / `theirs` lines and store `couch` from where the couch
  ends up.

---

## 8. Build order

1. **Voice tables + `voiceOf()` + they/them tokens.** Small, and it unblocks
   every scripted line.
2. **Scene runner + script-mode dialogue.** Gets Beats 0–1 playable.
3. **Radial menu**, including the fixed-object hooks (sink, fridge).
4. **Tutorial step machine + canvas spotlight + ghost footprints.** Gets
   Beats 2–3 playable.
5. **Watchers + the choice beat + `flags.intro`.** Gets Beats 4–5 playable.
6. **Beats 6–9 and the callbacks in §5.2.**
7. **Playtest pass:** time to the first choice, number of mis-taps per step,
   and the share of players who pick `mine` / `theirs` / `talked`. If one
   choice gets over 75%, rebalance the lines.

---

## 9. Open questions

1. **Dez's role:** is he a one-off, or a recurring neighborhood face (later
   deliveries, the furniture shop)? Pokémon gets a lot out of recurring minor
   NPCs.
2. **Should the player character speak** in scripted beats (a dialogue
   choice tree), or stay silent until the free-text chat? This doc assumes
   silent.
3. **"Talk it out…"** as a third door: keep it, or hold to a strict binary
   for the first choice?
4. **Should the first choice also go to the Velvet app** (§5.2), so the
   companion brings it up outside the game? The bridge already exists.
5. **Personality coverage:** four voices to start. If the presets grow, the
   VOICE tables grow with them, so should we cap the scripted opening at four
   archetypes and let Claude handle the long tail?
