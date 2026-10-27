# Scene contract: the template

A scene contract turns a creative brief into something the implementer can build and the director can check. One
contract per authored scene, kept at `docs/velvet-house/scenes/<script id>.md`, named after the script it describes
(`opening.moveIn`, `tutorial.ch7`, ...). The contract is the single source of truth for that scene: when the scene
changes, the contract is rewritten, never patched with "ignore the part below" notes.

Creative intent and technical mapping are kept in separate columns so a line of the brief is never silently
rewritten to fit the code. If they disagree, the disagreement is written down and the director decides.

## How requirements are classified

Every row in sections 3 to 9 carries one of these tags. They decide how strictly the implementation and the tests
hold to it.

| Tag | Meaning | What may vary | How it is verified |
|---|---|---|---|
| **Invariant** | Must always be true, before, during and after the scene | Nothing | An assertion in a test, checked at every exit of the scene |
| **Required beat** | Must happen, in this order | Wording, timing within limits, camera | The beat's exit condition is reached in play and in the headless test |
| **Flexible presentation** | How it looks or sounds | Freely, as long as the beat's meaning holds | A look at a recording or screenshot; not a hard test |
| **Optional moment** | Happens only when its condition is met | Whether it happens | A test for both the on and off case |
| **Open-ended interaction** | Generated at play time (the companion's future chat) | The words and the small talk | Only that the scene never depends on specific words |

Rule of thumb: a story outcome may depend on what the player *did* (an event or a world state), never on what
anyone *said*.

## The sections

### 1. Purpose and intended player experience
Two or three sentences from the director: what this scene is for, and what the player should feel and learn.
Quote the brief; do not paraphrase it.

### 2. Initial conditions
What must be true before the first beat may start: save state (new game, flags), clock, which floor is shown,
who is where, what objects exist or must not exist, what the host has already told the game (names, voice, plot).
Each line names how the game checks it. Anything the scene cannot establish itself is a **prerequisite** and the
scene must wait for it or fall back in a named way.

### 3. Required story beats, in order
A numbered beat sheet. One row per beat: id (`B1`, `B2`...), what happens in the brief's words, its tag, and the
**exit condition** in the game's terms (an event, a world predicate, a player action). No beat ends on "the card
was dismissed" or "the player tapped Continue" unless dismissing the card *is* the beat.

### 4. Character presence, positions and expected behaviour
Who is on stage in each beat, where (a named mark), facing what, and who controls them (script, free will,
player). Also who is explicitly *not* allowed to wander off during the beat.

### 5. Animation, presentation and dialogue requirements
Per beat: camera, mode (cutscene, guided, beat), poses and props, effects, which lines are said and by whom, and
how each line is chosen (fixed, by voice bank, from a pool, generated). Each asset named here is checked against
section 12 (assets).

### 6. Conditions for advancing between beats
The exit condition from section 3 spelled out as the game evaluates it: the event name and match fields, or the
world predicate (object id, mark, tolerance), plus the fallback that makes it safe to resume (a `did.` flag or the
predicate itself).

### 7. State changes and events that must be recorded
Flags set, objects created or changed, money, memories, `rt.done` entries. Also what must *not* change (for
example bond, needs) so the scene has no accidental side effects.

### 8. Optional interactions and permitted variations
Branches by companion relationship or voice, lines that are nice-to-have, things the player may do during the
scene (open a tab, move the camera) and how the scene reacts.

### 9. Completion conditions and control handoff
When the scene is done, what the player gets back (taps, dock, clock, free will), which script starts next and on
what trigger, and what the camera does.

### 10. Recovery behaviour
What happens on reload at each wait, on Skip at each wait, when the player pauses, when a delivery or other script
interrupts, when a required object is missing or cannot be placed, when the host never sends the profile. Each
case names the expected outcome in one line; "soft-lock" is never an acceptable outcome.

### 11. Acceptance criteria
A numbered checklist a tester can run. Each item says how it is verified: **S** source inspection only, **A**
automated test (name the test), **P** played in the real game (desktop and phone). A scene is not "done" on S alone.

### 12. Assets
Three lists: existing assets reused (object types, marks, poses, props, effects, line keys), new assets required,
and assets the brief names that do **not** exist. A missing asset is reported, never replaced by something
unrelated and marked done.

### 13. Unresolved
Questions only the director can answer, each with the implementer's recommendation. Nothing in this list is
built until it is answered.

### 14. Verified
Filled in after implementation: commit hash, which acceptance items passed at which level (S/A/P), and remaining
limitations. This is the section the director reads to know what actually plays.

## A filled-in row, for reference

| Beat | Brief (director's words) | Tag | Exit condition (game terms) | Resume-safe fallback |
|---|---|---|---|---|
| B5 | "Tapping the box opens a radial menu with one option, Unpack." | Required beat | event `obj.unpacked` with `objId: box.couch` | world: `box.couch` has type `sofa` |
