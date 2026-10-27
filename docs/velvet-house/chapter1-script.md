# Chapter 1: the move-in, as it plays now

> **Changed:** the opening no longer has the couch-by-the-window ask or the Keep it / Move it choice. It ends when the couch is set down, then Dez brings the lamp. Ignore the window-ask and "moved it" parts below.

Source: `src/games/velvet-house/content/scripts.ts` (`OPENING`) and `content/lines.ts`. The player (Jordan) says nothing yet.
Maya's lines come in four voices: **warm / calm / bubbly / dry** (all four are shown). `{town}`, `{player}`, `{partner}` are filled in.

## 0. Drive-up (new, no dialogue)
Dez's truck drives down Maple Street and pulls up at the player's town house. Tap to skip. Fades to the inside.

## 1. Cold open (inside, empty house, Maya by the window)
**MAYA**
- warm: So this is it. Our place. It echoes, babe. Listen. Hellooo.
- calm: It's quieter than I pictured. I like it. Feels like a page nobody's written on yet.
- bubbly: Okay okay okay. We live here. We LIVE here. I'm going to cry, ignore me.
- dry: Huh. Smaller without furniture. Or bigger. One of those.

**MAYA**
- warm: Movers said nine. It's nine. If they're late I'm sitting on the floor in protest.
- calm: The movers should be here any minute. Everything we own, on one truck. Strange thought.
- bubbly: Where ARE they? I need the couch. I need the kettle. I need my plant babies.
- dry: The movers are late. Our whole lives are in a truck somewhere. Very relaxing.

*(Maya looks alarmed: the "!" bubble.)*

## 2. The mover (Dez walks in, camera pushes in on him)
**DEZ** (same for everyone)
1. Hey y'all! I'm Dez! Welcome to {town}! We're mighty glad to have the two of ya!
2. I'm the mayor of this quaint little town, but I'm also the mover! Not that ya asked, but I run the food delivery service too.
3. Me and my family have lived here for ages, and we've started a few businesses 'round town, so don't hesitate to holler if ya need help!
4. Now, this paper here says your names are {player} and {partner}.
5. I've got some boxes in the truck with your names on 'em, so I'm gonna start bringing them in. Time to get 'er done!

*(Dez walks out the door. 1 second.)* Dez comes back carrying a moving box, sets it down in the gap between the entry and kitchen, leaves.

**MAYA**
- warm: Did the mayor just carry our couch? I love it here already.
- calm: He seems… sweet. A lot. But sweet.
- bubbly: THE MAYOR carried our COUCH. Best town. Best day.
- dry: So one man runs the whole town. Cool. Cool cool cool.

## 3. Touch tutorial (no dialogue)
Cards: "Tap anything" (the box) → unpack → "Put it where it goes" (drag the couch to the outline by the TV, tap Set it down).

## 4. The ask
*(Maya sits to watch the TV, 2.5 s.)*

**MAYA**
- warm: Okay, hear me out. What if it's under the window instead? Sunday mornings, coffee, sun on our feet.
- calm: Can I ask something? I'd sit here more if the light hit it. Would you mind trying it by the window?
- bubbly: WAIT. The window! Look at that light! Can we put it there? I know I just said TV. I contain multitudes.
- dry: So. The window. The light's good. The couch should be in it. I'm aware I just agreed to the TV wall.

## 5. The first choice (the player picks; today these are button labels, not spoken lines)
**[Keep it by the TV]** (default)  →  **MAYA**
- warm: Mm. Fine. FINE. But I'm stealing the window for something else, watch me.
- calm: Okay. That's fair. I'll find the light somewhere else.
- bubbly: TV couch! Also great. Everything's great. I'm putting a plant there though.
- dry: Bold. Wrong, but bold. I'll allow it.

**[Move it to the window]**  →  card "By the window: drag the couch into the pink outline"  →  **MAYA**
- warm: Look at that. Look at US. Okay, that's perfect. Don't let it go to your head.
- calm: Thank you. Really. That's going to be my favorite spot.
- bubbly: AAAH. Okay sit, sit with me. Ten seconds. Then more boxes.
- dry: See? Better. I'd say I told you so, but I only told you thirty seconds ago.

Then chapter 7 starts (Dez brings the lamp box, etc.).

---

## Where the player can speak
`say('jordan', 'some.line.id')` works like Maya's lines (the speaker name is the player's name). Natural slots:
- after the drive-up, right when Maya says the movers are late (the "why is the truck off the road" joke, Maya or Jordan or Dez)
- after Dez intro line 5 (Dez drives, Dez walks)
- after "THE MAYOR carried our COUCH"
- the two choice buttons could also be spoken aloud after they are picked
