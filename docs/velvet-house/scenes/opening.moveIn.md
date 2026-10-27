# Scene contract: `opening.moveIn` (the move-in)

Status: **proposed, not approved**. This is the audit's reading of the opening as it plays today, lined up against
the three documents that describe it, with the gaps marked. Nothing here has been built. Section 13 lists the
decisions that need the director; the contract is finalised after those answers.

Sources read: `src/games/velvet-house/content/scripts.ts` (`OPENING`), `content/lines.ts`, `content/banks.ts`,
`content/marks.ts`, `script/gameHost.ts`, `script/engine.ts`, `docs/velvet-house/opening-sequence.md` (the brief),
`docs/velvet-house/chapter1-script.md` ("as it plays now"), `docs/velvet-house/companion-voices-and-openings.md`
(the "new first beat"), `docs/velvet-house/architecture-plan.md` §2.5 (the worked example the engine was built from).

## What actually happens today (traced through the code, then confirmed in play)

Verified in play: the repository's `e2e/velvet-sims/story.spec.ts` (both tests pass in this container) and the
probe described in `scene-reliability-audit.md` §A. "Code" below means confirmed by reading only.

1. **Title screen.** The house runs behind a menu; Continue or New Game reloads the page (`main.ts` `launch`).
2. **Boot.** A new game removes the starter sofa, plant and lamp from the house and queues `opening.moveIn`
   (`gameHost.ts` 229–237). The host page is told the game is ready and sends names, voice, relationship and the
   town plot *afterwards*, over `postMessage` (`hostBridge.ts`, `VelvetHouseNextGame.tsx` `sendProfile`).
3. **Drive-up.** On the first tick the cutscene starts: letterbox bars, dock and canvas disabled, Skip shown. The
   drive-up canvas plays for about 8 seconds (a tap ends it). It reads the plot once, when it starts, so unless the
   host's plot message beat the first frame it shows the starter house (code).
4. **Setup.** Clock set to day 1, 9:00. Jordan is placed in the living room and Maya by the window, then both are
   immediately placed at the door again (two dead steps left from the old cold open: `scripts.ts` 28–32).
5. **Arrival.** Dez spawns at the door; Jordan and Maya walk to their entry marks without waiting; Dez walks inside
   and the camera closes in on him. Dez: "Come on in, {player} and {partner}! Welcome to your new home!" (tap).
   Camera wide; Maya gets a `!` and says the truck-off-the-road line for her humor style (tap). Dez brushes it off;
   if the companion is a friend, the roommates line; then `dez.intro.2`, `.3`, `.4` (taps). Dez walks out.
6. **The couch box.** After 1 s Dez re-enters carrying a box, walks to the gap between entry and kitchen, the box
   appears there (`give`, id `box.couch`, contents `sofa`), Dez leaves. Maya `!` and the "mayor carried our couch"
   line for her humor style (tap). **Checkpoint.**
7. **Lesson 1, guided.** Only the box can be tapped. Card "Open the box". Waits for the event `obj.unpacked` on
   `box.couch`. Tapping the box runs a 380 ms poof, then the box becomes a sofa, Arrange opens with it selected.
8. **Lesson 2, guided.** Maya asks for the couch by the TV in her communication style (tap). A player-coloured
   outline appears at `living.couchTv`; card "Put it where it goes" with a **Set it down** button. The button snaps
   the couch to the outline if it is within 4 units and closes Arrange. **The beat ends on the button, whatever the
   couch's position** (`gameHost.ts` 223, `arrange.ts` 109–114). Checkpoint; flags `opening.done` and
   `dez.deliveries` set; the script finishes (people released, card and outline cleared, mode off, clock runs).
9. **Hand-off.** `tutorial.ch7` triggers on `opening.done` as a `beat` chapter: after 2 s Dez brings the lamp box
   and two plant boxes, and the lamp lesson begins. That is a separate scene and gets its own contract.

What the brief describes and the game does **not** do: the cold open (two partner lines alone in the empty room,
then a knock), Dez's original five intro lines, the four personality voices, Maya sitting and looking at the window,
the TV-or-window ask and the Keep it / Move it choice (removed on 2026-10-27, and the docs were given a banner
rather than rewritten), the "Tap anything in your home" wording, and the radial menu with one option (a single
action runs at once; the tray only appears for two or more).

## 1. Purpose and intended player experience

From the brief: "a new-game cold open through the end of the tutorial"; the player meets Dez, learns that
tapping things is how you act in the house, and places the first piece of furniture; "the companion is how the
store becomes part of the world"; "the relationship is the product". The intended feeling (overhaul brief §10):
"the satisfying thud and dust when a box lands; the companion turning to look at them."

## 2. Initial conditions

| Condition | Tag | How the game knows | Today |
|---|---|---|---|
| A brand-new save (no `velvet-sims:<id>` slot, or Start chosen) | Invariant | `world.save === null` | Yes |
| The starter sofa, plant and lamp are not in the house | Invariant | `gameHost.ts` removes them for a new game | Yes |
| Clock day 1, 09:00, paused for the cutscene | Invariant | `clock` step; cutscene holds the day | Yes |
| Main floor shown, walls down, camera wide | Required | `camera` step; `wallIdx` default `down` | Yes |
| Player and partner names known | Invariant for lines | `g.simName`, `g.partnerName` from the host profile | **Race:** read at line time; defaults are Jordan and Maya |
| Companion humor and communication style known | Required | `g.s.voice` from the host profile | **Race:** defaults `warm`/`diplomatic`; not saved |
| Relationship (romantic or friend) known | Required for the roommates branch | `story.rel`, copied from `g.s.voice` every tick | **Race** |
| The player's town plot, for the drive-up | Flexible | `g.s.plot` from the host | **Race:** read once, usually `null` |
| Nobody stands on the drop mark | Required | `give` fails and traces `give-fail` | Not handled by the story |

## 3. Required story beats, in order

| Beat | Director's words (brief) | Tag | Exit condition (game terms) | Resume-safe fallback |
|---|---|---|---|---|
| B0 | Drive-up: Dez's truck pulls up at the player's house (chapter1-script §0) | Flexible presentation | `introDone()` or a tap | none needed (no world effect) |
| B1 | The player and the companion walk in with Dez (companion-voices "new first beat") | Required beat | all three `arrived` at their marks | world: Dez exists inside, both at entry marks |
| B2 | Dez welcomes them and introduces himself: mayor, mover, delivery | Required beat; the three facts are **Invariant** | last intro line dismissed | `did.say.dez.intro.4` (new) |
| B2a | The truck-off-the-road joke | Optional moment (humor bank) | line dismissed | – |
| B2b | Roommates line when the companion is a friend | Optional moment, cond `rel = friend` | line dismissed | – |
| B3 | Dez fetches the couch box, sets it down in the entry gap, leaves | Required beat | `box.couch` exists, Dez despawned | world: `box.couch` exists (as box or sofa) |
| B4 | The companion reacts: the mayor carried our couch | Required beat | line dismissed | `did.say.couchCarried` (new) |
| B5 | Tap the box: "Tap anything in your home to see what you can do with it." | Required beat (guided) | event `obj.unpacked box.couch` | world: `box.couch.type === 'sofa'` |
| B6 | Place the couch where the partner asks, against the wall facing the TV | Required beat (guided) | **decision 13.5**: sofa within tolerance of `living.couchTv`, or sofa set down anywhere | world predicate on `box.couch` position |
| B7 | Opening complete; Dez's deliveries begin | Invariant | flags `opening.done`, `dez.deliveries`; mode off; people released | idempotent `set` steps |

Beats the brief has that are **not** in the game, awaiting decision 13.1: the cold open (partner alone in the empty
room, two lines, the knock). Beats the game has that the brief does not: B1 as a walk-in with Dez, B2a.

## 4. Character presence, positions and behaviour

| Beat | Jordan (player) | Partner | Dez | Who controls |
|---|---|---|---|---|
| B0 | off stage | off stage | in the truck (drawn) | drive-up canvas |
| B1 | door → `entry.you` | door → `entry.partner` | door → `entry.inside`, carrying nothing | script (all three `scripted`) |
| B2 | stands at `entry.you` | stands at `entry.partner`, `!` on B2a | `entry.inside`, faces the room | script |
| B3 | same | same | out, then in with `pbox`, to `entry.drop`, out | script |
| B4 | same | same, `!` | gone | script |
| B5–B6 | frozen in place (scripted, no task) | frozen | gone | player (taps/drag on the allowed object only) |
| B7 | released; free will from here | released | – | simulation |

Invariant: during B1–B6 neither resident may wander, and nobody may stand on `entry.drop` when the box lands.
Today the second half holds only by luck (`give-fail` trace).

## 5. Animation, presentation and dialogue

| Beat | Mode | Camera | Poses, props, effects | Lines (how chosen) |
|---|---|---|---|---|
| B0 | cutscene | drive-up canvas | truck, street kit, plot; fade in/out; tap to end | none |
| B1 | cutscene | wide, then close on Dez 1.8× | walk clips; Dez name tag | – |
| B2 | cutscene | close on Dez; wide for the partner's line | `!` alert bubble | `dez.welcome`, `dez.brushOff`, `dez.intro.2–4` (fixed); `humor.truckOffRoad` (bank); `dez.roommates` (fixed, cond) |
| B3 | cutscene | wide | Dez carries a box (default carried prop); `art.drop` thud dust on landing | none |
| B4 | cutscene | wide | `!` | `humor.couchCarried` (bank) |
| B5 | guided | as is | canvas spotlight on the box; card; poof + burst on unpack | none |
| B6 | guided | Arrange framing (piece + outline) | ghost outline in player colour; card with button | `communication.couchPlace` (bank) |

Flexible: the exact zoom values, the hold time of bubbles, the typewriter speed. Not flexible: a line is never
shown before its speaker is on stage and standing (today `dez.welcome` can start while Jordan and Maya are still
walking; acceptable only if the director says so, see 13.3).

## 6. Advancing between beats

Today: B1 ends when Dez's walk ends (the residents' walks are not awaited); B2/B4 end on taps; B3 on Dez's walks;
B5 on the `obj.unpacked` event only; B6 on the card button only. Proposed: B5 and B6 end on world predicates (the
box is a sofa; the sofa is at the mark within tolerance or, per 13.5, has been set down by the player with
`obj.placed`), with the button as a convenience that snaps and closes Arrange but does not end the beat.

## 7. State changes and events recorded

| What | When | Today |
|---|---|---|
| `box.couch` created (pbox, contents sofa) at `entry.drop` | B3 | yes, guarded by id |
| `box.couch` becomes `sofa` | B5 | yes (`interact.ts` unpack) |
| sofa position | B6 | written by Arrange; not checked by the story |
| flags `opening.done`, `dez.deliveries` | B7 | yes |
| `rt.done` gets `opening.moveIn` | B7 | yes |
| `did.obj.unpacked`, `did.placed.sofa`, `did.tab.arrange` | B5/B6 | yes, but the opening's own waits do not use them |
| Must not change: bond, needs, money, memories, chat turns | all | holds (no step touches them) |

## 8. Optional interactions and permitted variations

Friend companion: `dez.roommates` and roommate beds (`hostBridge.ts roommateBeds`, only when the profile arrives on
day 1). Humor and communication banks: 4 × 4 styles for the three partner lines. Camera: the player cannot move it
during the cutscene; in guided beats pinch and drag still work. Pausing with Space during the cutscene is possible
and freezes the walkers (see recovery).

## 9. Completion and control handoff

Done when B7's flags are set and the script finishes: people released, highlight and outline cleared, mode off (UI
back, Skip hidden), clock running at 09:00, speed 1. Next: `tutorial.ch7` on `opening.done`. Camera: left where
Arrange put it until ch7's camera step. Today this hand-off is correct.

## 10. Recovery behaviour

| Case | Expected | Today (code; A = confirmed in play) |
|---|---|---|
| Reload during B0–B4 | Replay from the start of the cutscene, no duplicate box | Replays from the top; `give` guarded by id, so one box |
| Reload after unpacking (B5 done, B6 not) | Resume at B6 | **Soft-lock:** resumes at the checkpoint before B5 and waits for `obj.unpacked`, which can never fire again (A) |
| Reload during B6 | Resume at B6 with outline and card | Same soft-lock as above |
| Skip during B0–B4 | Couch by the TV, flags set, Dez gone | Yes (`onSkip`) |
| Skip after unpacking | One couch, by the TV or where it is | **Two couches:** `onSkip` gives `sofa` while `box.couch` is already a sofa (A) |
| Pause (Space) during the cutscene | Not possible, or walkers keep walking | Walkers freeze; the cutscene waits with no hint (`run.ts` 36 returns before the scripted branch) |
| Profile arrives after the first line | Lines use real names and voice | Default names and `warm`/`diplomatic` until it arrives; `rel` branch missed |
| Plot arrives after the drive-up starts | Drive-up shows the player's house | Starter house |
| Someone stands on `entry.drop` | Box lands nearby | `give` fails silently; the lesson waits on a box that does not exist |
| Drive-up cancelled by Skip | Overlay removed | Yes (`update` cancels it) |

## 11. Acceptance criteria

S = source, A = automated, P = played. The opening is accepted only when every A and P item passes on desktop and phone.

1. A new game shows the drive-up with the player's own plot when the host has one; a tap ends it. (P)
2. B1–B4 play in order; no line is shown while its speaker is off stage. (A headless, P)
3. Dez's three identity facts are said, in his words, to every player. (A content test)
4. After B3 exactly one couch source exists (`box.couch`), at `entry.drop`. (A)
5. Only `box.couch` is tappable during B5; the dock, other objects and the partner are not. (A e2e)
6. Unpacking turns the box into a sofa and opens Arrange with it selected. (A e2e)
7. B6 ends only when the sofa satisfies the agreed placement rule (13.5); pressing Set it down with the couch
   elsewhere does not end the opening. (A e2e, P)
8. After B7 the clock runs, the dock works, Skip is hidden, both residents move on their own. (A e2e)
9. Reload at every wait (after B4, after B5, during B6) resumes without a soft-lock and without a second box or
   couch. (A headless + e2e)
10. Skip at every wait leaves exactly one couch and the same flags as watching. (A headless)
11. Names, voice and relationship in the lines match the host profile when it arrives within 1.5 s; after that
   the game uses the saved values. (A e2e with a profile-sending host, P)
12. No page errors during the whole opening. (A e2e)

## 12. Assets

**Existing and reused:** Dez (`content/characters.ts`), `pbox` with `contents`, `sofa`, marks `door`,
`entry.inside/you/partner/drop`, `living.couchTv`, carried-box prop (`houseArt.js drawCarried` default case), `!`
alert and speech bubbles, speech box with typewriter and ▼ (`scriptUi.ts`), cards with optional button, ghost
outline (`art.setGhost`), canvas spotlight, letterbox bars, Skip button, drive-up (`arrivalIntro.ts` + the town
street kit), poof/burst/drop effects, humor and communication banks for `truckOffRoad`, `couchCarried`,
`couchPlace`, Dez's fixed lines.

**Required by the brief and missing:** a knock (no sound system in the game: no Howler, no AudioContext use under
`src/games/velvet-house`; no door animation; the `!` bubble stands in), a clipboard for Dez (`carrying:
'clipboard'` would draw as a moving box), a thud sound, the four personality voices (the app has no such field),
player spoken lines (`say('jordan', …)` works but no lines exist), Maya sitting and looking toward the window
(removed with the ask), a radial menu with a single "Unpack" option (a single action runs immediately).

**Should be removed or rewritten:** the two dead `place` steps (`scripts.ts` 28–29); the `Preset` plumbing the
validator still demands (`validate.ts` 4, 37, 44) when no line in the book uses presets.

## 12a. Scene-state transition map

One row per state the opening can be in. "Resume" is what a reload in that state should do; "Skip" what Skip
should leave behind. Today's behaviour is in §10; this is the target.

| State | Entered when | Prerequisites checked on entry | Exit → next | Resume | Skip |
|---|---|---|---|---|---|
| `NEW` | brand-new save | starter sofa/plant/lamp removed; host profile and plot applied, or 1.5 s passed | start → `DRIVEUP` | restart | – |
| `DRIVEUP` | first tick | plot known or fallback house | `introDone` or tap → `ARRIVAL` | restart (no world effect) | fast-forward to `DONE` |
| `ARRIVAL` | drive-up over | clock 09:00, camera wide L1, all three at `door`, Dez spawned | all three arrived → `INTRO` | re-place all three at door, replay | fast-forward |
| `INTRO` | arrival | Dez at `entry.inside`; names and voice known | `dez.intro.4` dismissed → `COUCH_DELIVERY` | replay from `ARRIVAL` (lines repeat; acceptable) | fast-forward |
| `COUCH_DELIVERY` | intro done | `entry.drop` free; Dez outside | `box.couch` exists and Dez despawned → `REACT` | if `box.couch` exists skip the give; else replay | fast-forward: `box.couch` as `sofa` at `living.couchTv` only if no couch exists |
| `REACT` | box down | Maya on stage | `couchCarried` dismissed → `LESSON_TAP` | replay the line | fast-forward |
| `LESSON_TAP` | react done | mode guided, allow `obj:box.couch`, card shown | `box.couch.type === 'sofa'` (world) → `LESSON_PLACE` | rebuild mode/card; if already a sofa, exit at once | fast-forward |
| `LESSON_PLACE` | unpacked | Arrange open with the sofa selected, outline at `living.couchTv`, card with button | sofa satisfies the placement rule (13.5) → `DONE` | rebuild mode/outline/card; if rule already true, exit at once | fast-forward: snap the sofa to the mark |
| `DONE` | placed | – | flags `opening.done`, `dez.deliveries`; release; mode off; `rt.done` → `tutorial.ch7` | nothing (script finished) | – |

Invariants across every state: exactly one couch source; nobody but the script moves Jordan or Maya until
`DONE`; the clock reads 09:00 until `DONE`; Skip is visible only in `DRIVEUP`–`LESSON_PLACE`.

## 12b. Continuity checklist

Checked at `DONE` and again at the start of `tutorial.ch7`:

- [ ] One object of type `sofa` on level 1, id `box.couch` (or the skip id), no `pbox` with `contents: sofa` left.
- [ ] If rule 13.5(a): the sofa is within tolerance of `living.couchTv`, rot 2.
- [ ] Dez is not in `people`; `people` is the two residents only.
- [ ] Jordan and Maya are on level 1, `scripted === false`, with no task left from the script.
- [ ] Clock day 1, 09:00; `view.paused` false; `scriptMode` null; `scriptAllow` empty; no card, outline, spotlight or letterbox showing.
- [ ] Flags: `opening.done`, `dez.deliveries` true; `rt.done` includes `opening.moveIn`; `rt.active` null.
- [ ] Names and voice in the save match the host profile; `rel` matches the companion's relationship.
- [ ] Bond, needs, money, memories and chat turns unchanged from the new-game values.
- [ ] No `give-fail` entry in the engine trace.
- [ ] A save written now and reloaded reaches `tutorial.ch7` without replaying the opening.

## 12c. Minimal implementation plan (after approval)

Content and small host changes only; no engine rewrite. Each step is one PR with its test.

1. `scripts.ts`: remove the two dead `place` steps; await the residents' walks in B1 (13.3); replace the B5 wait
   with a `did.obj.unpacked`-or-world fallback and the B6 button-ending with a `wait until` world condition (new
   `world` cond kind in `types.ts`/`engine.ts`, evaluated by the host in `gameHost.ts`).
2. `engine.ts`: skip as fast-forward of the remaining steps; keep `onSkip` optional. `validate.ts`: reject bare
   event waits and buttons not followed by a wait.
3. `main.ts`/`gameHost.ts`: start the new-game script after the profile and plot are applied or 1.5 s; save
   `voice`; drive-up reads the plot at start (unchanged) which now works.
4. `e2e/velvet-sims/host.html` sends a profile; `story.spec.ts` asserts the sofa position and the single couch after
   Skip; a headless `opening.test.ts` plays the beats against a world model with reload and skip at every wait.
5. Delete `opening-sequence.md` Part 1, `chapter1-script.md` and the opening part of
   `companion-voices-and-openings.md`; this contract is the single source.

## 13. Unresolved: decisions for the director

Each with the audit's recommendation; nothing is built until answered.

1. **Which first beat is canon?** The brief's cold open (partner alone, two lines, a knock) or the current walk-in
   with Dez. Recommendation: keep the walk-in (it exists and tests pass), and decide whether the two cold-open lines
   are wanted as an optional moment before Dez speaks.
2. **Dez's intro text.** The brief's five lines or the code's `welcome / brushOff / intro.2–4`. Recommendation:
   pick one and delete the other from the docs.
3. **Line timing.** May Dez's first line start while the residents are still walking in? Recommendation: no;
   await all three (`wait: true`).
4. **Companion voice key.** Four presets (brief), humor × communication banks (code), or signature voice (33 tone
   sets, companion-voices doc). Recommendation: banks now (they are what the app can send), signature voice later
   if the chat engine will use it.
5. **Placement rule for B6.** (a) Enforce: the couch must land in the outline; (b) respect: wherever the player
   sets it down counts, and Maya reacts to where it is; (c) hybrid: enforce in the opening only. Recommendation:
   (a) for the opening, since later beats (Maya sits to watch TV, the lamp "by the couch" mark) assume the TV wall.
6. **Knock, clipboard, thud.** Should audio be introduced for these, or is the `!` the agreed stand-in?
7. **Player lines.** Are Jordan's spoken lines (chapter1-script "where the player can speak") wanted now?
8. **Roommates.** Are three friend-specific lines enough, or does every slot need a roommate version as the
   companion-voices doc proposes?
9. **Save compatibility.** When the opening changes again, do players mid-opening start over (today: yes, by
   bumping `MIN_CONTENT_VERSION`) or resume? Recommendation: resume once recovery (section 10) is fixed, and
   reserve content bumps for finished-house changes.

## 14. Verified

Not yet: this contract is a proposal. The "Today" columns record what the audit found; see
`scene-reliability-audit.md` for how each was checked.
