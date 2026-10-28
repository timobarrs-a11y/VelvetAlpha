# Working in this repository

Velvet is a React app (`src/`) with an embedded life-sim game, **Velvet Sims**, in `src/games/velvet-house/`. Most
of the rules below are about the game's story scenes, because that is where work has gone wrong before.

## Before a push

```
npm run typecheck
```

That is the only required check: it catches a broken build in about a minute. Do not run the automated test suites
(`npx vitest run`, `npm run test:live`) as a gate before pushing or before reporting back, and do not keep the owner
waiting on them. By the owner's decision (2026-10-28), the tests were too slow and did not catch what matters: bad
scripting, a lesson that locks the player out, a moment that should not happen. Those are found by reading the code
and by playing the game. Run a single test only when the owner asks for it.

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
   (`script/validate.ts`, which warns in the console when the game starts in development) rejects a bare event
   wait and a card button with no wait after it.
4. **Nobody speaks while walking** in a cutscene or guided lesson: walks wait, or a `wait` with `arrive` comes
   before the line. The validator rejects the rest.
5. **No skipping.** There is no Skip button and no `skippable` script, by the director's decision. Do not add one.
6. **Residents a scene needs are held** with `needs.hold`; the opening also waits for the host profile with
   `needs.host`.
7. **Every wait is a resume point.** The engine handles this; do not add `checkpoint` steps unless a resume must
   land somewhere other than the last `mode` step.
8. **Lines** live in `content/lines.ts` and `content/banks.ts`. Companion lines are chosen by humor style and
   communication style (and gender, once the banks carry it); every slot must exist for every style. Dez's
   lines are the same for everyone. The player character has no lines.
9. **Do not bump `MIN_CONTENT_VERSION`** (`state/saveMigration.ts`) without the director's approval: it discards
   every player's house.
10. **Say how it was checked** in the PR: source reading (S), or played in the real game on desktop and phone (P).
    A clean typecheck is not a working scene; what has not been played is listed as not played.

## Companion chat boundary

The script engine owns story flags, `rt.done`, objects and the household. The companion chat
(`systems/chat.ts`) reads context and may propose actions; it never sets story flags, marks beats done or moves
objects directly. Do not write scripted lines into `chatTurns` as if the AI had said them.

## Pull requests

Use the template. In "Testing", list the acceptance items checked and how (S or P), and what has not been played
yet. One scene per PR.
