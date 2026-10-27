# Working in this repository

Velvet is a React app (`src/`) with an embedded life-sim game, **Velvet Sims**, in `src/games/velvet-house/`. Most
of the rules below are about the game's story scenes, because that is where work has gone wrong before.

## Checks that must pass before a push

```
npm run typecheck
npx vitest run
npm run test:live          # the live game in Chromium; story.spec.ts and boot.spec.ts at minimum
```

`npx vitest run src/games/velvet-house` is the quick loop for game work. The live tests need the Vite dev server
(the config starts it) and a Chromium; set `PW_CHROMIUM_PATH` if the default is missing.

## Story scenes (`src/games/velvet-house/content/`, `script/`)

A scene is a script in `content/scripts.ts`, run by `script/engine.ts` through the host in `script/gameHost.ts`.
Before changing or adding one:

1. **Read its contract** in `docs/velvet-house/scenes/<script id>.md`. No contract: write one first from
   `docs/velvet-house/scene-contract-template.md`, with the director's words quoted, not paraphrased. The contract
   is the source of truth; when the scene changes, rewrite the contract. Never leave "ignore the part below" notes.
2. **Surface conflicts, do not resolve them silently.** If the brief and the code disagree, or an asset the brief
   names does not exist (a pose, a prop, a sound, a mark), say so in the contract's "Still open" section and in the
   PR. Never substitute something unrelated and call the requirement met.
3. **Beats end on the world, not on buttons.** A lesson waits on a `world` condition (the piece's type, place,
   facing or light) or on an event **with** a flag or world fallback beside it. The validator
   (`script/validate.ts`, run by `__tests__/storyContent.test.ts`) rejects a bare event wait and a card button
   with no wait after it.
4. **Nobody speaks while walking** in a cutscene or guided lesson: walks wait, or a `wait` with `arrive` comes
   before the line. The validator rejects the rest.
5. **No skipping.** There is no Skip button and no `skippable` script, by the director's decision. Do not add one.
6. **Residents a scene needs are held** with `needs.hold`; the opening also waits for the host profile with
   `needs.host`.
7. **Every wait is a resume point.** The engine handles this; do not add `checkpoint` steps unless a resume must
   land somewhere other than the last `mode` step. `__tests__/storyResilience.test.ts` reloads every script at
   every wait and fails on a soft-lock or a duplicated object; it covers new scenes automatically.
8. **Lines** live in `content/lines.ts` and `content/banks.ts`. Companion lines are chosen by humor style and
   communication style (and gender, once the banks carry it); every slot must exist for every style. Dez's
   lines are the same for everyone. The player character has no lines.
9. **Do not bump `MIN_CONTENT_VERSION`** (`state/saveMigration.ts`) without the director's approval: it discards
   every player's house.
10. **Verify at the right level** and say which in the PR: source reading (S), automated test (A), played in the
    real game on desktop and phone (P). A green build is not a working scene.

## Companion chat boundary

The script engine owns story flags, `rt.done`, objects and the household. The companion chat
(`systems/chat.ts`) reads context and may propose actions; it never sets story flags, marks beats done or moves
objects directly. Do not write scripted lines into `chatTurns` as if the AI had said them.

## Pull requests

Use the template. In "Testing", list the acceptance items checked and at which level (S/A/P). One scene per PR.
