# Velvet Sims: architecture plan for scripts, daily list, jobs, character chat and the classroom

*Planning document. Nothing here is built yet. Approve it (or mark it up) before
implementation starts. Sonnet implements the steps in §5 in order.*

Branch read: `claude/stoic-bohr-azcrgu` at `f4080f0` (same as `main`).

## 0. Two things the brief assumes that the code doesn't have

1. **`docs/velvet-house/jobs.md` does not exist.** It isn't on this branch, on
   `main`, or anywhere in git history. The job design below (IT Help Desk cast,
   tickets, pay) is my proposal. If you have that doc elsewhere, add it and
   step 4.1 adapts its content. The engine design doesn't depend on it.
2. **There is no attic.** `state/house.ts` and `art/houseArt.js` both define four
   levels (0 basement, 1 main, 2 upstairs, 3 yard), and nothing references
   level 4. This plan adds the attic as the acceptance test for the
   single-source-of-truth refactor (step 0.9): it should take one data entry.

---

## 1. Verdict on the foundation

**Short version: it's a sound base for the simulation, but not for saving,
chatting or adding scenes.** Keep the pure sim modules and the renderer. Three
parts need a structural redesign before any of the new features: the save path,
the host bridge, and the data and scene model. `main.ts` needs to be split, but
that's a mechanical change, not a rewrite. Five live bugs should be fixed first,
because the new work would build on them.

### What is sound (keep as is)

| Part | Evidence |
|---|---|
| Pathfinding | `state/pathfinding.ts` is pure (grid A*, stair legs, `planRoute`) with 25+ tests. It only needs grid dimensions per scene (it uses the constants `NX=20`, `NY=16` today). |
| Agents, activities and needs | `state/agents.ts`: `startChain` → `startAct` → `moveAlong` → `arrive` → `finish` is a clean task state machine with seeded RNG injection (`rng: () => number`). Scripted walking and NPCs extend it without changing it (see §2.4). |
| Arrange | `state/arrange.ts` is pure placement validation (`checkPlacement`, `centreAt`, `rotateAboutCentre`), so the classroom reuses it unchanged. |
| Renderer and engine | `art/houseArt.js` (the drawing), `engine/*` (fixed-step loop, quality tiers, G-buffer, deferred lights). The look stays. |
| UI pieces | `ui/drawer.ts` and `ui/dialogue.ts` are self-contained factories with callbacks. |
| Seeded RNG | `state/rng.ts` exists and is threaded through agents. |
| Tests | 694 unit tests in 40 files, all passing (I ran them). |

### What needs a redesign, with evidence

**R1. Saving drops player data on every autosave (this is a live bug).**
`main.ts:905` `doSave()` writes `LOOKS: []`, `ROOMLOOK: [{},{},{},{}]`,
`WALLOBJS: []`, `yard: { t: [] }`, `pets: []`, `dirt: []`,
`career: { level: 0, perf: 0 }`, zeroed skills and a fixed mood. Paint,
wallpaper, floors, room looks and wall decor live inside the art module
(`houseArt.js`: `LOOKS`, `ROOMLOOK`, `WALLOBJS`, `YARD`). `art.applySave()`
reads them on load, but nothing ever writes them back. A player who paints a
room loses it on reload. A legacy v1 save keeps its looks for exactly one load,
and the first autosave 15 s later wipes them, along with career, pets and lawn.
`state/save.ts` has a second, unused `snapshot()` that writes *character* looks
into `LOOKS` (the slot for floor looks), so it's a second trap. The art also
keeps stale copies of `power`, `dishes`, `fridge` and `owned` that only refresh
on load. **Redesign:** one `GameState` owns all saved data, the art is drawn from
a frame that carries looks, and one serializer is used everywhere.

**R2. Companion chat can't work in the live game, even with the sampler
injected.** `main.ts:181` gets `sample` only from `window.claude.use('sample')`
(not provided by the app) or the DEV-only `__velvet.setSample`. And the shapes
don't match. The new game calls `sample(string[], …)` and expects a `string`
(`state/companionAI.ts:186`, `SampleFn` on line 62). The edge function expects
`input: {role, content}[]` (`velvet-game-turn/index.ts`, `normalizeTurns`) and
returns `{text}`. The legacy sampler in `VelvetHouseGame.tsx` returns `{text}`
too. Strings would be dropped by `normalizeTurns` and the call would 400. Other
gaps: there's no streaming (the function returns one JSON body), no prompt
caching, no per-user budget, and **`velvet-game-turn` does not run
`moderateInput()`**, which every other chat surface does
(`chat`, `chat-turn`, `group-chat` and others). **Redesign:** a typed
`postMessage` chat contract, with a v2 edge function that owns the prompts (§3).

**R3. Data is duplicated, and floors are bare numbers.** `houseArt.js:250`
`LEVELS`, `:268` `STAIRS`, `:313` `TYPES` (84 types with full geometry and
spots, the same 84 as `state/objects.ts`), `:130` `LEVEL_NAMES`, plus
`WALL_LIGHTS` at `:873`. `LEVEL_NAMES` also exists in `state/house.ts` and
`state/time.ts`, so there are three copies. The art has 18 `level === 3` /
`!== 3` checks. World size is the constant `WX=10, WY=8`, defined separately in `state/house.ts` and `houseArt.js`. Tap
hit-testing in `main.ts:595,602,687` and `screenToWorld` (`:558`) hard-code the
projection origin `288/128`. That's correct only at rotation 0, so **taps pick
the wrong object when the house is rotated**. **Redesign:** a scene registry
(§2.2) and art that imports the geometry and keeps only the drawing.

**R4. `main.ts` is one 1,280-line closure** (`boot()`, lines 127–1278), mixing
DOM, input, camera, sim, save, bridge and goals. Career is stubbed in five
places (`career: { level: 0 }` at `:909, :955, :994, :1010`), plus
`lawnLabel: 'Lush'` and `petCount: 0`. **Fix (mechanical):** split it into a
kernel plus systems plus UI controllers (step 0.10). No behaviour change.

**R5. Memory compaction drops memories instead of condensing them.**
`companionAI.ts:143,149` say "simplified: keep newest" and "simplified: drop".
That contradicts the design doc ("nothing important is dropped"). `memoryBrief()`
is also unused, because `persona()` builds its own block.

**R6. About 40% of the test suite covers code the game never runs.**
`calendar`, `dirt`, `economy`, `festivals`, `gameState`, `mayaCareer`,
`patterns`, `pets`, `save`, `shopLocks`, `sparks`, `wishes` and `yard` are not
imported by the live game (`career` only reaches the drawer and goal UI).
Together they have about 300 tests. The e2e suite (`e2e/velvet-house/*`) loads
`public/games/velvet-house/index.html`, the legacy file. **Nothing tests the live
game end to end**, so the refactors in §5 need the harness from step 0.7 first.

**R7. The legacy and live games share one localStorage key**
(`velvet-house-v1:<companionId>`). The live game writes v2 there. The legacy
loader rejects v2 (`index.html:3299` `s.v !== 1`), and the legacy host overwrites
the key from the cloud on boot. Today, opening `/velvet-house-legacy` quietly
pushes live-game progress into history. The live game needs its own key once it
owns cloud saves.

---

## 2. Target architecture

### 2.1 Module layout

New code goes in new folders. Existing `state/` files stay where they are (this
keeps churn low). Only `house.ts` and `objects.ts` change shape, and `main.ts`
shrinks.

```
src/games/velvet-house/
  main.ts                    ≤150 lines: create Game, mount UI, start loop, connect host
  core/
    game.ts                  Game kernel: GameState, systems in a fixed order, tick()
    events.ts                GameEvent union + queue (dispatched at end of tick, deterministic)
    clock.ts                 day/minutes/speed + pauseReasons: Set<PauseReason>
    rngStreams.ts            rngFor(seed, stream, day?) → independent seeded streams
    saveState.ts             GameState ⇄ SaveDataV3 (the only serializer)
  world/
    types.ts                 SceneDef, LevelDef, Place, PlaceRef, Portal, Mark
    scenes/house.ts          HOUSE scene (moved from state/house.ts; levels 0–4)
    scenes/itOffice.ts       one file per workplace scene
    registry.ts              getScene(), levelOf(), isOutdoor(), floor-bar entries
    projection.ts            project/unproject with rotation (shared by art + input)
    navigation.ts            grids per (scene, level), sized from LevelDef.size
  state/                     (existing) agents, activities, needs, household, arrange, taste, …
    objects.ts               ObjectTypeDef geometry + spots: the ONLY copy
  art/
    houseArt.js              drawing only; reads scene + TYPES from world/state
    objectParts.js           PARTS: Record<typeId, partsFn> (moved out of houseArt.js TYPES)
  script/
    types.ts  engine.ts  steps.ts  triggers.ts  skip.ts
  chat/
    characterChat.ts         say(characterId, text) → ChatReply (streams via host)
    budget.ts                client mirror of server budget + canned fallback picker
    memory.ts                memory tiers + compaction (fixes R5)
  jobs/
    types.ts  engine.ts  workday.ts  review.ts  commute.ts
  daily/
    todo.ts                  generation + event-driven completion + streak
  content/                   pure data, TypeScript
    characters/  (maya.ts, dez.ts, it/*.ts, school/*.ts …)
    lines/       (dez.ts, opening.ts …)
    scripts/     (opening.ts, tutorial.ts, deliveries.ts …)
    jobs/        (itHelpdesk.ts, tickets/itHelpdesk.ts …)
    todos.ts
    validate.ts              validateContent(): referential + safety checks
  bridge/
    protocol.ts              v1 messages (kept) + v2 chat/save/boot messages
    hostClient.ts            game side: request/response over postMessage
  ui/
    drawer.ts dialogue.ts    (existing)
    hud.ts controls.ts input.ts camera.ts   (split out of main.ts)
    letterbox.ts choice.ts todo.ts workView.ts ticketCard.ts reviewCard.ts
src/pages/VelvetHouseNextGame.tsx         host: chat proxy, cloud save, budget
src/games/velvet-house/host/              host-side helpers (pure, unit-testable)
  chatProxy.ts  cloudSave.ts
supabase/functions/velvet-game-turn/      v2 (keeps accepting v1 bodies)
supabase/functions/_shared/modelConfig.ts the only place model IDs appear
supabase/functions/_shared/velvetContent.json  generated character bundle (server copy)
```

### 2.2 Data flow

```
 input (tap/keys) ─► ui controllers ─► Game.command(...)
                                         │
 fixed step (1/60 s) ─► Game.tick(dt) ───┤ systems, in order:
                                         │  1 clock      (pauseReasons decide if game minutes move)
                                         │  2 household  (bills, deliveries → events)
                                         │  3 jobs       (schedule, commute, workday)
                                         │  4 agents     (move: always; live: when clock runs)
                                         │  5 scripts    (triggers on events/flags/time; steps)
                                         │  6 daily      (completion via events)
                                         │  7 goals      (settle + life goals, now via events)
                                         └─► events queue → dispatched to systems' on(...)
 render (rAF) ─► art.render(frame from GameState)   (art holds no game data)
 save timer / pagehide ─► saveState.toSave(state) ─► hostClient.save() ─► host ─► Supabase
 chat ─► chat/characterChat ─► hostClient.chat() ─► host ─► velvet-game-turn ─► Anthropic
```

```ts
// core/game.ts
export type PauseReason = 'player' | 'cutscene' | 'guided' | 'arrange' | 'chat' | 'review';

export interface System {
  id: string;
  tick?(g: Game, dt: number, gameMin: number): void;
  on?: { [K in GameEvent['type']]?: (e: Extract<GameEvent, { type: K }>, g: Game) => void };
}

export interface Game {
  state: GameState;                 // everything that is saved
  view: ViewState;                  // never saved: camera, scene/level shown, follow
  clock: Clock;
  scenes: SceneRegistry;
  content: ContentRegistry;
  rng(stream: string): () => number;  // rngFor(state.rngSeed, stream, state.day)
  emit(e: GameEvent): void;         // queued; dispatched after the systems tick
  command(c: Command): void;        // the only way UI changes state
}
```

```ts
// core/events.ts (initial set; extend per feature)
export type GameEvent =
  | { type: 'day.start'; day: number }
  | { type: 'clock.hour'; day: number; hour: number }
  | { type: 'act.started' | 'act.done'; who: AgentId; act: string; objId?: string }
  | { type: 'obj.bought'; itemId: string; objId?: string; category: DeliveryCategory }
  | { type: 'obj.unpacked' | 'obj.placed'; objId: string; objType: string; scene: SceneId; level: number }
  | { type: 'look.changed'; scene: SceneId; level: number; room?: string; kind: 'paint' | 'paper' | 'floor' }
  | { type: 'level.viewed'; scene: SceneId; level: number }
  | { type: 'ui.opened'; target: UiTarget }
  | { type: 'chat.opened' | 'chat.closed'; with: string; playerLines: number }
  | { type: 'delivery.due' | 'delivery.arrived'; deliveryId: string; category: DeliveryCategory }
  | { type: 'bill.paid' } | { type: 'money.changed'; delta: number; reason: string }
  | { type: 'work.left' | 'work.arrived' | 'work.leftWork' | 'work.home'; who: AgentId; jobId: string }
  | { type: 'work.taskDone'; jobId: string; taskId: string; outcome: Outcome }
  | { type: 'work.dayDone'; jobId: string; summary: WorkDaySummary }
  | { type: 'flag.set'; flag: string; value: FlagValue }
  | { type: 'script.done'; id: string; skipped: boolean }
  | { type: 'todo.done'; itemId: string } | { type: 'todo.allDone'; day: number };
```

**RNG streams.** `rngFor(seed, 'todo', day)`, `rngFor(seed, 'work:it-helpdesk', day)`
and so on are independent seeded streams (seed = `hash(rngSeed, stream, day)`).
Adding a feature then never shifts another feature's random sequence, which
keeps golden tests stable.

### 2.3 Scenes vs floors

**Answer:** a *scene* is a place with its own coordinate space, grids, objects,
looks and lighting: the house, the IT office, the classroom. A *level* is a
floor inside a scene. The house is one scene with five levels. A workplace is a
scene, usually with one level. A floor number is only meaningful together with
its scene. Each level says what kind it is (`interior | outdoor | basement |
attic`), which replaces `level === 3`. People and objects carry `scene`.

```ts
// world/types.ts
export type SceneId = string;                       // 'house' | 'work:it-helpdesk' | 'work:school' …
export type LevelKind = 'interior' | 'basement' | 'outdoor' | 'attic';

export interface LevelDef {
  id: string;                                       // 'basement' | 'main' | 'upstairs' | 'yard' | 'attic'
  name: string;                                     // floor bar + HUD label ('Main floor')
  short: string;                                    // phone floor bar ('Main')
  kind: LevelKind;
  size: [number, number];                           // world tiles; house levels = [10, 8]
  rooms: RoomDef[];
  walls: InteriorWall[];
  feats: WallFeat[];
  lights: WallLightDef[];                           // was WALL_LIGHTS filtered by level
  anchor: [number, number];
  rug?: [number, number, number, number];
  marks?: Record<string, [number, number]>;         // named points for scripts ('entry.inside')
  defaultLook: LevelLook;                           // was art LOOKS[i] default
  unlock?: UnlockId;                                // 'level:attic' → hidden until unlocked
}

export interface Portal {                           // stairs, doors and scene exits
  id: string;                                       // 'S01', 'D13', 'front'
  a: { level: number; node: [number, number] };
  b: { level: number; node: [number, number] } | { scene: SceneId };  // scene exit = leave
  kind: 'stairs' | 'door' | 'exit';
  bottom?: [number, number]; top?: [number, number];  // art data for flights
}

export interface SceneDef {
  id: SceneId;
  kind: 'home' | 'workplace';
  name: string;
  levels: LevelDef[];
  portals: Portal[];
  entry: { level: number; at: [number, number] };   // where people appear (front door)
  initialObjects: Omit<ObjectInstance, 'scene'>[];
  customizable: boolean;                            // paint/paper/floor/arrange allowed here
  catalogFilter?: (e: CatalogEntry) => boolean;     // what the shop sells for this scene
}

export interface Place { scene: SceneId; level: number; x: number; y: number }
export type PlaceRef =
  | 'door' | `mark:${string}` | `obj:${string}` | `objType:${string}` | `near:${string}`  // near:<actor>
  | { level: number; x: number; y: number };
```

**How each consumer reads it:**

| Consumer | Today | After |
|---|---|---|
| Art | Own `LEVELS`, `STAIRS`, `TYPES` geometry, `LEVEL_NAMES`, `WALL_LIGHTS`, `WX/WY`, 18 `level === 3` checks | `createHouseArt(ctx, opts)` gets `scene: () => SceneDef`. Walls, floors, feats and lights come from `scene.levels[lv]`. `isOutdoor = kind === 'outdoor'`, size from `level.size`. Object geometry is `TYPES[t]` from `state/objects.ts`, merged with drawing from `PARTS[t]`. |
| Pathfinding | `buildWorld(objs)` builds four grids from `LEVELS` with `NX/NY` constants | `navigation.ts` builds `grids[sceneId][level]` lazily, sized `ceil(size/RES)`. `planRoute` takes portals instead of `STAIRS`. `pathfinding.ts` gains `nx, ny` parameters (defaults keep the old tests green). |
| Objects | `ObjectInstance.level` only | Adds `scene?: SceneId` (absent means `'house'`, so old saves stay valid). Slots are built per scene. |
| Looks | Art-internal `LOOKS[4]` / `ROOMLOOK[4]` | `GameState.looks[sceneId][level] = { base: LevelLook; rooms: Record<string, LevelLook> }`, passed in the frame. The house's slice still saves as `LOOKS` / `ROOMLOOK` (see §3.3). |
| Lighting | `levelDark(level)` special-cases 0 and 3 | Reads `kind` (`basement` darker, `outdoor` sky-lit), plus an optional `LevelDef.ambient` override. |
| Floor bar | `LEVEL_NAMES.map` over buttons 0–3 | `registry.floorBar(state)` returns the visible (unlocked) levels of the viewed scene, plus a **Home / Work** toggle while Jordan is at work. Keys 1–5 map to visible levels. |
| Hit testing | Hard-coded `288 + (x - y) * 32` | `projection.unproject(sx, sy, level)` and `art.hitTest(sx, sy)` (uses the object hulls the art already computes for arrange), so taps are right at every rotation. |

### 2.4 Characters in the world: household, NPCs and scripted control

**Answer:** NPCs are the same `Agent` type as Jordan and Maya, so pathfinding,
pose and render need no changes. Three fields are added. A script drives any
agent through the existing task machine with one new task type, `goto`.

```ts
// state/agents.ts (additions)
export type AgentId = string;                       // was 'jordan' | 'maya'
export interface Agent {
  // … existing fields …
  kind: 'household' | 'npc';
  scene: SceneId;
  scripted: boolean;          // true while a script owns them: free will and idle picking are skipped
  away: { reason: 'work' | 'errand'; until: number } | null;  // off-screen; needs use DECAY_AWAY
  carrying?: string;          // prop drawn in hands (box, grocery bag)
  needs: CharacterNeeds | null; // NPCs: null, so needs don't tick
}

// new: walk somewhere with no activity at the end (scripts, commute, NPC schedules)
export function startGoto(world: NavWorld, ch: Agent, to: Place): boolean;
// split of tickAgent so cutscenes can move actors while the clock is paused:
export function moveAgent(world: NavWorld, ch: Agent, dt: number, walkMul: number): void; // route following only
export function liveAgent(world: NavWorld, ch: Agent, others: Agent[], gameMin: number,
                          hourF: number, rng: () => number, h?: HouseholdState): void;    // needs, task timing, free will
```

- `GameState.people: Agent[]` holds the household (always) and active NPCs. All
  `people[0]` / `people[1]` indexing in `main.ts` becomes `byId('jordan')`.
- **NPCs are spawned, not saved as agents.** A script or a workplace schedule
  spawns them at a `PlaceRef`. A save while an NPC is mid-walk stores only the
  script's position (§2.5), and on load the script re-spawns at its last
  checkpoint step.
- Workplace coworkers come from `CharacterDef.schedule`. They're spawned only
  while that scene is being *viewed*, at the spot their schedule says for the
  current minute, and despawned when the view leaves. Nothing ticks them while
  nobody watches.
- `art.render` already takes `chars: PersonFrame[]`. Seeds become `hash(id)`,
  and `PersonFrame` gains `name?`, `carrying?` and `bubble?` (speech for barks).

### 2.5 Script engine (cutscenes and story beats)

**Modes.** `cutscene` pauses the clock, shows letterbox bars, locks input and
offers Skip. `guided` pauses the clock and allows only listed targets (for
"tap the box"), with no bars. `beat` runs during free play with the clock
running (chapters 7+). A script can switch mode mid-way.

```ts
// script/types.ts
export type FlagValue = string | number | boolean;
export type Actor = 'jordan' | 'maya' | string;            // string = CharacterDef id (NPC)
export type LineRef =
  | string                                                 // key into content/lines (supports {player} {partner} {town})
  | { byPreset: Record<'warm' | 'calm' | 'bubbly' | 'dry', string> }  // companion voice variants
  | { pool: string };                                      // no-repeat pick from a line pool
export type UiTarget = `tab:${DrawerPage}` | 'floorbar' | 'camera' | 'wallet' | 'bill' | `obj:${string}` | 'todo';
export type UnlockId = `tab:${DrawerPage}` | `level:${string}` | `job:${string}` | 'freeWill';

export type Cond =
  | { flag: string; equals?: FlagValue; exists?: boolean }
  | { event: GameEvent['type']; match?: Record<string, FlagValue> }   // only valid in `wait.until` and triggers
  | { time: { day?: number; weekday?: number; after?: number; before?: number } }  // minutes in day
  | { scriptDone: string }
  | { all: Cond[] } | { any: Cond[] } | { not: Cond };

export type Step =
  | { do: 'mode'; mode: 'cutscene' | 'guided' | 'beat'; allow?: UiTarget[] }
  | { do: 'spawn'; npc: string; at: PlaceRef; carrying?: string }
  | { do: 'despawn'; npc: string }
  | { do: 'place'; who: Actor; at: PlaceRef; face?: Actor | PlaceRef }       // teleport (setup only)
  | { do: 'walk'; who: Actor; to: PlaceRef; wait?: boolean }               // default wait: true
  | { do: 'face'; who: Actor; toward: Actor | PlaceRef }
  | { do: 'act'; who: Actor; act: string; at?: PlaceRef; wait?: boolean }  // an ACTIVITIES/CHAINS id
  | { do: 'emote'; who: Actor; emote: 'alert' | 'laugh' | 'wave' | 'heart' | 'think' }
  | { do: 'camera'; focus: Actor | PlaceRef | 'wide'; zoom?: number; level?: number; scene?: SceneId }
  | { do: 'say'; who: Actor; line: LineRef; emotion?: Emotion }           // waits for tap (▼)
  | { do: 'choice'; options: ChoiceOption[] }
  | { do: 'card'; title: string; body: string; spotlight?: UiTarget }
  | { do: 'highlight'; target: UiTarget | null }
  | { do: 'outline'; objType: string; at: PlaceRef; rot?: number; color?: 'partner' | 'player' }
  | { do: 'set'; flag: string; value: FlagValue }
  | { do: 'give'; money?: number; items?: string[];
      object?: { type: string; at: PlaceRef; id?: string; contents?: string } }
  | { do: 'unlock'; what: UnlockId }
  | { do: 'clock'; day?: number; minutes?: number }                        // new-game setup only
  | { do: 'wait'; seconds?: number; minutes?: number; until?: Cond }
  | { do: 'if'; cond: Cond; then: Step[]; else?: Step[] }
  | { do: 'run'; script: string }                                          // sub-script, waits for it
  | { do: 'checkpoint' };                                                  // resume point after a reload

export interface ChoiceOption {
  label: string;
  set?: Record<string, FlagValue>;
  steps?: Step[];
  default?: boolean;                 // exactly one per choice: used on skip
}

export interface ScriptDef {
  id: string;
  trigger: { on: 'newGame' } | { on: 'cond'; cond: Cond };
  mode: 'cutscene' | 'guided' | 'beat';
  once?: boolean;                    // default true
  priority?: number;                 // higher starts first when several trigger at once
  skippable?: boolean;               // cutscene/guided only
  onSkip?: Step[];                   // REQUIRED if skippable: effect-only steps giving the end state
  vars?: Record<string, string>;     // from the triggering event, e.g. { category: '$event.category' }
  steps: Step[];
}

// saved (GameState.scripts)
export interface ScriptRuntime {
  done: string[];                                        // ids of finished once-scripts
  active: { id: string; checkpoint: number[]; vars: Record<string, FlagValue> } | null;
  queue: string[];                                       // triggered while another script runs
  linePools: Record<string, number[]>;                   // indices used recently, for no-repeat
}
```

**Engine rules.**
- One active script at a time. Others queue by priority. A `beat` can be
  pre-empted by a `cutscene` (the beat resumes from its checkpoint).
- Steps run in the **fixed step**. In `cutscene`/`guided`, the clock system sees
  `pauseReasons.has('cutscene')` and stops game minutes. `moveAgent` still runs
  for agents with `scripted: true` (at real-time walking speed), so Dez walks
  while time stands still.
- `walk` and `act` set `who.scripted = true` and call `startGoto` / `startChain`.
  The step completes when the agent's task is done. On script end, every actor
  it touched gets `scripted = false`.
- `say` renders through `ui/dialogue.ts` in a speaker mode (name plate and
  portrait colour), and in a letterbox layout during a cutscene.
- **Skip** runs `onSkip` effect steps only (`set`, `give`, `unlock`, `despawn`,
  `place`), then ends. `validateContent()` rejects a skippable script without
  `onSkip`, or an `onSkip` with presentational steps. The end state is then the
  same whether you watch or skip, and a test proves it per script.
- **Saving mid-script** stores `active.checkpoint`, a path of step indices into
  nested `if`/`choice` blocks. Resuming restarts at the last `checkpoint` step,
  never mid-walk.
- **Existing saves** get `opening.*` and `tutorial.*` marked done in the v3
  migration, so returning players never see the move-in again.

**Worked example: the Dez opening, beats 1 to 6** (content, not engine code):

```ts
// content/scripts/opening.ts
export const OPENING: ScriptDef = {
  id: 'opening.moveIn',
  trigger: { on: 'newGame' },
  mode: 'cutscene',
  skippable: true,
  steps: [
    { do: 'clock', day: 1, minutes: 9 * 60 },
    { do: 'camera', focus: 'wide', scene: 'house', level: 1 },
    { do: 'place', who: 'jordan', at: 'mark:living.center' },
    { do: 'place', who: 'maya', at: 'mark:living.window', face: 'jordan' },
    // 1. Cold open
    { do: 'say', who: 'maya', line: 'opening.echo' },          // byPreset W/C/B/D in content/lines/opening.ts
    { do: 'say', who: 'maya', line: 'opening.moversLate' },
    { do: 'emote', who: 'maya', emote: 'alert' },              // the knock
    // 2. The mover
    { do: 'spawn', npc: 'dez', at: 'door' },
    { do: 'walk', who: 'dez', to: 'mark:entry.inside' },
    { do: 'camera', focus: 'dez', zoom: 1.8 },
    { do: 'say', who: 'dez', line: 'dez.intro.1' },
    { do: 'say', who: 'dez', line: 'dez.intro.2' },
    { do: 'say', who: 'dez', line: 'dez.intro.3' },
    { do: 'say', who: 'dez', line: 'dez.intro.clipboard' },
    { do: 'say', who: 'dez', line: 'dez.intro.boxes' },
    { do: 'walk', who: 'dez', to: 'door' },
    { do: 'despawn', npc: 'dez' },
    { do: 'wait', seconds: 1.0 },
    { do: 'spawn', npc: 'dez', at: 'door', carrying: 'pbox' },
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'pbox', at: 'mark:entry.drop', id: 'box.couch', contents: 'sofa' } },
    { do: 'walk', who: 'dez', to: 'door' },
    { do: 'despawn', npc: 'dez' },
    { do: 'say', who: 'maya', line: 'opening.mayorCarriedCouch' },
    { do: 'checkpoint' },
    // 3. Touch: guided, only the box is tappable
    { do: 'mode', mode: 'guided', allow: ['obj:box.couch'] },
    { do: 'card', title: 'Tap anything', body: 'Tap anything in your home to see what you can do with it.', spotlight: 'obj:box.couch' },
    { do: 'wait', until: { event: 'obj.unpacked', match: { objId: 'box.couch' } } },
    // 4. Placement
    { do: 'outline', objType: 'sofa', at: 'mark:living.tvWall', rot: 0 },
    { do: 'card', title: 'Place it', body: 'Drag to move · ⟳ to rotate · tap to set it down.' },
    { do: 'wait', until: { event: 'obj.placed', match: { objType: 'sofa' } } },
    { do: 'outline', objType: 'sofa', at: 'mark:living.tvWall', color: 'player' },  // cleared by next outline/end
    { do: 'checkpoint' },
    // 5. The ask
    { do: 'mode', mode: 'cutscene' },
    { do: 'act', who: 'maya', act: 'tv', at: 'objType:sofa', wait: false },
    { do: 'say', who: 'maya', line: 'opening.windowAsk' },
    // 6. The first choice
    { do: 'choice', options: [
      { label: 'Keep it by the TV', default: true, set: { couch: 'mine' },
        steps: [{ do: 'say', who: 'maya', line: 'opening.keepIt' }] },
      { label: 'Move it to the window', set: { couch: 'theirs' },
        steps: [
          { do: 'mode', mode: 'guided', allow: ['objType:sofa'] },
          { do: 'outline', objType: 'sofa', at: 'mark:living.window', color: 'partner' },
          { do: 'wait', until: { event: 'obj.placed', match: { objType: 'sofa' } } },
          { do: 'say', who: 'maya', line: 'opening.movedIt' },
        ] },
    ] },
    { do: 'set', flag: 'opening.done', value: true },
    { do: 'run', script: 'tutorial.ch7' },
  ],
  onSkip: [
    { do: 'despawn', npc: 'dez' },
    { do: 'give', object: { type: 'sofa', at: 'mark:living.tvWall', id: 'sofa-1' } },
    { do: 'set', flag: 'couch', value: 'mine' },
    { do: 'set', flag: 'opening.done', value: true },
  ],
};

// content/scripts/deliveries.ts: every store purchase becomes a Dez visit
export const DEZ_DELIVERY: ScriptDef = {
  id: 'dez.delivery',
  trigger: { on: 'cond', cond: { event: 'delivery.due' } },
  mode: 'beat', once: false, priority: 5,
  vars: { category: '$event.category', deliveryId: '$event.deliveryId' },
  steps: [
    { do: 'spawn', npc: 'dez', at: 'door', carrying: '$category' },
    { do: 'walk', who: 'dez', to: 'mark:entry.drop' },
    { do: 'give', object: { type: 'parcel', at: 'mark:entry.drop', id: '$deliveryId' } },
    { do: 'say', who: 'dez', line: { pool: 'dez.delivery.$category' } },   // food | furniture | paint | decor
    { do: 'say', who: 'dez', line: 'dez.getErDone' },
    { do: 'walk', who: 'dez', to: 'door' },
    { do: 'despawn', npc: 'dez' },
  ],
};
```

Beat-mode `say` lines show as a speech bubble plus a log line, not the blocking
dialogue, so a delivery never interrupts play. Couch-move judging and the
9:02 AM auto-chat are suppressed while `!flags['opening.done']` and until
`tutorial.ch11` respectively (they're conditions in their systems, not script
steps).

### 2.6 Character model and chat engine

**Answer:** characters are TypeScript data files. The *static* part (persona,
voice, knowledge, boundaries) is compiled into a JSON bundle that the edge
function owns, so the server builds every prompt except the companion's
player-specific memory. The *runtime* part (affinity, mood, memory facts) lives
in the save. Every reply is structured output: `{ line, emotion, action }`.

```ts
// content/characters/types.ts
export type ModelTier = 'canned' | 'small' | 'standard' | 'premium';   // 'canned' = never calls AI
export type Emotion = 'happy' | 'playful' | 'neutral' | 'tired' | 'annoyed' | 'sad' | 'surprised' | 'shy';
export type ActionKind = 'none' | 'emote' | 'want' | 'act' | 'pick' | 'affinity';
export type CharacterAction =
  | { type: 'none' }
  | { type: 'emote'; emote: 'laugh' | 'wave' | 'hug' | 'dance' | 'think' }
  | { type: 'want'; want: 'coffee' | 'dance' | 'tv' }
  | { type: 'act'; act: 'move_back' | 'repaint' | 'rearrange' | 'cook' | 'clean' | 'pet_care' }
  | { type: 'pick'; catalogId: string }
  | { type: 'affinity'; delta: -3 | -2 | -1 | 0 | 1 | 2 | 3 };

export interface ScheduleEntry { days: number[]; from: number; to: number; at: { scene: SceneId; ref: PlaceRef }; act?: string }

export interface CharacterDef {
  id: string;                         // 'maya' | 'dez' | 'it.marlene' | 'school.kid.ollie' …
  name: string;
  role: string;                       // 'mayor and mover', 'IT manager', 'student (age 9)'
  ageBand: 'adult' | 'child';         // 'child' switches on the safety layer (§4.2), everywhere
  pronoun: 'she' | 'he' | 'they';
  look: AgentLook;
  voice: {
    signature?: string;               // SIGNATURE_VOICES id: adults only; COMMUNICATION section only
    style: string;                    // 1–3 sentences of how they talk
    catchphrases?: string[];
  };
  persona: string;                    // ≤ 800 chars, stable
  knowledge: string[];                // facts they know (town, job, coworkers); ≤ 12 items
  boundaries: string[];               // extra hard rules for this character
  allowedActions: ActionKind[];       // children: ['none', 'emote']
  chat: {
    tier: ModelTier;                  // default tier for replies
    maxSentences: 1 | 2;
    dailyTalks: number;               // AI exchanges per game day before canned-only
    memory: boolean;                  // keeps MemoryFacts about the player
  };
  canned: { greet: string[]; busy: string[]; fallback: string[]; byEmotion?: Partial<Record<Emotion, string[]>> };
  schedule?: ScheduleEntry[];
  homeScene: SceneId;
}

// saved: GameState.characters[id]
export interface CharacterRuntime {
  affinity: number;                   // 0–100, starts at CharacterDef default (50)
  mood: Emotion;
  memory: MemoryFact[];               // ≤ 12 for NPCs; Maya keeps her three tiers (below)
  talksToday: number; lastTalkDay: number;
  turns: { role: 'user' | 'assistant'; content: string }[];  // ≤ 6 for NPCs, 16 for Maya
}
export interface MemoryFact { text: string; day: number; weight: 1 | 2 | 3 }

export interface ChatReply { line: string; emotion: Emotion; action: CharacterAction }
```

**Reusing the 26 signature voices.** `signatureVoices.ts` instructions are
2–3 kB each and all contain a `RELATIONSHIP PHILOSOPHY` section written for a
romantic companion. NPCs reference a voice by id, and the build script extracts
**only** its `COMMUNICATION:` paragraph (28 entries have one). Children never
reference a signature voice (validation rule). Example mapping for the IT cast:
Marlene → `southern_belle`, Patch → `surfer_dude`, Tobias → `nerd`.

**Maya moves onto it.** Maya becomes `content/characters/maya.ts` with
`chat.tier: 'small'`, `maxSentences: 2` and `memory: true`. Her three memory
tiers stay as the flat save fields (`coreMem`, `memories`, `pastMem`, `turns`,
`bond`), so the legacy copy keeps working. `chat/memory.ts` implements the
documented compaction (condense via `purpose: 'condense'`, never drop). If
condensing fails or the budget is spent, the oldest entries wait in a
`pendingCondense` list instead of being deleted. The `[mood=…]` tag is replaced
by structured output. `parseTag` stays only to read old turns. `act` and `pick`
keep driving autonomy and shop picks exactly as the tag did.

**Where prompts are built.** In the edge function (`_shared/velvetPrompt.ts`),
cache-friendly order (§4.1):

1. `GAME_RULES` (static for everyone): in-world, no mention of AI or the main app, reply format.
2. `SAFETY_BLOCK[ageBand]` (static).
3. Character block from the bundle (static per character; for Maya it's built
   from preset, pronoun, bio and taste words, which are static per save).
4. Player profile facts (static per user; existing `factsBlock`).
5. Memory brief (changes when a chat closes): companion only, ≤ 8,000 chars.
6. Messages: last N turns, then the user turn prefixed with the state line
   (day, time, where everyone is). This is the only per-request-variable part.

### 2.7 Jobs as content packs

```ts
// jobs/types.ts
export type JobId = 'it-helpdesk' | 'teacher' | 'barista' | 'trainer' | 'vet-clinic';
export type Outcome = 'great' | 'good' | 'ok' | 'bad';
export type Skill = 'cooking' | 'fitness' | 'logic' | 'creativity' | 'charisma';

export interface JobDef {
  id: JobId;
  title: string;                      // 'IT Help Desk'
  employer: string;                   // 'Dupree County Schools IT' (town lore)
  scene: SceneId;                     // 'work:it-helpdesk'
  schedule: { days: number[]; start: number; end: number; commute: number };  // minutes; weekday 0 = Mon
  levels: { title: string; wage: number; promoAt: number }[];  // wage per hour, perf points to promote
  skill: Skill;                       // main skill for task rolls
  cast: { boss: string; coworkers: string[]; regulars: string[] };   // CharacterDef ids
  stream: TaskStreamDef;
  review: ReviewDef;
  unlock?: Cond;                      // other jobs unlock via flags/goals
}

export interface TaskStreamDef {
  firstAt: number;                    // minutes after start
  gap: [number, number];              // minutes between new tasks (seeded)
  maxOpen: number;
  pool: WorkTaskDef[];
}

export interface WorkTaskDef {
  id: string;
  title: string;                      // 'Password reset (again)'
  from: string | 'walkin';            // CharacterDef id, or a generic walk-in
  minLevel?: number;
  weight: number;
  difficulty: 1 | 2 | 3;
  minutes: number;                    // game minutes of work
  station: string;                    // spot tag in the workplace scene ('helpdesk', 'rack', 'printer')
  approaches?: { label: string; skill?: Skill; bonus: number }[];   // player choice when watching
  lines: { open: LineRef; great?: LineRef; good?: LineRef; bad?: LineRef };
  perf: Record<Outcome, number>;      // e.g. { great: 1.5, good: 1, ok: 0.4, bad: -0.5 }
  xp?: Partial<Record<Skill, number>>;
}

export interface ReviewDef {
  weekday: number;                    // 4 = Friday
  bands: { minAvg: number; stars: 1 | 2 | 3 | 4 | 5; line: LineRef; raise: number }[];
  aiFlavor: boolean;                  // one extra 1-sentence line from the boss (small tier, budgeted)
}

// saved: GameState.jobs.jordan
export interface JobSave {
  jobId: JobId; level: number; perf: number; daysWorked: number; missedDays: number;
  week: { taskOutcomes: Outcome[]; days: number };
  today: WorkDayState | null;
  history: WorkDaySummary[];          // last 10 days
  skills: Record<Skill, number>;      // moves the zeroed `jordan.skills` into real use
}

export interface WorkDayState {
  day: number;
  phase: 'commute' | 'atWork' | 'commuteHome' | 'done';
  open: { taskId: string; startedAt: number | null; approach?: number }[];
  done: { taskId: string; outcome: Outcome }[];
  nextTaskAt: number;
  mods: { energy: number; fun: number; hygiene: number };  // needs when they left, for rolls
}
export interface WorkDaySummary { day: number; jobId: JobId; tasks: number; byOutcome: Record<Outcome, number>; perf: number; pay: number }
```

**Determinism.** `workday.ts` is a pure state machine:
`stepWorkday(def, state, minute, rng)`. It always ticks (it's tiny), whether or
not anyone watches. The task sequence comes from
`rngFor(seed, 'work:'+jobId, day)`. Outcome roll:
`p = base(difficulty) + skill*0.04 + needsMod + approachBonus`. When the player
is watching and picks an approach on the ticket card, that adds `bonus`. When
nobody watches, tasks auto-resolve with no approach. Watching is optional and
only helps a little. Zero AI calls during a work day, except the optional
Friday review line.

**Worked example: IT Help Desk** (proposal; replace if `jobs.md` turns up):

```ts
// content/jobs/itHelpdesk.ts
export const IT_HELPDESK: JobDef = {
  id: 'it-helpdesk',
  title: 'IT Help Desk',
  employer: 'Honeysuckle Hollow Town Hall IT',       // Dez's town hall: free crossover
  scene: 'work:it-helpdesk',
  schedule: { days: [0, 1, 2, 3, 4], start: 8 * 60, end: 15 * 60, commute: 30 },  // matches Ch. 14
  levels: [
    { title: 'Help Desk Tech I',  wage: 18, promoAt: 8 },
    { title: 'Help Desk Tech II', wage: 22, promoAt: 12 },
    { title: 'Systems Admin',     wage: 28, promoAt: 18 },
    { title: 'IT Lead',           wage: 35, promoAt: Infinity },
  ],
  skill: 'logic',
  cast: {
    boss: 'it.marlene',          // Marlene Dupree, office manager, Dez's cousin; warm, runs on spreadsheets
    coworkers: ['it.patch', 'it.tobias'],  // Patch: unflappable senior tech; Tobias: anxious junior who escalates everything
    regulars: ['it.coachRhonda', 'it.beaumont'],  // Coach Rhonda forgets her password; Mr. Beaumont vs the printer
  },
  stream: {
    firstAt: 15, gap: [25, 55], maxOpen: 3,
    pool: [
      { id: 'pw-reset', title: 'Password reset (again)', from: 'it.coachRhonda', weight: 5, difficulty: 1,
        minutes: 10, station: 'helpdesk', perf: { great: 1.2, good: 1, ok: 0.4, bad: -0.5 },
        lines: { open: 'it.t.pw.open', great: 'it.t.pw.great', bad: 'it.t.pw.bad' } },
      { id: 'printer-jam', title: 'The printer is "possessed"', from: 'it.beaumont', weight: 4, difficulty: 2,
        minutes: 25, station: 'printer',
        approaches: [{ label: 'Clear the jam', skill: 'logic', bonus: 0.1 },
                     { label: 'Turn it off and on', bonus: 0.05 },
                     { label: 'Calm Mr. Beaumont first', skill: 'charisma', bonus: 0.12 }],
        perf: { great: 1.5, good: 1, ok: 0.4, bad: -0.6 },
        lines: { open: 'it.t.printer.open', great: 'it.t.printer.great', bad: 'it.t.printer.bad' } },
      { id: 'unplugged', title: '"The internet is down"', from: 'walkin', weight: 3, difficulty: 1,
        minutes: 8, station: 'walk:desk', perf: { great: 1, good: 1, ok: 0.5, bad: -0.3 },
        lines: { open: 'it.t.unplugged.open', great: 'it.t.unplugged.great' } },
      { id: 'phish', title: 'Suspicious "prize" email', from: 'it.tobias', weight: 2, difficulty: 2,
        minutes: 20, station: 'helpdesk', perf: { great: 2, good: 1.2, ok: 0.4, bad: -1 },
        lines: { open: 'it.t.phish.open', great: 'it.t.phish.great', bad: 'it.t.phish.bad' } },
      { id: 'projector', title: 'Projector before the 10 AM meeting', from: 'it.marlene', minLevel: 1,
        weight: 2, difficulty: 3, minutes: 30, station: 'meeting', perf: { great: 2.5, good: 1.5, ok: 0.5, bad: -1.5 },
        lines: { open: 'it.t.projector.open', great: 'it.t.projector.great', bad: 'it.t.projector.bad' } },
      { id: 'server-fan', title: 'Server room is making The Noise', from: 'it.patch', minLevel: 2,
        weight: 1, difficulty: 3, minutes: 40, station: 'rack', perf: { great: 3, good: 2, ok: 0.5, bad: -2 },
        lines: { open: 'it.t.fan.open', great: 'it.t.fan.great', bad: 'it.t.fan.bad' } },
      // … 15–25 tickets total in content/jobs/tickets/itHelpdesk.ts
    ],
  },
  review: {
    weekday: 4, aiFlavor: true,
    bands: [
      { minAvg: 1.3, stars: 5, line: 'it.review.5', raise: 1 },
      { minAvg: 0.9, stars: 4, line: 'it.review.4', raise: 0 },
      { minAvg: 0.5, stars: 3, line: 'it.review.3', raise: 0 },
      { minAvg: 0.0, stars: 2, line: 'it.review.2', raise: 0 },
      { minAvg: -99, stars: 1, line: 'it.review.1', raise: 0 },
    ],
  },
};
```

**Work day vs clock, speed, needs and Maya:**

| Concern | Rule |
|---|---|
| Leaving | At `start - commute`, Jordan's current task is cut. If a cutscene is running, departure waits for it to end. Jordan walks to the front door (`startGoto(door)`) and gets `away = { reason: 'work' }`. The commute is off-screen (`phase: 'commute'`). |
| Clock and speed | The clock never stops for work. Speeds stay 1x/3x/10x. A **Skip to 3 PM** button appears while Jordan is away. It runs the fixed step headless at 10x until `end + commute`, with no rendering (about 2,500 steps; under 50 ms on a phone). Maya's day is simulated, not faked. |
| Needs at work | Jordan uses `DECAY_AWAY` (already in `needs.ts`) and gets a free lunch at noon. If the to-do item "Pack lunch" was done, food gets +20 and $8 is saved. A low `energy`/`fun`/`hygiene` at departure lowers outcome rolls (`mods`), so home life feeds work. |
| Watching | Tap Jordan's card (or Home/Work on the floor bar) to switch the view to the workplace scene. Coworkers spawn from their schedules, Jordan's agent appears at his station, and the live ticket card shows open tickets with approach buttons. Leaving the view despawns NPCs; Jordan's agent goes back to `away`. |
| Maya's day | Free will continues at home. `GameState.dayLog` records her notable acts (repaint, rearrange, cook, garden, buy). On `work.home` a short `beat` plays: Maya greets Jordan at the door, and a card shows "While you were at work: …" from `dayLog`. An optional one-line AI greeting uses `purpose: 'greeting'` (small tier, budgeted, canned template fallback). |
| Pay | Paid at day end: `wage × hours` via `household.earn`, logged, plus an `earnedToday` update. |
| Missed work | Asleep, or a cutscene still running an hour after start: the day counts as missed (`perf -2`, no pay, and a message from Marlene). |
| Weekly review | On Friday at `end`: perf from the week's average outcome; stars, a raise or promotion when `perf ≥ promoAt`, a review card with the boss's canned line and an optional AI flavour line. Promotion is an `act.done`-style event, so life goals and the to-do list see it. |

**Maya's own job.** The code has `MAYA_WORK = 11:00–17:30 'the studio'` and
`mayaCareer.ts` (unwired). The brief says Maya stays home. Recommendation: Maya
**works from home** as a freelance designer (the `freelance` desk activity
already exists), for 3–4 hours a day at her desk, chosen by free will. She's
home while Jordan is out, and `mayaCareer.ts` gets wired to those desk hours.
This is open decision D3.

### 2.8 Daily to-do list

```ts
// daily/todo.ts
export type TodoKind = 'fixed' | 'random';
export interface TodoDef {
  id: string;
  kind: TodoKind;
  label: string;                                    // supports {partner}
  when?: Cond;                                      // e.g. workday only
  weight?: (ctx: TodoCtx) => number;                // random items: needs/season/state-weighted
  seasons?: Array<'Spring' | 'Summer' | 'Fall' | 'Winter'>;
  done: { event: GameEvent['type']; match?: Record<string, FlagValue>; count?: number };
  order?: string;                                   // CHAINS id: tapping the item sends Jordan to do it
  reward: { money?: number; bond?: number; xp?: Partial<Record<Skill, number>> };
}
export interface TodoCtx { day: number; season: string; weekday: number; workday: boolean;
  needs: Record<AgentId, CharacterNeeds>; dishes: number; laundryPile: number; dirt: number;
  lawnLength: number; fridgeServings: number; billDue: boolean }

// saved: GameState.daily
export interface DailyListState {
  day: number;
  items: { id: string; label: string; done: boolean; doneAt?: number; progress?: number }[];
  streak: number; best: number; lastFullDay: number;
}
```

- **Generated at 6:00 AM** (`clock.hour` event; also on load if `daily.day !== day`)
  with `rngFor(seed, 'todo', day)`. Fixed items: **Go to work** (workdays),
  **Dinner together** (`act.done` eat with both at the table), and **Talk with
  {partner}** (`chat.closed` with `playerLines ≥ 2`). Then 2 or 3 random items
  drawn by weight: dishes > 4 → "Do the dishes"; laundry ≥ 4 → "Laundry";
  lowest need → a matching activity; season-specific (Winter: "Light the fire";
  Spring: "Plant something"); bill due → "Pay the bill".
- **Completion is event-driven only.** No polling. Tapping an item with `order`
  runs that chain for Jordan, and the list ticks when the `act.done` arrives.
- **Rewards:** each item gives a small reward ($5–15, bond +1). All items done by
  midnight gives `streak + 1` and a streak bonus (`$10 × min(streak, 7)`). Missing
  a day resets the streak to 0. **Grace rule:** a fixed item that becomes
  impossible (power cut, a sick day) is auto-removed rather than failed.
- **UI:** a compact HUD chip ("3/5 ✓") that opens a list sheet. On phones it lives
  in the drawer's **Goals** page above the life goal.

### 2.9 Customisable classroom

The classroom is the teacher job's scene `work:school`, with
`customizable: true` and one interior level. Because looks, objects and arrange
are per scene after step 0.11, the existing paint/wallpaper/floor tabs and
Arrange work there unchanged when the viewed scene is the classroom. New pieces:
object types (`studentDesk`, `teacherDesk`, `whiteboard`, `readingRug`,
`cubbies`, `globe`, `classPlant`) as `TYPES` geometry plus `PARTS` drawing, a
`catalogFilter` so the shop shows classroom items while you view the classroom,
and the classroom looks saved under `sceneLooks['work:school']`. Who pays is
open decision D9 (recommendation: a weekly **class budget** of $60 that resets
on Monday, so the player isn't spending household money).

### 2.10 Authoring, validation and tests

**Answer: TypeScript data, not JSON.** Content files use `satisfies JobDef` (and
so on), so ids, actions and steps are type-checked. Conditions are declarative
(`Cond`), so saves only ever store ids and indices, never functions. The one
exception is `TodoDef.weight`, a pure function of `TodoCtx`. The edge function
gets a generated `supabase/functions/_shared/velvetContent.json` built by
`npm run gen:velvet-content` (static character blocks and kid policy only). A
unit test regenerates it in memory and fails if the committed file is stale.

`content/validate.ts`, `validateContent(registry): ContentError[]`, runs as a
vitest over everything:
- unique ids; every reference resolves (characters, lines, scenes, marks,
  object types, ACTIVITIES/CHAINS ids, flags set before read);
- every `say` line exists for every preset when it's `byPreset`; line length
  ≤ 220 characters; `{tokens}` are known;
- skippable scripts have an effect-only `onSkip`; every `choice` has exactly one
  `default`;
- every job has ≥ 1 task per level, valid stations in its scene, and
  monotonically increasing wages;
- **child rules:** `ageBand: 'child'` implies no `signature`, `allowedActions ⊆
  ['none','emote']`, `memory: false`, and all canned lines pass the output
  validator (§4.2).

Other test kinds:
- **Headless sim tests:** the `Game` kernel runs without DOM or art.
  `simulateDays(state, n)` makes golden assertions possible, e.g. "30 IT days
  with seed 42 produce this perf/pay", "the opening skipped equals the opening
  watched", "save → load → 3 more days equals 3 more days".
- **Live-game e2e** (step 0.7) for wiring and visuals.

---

## 3. Bridge contract and save schema

### 3.1 Transport decision

**`postMessage` only, typed, request/response with ids.** No function injection
(the legacy `__velvet.setSample` stays as a DEV/test hook only). The iframe is
same-origin, but `postMessage` keeps the game testable with a fake host page and
works the same way in the e2e harness. Origin checks stay as today
(`isValidOrigin` on the game side; `e.source === iframe` and the same-origin
check on the host).

### 3.2 Messages (protocol 2)

```ts
// bridge/protocol.ts (additions; v1 messages unchanged)
export const PROTOCOL = 2;

// game → host
export interface ReadyV2 { type: 'velvet:ready'; game: 'velvet-house'; day: number; needsProfile: boolean; protocol: 2 }
export interface ChatRequestMsg {
  type: 'velvet:chat'; id: string;                    // id = `${Date.now()}-${seq}`
  req: GameTurnRequestV2;                             // see 3.4; the host adds companionId
}
export interface ChatCancelMsg { type: 'velvet:chatCancel'; id: string }
export interface SaveMsg {
  type: 'velvet:save'; rev: number; reason: 'interval' | 'hidden' | 'exit' | 'manual' | 'restart';
  data: SaveDataV3;                                   // full save; ≤ 400 kB, enforced on the game side
}

// host → game
export interface BootMsg {
  type: 'velvet:boot'; protocol: 2;
  save: unknown | null;                               // cloud (or repaired) save; game runs migrateSave()
  source: 'cloud' | 'local' | 'none';
  budget: BudgetInfo;
}
export interface ChatDeltaMsg { type: 'velvet:chatDelta'; id: string; text: string }   // `line` text only
export interface ChatDoneMsg { type: 'velvet:chatDone'; id: string; reply: ChatReply; budget: BudgetInfo }
export interface ChatErrorMsg {
  type: 'velvet:chatError'; id: string;
  code: 'rate_limited' | 'budget' | 'unavailable' | 'refused' | 'cancelled' | 'offline' | 'blocked';
  retryAfterMs?: number; budget?: BudgetInfo;
}
export interface SavedMsg { type: 'velvet:saved'; rev: number; ok: boolean; at: number }
export interface BudgetInfo { remaining: number; limit: number; resetsAt: string }  // credits; see 4.1
```

**Boot sequence.**
1. The game loads, posts `velvet:ready {protocol: 2}`, and waits for
   `velvet:boot` for up to 4 s.
2. The host loads the cloud save (`loadVelvetHouseSave`), and if the local
   `velvet-sims:<id>` cache is newer by `(day, minutes, rev)`, uses that instead.
   It runs `repairFromV1` (§3.3) and sends `velvet:boot`.
3. Timeout or no host (standalone or dev): the game reads its own local cache and
   runs offline. Chat then uses canned lines and shows "offline".

**Chat.** The game sends `velvet:chat`. The host calls the edge function with
`stream: true`, forwards `delta` events as `chatDelta` (rate-limited to one
message per 50 ms) and then sends `chatDone`. One in-flight request per character.
A new `say` cancels the previous one (`AbortController`). The host keeps no
transcript.

**Errors and fallbacks** (game side, `chat/budget.ts`):

| Code | Game behaviour |
|---|---|
| `budget` | Canned line from `canned.fallback`, and a soft note: "{partner} is winding down for today. Talk more tomorrow." Further `say` calls for the day skip the network. |
| `rate_limited` | Canned `busy` line; retry allowed after `retryAfterMs`. |
| `unavailable` / `offline` | Canned `fallback`; one automatic retry after 3 s for `reply` purposes only. |
| `refused` / `blocked` | Canned in-character deflection ("Let's talk about something else."), no retry, and the turn is **not** added to history. |
| `cancelled` | Silent. |

**Save.** The game posts `velvet:save` every 15 s, on `visibilitychange` hidden,
on `pagehide`, and on Exit (the host sends `velvet:requestSave` before navigating,
then waits ≤ 1 s for it). The host writes the local cache immediately and the cloud
at most every 30 s (and always on exit or hidden) via
`saveVelvetHouseProgress()`. The existing dual-write produces the v1-compatible
`save_data` and the full `save_data_v2` (that column keeps its name and holds v2+).
It replies `velvet:saved`. Restart sends `reason: 'restart'`, and the host reuses
the existing restart-pending and history logic from `VelvetHouseGame.tsx`, moved
into `host/cloudSave.ts` so both pages share it.

### 3.3 Save schema v3 and migration

**Shape decision:** v3 stays **flat and additive** on top of v2, because
`toV1Compatible()` copies top-level keys into the legacy `save_data` column, and
the legacy game must keep loading it until it's retired. New feature state goes
in new top-level keys, which are added to `V2_ONLY_KEYS` so the legacy copy
stays clean.

```ts
// state/types.ts
export interface SaveDataV3 extends Omit<SaveDataV2, 'v'> {
  v: 3;
  rev: number;                                     // +1 per save; tie-breaker after (day, minutes)
  contentVersion: number;                          // bump when content ids are renamed
  // already in v2 but now actually written (fixes R1):
  LOOKS: LevelLook[];                              // house levels, length = house level count (5)
  ROOMLOOK: Record<string, LevelLook>[];           // same length
  WALLOBJS: WallObj[];
  yard: { t: number[][]; rainAt: number; rainUntil: number; rainCheck: number };
  career: { level: number; perf: number };         // kept, mirrored from jobs.jordan for legacy
  // new in v3:
  scripts: ScriptRuntime;
  daily: DailyListState | null;
  jobs: { jordan: JobSave | null };
  characters: Record<string, CharacterRuntime>;    // NPCs only; Maya stays in the flat fields
  sceneLooks: Record<SceneId, { looks: LevelLook[]; rooms: Record<string, LevelLook>[] }>;  // non-house scenes
  dayLog: { day: number; entries: string[] };
  unlocks: string[];                               // UnlockId[]: tabs, levels, jobs
  pendingCondense: string[];                       // memories waiting to be condensed (R5)
  // objs[]: ObjectInstance now has optional `scene` (absent = 'house')
}
```

**`migrateSave` chain:** `v1 → v2` (existing) `→ v3` (new). `v3` passes
through. Unknown `v > 3` → `null` and keep the old cache untouched (forward-safety).

**`migrateV2toV3(s)`:**
1. `LOOKS`: if it's a 4-entry array of `{paint|paper|floor}`, keep it and append
   the attic default. If it's empty or has character-look shape (written by the
   bug), use the house defaults and set `ext.looksLost = true`, so the host can
   repair (step 4).
2. `ROOMLOOK`, `WALLOBJS` and `yard`: the same logic (pad to 5, or default and
   flag).
3. `scripts.done`: if `settleDone || day > 1`, mark every `opening.*` and
   `tutorial.*` done. Otherwise, if `day === 1` and a sofa exists, mark
   `opening.moveIn` done and let the chapter beats resume from flags.
4. `jobs.jordan`: `{ jobId: 'it-helpdesk', level: min(career.level, 3), perf:
   career.perf, skills: jordan.skills ?? zeros, … }`.
5. `daily = null` (generated next morning), `characters = {}`, `sceneLooks = {}`,
   `unlocks` derived from `settleDone` (all tabs) and flags, `rev = 0`.

**`repairFromV1(v3, cloudV1)` (host side, once):** if `ext.looksLost` (or empty
`pets`/`yard` while v1 has them), copy `LOOKS`, `ROOMLOOK`, `WALLOBJS`, `yard`,
`pets`, `dirt`, `career` and `mcareer` from the cloud `save_data` (v1), which the
live game has never overwritten because it never synced. This recovers what R1
destroyed locally. Unit-tested with a fixture pair.

**`toV1Compatible` changes:** add the new keys to `V2_ONLY_KEYS`, filter `objs`
to `scene` absent or `'house'` (otherwise classroom desks appear in the legacy
basement), slice `LOOKS` and `ROOMLOOK` to 4, and keep `career` mirrored.

**What is in the cloud save:** everything in `SaveDataV3`. That's all player
progress, including chat turns and memories, which the memory rule says live in
the game save, and the cloud row *is* the game save. It is still never read by
the main chat, and a test enforces this: no file under `src/` outside
`services/velvetHouseDatabase.ts`, the two game pages and `host/` may reference
`velvet_house_saves`. **Device-local only:** quality tier, drawer page, camera,
wall mode preference and avatar head images (never saved). `GameState.view` is
never saved.

### 3.4 Edge function `velvet-game-turn` v2

```ts
// body (v1 bodies { companionId, input } still accepted for /velvet-house-legacy)
export interface GameTurnRequestV2 {
  v: 2;
  companionId: string;
  characterId: 'maya' | string;             // 'maya' = the player's companion
  purpose: 'reply' | 'memory' | 'condense' | 'greeting' | 'review' | 'bark';
  tier?: 'small' | 'standard';              // a hint only; the server policy decides
  companion?: { preset: string; pronoun: string; bio: string; loves: string[]; hates: string[] };  // maya only
  memory?: string;                          // maya only, ≤ 8,000 chars
  state: { day: number; minutes: number; season: string; where: Record<string, string>; recent: string[] };  // ≤ 1,500 chars total
  turns: { role: 'user' | 'assistant'; content: string }[];   // ≤ 16 (maya), ≤ 6 (npc); each ≤ 1,000 chars
  stream?: boolean;
}
// stream: text/event-stream with events  delta {text} | done {reply, budget} | error {code, retryAfterMs?}
```

Server pipeline, in order:
auth → ban check → **`moderateInput()`** on the last user turn (every
character; currently missing) → child input gate if `ageBand === 'child'` →
budget and rate check (atomic RPC) → build the prompt from the bundle → call
Anthropic with structured output and caching → (child: buffer, then validate;
adult: stream the `line` field) → record usage → respond.

For `purpose ≠ 'reply'`, the server owns the prompt template (memory extraction,
condense, greeting, review), and the client sends only the transcript or log.
Character prompts for anything except Maya are never taken from the client.

---

## 4. Model tiers and the child-safety layer

### 4.1 Model tiers, caching and budget

**One config:** `supabase/functions/_shared/modelConfig.ts` is the only file
that contains model IDs. The client and the game speak only in tiers.

```ts
export const MODELS = {
  small: 'claude-haiku-5-5',      // $0.10 / $0.50 per MTok (≤100K prompt)
  standard: 'claude-sonnet-5-5',  // $2 / $10
  premium: 'claude-opus-5-5',     // $4 / $20
} as const;
export type ModelTier = keyof typeof MODELS;
export function modelFor(tier: ModelTier): string { return MODELS[tier]; }
// kept for existing callers during the migration:
export const MODEL_CONFIG = { SONNET: MODELS.standard, HAIKU: MODELS.small } as const;
```

| Call (purpose) | Character | Tier | Effort | max_tokens | Stream | Notes |
|---|---|---|---|---|---|---|
| `reply` | Maya | small | low | 300 | yes | `standard` only if open decision D5 says so (e.g. premium subscribers). The tier is fixed for a whole conversation, because caches are model-scoped. |
| `reply` | adult NPC | small | low | 160 | yes | Daily talk cap per NPC (default 3). |
| `reply` | child | small | low | 160 | **no** | Buffered until the output check passes (§4.2). |
| `bark` | any | canned | n/a | n/a | n/a | Ambient lines are always canned and deterministic. |
| `memory` | Maya | small | low | 300 | no | At chat close, ≤ 3 facts as structured output `{facts: {text, important}[]}`. |
| `condense` | Maya | small | low | 400 | no | Memory compaction (R5). |
| `greeting` | Maya | small | low | 120 | no | Welcome home after work. Canned template fallback. |
| `review` | boss | small | low | 120 | no | Weekly, one sentence. |
| `childCheck` | child | small | low | 60 | no | The output classifier (§4.2). |
| Content authoring | n/a | premium | high | n/a | n/a | Offline dev script only (`scripts/velvet/draft-lines.ts`): drafts ticket and line pools that a human reviews and commits as data. **No runtime Opus calls.** |

- **Thinking:** Haiku 5.5 and Sonnet 5.5 think adaptively by default (Haiku 5.5's
  default effort is `medium`). For one-to-two-sentence replies, set
  `output_config.effort: 'low'` explicitly. Don't send `temperature`, `top_p` or
  `top_k`; under API version `2026-10-21` they return a 400.
- **Structured output:** `output_config.format` with a JSON schema whose first
  property is `line` (so the server can stream the `line` value as it arrives
  with a small incremental parser), then `emotion` and `action` as enums limited
  to the character's `allowedActions`.
- **Prompt caching:** the system blocks in the order of §2.6. An explicit
  `cache_control` breakpoint goes after block 4 (rules + safety + character +
  profile, all static), and a top-level automatic `cache_control` covers the
  growing message tail. The minimum cacheable prefix on the 5.5 models is 512
  tokens, and blocks 1–3 alone should exceed that for every character. Rules and
  safety are byte-identical across all users, and NPC character blocks are
  identical across users, so they cache across players. TTL is the default 5 min:
  chat bursts are seconds apart, so the 1-hour TTL's 2× write isn't worth it. The
  state line goes *only* in the final user turn, never in `system`, so it doesn't
  invalidate the cache. Usage logging records `cache_read_input_tokens` to verify
  hits.
- **Budget (server-enforced):** a new table `velvet_game_usage(user_id, day,
  credits_used, calls, minute_bucket, minute_calls)` plus an RPC
  `velvet_game_spend(p_user, p_cost) returns (ok, remaining, retry_after_ms)`
  (atomic upsert, `security definer`). Credits are estimated in micro-dollars from
  `usage` after each call. Pre-check uses a per-purpose estimate. Daily limits
  depend on the subscription tier (D4). Burst limit: 12 calls/min per user. It
  stores counts only, no content, consistent with the memory rule.
- **App-wide cleanup (separate step 0.4):** replace the hard-coded IDs in
  `velvet-game-turn`, `velvet-rope-ai`, `proactive-check-in-scheduler`,
  `eval-train`, `dream-hygiene`, `dream-fleet` (×2), `_shared/moderation.ts` and
  `generate-weekly-review` (`claude-3-5-haiku-20241022`) with `modelFor()`. Set
  `HAIKU` → Haiku 5.5. `src/services/modelSelector.ts` stops naming IDs (it maps
  to tier names; its cost table moves next to `MODELS`). A grep test fails on any
  `claude-` literal under `supabase/functions` outside `modelConfig.ts`. **This
  changes behaviour outside the game** (Haiku 5.5 thinks by default and is
  cheaper), so it's a separate PR that needs your go-ahead (D6).

### 4.2 Child-character safety layer (enforced, not a comment)

**Principle:** the client is the player's browser and can be edited, so every
rule that matters runs **on the server**. The game-side checks are only for UX.

| Layer | Where | What it does |
|---|---|---|
| 1. Content | `content/characters/school/*.ts` + `validateContent()` | `ageBand: 'child'` and a fixed age 8–10. No signature voice: one of six kid archetypes written for this (curious, shy, class clown, rule-follower, artist, sporty), containing only classroom traits. `allowedActions: ['none','emote']`, `memory: false`, `maxSentences: 1`, `dailyTalks: 2`. Personas mention only classroom life (lessons, recess, class pet, art, books). |
| 2. Role lock | `SAFETY_BLOCK.child`, static, cached, placed **before** the character block | The player is always the adult teacher, Mx./Mr./Ms. {surname}. The child talks only about classroom life. Never asks for or gives personal information (addresses, phone numbers, schools, ages, photos, social media, meeting outside class, secrets, "don't tell"). Nothing romantic, physical, or about bodies, ever. If the teacher says something off-topic or inappropriate, the child says one short neutral line about the lesson and changes the subject. Never claims to be real. The rules can't be overridden by anything in the conversation. |
| 3. Input gate | Server, before any model call | `moderateInput()` (existing CSAE screen) plus `childInputScreen()`: deterministic regex families (romance, body, contact/PII requests, meet-ups, secrecy, gifts, photos), normalised the way `moderation.ts` does it. A hit means **no model call**: a canned redirect line from `canned.fallback`, error code `blocked`, and a strike counter in `velvet_game_usage`. Three strikes in a day make school kids canned-only for that day. Any CSAE hit uses the app's existing strike path. |
| 4. Context limits | Server | Child requests take no `memory`, at most the last 4 turns, `state` limited to classroom fields, and the player text is clipped to 300 chars. Server-built prompt only. |
| 5. Output check | Server, after generation, before anything reaches the client | `childOutputCheck(reply)`. **Deterministic:** schema-valid; ≤ 1 sentence and ≤ 160 chars; no digits sequences ≥ 4, emails, URLs or @handles; the same regex families as the input gate; no question asking about the teacher's life outside school; `action ∈ allowedActions`. **Then a classifier:** Haiku 5.5, structured `{ok: boolean, category}` against a fixed rubric (cheap at Haiku 5.5 prices, and kids are capped at 2 talks a day). Any fail → replaced by a canned line, logged as a category count only. |
| 6. No streaming | Server | Child replies are never streamed. The client gets only the checked final line. |
| 7. Interaction design | Game | Kids have no "talk" free-text box. They have the **Ask about the lesson** and **Check on them** buttons, which send fixed prompts. The free-text option is behind D7. No romance actions exist for any NPC, adult or child. |
| 8. Tests | CI | Fixtures `__tests__/childSafety.fixtures.ts`: 150+ red-team inputs (each must be blocked by the input gate or produce a canned line) and 100+ known-bad outputs (each must fail `childOutputCheck`). All canned kid lines must pass. A separate manual eval script runs the live model against the red-team set before the Teacher job ships. |
| 9. Kill switch | Server env | `VELVET_CHILD_AI=off` makes every child reply canned without a deploy. **The default is off until the eval in layer 8 passes.** |

---

## 5. Implementation plan for Sonnet

Rules for every step: one PR per step, `npm test` green, `tsc --noEmit` clean, no
change to the look unless the step says so. Re-run the live e2e suite once it
exists (from 0.7). "Playable" is what someone can check by hand on a phone at
`/velvet-house`.

### Phase 0: Foundation (no new features)

| # | Step | Files touched | Tests to add | Playable at the end |
|---|---|---|---|---|
| 0.1 | **Stop the save data loss (R1).** The art exports its looks state (`exportLooks(): { LOOKS, ROOMLOOK, WALLOBJS, yard }`). `doSave` uses `state/save.ts snapshot()` (fix it: no character looks in `LOOKS`, real career/pets/dirt/skills pass-through from the loaded save for anything not yet modelled). Delete the inline copy in `main.ts`. The art reads `power`, `dishes`, `fridge` and `owned` from the frame each render. | `art/houseArt.js`, `art/houseArt.d.ts`, `state/save.ts`, `main.ts` | `save.test.ts`: paint, paper, floor, room look, wall decor and yard survive save → load; a v1 fixture with career 2 and pets keeps them after one save; a guard test that no saved key is an empty placeholder when the source had data. | Paint a room, reload: it's still painted. A legacy save keeps its career and pets after 15 s. |
| 0.2 | **Memory compaction per the design doc (R5).** `chat/memory.ts` with `remember()` and `compact(sample?)`: condense, never drop; the `pendingCondense` queue when no sampler. `persona()` uses `memoryBrief()`. | `state/companionAI.ts`, new `chat/memory.ts` | `memoryCompaction.test.ts`: caps, condense call shape, nothing lost when the sampler fails, the 8,000-char brief budget. | No visible change (chat isn't wired yet). |
| 0.3 | **Tap hit-testing at every rotation.** `world/projection.ts` (project/unproject with rotation, shared with art); `art.hitTest(sx, sy)` using the object hulls; remove `288/128` from `main.ts`. | `main.ts`, `art/houseArt.js`, new `world/projection.ts` | `projection.test.ts`: round trip for 4 rotations; the same object is hit at the same world point for each rotation. | Rotate the house; tapping the TV opens the TV actions. |
| 0.4 | **Model config consolidation** (separate PR, needs D6). `modelConfig.ts` tiers; replace literals in 8 functions; `modelSelector.ts` speaks tiers. | `supabase/functions/**`, `src/services/modelSelector.ts` | `modelIds.test.ts`: grep test, no `claude-` literal outside `modelConfig.ts`. | Nothing in the game; app chats use the new IDs. |
| 0.5 | **Bridge v2 + live companion chat (R2).** `protocol.ts` v2 messages + validators; `bridge/hostClient.ts` (game: a `SampleFn` over `velvet:chat`, cancel, timeouts); `host/chatProxy.ts` (host: fetch + SSE parse + forward); `VelvetHouseNextGame.tsx` answers chat; edge function v2 path (`purpose: 'reply'` and `memory` only for now, text plus mood-tag format kept), **`moderateInput()` added**, streaming SSE, v1 body still accepted. | `bridge/*`, new `host/chatProxy.ts`, `pages/VelvetHouseNextGame.tsx`, `main.ts`, `state/companionAI.ts`, `velvet-game-turn/index.ts` | `bridge.test.ts`: validators for every new message; `chatProxy.test.ts` with a fake fetch stream: deltas, done, each error code, cancel; an edge function test for the request-builder module (pure), v1 and v2 bodies. | **Tap Maya and talk, with streaming text.** Memories form at chat close. |
| 0.6 | **Budget and rate limits.** Supabase migration (`velvet_game_usage`, `velvet_game_spend` RPC, RLS deny-all for clients); edge function enforcement; `BudgetInfo` passed through; `chat/budget.ts` with canned fallbacks for Maya (`content/characters/maya.ts` canned lines only, for now). | `supabase/migrations/*`, `velvet-game-turn`, `chat/budget.ts`, `content/characters/maya.ts` | Pure cost-estimate and limit tests; game test: `budget` → canned line and the "winding down" note, no network call afterwards. | Talking past the daily limit gives graceful canned replies. |
| 0.7 | **E2E harness for the live game.** `playwright.config.ts` gets a `live` project: `vite build` + preview, a fake host page (`e2e/velvet-sims/host.html`) that answers boot, chat (canned) and save; `?seed=` and a test-only `__velvet` hook (`import.meta.env.DEV \|\| ?e2e=1`). | `playwright.config.ts`, `e2e/velvet-sims/*`, `main.ts` (hook) | Specs: boots and shows the main floor; switches floors; chat round trip; save → reload equality; goldens for main/basement/yard on phone portrait (390×844) and desktop. | Nothing new; the safety net is in place. |
| 0.8 | **Cloud save for the live game (R7).** `host/cloudSave.ts` (moved from `VelvetHouseGame.tsx`: restart-pending, history, rollback guard); the boot message; the game waits for boot and uses its own local key `velvet-sims:<id>`; `velvet:save` cadence; `requestSave` on Exit; **`SaveDataV3` + `migrateV2toV3` + `repairFromV1`**; `toV1Compatible` updates. | `state/types.ts`, `state/saveMigration.ts`, `services/velvetHouseDatabase.ts`, new `host/cloudSave.ts`, both game pages, `main.ts` | `saveMigration.test.ts`: v1 → v3 and v2 → v3 fixtures (including the bug-shaped v2), `repairFromV1`; `dualWrite.test.ts`: v3 → v1 copy has no new keys, `objs` filtered, `LOOKS` length 4; e2e: save → new browser context → same house. | Progress follows the player to another device; `/velvet-house-legacy` still loads the same house. |
| 0.9 | **Single source of truth for level and object data (R3).** Art imports `LEVELS`, `STAIRS`, `WALL_LIGHTS` and `TYPES` geometry; `PARTS` moved to `art/objectParts.js`; one `LEVEL_NAMES`; `time.ts` copy removed. | `art/houseArt.js`, new `art/objectParts.js`, `state/house.ts`, `state/time.ts` | `noDuplicateData.test.ts`: reads `houseArt.js` source and fails on `const LEVELS =`, `const STAIRS =`, `LEVEL_NAMES =`, or `W:` inside `PARTS`; every `TYPES` key has `PARTS` and vice versa; e2e goldens unchanged. | Identical look. |
| 0.10 | **Split `main.ts` (R4).** `core/game.ts` kernel + `core/events.ts` + `core/clock.ts` (pause reasons) + `core/rngStreams.ts`; `ui/hud.ts`, `ui/controls.ts`, `ui/input.ts`, `ui/camera.ts`; `goalsTick` becomes an event-driven `goals` system. | `main.ts` → many new files | `game.test.ts`: headless kernel ticks N days deterministically; event order test; existing tests unchanged; e2e unchanged. | Identical behaviour. |
| 0.11 | **Scene registry.** `world/types.ts`, `world/scenes/house.ts`, `world/registry.ts`, `world/navigation.ts` (grids per scene/level with sizes); `Place`; `ObjectInstance.scene?`; `Agent.scene`; art takes `scene()`; `kind` replaces `=== 3`; looks move into `GameState.looks`; the floor bar comes from the registry. **The attic as level 4** (`kind: 'attic'`, locked by `unlock: 'level:attic'`; plain interior walls first, sloped-ceiling art optional in 0.11b); a Dupree Construction catalog entry unlocks it. | `world/*`, `state/agents.ts`, `state/pathfinding.ts` (nx/ny params), `art/houseArt.js`, `ui/controls.ts`, `state/catalog.ts` | `scenes.test.ts`: registry lookups, floor bar with and without the attic, grids sized per level; a pathfinding test with a 12×9 level; the migration pads `LOOKS` to 5; e2e goldens unchanged for levels 0–3. | Buy the attic conversion; a fifth floor appears and you can walk up to it. |

### Phase 1: Events, NPCs and the script engine

| # | Step | Files touched | Tests to add | Playable at the end |
|---|---|---|---|---|
| 1.1 | **Agent split + `startGoto` + NPC agents.** `moveAgent`/`liveAgent`; `AgentId = string`; `kind`, `scripted`, `away`, `carrying`; `people` list lookups; `PersonFrame` name, carrying and bubble; `content/characters/dez.ts` (look only). | `state/agents.ts`, `core/game.ts`, `art/houseArt.js` (carry prop, name tag) | `agents.test.ts`: goto across stairs; scripted agents skip free will; NPC with `needs: null` doesn't tick; cutscene pause still moves scripted agents. | DEV hook: spawn Dez, and he walks door → entry → door. |
| 1.2 | **Script engine core** (headless). `script/types.ts`, `engine.ts`, `steps.ts`, `triggers.ts`, `skip.ts`; `ScriptRuntime` saved; `content/validate.ts` (script rules). | new `script/*`, `content/validate.ts`, `core/saveState.ts` | `scriptEngine.test.ts`: each step type; wait-until-event; choice + default; skip = onSkip end state; save mid-script → resume at checkpoint; queue and pre-emption. | Nothing visible yet. |
| 1.3 | **Cutscene UI.** `ui/letterbox.ts`, the speaker mode of the dialogue, `ui/choice.ts`, the Skip button, guided allow-list in `ui/input.ts`, the `camera` step, `outline` and `highlight` drawing. | `ui/*`, `art/houseArt.js` (outline ghost) | e2e: a test script plays; Skip works; guided mode blocks other taps. Golden: letterbox on phone portrait. | A sample cutscene plays with bars and can be skipped. |
| 1.4 | **The opening (beats 1–6).** `content/scripts/opening.ts`, `content/lines/opening.ts` + `dez.ts`; the `pbox` contents + Unpack radial; suppress couch judging and the 9:02 auto-chat until their flags. New games only. | `content/*`, `state/objects.ts` (pbox contents), `main`/systems | `opening.test.ts`: watched vs skipped end states equal; both choice branches; e2e: new game → skip → couch placed. | **A new game opens with Dez.** |
| 1.5 | **Dez delivers every purchase.** The store creates `delivery.due` events (a queue in household); the `dez.delivery` script; line pools per category with no-repeat. | `state/household.ts`, `main` shop handlers → commands, `content/scripts/deliveries.ts`, `content/lines/dez.ts` | Delivery queue tests; no-repeat pool test; e2e: buy a lamp → Dez walks it in. | Buying anything brings Dez to the door. |
| 1.6 | **Tutorial chapters 7–11** as `beat` scripts. | `content/scripts/tutorial.ts` | Per-chapter trigger and done-condition tests; headless run of the whole day 1 with scripted commands. | Day 1 through first chat. |
| 1.7 | **Tutorial chapters 12–15** (Dupree Construction, Upstairs, Rent's Due, Get 'Er Done → life goal, free will on). | same | same | The whole tutorial. |

### Phase 2: Daily to-do list

| # | Step | Files touched | Tests to add | Playable at the end |
|---|---|---|---|---|
| 2.1 | Engine + content: `daily/todo.ts`, `content/todos.ts`; generation at 6 AM; event completion; rewards; streak; saved. Starts after the tutorial (`unlock: 'todo'` from Ch. 15). | `daily/*`, `content/todos.ts`, `core/game.ts` | Generation is deterministic per seed and day; weights respond to needs and season; completion by event; streak and grace rule; save round trip. | Lists generate (DEV view). |
| 2.2 | UI: HUD chip + list sheet; tap to order; the Goals page section on phones. | `ui/todo.ts`, `ui/drawer.ts`, `ui/hud.ts` | e2e: tap "Do the dishes" → Jordan goes → it ticks; golden for the sheet on a phone. | **The daily list is live.** |

### Phase 3: Character chat engine

| # | Step | Files touched | Tests to add | Playable at the end |
|---|---|---|---|---|
| 3.1 | `CharacterDef`/`CharacterRuntime` types; Maya and Dez definitions; `validateContent` character rules; `gen:velvet-content` → `_shared/velvetContent.json` (signature voice COMMUNICATION extraction). | `content/characters/*`, `scripts/gen-velvet-content.ts`, `package.json` | Bundle-in-sync test; voice extraction test (no `RELATIONSHIP PHILOSOPHY` text in the bundle). | No change. |
| 3.2 | **Edge function v2 prompts:** server-built prompt blocks, `SAFETY_BLOCK.adult`, structured output `{line, emotion, action}`, streaming of `line`, cache breakpoints, the tier policy, all purposes (`condense`, `greeting`, `review`). | `velvet-game-turn/*`, `_shared/velvetPrompt.ts`, `_shared/modelConfig.ts` | Prompt-builder snapshot tests (block order, byte-stable static prefix), the streaming line-parser test, the tier clamp test. | Same chat, now structured. |
| 3.3 | **Maya on the engine:** `chat/characterChat.ts`; mood tag → structured reply mapping into bond, emote, want, act and pick; old turns still readable. | `chat/*`, `state/companionAI.ts` (thin), the dialogue | Reply-application tests (affinity clamp, act/pick → autonomy queue); old-tag parse kept. | Maya replies 1–2 sentences and reacts with emotes. |
| 3.4 | **NPC chat:** tap an NPC → a short exchange (Dez first): daily caps, canned greet/busy/fallback, runtime memory facts. | `ui/dialogue.ts` (NPC mode), `chat/*` | Cap and fallback tests; e2e: talk to Dez during a delivery. | Talk to Dez. |

### Phase 4: Jobs (IT Help Desk first)

| # | Step | Files touched | Tests to add | Playable at the end |
|---|---|---|---|---|
| 4.1 | Job engine (pure) + IT content (cast definitions, 20 tickets, lines, review bands). `JobSave` from the migration (step 0.8 already maps career). | `jobs/*`, `content/jobs/*`, `content/characters/it/*` | `workday.test.ts`: the task stream is deterministic; outcome odds; 30-day golden (perf, pay, promotions); a missed day; the weekly review. | No view yet. |
| 4.2 | **Commute and home integration:** leave/return, `away` needs, lunch, pay, Maya's `dayLog` + the welcome-home beat, **Skip to 3 PM**, work items on the daily list, the drawer "You" page shows title, wage and progress (replaces the `careerLevel: 0` stubs). | `jobs/commute.ts`, `core/game.ts`, `ui/drawer.ts`, `ui/hud.ts`, `content/scripts/welcomeHome.ts` | Headless: a full weekday; skip equals running at 10x; the needs-at-work curve. e2e: skip work → paycheck logged. | **Jordan goes to work and comes home paid.** |
| 4.3 | **IT office scene:** `world/scenes/itOffice.ts`, object types + parts (help desk, rack, printer, meeting table, coffee machine), coworker schedules, Home/Work view switching. | `world/scenes/*`, `state/objects.ts`, `art/objectParts.js`, `ui/controls.ts` | Scene validation; schedule spawn positions; e2e golden of the office on a phone. | **Tap Jordan at work and watch the office.** |
| 4.4 | **Ticket card + review card:** the live open-ticket card with approaches when watching; the Friday review card (canned + optional AI flavour line). | `ui/ticketCard.ts`, `ui/reviewCard.ts` | Approach bonus applied only when watching; review band selection; e2e: pick an approach. | Influence tickets, get reviewed. |
| 4.5 | Café barista (content + scene). | `content/jobs/barista*`, `world/scenes/cafe.ts` | Content validation + 30-day golden. | Second job selectable (job board in the drawer). |
| 4.6 | Gym trainer. | same pattern | same | |
| 4.7 | Animal clinic. | same pattern | same | |

### Phase 5: Child safety, Teacher, classroom

| # | Step | Files touched | Tests to add | Playable at the end |
|---|---|---|---|---|
| 5.1 | **Safety layer (server):** `SAFETY_BLOCK.child`, `childInputScreen`, `childOutputCheck` + classifier, no streaming, strikes, the `VELVET_CHILD_AI` switch (default off). | `_shared/velvetSafety.ts`, `velvet-game-turn` | Red-team fixtures (§4.2 layer 8); every canned kid line passes; the switch makes everything canned. | Nothing visible. |
| 5.2 | **Teacher job:** the classroom scene, kid roster (6–8 kids from the archetypes), lesson-task stream (deterministic: grading, reading circle, recess duty, a science fair), fixed-prompt kid interactions, review by the principal. | `content/jobs/teacher*`, `content/characters/school/*`, `world/scenes/school.ts` | Content validation incl. child rules; 30-day golden. | **Teach a class** (kids canned-only until the eval passes). |
| 5.3 | **Customisable classroom:** looks and arrange on `work:school`, the classroom catalog filter, the class budget, `sceneLooks` save. | `world/scenes/school.ts`, `state/catalog.ts`, `ui/drawer.ts`, `core/saveState.ts` | The classroom look survives a save; `toV1Compatible` excludes classroom objects; e2e golden of a decorated classroom. | **Decorate the classroom.** |
| 5.4 | Live-model child eval (manual script, results recorded in this doc); then flip `VELVET_CHILD_AI=on` with your approval. | `scripts/velvet/child-eval.ts` | n/a | AI kid lines, if approved. |

**Dependency notes.** Step 0.5 can ship before 0.8 (chat works with local
saves). Steps 0.9–0.11 must follow 0.7 (the e2e safety net). Phases 2 and 3 can
run in parallel after Phase 1. Phase 5 needs 3.2 and 4.3.

---

## 6. Risks and open decisions (ranked)

### Risks

| # | Risk | Severity | Mitigation in this plan |
|---|---|---|---|
| 1 | AI child characters say something inappropriate, or are steered into it. | Critical | §4.2: server-side layers, no streaming, a classifier, a kill switch defaulting off, red-team CI fixtures, fixed-prompt interactions. |
| 2 | Player data loss: it's already happening (R1), and the legacy/live shared key (R7) and the v3 migration add more risk. | High | Step 0.1 first; `repairFromV1` recovers from the untouched cloud v1 copy; flat additive v3; legacy dual-write kept; fixtures for every version. |
| 3 | AI cost overrun as NPCs multiply. | High | Server-enforced daily credits + burst limit; NPC barks always canned; daily talk caps per character; Haiku 5.5 at `effort: low`; caching across users for static blocks. |
| 4 | Refactor regressions with no e2e on the live game. | High | Harness (0.7) before the refactor steps (0.9–0.11); headless kernel tests; goldens on phone and desktop. |
| 5 | Changing model IDs app-wide changes other features (Haiku 5.5 thinks by default, so latency and tone differ). | Medium | Separate PR (0.4) with your sign-off; set effort explicitly per route. |
| 6 | Content volume: 5 jobs × cast × 20 tickets × lines; `jobs.md` missing. | Medium | Engine is content-agnostic; the Opus authoring script drafts pools for human review; ship jobs one at a time. |
| 7 | Phone performance with NPCs and a second scene. | Medium | NPCs only while viewed; per-scene layer cache; the quality manager already in place; a frame-time check in the e2e suite (reuse `frame-traces.spec.ts` against the live build). |
| 8 | Memory-rule leakage (game content reaching the main chat). | Medium | The edge function stores nothing; the usage table stores counts only; a test forbids `velvet_house_saves` references outside the allowed files. |

### Open decisions for you (my recommendation first)

1. **D1 Job doc.** `jobs.md` is missing. Recommend: send it if it exists; otherwise approve the IT cast and tickets in §2.7 as the starting content.
2. **D2 Attic.** It isn't built. Recommend: add it in 0.11 as a buildable level (Dupree Construction, $1,200), with plain walls first and sloped-roof art as a follow-up.
3. **D3 Maya's job.** Recommend: she works from home (freelance desk hours), so she's home while Jordan works; wire `mayaCareer.ts` to it.
4. **D4 Daily AI budget.** Recommend: free tier ≈ 40 Maya replies/day equivalent; premium ≈ 300; NPC talks count at the same rate; numbers live in one server constant.
5. **D5 Maya's model tier.** Recommend: Haiku 5.5 for everyone at launch; offer Sonnet 5.5 for premium subscribers only after an A/B on reply quality.
6. **D6 App-wide model cleanup (0.4).** Recommend: yes, as its own PR, before 0.5.
7. **D7 Teacher kids.** Recommend: ship the Teacher job with canned kid lines; turn on AI kid lines only after the manual eval passes and you approve it; keep free-text chat with kids off permanently (buttons only).
8. **D8 Unwired modules** (pets, yard, dirt, calendar, festivals, economy, sparks, wishes, shopLocks, patterns, gameState). Recommend: wire `yard` (lawn label) and `dirt` in Phase 2 as to-do sources, `pets` later, and delete `gameState.ts` (superseded by the kernel). Don't count the rest as coverage until they're wired.
9. **D9 Classroom spending.** Recommend: a weekly class budget ($60, resets Monday), separate from household money.
10. **D10 Retiring `/velvet-house-legacy`.** Recommend: keep it (and the v1 dual-write) until Phase 1 ships and the live e2e suite covers save/load; then remove the route, the legacy file and its e2e specs, and stop writing `save_data`.
11. **D11 Reply length.** You said one or two sentences for everyone. Recommend: keep that for Maya too, but allow up to 4 when the player explicitly asks for a story or an explanation (a `long` flag the client sets from the player's message).
