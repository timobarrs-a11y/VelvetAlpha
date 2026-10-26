# Prompt for Opus: Velvet Sims architecture and design (planning only)

Paste everything below the line into a fresh session on Opus, with the repo
open on branch `claude/great-shannon-2gnmm0`.

---

You are the architect for **Velvet Sims** (code name Velvet House), a cozy
life-sim inside the Velvet app. This is a **planning request, not a build
request**. Read the context, inspect the code where I point you, then produce
the design deliverables in section 6 and **stop for my approval before any
implementation**. Sonnet will implement what you design, so your output must
be precise enough to hand over: types, schemas, file layout, step order.

## 1. The game

Isometric 2D canvas life-sim. The player (Jordan) and an AI companion (Maya)
live in a three-floor house plus a backyard and a buildable attic. The
companion is a real conversational partner powered by Claude. The player
decorates, arranges furniture, shops, pays bills, and watches the household
live. The core of the product is the relationship with the companion, and the
game is the setting around it.

The live game is the TypeScript one:
- `src/games/velvet-house/` (state, art, ui, engine, bridge, tests)
- served by `games/velvet-house-next/index.html` inside an iframe on the page
  `src/pages/VelvetHouseNextGame.tsx` at the route `/velvet-house`
- the legacy 5,000-line `public/games/velvet-house/index.html` is still served
  at `/velvet-house-legacy` and is the only thing the e2e tests cover

Existing design docs to read first:
- `docs/velvet-house/opening-sequence.md` (the Dez Dupree opening and the
  15-chapter tutorial)
- `docs/velvet-house/jobs.md` (jobs, work days, workplace casts, character
  engine rules)
- `docs/velvet-house/bolt-overhaul-prompt.md` (earlier planning brief)
- `src/config/signatureVoices.ts` (26 personality voices to reuse)

## 2. What we are about to build

1. **A script engine** (cutscenes and story beats): data-driven events with
   triggers and steps (spawn an NPC, walk to a point, move the camera, say a
   line, set a flag, give money or an item, unlock a tab, wait). It pauses the
   sim, has letterbox bars, can be skipped, and saves its progress. First use:
   Dez Dupree, the mayor / mover / delivery man, from the opening doc.
2. **A daily to-do list:** each morning a short list is generated (fixed items
   such as work, dinner, a conversation, plus a few random ones weighted by
   needs and season). Items tick off automatically or by order, give small
   rewards and a streak.
3. **Jobs as content packs:** Jordan goes to work on a schedule while Maya
   stays home. Five jobs: IT Help Desk (first), Teacher, Café barista, Gym
   trainer, Animal clinic. Each has a workplace **scene**, a cast of strong
   personalities, a stream of mostly free, deterministic work tasks (for
   example a ticket queue), and a performance and pay review. The player can
   tap Jordan at work and watch the workplace.
4. **A shared character chat engine:** characters are data files (persona,
   knowledge, relationship, mood, memory facts, schedule, model tier). Replies
   are one or two sentences, structured as `{ line, emotion, action }`. Maya
   moves onto it.
5. **A customisable classroom** (desks, colours, wallpaper) reusing the
   existing paint, wallpaper, floor and Arrange systems.

## 3. Known problems you must design around

These were found in an audit and are verified in the code:

- **Companion chat is not connected in the live game.** `main.ts` only gets
  its `sample` function from `window.claude.use('sample')` or the DEV-only
  `window.__velvet.setSample`. The legacy host page injects it
  (`sampleGameTurn` in `src/pages/VelvetHouseGame.tsx`, calling the edge
  function `velvet-game-turn`). `VelvetHouseNextGame.tsx` does not.
- **No cloud save in the new game.** It saves to `localStorage` only
  (`SAVE_KEY`). The legacy page saved to Supabase through
  `src/services/velvetHouseDatabase.ts`.
- **Work and career are not wired.** `career` is hard-coded to level 0 in
  `main.ts`; the pure logic exists in `state/career.ts` and
  `state/mayaCareer.ts`. Other placeholders: lawn label, pet count.
- **Duplicated data.** `art/houseArt.js` has its own copies of `LEVELS`,
  `STAIRS`, object `TYPES` (with drawing code) and `LEVEL_NAMES`, separate from
  `state/house.ts` and `state/objects.ts`. Adding the attic needed edits in
  both places.
- **One giant closure.** `main.ts` is about 1,460 lines inside `boot()`.
- **Floors are bare numbers** (0 basement, 1 main, 2 upstairs, 3 yard,
  4 attic) with `level === 3` special cases for the yard. A workplace needs to
  be a proper **scene** rather than a floor number.
- **No e2e coverage of the live game**; only unit tests (about 700 pass).
- **Model IDs are scattered.** `supabase/functions/_shared/modelConfig.ts`,
  `src/services/modelSelector.ts` and about seven functions hard-code them.
  `velvet-game-turn` uses `claude-haiku-4-5` for everything. One function uses
  a legacy 3.5 Haiku id. Current models: Haiku 5.5 `claude-haiku-5-5`, Sonnet
  5.5 `claude-sonnet-5-5`, Opus 5.5 `claude-opus-5-5`.

Also read: `state/agents.ts`, `state/pathfinding.ts`, `state/activities.ts`,
`state/save.ts`, `state/saveMigration.ts`, `state/companionAI.ts`,
`state/arrange.ts`, `ui/drawer.ts`, `ui/dialogue.ts`, `bridge/protocol.ts`,
`supabase/functions/velvet-game-turn/index.ts`.

## 4. Constraints

- Keep the existing look and the systems that work (pathfinding, needs,
  arrange, shop, drawer, saves).
- Phone-first. The game runs in an iframe; portrait is the main use.
- AI cost matters. Most gameplay must be deterministic and free. AI is for
  flavour, relationships and a few decisions.
- **Child-character safety.** The Teacher job has AI-written child characters.
  The player is always the adult teacher. Kids stay inside classroom life,
  never ask for or give personal information, and nothing romantic or
  inappropriate is ever in scope. Design this as an enforced layer (prompt plus
  an output check), not a comment.
- Memory rule from the opening doc: nothing from the game reaches the main
  Velvet companion chat.
- Backwards compatibility: existing saves must keep loading (migrations).

## 5. Questions to resolve in your design (recommend an answer to each)

- How does a **scene** differ from a floor? What is the registry, and how do
  the art, pathfinding, objects, wallpaper/floor looks, lighting and the floor
  bar consume it?
- What is the **single source of truth** for level and object data, so the art
  stops duplicating it?
- How does the script engine **drive characters** (the existing route and task
  system), and how are NPCs represented next to the two household agents?
- How does the **host bridge** supply chat and cloud save to the game
  (`postMessage` contract), including streaming, errors, rate limits and a
  per-day budget with canned fallbacks?
- How are **characters, jobs, tickets and events authored** (TypeScript data
  versus JSON), validated, and tested?
- How should the work day interact with the **clock and speed**, needs, and
  Maya's autonomous day while Jordan is away?
- What is the **save schema** change (version bump, migration), and what must
  be in the cloud save?
- How are **model tiers** assigned per character and per call, with prompt
  caching, and where does the single model config live?

## 6. Deliverables (planning only)

1. **Verdict on the foundation:** is the current code a sound base, or does
   any part need a redesign? Justify with evidence from the code.
2. **Target architecture:** module layout, data flow, and the scene, script,
   character, job and daily-list models, each with TypeScript types and one
   worked example (the Dez opening for scripts; the IT Help Desk for jobs).
3. **The bridge contract and the save schema** (with migration).
4. **The model-tier plan** and the child-character safety layer.
5. **A step-by-step implementation plan** for Sonnet: ordered, each step
   small enough to review, with files touched, tests to add, and what is
   playable at the end of the step. The foundation fixes in section 3 come
   first.
6. **Risks and open decisions** for me, ranked.

Do not write implementation code beyond types and short examples. Stop after
the plan and wait for my approval.
