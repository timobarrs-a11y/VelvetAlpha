# Velvet Sims: narrative reliability and scene production audit

Date: 2026-10-27. Branch inspected: `main` at `7a8394a` (the state checked out on `claude/festive-mendel-lytptr`).
No game code was changed for this audit. The only files added are this document, the scene contract template
(`scene-contract-template.md`) and the proposed opening contract (`scenes/opening.moveIn.md`).

How to read the evidence tags used throughout:

- **S** (source): concluded from reading the code.
- **A** (automated): a check that ran in this container: `npm run typecheck`, `vitest`, or Playwright against the
  live game.
- **P** (played): the real game, driven in a headless Chromium through the same stand-in host page the end-to-end
  tests use, with the result read back from the game's own state. Not a human on a phone.

---

## 1. What exists (Phase 1)

### 1.1 Two games, one route

| | Live game ("Velvet Sims") | Legacy game |
|---|---|---|
| Code | `src/games/velvet-house/` (about 26k lines in TypeScript modules), served by `games/velvet-house-next/index.html` | `public/games/velvet-house/index.html`, one 5,026-line file |
| Route | `/velvet-house` and `/velvet-house-next` → `VelvetHouseNextGame.tsx` | `/velvet-house-legacy` → `VelvetHouseGame.tsx` |
| Opening | Script engine: Dez drive-up and move-in | Its own mover NPC and box queue (`spawnMover`, `moverQueue`, line 3712 on) |
| Status | The one players get | Kept "until the parity checklist is clear" (`roadmap.md`), still deployed |

Everything below is about the live game. The legacy game matters only as a second, competing implementation of
the move-in that is still shipped, which is one of the things the brief asked about.

### 1.2 The execution path from "start" to the end of the opening (S, confirmed A/P where marked)

1. `main.ts` `launch()`: the title screen runs over a throwaway copy of the house (`run.attract`). Continue or New
   Game sets `#launch` and reloads. `?start=new` from the host clears the save slot first.
2. `boot()` → `kernel/game.ts createGame`: loads the save (`kernel/config.ts loadWorld`, with migration and a
   content-version gate that throws away saves older than `MIN_CONTENT_VERSION = 4`), builds the two residents
   (`jordan`, `maya` are internal ids; display names come from the save or the host), the house, the renderer and
   the shell DOM. Then each module is mixed into the `g` object in a fixed order; the script host
   (`script/gameHost.ts createScripts`) is the last module before the loop starts, and the host bridge
   (`bridge/hostBridge.ts`) is created **after** the game loop has started.
3. `createScripts`: validates the content (`script/validate.ts`, warnings only in DEV), builds the `ScriptEngine`
   over `SCRIPTS` and `LINE_BOOK`. A new game removes the starter sofa, plant and lamp and queues
   `opening.moveIn`. A save with a script runtime resumes it; any other save marks the opening and tutorial done.
4. `kernel/run.ts startGameLoop`: a fixed-step loop. Every step calls `g.scriptUpdate(dt)` first, then returns
   early if paused; in `cutscene` or `guided` mode only scripted people and visitors move and the day holds still;
   otherwise the clock advances, needs tick, free will runs, deliveries tick, goals tick.
5. `script/engine.ts`: one active script, a priority queue, steps that block (walk, act, say, choice, card with
   button, wait, intro), `checkpoint` steps that record a resume path, `skip()` that runs `onSkip` effect steps,
   and `emit()` for game events. The story is data in `content/scripts.ts`, lines in `content/lines.ts` and
   `content/banks.ts`, places in `content/marks.ts`, visitors in `content/characters.ts`.
6. `script/gameHost.ts` turns steps into world changes: spawn and move agents (`state/agents.ts`), show lines and
   cards (`ui/scriptUi.ts`), outlines and spotlights (`art/houseArt.js`), the drive-up (`ui/arrivalIntro.ts`),
   deliveries, flags. It also gates the UI: `g.s.scriptMode` and `g.s.scriptAllow` are read by `systems/input.ts`
   and `systems/arrange.ts`, and CSS on `data-script` disables the dock, controls and canvas.
7. Events flow back through `g.scriptEmit`, which also records `did.<event>` flags, from: unpacking
   (`systems/interact.ts`), placing (`systems/arrange.ts commitMove`), lights (`input.ts`, `interact.ts`), tabs
   (`ui/gameDrawer.ts`), floors (`ui/controls.ts setLevel`), groceries, meals, dishes, deliveries
   (`systems/deliveries.ts`), chat closed (`systems/chat.ts`), room styled (`systems/shop.ts`).
8. Saving: `systems/persist.ts` every 15 s, on `pagehide` and on hide, through one serializer
   (`state/save.ts snapshot`). The script runtime is saved inside `flags.scriptRt`; story flags in `flags.story`.
   The host copies the slot to the cloud (`useVelvetHouseCloudSave.ts`) and picks the newer copy **before** the
   iframe mounts, so the cloud never overwrites a running game (S, sound).
9. The opening itself, step by step, is traced in `scenes/opening.moveIn.md` ("What actually happens today").
   It was confirmed in play: the repository's `story.spec.ts` (two tests) and `boot.spec.ts` (three) pass here
   (A), and the probe in Appendix A played it three times (P).

### 1.3 Who owns what

| Concern | Owner | Notes |
|---|---|---|
| Story progression | `ScriptEngine` + `flags.story` + `flags.scriptRt` | Centralised. Good. |
| Player control | `g.s.scriptMode`/`scriptAllow` set by the host's `setMode`; read in `input.ts`, `arrange.ts`, CSS | Centralised, but the keyboard (`controls.ts` 88–99) is not gated: Space pauses, digits change floors, A opens Arrange during a cutscene |
| Character position | `place/walk/act` set `agent.scripted`; `release()` at script end | Clear while a script runs. In `beat` chapters free will is on, so Jordan wanders (the day-1 test works around this) |
| Dialogue | `scriptUi.say` (blocking, cutscene/guided) or a bubble + log line (beat) | Lines are chosen at show time from `host.names()` |
| Animation | `state/agents.ts` tasks and `art/poseAnim.js` clips; scripts only start them | Dialogue and animation are only coupled by `wait: true` on walks and acts |
| Timers | `wait seconds` in scripts; `setTimeout` in `interact.unpack` (380 ms), `gameHost.showCard` (9 s), `dialogue.createTray` (6 s), `hostBridge.doVidSearch` (12 s); bubble hold `text.length / 14` | Scattered; none are aware of script state except the card timer |
| Tutorial completion | **Two systems:** `tutorial.ch15` (`deliver settle`) and `systems/goals.ts` `SETTLE` (skipped once `dez.deliveries` is set) | Duplicate path kept for pre-story saves and the `noscript` test mode |
| Narrative documents | `opening-sequence.md` (brief), `chapter1-script.md` ("as it plays now"), `companion-voices-and-openings.md`, `architecture-plan.md` §2.5, `bolt-overhaul-prompt.md` §10, `roadmap.md` | Five documents describe the opening; three disagree with each other and with the code (see 2.5) |

### 1.4 What is sound and should be kept

- The engine's shape: scripts as data, steps that block, a host interface, content validation, a priority queue,
  skip with effect-only `onSkip`, line pools, voice banks. 21 engine unit tests and a content test pass (A).
- Flags for "what the player already did" (`did.*`) and `rt.done` for "what already played": the right primitives.
- The save path and the cloud-save ordering.
- The e2e harness (`e2e/velvet-sims/host.html`, `helpers.ts`, dev hooks in `dev/hooks.ts`): a stand-in host with
  no backend, able to read the game's state. It is the right place to test scenes; it is under-used.

---

## 2. Diagnosis: why scene instructions are not followed reliably (Phase 2)

Ranked by how much they explain the symptoms you described: missed beats, dialogue and animation drifting apart,
one fix breaking another, and instructions interpreted differently from how they were written.

### 2.1 Critical: beats end on UI gestures, not on the world being in the required state

The placement beats end when the player presses **Set it down** (`content/scripts.ts` 64, 122, 135: a `card` with
a `button`), not when the couch or lamp is where the beat says. The button handler snaps the piece only if it is
already within four units of the outline (`gameHost.ts` 223 → `arrange.ts snapSelectedToOutline` 109–114); if not,
nothing happens to the piece and the script proceeds anyway, sets `opening.done`, and later beats assume a couch at
the TV wall (`tutorial.ch7`: Maya walks to `living.center` and plays `tv`; the lamp mark `living.lamp` is a fixed
coordinate beside where the couch should be).

**Confirmed in play (P, Appendix A, probe B):** with the couch untouched at (0.25, 4.0), pressing Set it down set
`opening.done` and `dez.deliveries`; the target mark is (5.6, 3.3). The repository's own `story.spec.ts` test
"watching the move-in" does exactly this and passes, so the test encodes the weak exit condition.

This is the main mechanism behind "animation and dialogue become disconnected": the dialogue follows the script's
belief about the room; the room is whatever the player left. The architecture plan's worked example
(`architecture-plan.md` §2.5) used `wait until obj.placed`; the implementation replaced it with a button.

### 2.2 Critical: reloading in the wrong place soft-locks the story

Waits in the opening and chapter 7 are on one-shot events only: `obj.unpacked box.couch` (`scripts.ts` 60),
`obj.unpacked box.lamp` (120), `light.toggled lamp` (138). Chapters 8 to 15 pair each event with a `did.*` flag
(156, 166, 168, 176, 179, 189, 201, 212); the opening and chapter 7 do not. Resume (`engine.ts resume/restore`
71–78, 155–169) restarts at the last `checkpoint`, which in the opening sits **before** the unpack lesson
(`scripts.ts` 56), and chapters 7 to 15 have no checkpoints at all, so they restart from their first step.

**Confirmed in play (P, probe A):** unpack the couch, save, reload: the game shows "Open the box" again, blocks on
`obj.unpacked` for `box.couch`, and `box.couch` is already a `sofa`. Tapping the couch does nothing for the story
(`did.obj.unpacked` is already true but nothing reads it). There is no way out except Skip or a new game.

The same reasoning applies to chapter 7 after the lamp is unpacked (S, not played), and reloads during chapters
8 to 15 replay Dez's whole visit from the top (S): "the same scene plays twice".

### 2.3 High: Skip is a fixed list of effects, independent of progress

`onSkip` (`scripts.ts` 71–77) always gives a sofa with id `sofa`. If the player has already unpacked the box,
`box.couch` is a sofa too. **Confirmed in play (P, probe C):** two couches. `engine.skip` (105–113) does not
consider where the script is; the engine already has the pieces for a better rule (steps can run with
`skipping = true`, which makes walks and acts non-blocking), see §3.

### 2.4 High: the host's data races the first beats

The engine starts on the first frame; names, voice, relationship and the town plot arrive by `postMessage` after
the game posts `velvet:ready`, which happens after the loop starts (`main.ts` 58–60; `hostBridge.ts` 17, 58–72;
`VelvetHouseNextGame.tsx sendProfile` 155–178 does two network round trips first). The drive-up reads `g.s.plot`
once when it starts (`gameHost.ts` 181–187), so it almost always shows the starter house instead of the player's
own. Lines read names and voice at show time (`gameHost.ts names()` 60), so on a slow connection the first lines
say "Jordan" and "Maya" in the default `warm`/`diplomatic` style, and the roommates branch (`scripts.ts` 44) is
evaluated whenever the engine reaches it. Voice is not saved (`GameState.voice` is not in `snapshot`), so it
depends on the host every boot; the e2e host never sends a profile, so **no automated test has ever exercised the
voice banks, the real names or the roommates branch** (S).

### 2.5 High: there is no canonical brief, so "the instructions" differ by document

- `opening-sequence.md` describes a cold open (two partner lines, a knock), Dez's five intro lines, four voices
  and the TV-or-window choice. It now carries a banner: "Ignore the window-ask and 'moved it' parts below."
- `chapter1-script.md` says "as it plays now" but describes the cold open with Maya by the window. The code places
  her there and immediately moves her to the door (`scripts.ts` 28–32, dead steps), then everyone walks in with Dez
  (the "new first beat" from `companion-voices-and-openings.md`). Same banner.
- Dez's lines in `lines.ts` (`dez.welcome`, `dez.brushOff`, `dez.intro.2–4`) are different text from both docs.
- The four voices (`Preset`) still exist in types and the validator (`validate.ts` 4, 37, 44) while every line is a
  plain string or a humor/communication bank entry; `companionCfg.preset` is filled from a free-text personality.

Three documents, each partly out of date, each patched with "ignore" notes, is how an implementer "interprets
instructions incorrectly" while following one of them faithfully. The git history shows the cost: 13 commits to
`scripts.ts` in two days (Oct 26–27); the window ask added (`31c72a5`), reworked (`d30eb25`), removed in two
passes (`5ba37f9`, `6b2e2ac`), then `MIN_CONTENT_VERSION` bumped twice (`aac0f93`, `ee88974`) so every player's
save is thrown away because a mid-opening save would "resume in the wrong place". The save-version bump is being
used as the fix for the recovery problem in 2.2.

### 2.6 High: verification does not test what the brief asks for

- No CI runs any test: `.github/workflows` has only the changelog and edge-function deploys. Typecheck (0 errors),
  856 unit tests and the 5 live tests all pass here (A), but nothing runs them on a PR.
- `story.spec.ts` asserts that the **next box arrives**, not that the beat's conditions held (see 2.1).
- `day1.spec.ts` plays the whole day through dev hooks (`v.buy`, `v.setMinutes`, `v.openTab`, `v.openChat`), not
  through player taps, and checks flags only. It takes up to 15 minutes and is not in the default live run.
- The engine unit tests cover the engine with a fake host; there is no headless test that plays a real scene
  against a model of the world (the architecture plan §2.10 asked for `simulateDays` and "the opening skipped equals
  the opening watched" per script).
- Golden screenshots cover floors and tabs, not story moments.

"A successful build" and "a green test run" currently say almost nothing about whether a scene plays as written.

### 2.7 Medium: ownership of position, pause and interruption is partly implicit

- Pausing during a cutscene is possible from the keyboard (`controls.ts` 93, Space) and stops scripted walkers
  (`run.ts` 36 returns before the scripted branch), so a cutscene waits forever with no hint (S).
- In `beat` chapters free will is on; Jordan can leave the floor during Dez's visit (the day-1 test has an explicit
  workaround at line 39). Nothing in a beat declares "these people stay".
- `interruptIfUrgent` (`engine.ts` 190–203) checks the script's declared mode, not the live one, so chapter 7 can be
  interrupted by a delivery while it is in its guided or cutscene section; on resume only the wait step is redone,
  so the mode, card, outline and allow-list are not rebuilt (S; the engine test covers the simple beat case only).
- `give` can fail to land a box when someone stands on the mark; it leaves a `give-fail` trace and the story waits
  for a box that does not exist (`gameHost.ts` 169). The probe shows the mitigation at work: the couch box landed at
  x 0.25 instead of the mark's 2.3 (P).

### 2.8 Medium: hard-coded timing and side effects outside the script

`interact.unpack` finishes 380 ms later on a timer (`interact.ts` 77–91): a Skip or a reload in that window acts
on a box that is about to become a sofa. `showCard` arms a 9 s minimize timer that can fold a *later* card
(`gameHost.ts` 140). Bubble hold time is `text.length / 14` seconds (`gameHost.ts` 129). The chapter-11 line is
injected into the chat history as if the AI had said it (`deliver chatLine`, `gameHost.ts` 197–202). None of these
are wrong on their own; together they are the "unrelated details change" surface.

### 2.9 Low: leftovers that cost attention

Dead `place` steps; `Preset` plumbing; a junk flag `did.tab.` written when the drawer closes (seen in probe B's
flags); `dez.deliveries` doubling as "the opening is over" for both deliveries and the goals system; "Maya unpacks
a box on her own" is a log line (`deliver mayaUnpack`), no box changes, while the brief says "the existing code
already does this" (it did, in the legacy game); the `noscript` test mode and pre-story saves keep the second
settle path alive; the legacy game is still routable.

### 2.10 What is *not* the problem

The engine is not too simple, the content format is not the wrong shape, and the renderer and animation system
are not implicated in any finding. The fixes in §3 are rules and small additions to what exists.

---

## 3. Recommended minimal architecture (Phase 4)

Keep the script engine, the host interface, content as data, flags and `rt.done`. Add five rules. Each is small,
each closes a class of bugs above, and none requires a rewrite.

### 3.1 Beats end on world state

Add one condition kind the host evaluates against the world, for example
`{ world: { objAt: { id: 'box.couch', mark: 'living.couchTv', within: 0.6, rot: 2 } } }` and
`{ world: { objType: { id: 'box.couch', is: 'sofa' } } }`, and make the placement beats `wait until` it. The card's
button becomes presentation: it snaps and closes Arrange, it never ends a beat. A validator rule: a `card` with a
`button` must be followed by a `wait`, not by effect steps. This alone fixes 2.1 and makes `story.spec.ts` assert
the right thing.

### 3.2 Every wait is a safe resume point

Two parts. (a) Every `wait.until` on an event carries a state fallback: either the `did.<event>` flag the host
already writes or a world condition from 3.1; the validator rejects a bare event wait. (b) The engine records the
resume path automatically at each `mode` step and each `wait.until`, and on resume re-runs from the last `mode`
step so the card, outline and allow-list are rebuilt (effect steps are already idempotent: `give` is guarded by
id, `set` is a plain write). Authors then never place checkpoints by hand. Trade-off: a reload may replay one line
of dialogue; that is far better than the soft-lock in 2.2 and removes the need to throw away saves when the opening
changes (2.5).

### 3.3 Skip is fast-forward

Replace the fixed `onSkip` list with "run the remaining steps as effects": walks, acts, waits, says, cards and
choices are skipped (choice takes its default), `give`/`set`/`deliver`/`despawn`/`clock`/`mode` apply. The engine
already runs steps with `skipping = true` for walks and acts; this generalises it. Result: skipping at any point
yields the same world as watching from that point, so no second couch (2.3). `onSkip` stays available for the
rare effect that must happen *only* when skipped.

### 3.4 Scenes declare presence and the host readiness they need

Add an optional `needs` block to `ScriptDef`: `{ host: ['profile', 'plot'], timeoutMs: 1500, hold: ['jordan',
'maya'] }`. The engine does not start the script until the host has applied those messages or the timeout passes;
`hold` keeps the named residents scripted (no free will) for the whole script, including its `beat` sections. Save
`voice` with the game. The drive-up reads the plot when it starts, so with the gate it shows the player's house.
This closes 2.4 and the wandering half of 2.7. Also gate the keyboard on `scriptMode` (one line in `controls.ts`)
and let scripted walkers move while paused (move the scripted branch above the `paused` return in `run.ts`).

### 3.5 One contract per scene, one canonical document

The scene contract (`scene-contract-template.md`) replaces the brief-plus-banners pattern. Steps in
`content/scripts.ts` carry a `beat: 'B5'` label matching the contract's beat ids (a string field the engine
ignores; the validator checks every contract beat id appears once). `opening-sequence.md`, `chapter1-script.md`
and `companion-voices-and-openings.md` are superseded by `scenes/opening.moveIn.md` once the director approves
it, and the old files are deleted rather than banner-patched. This closes 2.5.

### 3.6 Tests that read the contract

- A headless scene test per script with a fake host that keeps a small world model (positions, object types):
  walk to arrive, unpack, place off-target, then assert the beat did not end; reload at every wait and assert no
  block on an unreachable event; skip at every wait and assert one couch and the same flags as watching.
- `story.spec.ts` asserts the sofa's position against the mark after Set it down, and runs once with a profile
  sent by the stand-in host (names, humor, communication, relationship) so banks and the roommates branch are
  covered.
- A GitHub Actions workflow on pull requests: `npm run typecheck`, `npx vitest run`, and the live `story.spec.ts`
  and `boot.spec.ts` (about five minutes here). `day1.spec.ts` can stay manual.

### 3.7 Explicitly not recommended

A new state-machine library or framework; moving the story into React; a rewrite of `engine.ts`; a generic
"scene graph"; making every object interaction a narrative event; using content-version bumps as a recovery tool.

---

## 4. Authored narrative and companion improvisation (Phase 5)

Today the companion chat (`systems/chat.ts`, `state/companionAI.ts`, the host's `velvet-game-turn`) is separate
from the script engine and talks to it only through one event, `chat.closed`. That boundary is right; it needs
to be stated and two leaks closed.

**The narrative system owns** story flags, `rt.done`, objects and their positions, the household, `settleDone`,
`lifeGoal`, bond. Nothing else writes them.

**The companion receives a context pack, read-only**, assembled by the game at each turn: archetype (the app's
humor, communication, signature voice, relationship), the current scene (active script id and beat label, mode),
recent events (the last `did.*` flags and log lines, which `PersonaContext` already carries in part), relationship
state (bond, a few memories) and a **permitted actions** list (what the companion may propose right now, derived
from the same rules scripts use: not during a cutscene, only movable objects, only reachable places).

**The companion may** talk about anything, joke, ask, start small talk, react to events, and propose an action.
It does not follow a dialogue tree for ordinary conversation, and no script waits on what it says.

**The companion may not** set flags, mark beats done, create objects or memories of events that did not happen,
or move anything directly. A proposal is a structured intent (`{ act: 'moveObject', id, to }`), which the
simulation validates (`checkPlacement`, the allow-list, the mode) and executes through the same commands scripts
use (`host.place/walk/act`). The result is an ordinary event the story may react to. The hook already exists:
`result.tag.act` is parsed and only logged (`systems/chat.ts` 84–86).

**Two leaks to close now.** (1) Chapter 11 writes a hardcoded line into `chatTurns` as an assistant message
(`deliver chatLine`), so the AI's history contains words it never said; give it the line as a *scene opener hint*
in the context instead, with the fixed line shown only when the AI is unavailable. (2) `openChat` sets `flags.talked`
and the legacy `settleSeen` directly; those belong to the event path (`chat.closed` is already emitted).

**How they coexist without scripting every conversation:** a required beat waits on a player action (chat opened
and closed, an object placed), never on a reply. The companion gets the beat as context and improvises around it.
If the player never talks, the beat still completes on the action; if the AI is down, canned lines keep the scene
moving (already built: `cannedFor`). Open-ended interaction is the default state of the companion; a scene only
narrows what it knows and what it may propose, never what it must say.

---

## 5. Production workflow for future scenes (Phase 6)

1. **Read the brief** and quote it into section 1 of a new contract (`docs/velvet-house/scenes/<id>.md`). Do not
   paraphrase the director's words.
2. **List ambiguities** in section 13 with a recommendation each. Ask only the ones that change what gets built
   (a line's wording does not; whether a beat is required does). Wait for answers on those; proceed on the rest.
3. **Write the beat sheet** (section 3) with tags and exit conditions in game terms, and the state transition map
   (prerequisites, exit, resume rule, skip effect per beat).
4. **Map each beat to the code**: which steps, marks, line keys, events and world conditions. If a beat needs an
   event the game does not emit, name the emitter to add.
5. **Check assets** (section 12): object types in `state/objects.ts`, marks, poses in `poseAnim.js`, carried props
   in `houseArt.js drawCarried`, effects, line keys. Anything missing is written down as missing. No substitutes.
6. **Implement the smallest coherent change**: content first (`scripts.ts`, `lines.ts`, `banks.ts`, `marks.ts`),
   host or engine only when a step kind or condition is genuinely new. One scene per PR.
7. **Run the checks**: `npm run typecheck`, `npx vitest run src/games/velvet-house`, the headless scene test,
   then `npm run test:live` for the scene's spec on desktop and phone.
8. **Walk the acceptance list** (section 11) item by item, marking S, A or P as actually achieved. Record a
   screenshot or short recording for the presentation items.
9. **Fix discrepancies** inside the scene's files. A fix that needs a change to a shared system is called out in
   the PR as such, with the other scenes it can affect listed and re-run.
10. **Record** in section 14: commit hash, what passed at which level, remaining limitations. Update the roadmap
    row from the contract, not from memory.

Rules: a conflict between the brief and existing behaviour is surfaced in section 13, never resolved silently;
a missing asset is reported, never replaced by something unrelated; no `MIN_CONTENT_VERSION` bump without the
director's approval (it deletes every player's house); no "ignore the part below" banners, the contract is
rewritten; a green build or test run is not "the scene works" until the P items are checked.

---

## 6. Prioritised plan

**P0: make the existing opening trustworthy (before any new scene).** All in `src/games/velvet-house`; estimated
a few days together; each item is one PR with its test.

1. Placement beats end on world state (3.1): new `world` condition, two script edits, button becomes presentation,
   `story.spec.ts` asserts the sofa position. Fixes 2.1.
2. Resume safety (3.2): `did.*` fallbacks for the three bare event waits now; engine auto-resume-point at `mode`
   and `wait.until` next. Headless reload test at every wait. Fixes 2.2.
3. Skip as fast-forward (3.3). Headless skip test at every wait. Fixes 2.3.
4. Host readiness gate and `hold` (3.4); save `voice`; e2e host sends a profile. Fixes 2.4 and the wandering.
5. The director approves `scenes/opening.moveIn.md` (decisions in its section 13); the three old documents are
   removed; dead steps and `Preset` leftovers deleted. Fixes 2.5.

**P1: make reliability repeatable.**

6. Headless scene harness (3.6) and a PR workflow running typecheck, unit tests and the two short live specs.
7. Keyboard gated by script mode; scripted walkers move while paused; `interruptIfUrgent` uses the live mode and
   resumes from the last `mode` step.
8. Chapter 7 contract and the same P0 treatment (lamp waits, Maya's "I did one" actually unpacks a box or the line
   changes).

**P2: boundaries and clean-up.**

9. Companion context pack and the validated action hook (§4); chapter 11 opener as a hint, not fake history.
10. Retire the legacy route per the parity checklist; unify the two settle paths; remove the `noscript`-only goal
    path or keep it as an explicit test fixture.

---

## Appendix A: verification log

Run in this container on 2026-10-27 against `7a8394a`.

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | 0 errors |
| Unit tests | `npx vitest run src/games/velvet-house` | 58 files, 856 tests, all pass (includes `scriptEngine.test.ts`, `storyContent.test.ts`) |
| Live e2e | `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --config playwright.live.config.ts e2e/velvet-sims/story.spec.ts e2e/velvet-sims/boot.spec.ts --project=desktop` | 5 passed in 4.4 min |
| Gameplay probe | A Playwright script that opens the game through `e2e/velvet-sims/host.html?script` with a fresh `velvet-sims:e2e` slot, taps through the cutscene and reads state with the dev hooks (`v.objects()`, `v.story()`, `v.scriptState()`) | see below |

Probe results (P):

- **A, reload after unpacking.** Saved runtime: `active.path = [{ i: 35 }]` (the checkpoint before the lesson).
  After reload: card "Open the box", engine blocking on `until obj.unpacked box.couch`, `box.couch` is type `sofa`
  at (0.25, 4.0). Six seconds after tapping the couch: same card; story flags `did.obj.unpacked`, `did.tab.arrange`
  only. Soft-lock.
- **B, Set it down without moving.** Couch before and after: (0.25, 4.0) rot 0; target mark (5.6, 3.3) rot 2. Flags
  after: `opening.done: true`, `dez.deliveries: true` (and a junk `did.tab.: true`).
- **C, Skip after unpacking.** Two sofas: `box.couch` at (0.25, 4.0) and `sofa` at (5.25, 3.0).
- No page errors in any run.

Not verified: a human playing on a phone; chapters 7 to 15 in play (the 15-minute `day1.spec.ts` was not run);
the host-data race under real network latency (reasoned from code only); the legacy game.
