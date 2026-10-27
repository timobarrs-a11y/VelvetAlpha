# Scene contract: the move-in (`opening.moveIn` and `tutorial.ch7`)

Status: **direction approved by the director on 2026-10-27** (answers recorded in §0). Implementation has not
started; it begins when the director says go. Section 13 holds the small questions still open; each has a working
assumption so none of them blocks the start.

This contract covers two scripts because the director describes them as one continuous introduction: the arrival
and the couch (`opening.moveIn`) and the lamp (`tutorial.ch7`). The hand-off between them is a continuity point and
is specified here.

Sources read: `src/games/velvet-house/content/scripts.ts`, `content/lines.ts`, `content/banks.ts`,
`content/marks.ts`, `script/gameHost.ts`, `script/engine.ts`, `ui/arrivalIntro.ts`, the director's brief
(`opening-sequence.md`) and the director's answers of 2026-10-27.

## 0. Decisions taken

| # | Question | Decision |
|---|---|---|
| 1 | First thing seen inside | Dez, the player and the companion walk in together. The truck-off-the-road joke stays and is a **required beat**; the drive-up should visibly run over a tree so the joke lands on something the player saw. |
| 2 | Dez's introduction | The current lines, reworked as in §3 B2–B5: "Welcome to {town}" with the town name bold and green; the companion leads with the driving remark; Dez brushes it off; Dez confirms the names (one tap); Dez points at the first box and leaves. |
| 3 | Lines while walking | Never. Handheld-RPG rule: a dialogue box appears only when every mover involved has stopped. Dez enters first carrying the box, the player and companion follow; the speech starts when all three stand at their marks. |
| 4 | Companion voice key | Hard-coded line banks keyed by the companion's **humor style × communication style** (4 × 4), complete for every slot. Live generation is for later. |
| 5 | Couch placed elsewhere | The step does not end. The companion says, in her communication style, that this is not where she wants it, and the lesson stays open until the couch is in the outline. Same rule for both lamp placements. |
| 6 | Sound | None. The `!` bubble and visual effects are the stand-in. |
| 7 | Player lines | None. The player character never speaks in scripted scenes. |
| 8 | Line variants | Lines vary by humor style, communication style **and the companion's gender** (masculine and feminine versions of each). No separate roommate versions; wording is written without pet names so it fits a partner or a friend. |
| 9 | Saves when the opening changes | New game for everyone (keep the `MIN_CONTENT_VERSION` bump). Reload safety within one version still has to work (§10). |

Added 2026-10-27 (fourth round, after the director played it):
- **Arrange sets nothing on letting go.** A dragged piece stays where it was dropped, loose, red or green. **Set it
  down** in the Arrange bar keeps it (and refuses with a reason if it does not fit); **Put it back** returns it;
  **Rotate** turns it in place. No auto-rotation: the couch lesson adds a short turn step using Rotate, and ends only
  when the couch faces the TV. The lesson cards have no buttons.
- **A piece in hand never counts as placed.** The lamp's "glitch back to the entryway" was the lesson's condition
  coming true mid-drag; Arrange then closed itself and closing Arrange put the held piece back where it was picked up.
- **Reactions are a sequence, not a timer:** the room settles (0.7 s), the partner turns to what changed (0.4 s),
  the `!` hangs on its own (1.0 s), then the line. Where she asks rather than notices (the couch), no `!`.

Added 2026-10-27 (third round): **there is no Skip.** A story animation plays to its end, as in a handheld
RPG; only dialogue is tapped through. The Skip button, the skippable flag and the drive-up's tap-to-end are gone.

Also raised by the director and recorded as requirements: the Set it down affordance is unclear and the couch
sometimes lands facing the wrong way (§11 items 9–10); the "this or that" choice buttons are not wanted anywhere in
the introduction; residents should switch lamps on and off by themselves in free play (§12, new system, not part of
this scene).

## 1. Purpose and intended player experience

From the brief: meet Dez, the mayor who does everything; learn that tapping things is how you act; place the first
two pieces of furniture while the companion shows she has opinions of her own. The player should laugh once at the
driving, feel the box thud, and see the companion turn and react in real time.

## 2. Initial conditions

| Condition | Tag | How the game knows | Today |
|---|---|---|---|
| Brand-new save | Invariant | `world.save === null` | yes |
| Starter sofa, plant and lamp absent | Invariant | removed in `gameHost.ts` for a new game | yes |
| Clock day 1, 09:00, held during cutscene and guided steps | Invariant | `clock` step; `run.ts` holds the day | yes |
| Main floor, walls down, camera wide | Required | `camera` step; `wallIdx` default | yes |
| Host profile applied: names, humor, communication, gender, relationship | Invariant for lines | `hostBridge.ts` profile message | **race**: not awaited; `voice` not saved |
| Plot known, or the fallback house | Flexible | `g.s.plot` | **race**: read once at start |
| `entry.drop` free when a box lands | Required | `give` fails otherwise | not handled |

## 3. Beats, in order

Tags: Invariant · Required beat · Flexible presentation · Optional moment. No open-ended interaction exists in the
introduction; the companion's chat is not reachable until chapter 11.

### Part A: `opening.moveIn`

| Beat | What happens (director's words where given) | Tag | Exit condition (game terms) | Resume-safe fallback |
|---|---|---|---|---|
| A0 | Drive-up. Dez's truck comes down Maple Street, **runs over a tree** on the way, pulls up at the house. Plays to the end; no tap ends it. | Required beat; the tree knock-down is Flexible presentation until built (§12) | `introDone` | none (no world effect) |
| A1 | Dez walks in first **carrying the couch box**, the player and companion follow. He sets the box down in the entry gap. Nobody speaks until all three are standing. | Required beat | Dez, player and companion all `arrived`; `box.couch` exists at `entry.drop` | world: `box.couch` exists (box or sofa) and the three are inside |
| A2 | Dez: "Come on in guys! Welcome to **{town}**!" (town bold, green) then the mayor passage: mayor, mover, food delivery, the family's businesses. | Required beat; the identity facts are Invariant | last passage line dismissed | `did.beat.A2` (new) |
| A3 | The companion reacts to the drive in her humor style (`truckOffRoad`). | Required beat (bank: humor × gender) | line dismissed | `did.beat.A3` |
| A4 | Dez brushes it off (`dez.brushOff`, unchanged). | Required beat | line dismissed | `did.beat.A4` |
| A5 | Dez checks the clipboard: "Now let's see here, your names were {player} and {partner}, right?" The player taps to confirm. | Required beat (one tap; no choice buttons) | line dismissed | `did.beat.A5` |
| A6 | Dez: "Alright, here's your first box. I'll go grab some more." He walks out. | Required beat | Dez despawned | world: Dez not in `people` |
| A7 | Lesson: open the box. Card "Tap the box to open it". Only the box is tappable. | Required beat (guided) | world: `box.couch.type === 'sofa'` | same predicate |
| A8 | Lesson: place the couch. The companion asks for it by the TV in her communication style (`couchPlace`). Outline at `living.couchTv`. Setting it down anywhere else: the companion says it is not where she wants it (`couchNotThere`, communication × gender) and the lesson continues. | Required beat (guided, loop) | world: sofa within tolerance of `living.couchTv`, facing the TV | same predicate |
| A9 | Opening complete. Flags `opening.done`, `dez.deliveries`; control returns; the clock runs. | Invariant | flags set, script finished | idempotent |

### Part B: `tutorial.ch7`, the lamp

| Beat | What happens | Tag | Exit condition | Resume-safe fallback |
|---|---|---|---|---|
| B1 | Dez comes in with a box, sets it down: "This one doesn't have a label!" and walks back out. Dialogue only once he has stopped. | Required beat | `box.lamp` exists; Dez despawned | world: `box.lamp` exists (box or lamp) |
| B2 | Control returns. The player opens the box (tap). | Required beat (guided: only the box) | world: `box.lamp.type === 'lamp'` | same |
| B3 | The moment it opens: `!` over the companion. **The camera moves or zooms out so both the lamp and the companion are on screen while the `!` shows.** After about a second she asks, in her communication style, for the lamp in the corner by the TV (`lampCorner`; the mark moves, §13). | Required beat; camera framing is Invariant for this beat | line dismissed | `did.beat.B3` |
| B4 | Place the lamp in the corner outline (`living.lampCorner`). Elsewhere: `lampNotThere` loop as in A8. | Required beat (guided, loop) | world: lamp within tolerance of the corner mark | same |
| B5 | `!` over the companion again (camera frames her), then she says she would rather have it by the couch to read at night (`lampByCouch`, humor × gender). | Required beat | line dismissed | `did.beat.B5` |
| B6 | Move the lamp to the right-hand side of the couch (`living.lamp`, computed from where the couch actually is). Elsewhere: loop. | Required beat (guided, loop) | world: lamp within tolerance of the couch-side mark | same |
| B7 | Card: lights can be switched on and off by tapping them. Waits for the lamp to be switched on. | Required beat (guided: only the lamp) | world: the lamp's light is on | same |
| B8 | The companion reacts to the light (`lampOn`); evening dim lifts; control returns; `tutorial.lamp` set. | Required beat | flag set | idempotent |

Removed from today's chapter 7 because the director does not want them: the companion sitting to watch TV before
she changes her mind (replaced by the `!` and camera beat B5) and the companion "unpacking a box on her own" (the log
line only). Of the two plant boxes Dez stacks by the door, one stays (decided, §13).

## 4. Character presence, positions and behaviour

| Beat | Player | Companion | Dez | Control |
|---|---|---|---|---|
| A0 | off | off | in the truck | drive-up |
| A1 | door → `entry.you` (waits) | door → `entry.partner` (waits) | door → `entry.drop` carrying `pbox`, sets it down (waits) | script |
| A2–A5 | standing | standing; `!` on A3 | standing at `entry.inside`, facing the two | script |
| A6 | standing | standing | → door, despawn (waits) | script |
| A7–A8 | held still (`scripted`, no task) | held still | gone | player: allowed object only |
| A9 | released | released | – | simulation |
| B1 | **held still** (no wandering while Dez is in) | held still | door → `entry.drop` with `pbox`, line, → door | script |
| B2–B7 | held still | held still; `!` on B3 and B5; turns to face the lamp | gone | player: allowed object only |
| B8 | released | released | – | simulation |

Invariant: from A1 to A9 and from B1 to B8 the residents never choose their own actions (today chapter 7 runs in
`beat` mode for its first seconds and Jordan can wander off the floor). Nobody stands on `entry.drop` when a box
lands: the script places the residents on marks that keep it clear.

## 5. Animation, presentation and dialogue

| Beat | Mode | Camera | Poses, props, effects | Lines and how they are chosen |
|---|---|---|---|---|
| A0 | cutscene | drive-up canvas | truck, tree knock-down (new), exhaust, fade | none |
| A1 | cutscene | wide | walk clips; Dez carries a box; `art.drop` thud and dust | none until all stand |
| A2 | cutscene | close on Dez | – | `dez.welcome` with `{town}` styled bold green (new speech-box markup), then the mayor passage (today's `dez.intro.2` + `dez.intro.3`, merged, §13 q1) |
| A3 | cutscene | wide enough for the companion | `!` | bank `humor.<style>.<gender>.truckOffRoad` |
| A4 | cutscene | close on Dez | – | `dez.brushOff` |
| A5 | cutscene | close on Dez | clipboard pose if one exists, else none (§12) | `dez.names` (new): "Now let's see here, your names were {player} and {partner}, right?" |
| A6 | cutscene | wide | Dez walks out | `dez.firstBox` (new): "Alright, here's your first box. I'll go grab some more." |
| A7 | guided | as is | spotlight on the box; poof and burst on open | card "Open the box" |
| A8 | guided | Arrange framing of piece and outline | outline, player colour; **clear Set it down affordance** on phone and desktop (§11) | bank `communication.<style>.<gender>.couchPlace`; loop line `couchNotThere` as a bubble, not a blocking box |
| B1 | cutscene | door | Dez carries a box; thud | `dez.ch7.noLabel` (new): "This one doesn't have a label!" |
| B2 | guided | as is | spotlight; poof | card "Open the box" |
| B3 | cutscene for the `!`, then the line | **frame lamp and companion together** | `!`, companion turns toward the lamp | bank `communication.<style>.<gender>.lampCorner` |
| B4 | guided | Arrange framing | outline at the corner | loop line `lampNotThere` |
| B5 | cutscene | frame the companion | `!` | bank `humor.<style>.<gender>.lampByCouch` |
| B6 | guided | Arrange framing | outline beside the couch, evening dim 0.38 so the light shows | loop line `lampNotThere` |
| B7 | guided | as is | spotlight on the lamp | card "Let there be light" |
| B8 | beat | wide | dim lifts | bank `humor.<style>.<gender>.lampOn` |

Invariant (decision 3): a `say` never starts while its speaker or any other mover named in the beat is walking.
Every `walk` in these two scripts waits; the validator should reject a `say` after a `walk` with `wait: false`.

## 6. Advancing between beats

All lesson beats (A7, A8, B2, B4, B6, B7) end on a world predicate evaluated by the host, not on a card button or
a one-shot event: the object's type, its distance and rotation relative to a mark, or its light state. Spoken
beats end on the tap that dismisses the line, with a `did.beat.<id>` flag written so a reload does not require
the tap again. The Set it down button snaps the piece when it is close and closes Arrange; it never ends a beat.

## 7. State changes and events recorded

| What | Beat | Today |
|---|---|---|
| `box.couch` (pbox, contents sofa) at `entry.drop` | A1 | yes (given later, by Dez's second trip) |
| `box.couch` → `sofa`; sofa at `living.couchTv` facing the TV | A7–A8 | type yes; position unchecked |
| `opening.done`, `dez.deliveries`; `rt.done` += `opening.moveIn` | A9 | yes |
| `box.lamp` at `entry.drop`; → `lamp`; at corner; at couch side; light on | B1–B7 | partly; waits are one-shot |
| `tutorial.lamp` | B8 | yes |
| `did.beat.*` for every spoken beat | all | **new** |
| Must not change: bond, needs, money, memories, chat turns | all | holds |

## 8. Optional interactions and permitted variations

Gender and style variants of every companion line (4 × 4 × 2 for humor slots, 4 × 2 for communication slots; a
`they` companion gets the masculine wording unless a slot has a neutral one). Camera pinch and drag during guided
beats. The friend companion gets Dez's roommates line and no separate companion lines (decision 8). One plant box
stays by the door (§13).

## 9. Completion and control handoff

A9: people released, highlight, outline and spotlight cleared, mode off, clock running at 09:00 speed
1; `tutorial.ch7` starts on `opening.done` **with the residents still held** (new `hold` need, see the audit §3.4)
so Dez's lamp visit is not interrupted by free will. B8: the same release; the clock runs; chapter 8 follows on
`tutorial.lamp` as today.

## 10. Recovery behaviour

| Case | Expected |
|---|---|
| Reload during A0–A6 or B1 | Replay the cutscene from its start; boxes are not duplicated (`give` guarded by id) |
| Reload during a lesson (A7, A8, B2, B4, B6, B7) | Resume at the lesson with its mode, card, outline and allow-list rebuilt; if the predicate is already true, move on at once. **Today: soft-lock after A7 or B2 (confirmed in play)** |
| Skip | Not possible: there is no Skip (decided). The old Skip left two couches when used after A7 (confirmed in play before it was removed) |
| Pause (Space) during a cutscene | Not possible, or scripted walkers keep walking |
| Delivery interrupts chapter 7 | Cannot happen while the residents are held and the dock is disabled; if it does, resume rebuilds the lesson |
| Profile not yet applied | The new-game script waits up to 1.5 s for it; after that, defaults and the saved values |
| Box cannot land | `give` relocates to the nearest free spot (today's behaviour) and the script frames the box so the player can find it |
| Content version bumped | Everyone starts a new game (decision 9) |

## 11. Acceptance criteria

S = source, A = automated, P = played on desktop **and** phone.

1. The drive-up shows the player's plot when the host has one and the truck visibly runs over a tree. (P)
2. Dez enters carrying the box, the two follow, and no dialogue box appears until all three stand still. (A headless; P)
3. The town name in Dez's welcome is bold and green; the mayor passage states mayor, mover, delivery. (A content; P)
4. The companion's driving remark and both lamp remarks match her humor style and gender; the couch and corner asks match her communication style and gender; all 16 × 2 humor and 4 × 2 communication variants exist for every slot. (A content test)
5. A5 is a plain tap, with no choice buttons anywhere in Parts A and B. (A e2e)
6. Only the current lesson object is tappable; dock, keyboard shortcuts, other objects and the companion are not. (A e2e)
7. Pressing Set it down with the couch (or lamp) outside the outline shows the companion's "not there" line and the lesson stays open; inside the outline, the piece snaps and the beat ends. (A e2e; P)
8. After A9 and after B8 the clock runs, the dock works and both residents act on their own. (A e2e)
9. **Set it down is obvious**: the Arrange bar's green Set it down button, with Put it back beside it when a piece is loose. (P, both sizes)
10. **Facing is the player's**: nothing auto-rotates; the couch lesson's Turn it step ends only when it faces the TV. (A e2e; P)
11. On B3 and B5 the `!` and the companion are on screen when they fire, together with the lamp. (P; screenshot)
12. Reload at every lesson resumes without a soft-lock and without a second box, couch or lamp. (A headless + e2e)
13. There is no Skip button, no `skippable` script, and the drive-up cannot be ended early. (A e2e)
14. No page errors through both parts. (A e2e)

## 12. Assets

**Existing and reused:** Dez (`content/characters.ts`), `pbox` with `contents`, `sofa`, `lamp` (with light),
marks `door`, `entry.inside/you/partner/drop`, `living.couchTv`, `living.lampCorner`, `living.lamp`, carried
box prop, `!` bubble, speech box, cards, ghost outline, canvas spotlight, letterbox, drive-up and street
kit, poof/burst/drop effects, evening dim, banks for `truckOffRoad`, `couchCarried` (no longer used), `couchPlace`,
`lampCorner`, `lampByCouch`, `lampOn`, Dez's `welcome`, `brushOff`, `intro.2`, `intro.3`.

**New content (writing only):** `dez.names`, `dez.firstBox`, `dez.ch7.noLabel`; bank slots `couchNotThere`,
`lampNotThere`; a gender dimension for every bank slot (today the banks have no gender axis); the reworked
`dez.welcome` with `{town}` markup.

**New code (small):** bold-green `{town}` in the speech box (`scriptUi.say` uses `textContent` today); a
`world` condition kind (object type, position within tolerance of a mark, light on); `hold` for residents across a
script; a host-readiness gate; the loop line as a non-blocking bubble; a couch-relative `living.lamp` mark.

**New animation (medium):** the tree knock-down in the drive-up. The street is drawn once as a still image
(`arrivalIntro.ts` 116); the tree would have to be drawn by the drive-up as a moving element with a fall and a
few leaves, timed to the truck's x. Free plots have no tree today, so the drive-up needs its own verge tree.

**Named by the director and not in the game:** a clipboard for Dez (would draw as a box; omit or add a prop);
residents switching lamps on and off by themselves (a free-will rule in `state/agents.ts`, separate feature);
sound (decided: none).

## 13. Still open and newly decided

Decided 2026-10-27 (second round):

- The mayor passage keeps the family-businesses line (`dez.intro.3`), merged after `dez.intro.2`.
- Dez sets the couch box down where he does today: the gap between the entry and the kitchen (`entry.drop`).
- "Upper corner" for the lamp means **the TV wall, to the right of the TV**. The TV unit sits at (6.0, 0.12) on
  the living room's back wall (room x 4.7–10, y 0–8), so the corner mark moves from today's `living.lampCorner`
  (9.3, 7.2), which is the opposite front corner, to about (8.8, 0.25) beside the TV. Which side reads as "right"
  depends on the camera rotation: confirm with a screenshot during implementation and adjust.
- Chapter 7 keeps **one** plant box by the door, not two.

Taken while building (easy to reverse): Dez's roommates line for a friend companion stays (it is Dez's line, not a
companion variant, and the director said to keep his script); companion lines carry masculine and feminine versions
and no relationship versions.

Still open (working assumption in brackets):

1. Residents switching lamps on and off themselves: build with this scene or afterwards? [afterwards]

## 14. Verified

Not yet. Filled in after implementation with commit hashes and the S/A/P results per item in §11.
