# Velvet House: Visual & Systems Overhaul (planning brief)

> **How to use this brief:** Read all of it before planning. This is a planning
> request, not a build request. Produce the plan described in **§11** and wait
> for approval before writing code. Everything you need to know about the
> current game is in here. When something isn't covered, inspect the code
> rather than guess.

---

## 1. What this is and why we're doing it

**Velvet House** is a cozy life-sim inside the Velvet app (this repo). The
player and their AI companion live together in a house. They move in,
decorate, cook, work out, garden, pay bills and have friends over, and the
player can **talk to the companion like a real person** at any time.

The one-line pitch: **Animal Crossing meets The Sims meets companion chat.**

- **From The Sims:** you *watch your sim live*. You tell them to work out and
  you watch them run on the treadmill. You buy a shirt and you watch them try
  it on.
- **From Animal Crossing:** collecting, designing, seasons, gardens that grow,
  a shop that changes every day, and a small town with characters.
- **From Velvet:** the companion is a real conversational partner powered by
  Claude. They remember what you tell them, react to what you do, and have
  their own taste and opinions.

**Why the overhaul:** The game works and already looks *good*. The isometric
objects are believable, especially in the basement. But "good" isn't enough to
make someone come back every day. The visuals need a big step up, and above
all **the animations have to look and feel great**, because watching your sim
live *is* the game.

**The fidelity target:** Not 4K and not hand-painted. The Sims and Pokémon
sold hundreds of millions of copies at modest fidelity. We're aiming for the
spot between Pokémon's simplicity and The Sims' detail, done with more polish
than anyone expects from a browser game.

- **No hand-drawn art and no external art assets.** Everything is drawn in
  code: Canvas 2D for the art, WebGL2 for lighting and effects.
- **Lean into what code does well:** lighting, motion, variety, physics-like
  secondary motion, and endless generated variations.

---

## 2. The repo today

**Stack:** Vite 5 + React 18 + TypeScript + Tailwind, Supabase (auth,
Postgres, edge functions), deployed on Vercel (`vercel.json`). Tests use
Vitest + jsdom.

**Dependencies already installed** include `three@0.154` and `phaser`.
**Don't use either for this game** (see §5 for why).

### How Velvet House is wired

| Piece | Where | What it does |
|---|---|---|
| **The game** | `public/games/velvet-house/index.html` | **One ~4,950-line file**: inline CSS, HTML and one IIFE `<script>`. Served as a static file, no build step. |
| **Host page** | `src/pages/VelvetHouseGame.tsx` | Route `/velvet-house?companion=<id>` (registered in `src/routes/gamesRoutes.tsx`). Renders the game in an `<iframe src="/games/velvet-house/index.html">` with an Exit bar. |
| **Bridge: host → game** | `postMessage` | `velvet:profile` (player name/look, companion name/pronoun/personality/look/likes) and `velvet:vidResults` (YouTube search results). |
| **Bridge: game → host** | `postMessage` | `velvet:ready` (with `needsProfile`), `velvet:vidSearch`, `velvet:profileApplied`, `velvet:companionCreated`. |
| **Bridge: AI hook** | `window.__velvet.setSample(fn)` | The host injects a function that calls the `velvet-game-turn` edge function. The game also falls back to `window.claude.use('sample')`. |
| **Chat backend** | `supabase/functions/velvet-game-turn/index.ts` | A stateless proxy to Claude (Haiku). It uses the first `user` message as the system persona, adds the player's and companion's **profile** facts from the database, and returns `{ text }`. It stores nothing. |
| **Saves** | `localStorage['velvet-house-v1']` | `snapshot()` / `loadGame()` with schema `v: 1`. The host syncs this blob to the Supabase table `velvet_house_saves` (one row per user + companion) every 30 s and on exit. |
| **Other local keys** | `localStorage` | `velvet-newgame` (restart prefs), `velvet-drawer` (last open menu), `velvet-cam` (camera mode). |
| **Design doc** | `docs/velvet-house/opening-sequence.md` | The scripted opening, Dez the mover/mayor, the full tutorial map, and the companion memory rules. **Read it.** |

### What's inside the game file (section banners in the script)

- **Canvas and camera:** `fit()` renders at the displayed size × DPR. A
  logical 640×440 world is drawn in isometric with `iso()` / `unIso()`, and
  the view can rotate (`VR`).
- **Character looks and outfits:**
  - Tops: `topShape`, `arm`, `CLOTHES` (tee, tank, hoodie, sweater, flannel,
    blazer, denim, puffer, dress, jersey…).
  - Also hair, glasses, facial hair.
  - Clothes are currently **solid colors only**.
- **Drawing helpers:** `poly`, `box`, `rr`, `ell`, `limb`, `limb3`, and the
  per-object transform builder `makeT` (`T.box`, `T.poly`, `T.line`).
  Objects are built from 3D boxes and polygons in local coordinates.
- **The house:**
  - `LEVELS` (basement, main, upstairs, yard), rooms, walls and wall
    features (windows, doors).
  - Stairs and pathfinding (grid A*, `findPath` / `planRoute`).
  - A second house: "The Craftsman on Elm".
- **Objects:** ~90 types in `TYPES`, each with `parts` and `spots`.
  Instances live in `OBJS`, and use slots are in `SLOTS`.
- **Action engine:** `ACT` table (~60 activities, each with tags, pose,
  duration, need effects, callbacks), plus `startAct`, `tickAgent`, free
  will, queues and joint activities.
- **Economy and world:**
  - Needs, money, bills (power gets cut if unpaid), deliveries, errands,
    careers for both characters.
  - Dirt and cleaning, lights (`WALL_LIGHTS`, lamps), pets, the yard
    (grass growth, weeds, rain, mowing, garden `o.grow` 0→1).
  - Seasons and festivals, visitors and family, the calendar.
- **The companion system:**
  - **Reacting:** `noteMove` / `noteBuy` / `noteLook` → `judge()` →
    `react()` → `RL` line tables.
  - **Taste:** `TASTE` / `mayaStyle` / `styleWords()`.
  - **Autonomy:** the partner changes the house themselves (`requestAct`,
    `planAct`).
  - **Chat:** `persona()`, `stateLine()`, `talk()`, and a mood tag parser
    (`[mood=…; bond=…; emote=…; want=…; act=…; pick=…]`).
- **Memory:** three tiers (`coreMem` never-forget, `memories` recent,
  `pastMem` condensed), with AI summaries at the end of each chat, a
  compaction pass, and `memoryBrief()` capped at 8,000 characters. See §4.
- **Move-in and goals:** `startMoveIn()`, a mover NPC delivering boxes,
  `SETTLE` goals, `LIFE` goal tracks, `MOMENTS` (one-time story beats),
  discovery cards.
- **UI:**
  - A full-screen stage with HUD chips, a town sign, and an objective
    tracker.
  - A drawer with pages (Shop, Goals, Do, Partner, You, Home, Log) opened
    from a dock. The dock is a right rail on desktop and a bottom bar on
    phone.
  - A radial-ish interaction tray (`showTray`) and an RPG-style dialogue
    box.
- **Rendering:** `render()` draws walls, floors and decals, then
  depth-sorts objects and characters (`depthSort`), then front walls, then
  `lighting()`. Lighting is an offscreen canvas with radial gradients plus
  `soft-light` / `saturation` composites. Then rain and the arrange overlay.
- **Recent additions:**
  - **Watch camera:** `cam`, `camTarget`, `camTick`. It eases in on the
    sim during activities and frames the couple during chat. A toolbar
    toggle switches between Auto and Wide.
  - **A jointed pose rig:** `RIGGED`, `rigFor`, `drawRig`, `flow`, `YOGA`,
    with knees, elbows, keyframes and easing. It's used for the treadmill
    run, dumbbells and the yoga flow. **Every other activity still uses the
    old two-point limb poses in `drawStanding` / `drawSitting`.**

### Known gaps to fix along the way

- **Pronouns:** the setup form offers **they/them**, but `P()` / `heSwap()`
  only handle `he`.
- **Phone layout:** the wide isometric scene leaves empty bands on a tall
  phone screen when the menu is closed. It needs pinch/scroll zoom or a
  phone-specific framing.
- **Do menu:** its title is shown twice (the drawer title plus the section
  heading).
- **Untappable objects:** fixed objects (sink, stove, fridge) can't be
  tapped, but the tutorial needs radial menus on them.
- **Test hook:** `window.__velvet.remember` is exposed only for tests. Keep
  it behind a test or dev flag after the migration.

---

## 3. Non-negotiables

1. **Don't break existing players:**
   - Saves (`v: 1` snapshots in localStorage and in `velvet_house_saves`)
     must load. Add a versioned migration (`v: 2`, …), never a reset.
   - The host bridge messages and `window.__velvet.setSample` must keep
     working, or change in lockstep with `VelvetHouseGame.tsx`.
2. **The memory privacy rule:**
   - **In:** the profile comes in from the app (names, look, personality,
     hobbies, favorite color, music).
   - **Built in the game:** the companion's memory is built only from what
     happens in the game and lives only in the game save.
   - **Never out:** nothing from the game reaches the main companion chat.
     No memories, conversations or moments. The game doesn't emit
     memory or moment messages, and it ignores memories passed in.
3. **No external art assets.** Everything is drawn or generated in code.
   Fonts already come from Google Fonts.
4. **Graceful fallback.** With no WebGL2, or on a low-end device, the game
   runs on the Canvas 2D path that exists today, without breaking.
5. **Performance budgets:**
   - 60 fps on a mid-range laptop, ≥ 30 fps on a mid-range phone (e.g.
     iPhone 12 / Pixel 6), and the first frame in under 2 s after load.
   - Use dynamic resolution and quality tiers (Low / Medium / High) when a
     device can't keep up.
   - Pause rendering when the tab is hidden.
6. **Accessibility:** respect `prefers-reduced-motion` (cut instead of ease,
   and no camera sway). Keep every interactive element keyboard-reachable,
   keep dialogue text readable, and support light and dark themes.
7. **Mobile first-class:** touch, phone layout, safe areas. Every feature is
   designed for a 390 px wide screen as well as desktop.
8. **Behavior parity during the migration** (Phase 1 changes no gameplay).

---

## 4. The companion and memory system (keep it intact)

- **Chat:** tap the companion (or Talk) to open the dialogue box.
  - `talk()` sends `persona()` (the system prompt, which includes
    `memoryBrief()`), the last 16 turns, and `stateLine()` (the game state).
  - The AI replies in character and ends with a mood tag that drives mood,
    bond, emote, wants, autonomous acts and shop picks.
- **Memory tiers:**
  - **`coreMem`** (≤ 24): things a partner should never forget (family,
    health, people, big news, dreams, fears, promises). Past 24, the oldest
    8 are condensed into 1–3 sentences.
  - **`memories`** (≤ 30): everyday things. Past 30, the oldest 12 are
    condensed into one `pastMem` summary.
  - **`pastMem`** (≤ 8): past 8, the two oldest merge.
  - **The prompt block** is capped at 8,000 characters (the server caps the
    persona at 14,000).
- **When a chat closes,** `rememberChat()` asks the AI for up to 3 memories.
  Lines starting with `!` go to `coreMem`.
- **The last 16 chat turns** are saved with the game.
- **The companion reacts to the player's actions** (moving furniture,
  buying, repainting) through `judge()` / `react()`, and has a shuffled
  personal taste. New systems (clothing, gardens) must **plug into this**:
  the companion should notice and react to outfits, designs and the garden.

---

## 5. Phase 1: Move the game into the repo as modules

**Goal:** turn the single HTML file into a typed, modular, testable game in
the Vite build. **Players see no behavior change.**

**Target shape** (adjust if you find a better split, and justify it):

```
games/velvet-house/index.html          ← Vite multi-page entry (the iframe URL stays /games/velvet-house/index.html)
src/games/velvet-house/
  main.ts                              ← boot, loop, bridge wiring
  state/          (single typed game state, save schema + migrations, seeded RNG)
  world/          (levels, rooms, walls, features, houses, pathfinding)
  objects/        (object types, parts, spots/slots, catalog)
  sim/            (action engine, needs, free will, economy, bills, deliveries, errands, careers, seasons, visitors, pets, yard, dirt)
  companion/      (persona, chat, mood tags, judge/react, taste, autonomy, memory tiers)
  story/          (move-in, goals, life goals, moments, opening/tutorial scene runner)
  render/
    canvas2d/     (the existing drawing code: helpers, objects, walls, floors, characters)
    gpu/          (Phase 2)
    camera.ts, depthSort.ts
  characters/     (looks, rig, poses, animation clips, clothing renderer)
  ui/             (stage HUD, tracker, drawer + dock, shop, dialogue, radial menu, setup, cards). Plain TS + DOM, or React. Pick one and justify.
  bridge/         (host postMessage protocol, typed)
  styles/         (game CSS)
```

**Requirements:**

- **Build setup:**
  - Add the game as a second Rollup input in `vite.config.ts`
    (multi-page), so dev and prod both serve `/games/velvet-house/index.html`.
  - Confirm that Vercel serves the built file ahead of the SPA rewrite in
    `vercel.json`.
  - Then delete `public/games/velvet-house/index.html`.
- **One state object:** replace the IIFE's ~280 loose `let`/`const`
  globals with a single typed state object, and make `snapshot()` /
  `loadGame()` work against it.
- **Typed save schema:** add `v: 2` with a migration from `v: 1`, and test
  it against a real v1 fixture (capture one from the current game).
- **Seeded RNG for tests:** `Math.random` is used everywhere. Route it
  through an injectable RNG so tests and screenshot comparisons are
  deterministic.
- **Tests (Vitest)** for the pure logic: save migration, memory compaction
  and budget, pathfinding, `judge()` outcomes, needs ticking, pattern-recipe
  determinism (from Phase 4), and the bridge message validation.
- **Visual parity check:**
  - Add Playwright (Chromium is available) and script golden screenshots of
    fixed scenes (each floor, day and night, arrange mode, dialogue open,
    phone and desktop) with the seeded RNG.
  - Phase 1 is done when they match the pre-migration game.
- **Keep the bridge contract unchanged:**
  - The game posts its messages to `window.parent` with `targetOrigin: '*'`
    today. Tighten that to the app's origin.
  - Accept `velvet:profile` only from the parent origin.
- **Size:** keep the game a separate lazy chunk. Don't bloat the main app
  bundle.

---

## 6. Phase 2: Renderer upgrade (hybrid deferred lighting)

**Don't rewrite the art.** The Canvas 2D drawing code *is* the art style and
it's good. Add a WebGL2 lighting and effects layer on top of it. **Every
Level 1 feature (animation, juice, camera) applies regardless, and so does
every Level 2 feature below.**

**Approach:**

1. **Albedo pass:** the existing Canvas 2D renderer draws the scene (no
   lighting) into an offscreen canvas, uploaded as a texture.
2. **Data pass (G-buffer):** the same draw calls run in a "data mode"
   where `T.box` / `T.poly` / walls / floors fill with encoded values
   instead of paint:
   - **Height** above the floor.
   - **Surface normal:** top, left face or right face, which the box faces
     already know.
   - **Material ID:** matte, wood, glass, metal, fabric-sheen, screen, water.
   - **Emissive:** lamps, screens, lit windows.

   Characters render as billboards with a vertical height ramp and a "body"
   material. Every object is built from known 3D boxes, so this should be
   cheap. Confirm by spiking it.
3. **WebGL2 composite shaders:**
   - **Lighting:** ambient plus a sun or moon whose direction and color
     follow the in-game clock, season and weather, plus point lights from
     `WALL_LIGHTS` and lamps (warm pools at night).
   - **Soft shadows:** screen-space shadows that ray-march the height map
     toward each light, for soft contact shadows under furniture and people
     and shadows cast by lamps.
   - **Ambient occlusion** in corners and under furniture.
   - **Light through windows:** sun patches on the floor that move during
     the day, and visible light shafts with dust motes.
   - **Bloom** on lamps, screens, candles, party lights.
   - **Color grade:** a tone curve by time of day (golden morning, neutral
     day, warm-to-cool evening, moody night) and by season (snow-bright
     winter, warm summer).
   - **Weather:** rain streaks and droplets running down window glass, wet
     sheen on the yard and puddles, snow accumulating outside.
   - **Depth of field** during conversations and try-on moments: the
     background blurs, the characters stay sharp.
   - **Material looks:** sheen on satin and leather, gloss on wood floors
     and tile, a screen glow.
4. **GPU particles:** dust puffs, steam (shower, cooking, coffee), water
   splashes, sparkles, leaves, snow, rain, sweat. A pooled system with
   thousands of particles at low cost.
5. **The camera works in screen space:** the watch camera zooms by
   rendering at the zoomed resolution (vector art stays sharp, never upscaled
   bitmaps), and the shaders work at any zoom.
6. **Quality tiers and fallback:**
   - **High:** everything on.
   - **Medium:** half-resolution lighting and no DOF.
   - **Low:** the Canvas 2D path that exists today.
   - Detect the tier automatically from frame time, and let the player
     override it in settings.

**Proof slice (do this before going wide):** the **basement** fully lit:
soft shadows, the fluorescent tube, a window with rain, day-to-night
grading, dust motes in the light. Present screenshots at four times of day,
and frame-time numbers on desktop and phone, before rolling out to every
floor.

---

## 7. Phase 3: Animation that feels good (the most important phase)

Watching your sim live is the game. Every animation should feel weighted,
readable and alive.

**Rig and clips:**

- **Expand the existing rig** (`rigFor` / `drawRig`: hips, knees, feet,
  shoulders, elbows, hands, torso lean, a front-facing fold) into a proper
  clip system:
  - **Keyframes** with easing curves per segment (ease-in/out, overshoot,
    anticipation).
  - **Crossfades** between clips (≈ 150–250 ms) so poses never pop.
  - **Additive layers:** breathing, look-at, emote.
  - **Root motion** for walking.
- **Head look-at:** the head turns toward the TV, the partner, a talker or
  the player's tap.
- **Faces:**
  - Blinks with natural timing (with a double-blink now and then), plus
    eye darts.
  - Mouth shapes driven by the typing text in dialogue.
  - Expressions from the mood tag: happy, playful, neutral, tired, annoyed,
    sad.
- **Secondary motion:** hair sway, dress and skirt hems, hoodie
  drawstrings, sleeve ends, a ponytail bounce. Use simple spring physics.
- **Walking:** a real walk cycle with weight shift, arm swing, and stride
  matched to speed. Make starts and stops feel deliberate (no sliding), and
  add a turn-in-place step.
- **Idle life:** never freeze. Add a library of idle fidgets (stretch,
  check phone, shift weight, scratch head, look around) picked by mood and
  need.

**Move every activity onto the rig** (there are ~70 in `ACT`). Each one needs
a readable loop and, where it fits, a start and end transition:

- **Cooking:** chop, stir, taste, plate.
- **Eating,** **coffee:** pour, sip.
- **Showering:** lather, rinse, steam.
- **Sleeping:** turning over, breathing.
- **Reading:** page turns.
- **TV:** reacting.
- **Dancing:** several styles, plus partner dancing.
- **Cleaning:** a mop sweep, scrubbing a wall.
- **Dishes:** splashes.
- **Laundry.**
- **Yard work:** mowing, raking, weeding, watering.
- **Gardening:** kneel, dig, plant, harvest.
- **Hobbies:** piano with alternating hands, guitar strumming, painting at
  the easel with brush strokes, arcade.
- **Workouts:** treadmill, weights, yoga, boxing combos, the bike.
- **Pets:** playing with and petting pets.
- **Phone:** scrolling.
- **Desk:** typing.
- **Unpacking:** cut the tape, lift, place.
- **Painting walls:** a roller sweeping, with the new color revealing stroke
  by stroke.
- **Carrying:** boxes and groceries.

**Juice (world reactions):**

- **Furniture:** squash and stretch when placed, a dust puff when a box
  hits the floor, a soft bounce when it appears.
- **Doors** open and close.
- **Lights** fade on and off instead of switching.
- **Water** splashes at the sink and shower.
- **Steam** from cooking and showers.
- **Leaves** blowing in the yard.
- **Floor changes** dip and crossfade, and the rotate-view uses a short
  crossfade.
- **Dez the mover:** the box sways in his arms as he walks.
- **Screen shake:** very subtle, and only for big moments (none with
  reduced motion).

**Camera language:**

- Extend the existing watch camera with shot types: wide, activity
  close-up, two-shot for conversations, a mirror shot for try-ons, and a
  reveal for "room finished".
- Add pinch and scroll zoom with inertia.
- On phone, use smart framing so the tall screen isn't empty bands.

**Character fidelity:**

- Draw characters slightly larger and with more detail at close zoom: fabric
  fold shading bands, highlight and shadow on the face and hair, soft
  outlines.
- Keep the current proportions and charm. This is a polish pass, not a new
  style.

**Bar for "done":** for each activity, a short screen recording (or a frame
strip) that a non-developer would describe as "cute" or "satisfying", with no
popping, sliding or frozen frames.

---

## 8. Phase 4: The clothing system and the design generator

The goal is that players *want* to try different combinations and keep coming
back for new pieces.

**Every garment is a recipe, not a picture.** A recipe is a small,
deterministic JSON object that the renderer draws live on the body:

```ts
type Garment = {
  v: 1;
  slot: 'top' | 'bottom' | 'dress' | 'outer' | 'shoes' | 'hat';
  cut: string;            // e.g. tee, tank, crop, button-up, hoodie, sweater, cardigan, jacket, blazer, dress; slim/straight/wide/cargo jeans, shorts, skirt
  fabric: string;         // cotton, denim, knit, flannel, corduroy, linen, leather, satin, fleece, puffer
  base: string;           // hex
  pattern?: {
    kind: string;         // stripes, pinstripe, plaid/tartan, gingham, polka, floral, camo, tie-dye, checker, argyle, leopard, zebra, color-block, graphic
    colors: string[];     // 1–3 hex
    scale: number; angle: number; density?: number; seed: number;
    layer2?: Omit<Garment['pattern'], 'layer2'>;   // one optional overlay
  };
  details?: { pocket?: boolean; buttons?: boolean; cuffs?: 'rolled' | 'contrast'; distress?: number; wash?: number /* denim 0 raw … 1 light */; drawstring?: boolean };
  tags: string[];         // style words the companion's taste system understands (cozy, bold, vintage, minimal, luxe, playful, natural, …)
  rarity: 'common' | 'uncommon' | 'rare' | 'one-of-a-kind';
  name: string;
};
```

**Rendering:**

- **Patterns follow the body.** Each body segment (torso, upper arm,
  forearm, thigh, shin) gets the pattern mapped in its own frame, so stripes
  rotate with the arm during curls and plaid bends at the elbow.
- **Fabric looks:**
  - Denim: wash, fade at the thighs and knees, whisker lines, seam stitching.
  - Knit: a visible weave. Corduroy: ridges. Flannel: a soft brushed look.
  - Leather and satin: the sheen comes from the Phase 2 material ID.
- **Movement:** cloth motion uses the Phase 3 secondary-motion springs
  (hems, drawstrings).
- **Performance:** the same recipe always renders the same. Cache pattern
  tiles.

**The generator:**

- A seeded generator produces endless, tasteful designs: curated palettes,
  pattern rules that avoid ugly combinations, and rarity weighting.
- Every recipe validates against a schema, with values clamped.

**Where designs come from:**

- **Daily boutique:** a fresh rotating selection with rarity tiers, like
  Animal Crossing's tailor shop. Dez delivers orders (see the opening doc).
- **Design studio:** the player builds their own. Pick a cut, fabric and
  pattern, set colors, scale and angle, add a second layer and details. A
  live preview shows it on their own sim, animated.
- **"Describe it":**
  - The player types a phrase ("70s sunset over the ocean", "cozy cabin
    flannel", "something that matches my partner") and gets a garment back.
  - Use `velvet-game-turn` with a dedicated prompt that returns **only a
    recipe JSON**. Validate it, clamp it, and render it instantly.
  - It's cheap: a few hundred tokens and no image generation.
  - Rate-limit it, and handle refusals or failures with a friendly fallback
    (a generated random design).
- **Share codes:** a recipe packs into a short code (base64url plus a
  checksum, e.g. `VH-7K2Q-…`) that anyone can type into the studio. It's
  offline-safe, with no server needed.

**The companion connection** (what nobody else has):

- Recipes carry style tags, and the companion's existing taste
  (`mayaStyle`, `TASTE`, `styleWords`) scores them.
- They react to outfits through the `judge()` / `react()` pipeline: when the
  player changes clothes, buys or designs something, and when they see it for
  the first time that day.
- The companion can design something for the player as a gift, using their
  taste plus "describe it" from their own perspective.
- They can make outfit requests for dates or festivals.
- Outfit reactions feed memory through the existing tiers ("loved the
  green plaid on date night").

**Try-on moment:**

- Opening the boutique or a closet starts a mirror scene: a camera
  close-up, the sim turns and strikes a short pose, the partner comments.
- Then the player buys or keeps it, and saves the combination as an outfit.
- Outfits can be tied to occasions (everyday, work, workout, sleep,
  date, party, season). Sims change automatically when the activity calls
  for it.

**Bottoms and jeans** get the same depth: color, wash, fit (slim, straight,
wide, cargo), rolled cuffs, rips. Shoes get a few cuts and colors.

**Migration:** existing `CLOTHES` items and saved outfits (`closet`,
`wearOn`) convert to recipes in the save migration.

---

## 9. Phase 5: Gardens and the outdoors

- **Plants:** species such as tomatoes, peppers, herbs, strawberries,
  sunflowers, roses, tulips, lavender, a fruit tree, and hedges.
- **Growth stages,** each drawn distinctly: seed → sprout → leaves → bud →
  bloom → fruit → harvest → wilt.
- **Life:**
  - Wind sway with a gust system, and seasonal looks (spring blossoms,
    summer full, autumn color, winter dormant or snow-covered).
  - Watering darkens the soil, and rain fills puddles.
  - Bees and butterflies at blooms.
- **Planting and harvesting** use the rig (kneel, dig, plant, water,
  harvest with a basket). Harvests stock the fridge, as the garden does now.
- **Yard decorating:** plant placement, paths, planters, string lights at
  night (bloom from Phase 2).
- **The companion has favorite flowers** (from their taste) and reacts to
  the garden.

---

## 10. Phase 6: The opening and the tutorial

Implement `docs/velvet-house/opening-sequence.md` on top of the new systems.
It covers:

- **The cold open:** the couple is waiting for the movers.
- **Dez Dupree:** the mayor, mover and owner of the food-delivery service and
  the construction company. His catchphrase is "Get 'er done!". He delivers
  everything the player buys in the store.
- **The player-named town.** It's shown on the stage at all times; this is
  already built.
- **Tapping and radial menus:** objects open a radial menu with 1–4 options
  that change with state. The sink, for example, offers Wash dishes, Run
  water / Turn off water, and Fill a glass.
- **Placement:** guided furniture placement with a target outline.
- **The first choice:** the companion asks for the couch to be moved, and
  the player either keeps it or moves it. Each answer gets its own
  personality-voiced reply in four voices (warm, calm, bubbly, dry), and
  the choice is remembered.
- **Chapters 7–15** of the tutorial.

**Systems it needs:**

- **A scene runner** with beats: walk, say, face, emote, wait, spawn,
  camera, choice.
- **Pokémon-style dialogue:** tap to advance, a name plate, a ▼ indicator.
- **The radial menu,** a canvas spotlight, and a ghost footprint for target
  placement.
- **Scripted watchers** layered on top of `judge()`.
- **Voice tables** with `voiceOf()`, which maps free-text personalities from
  the app onto the four voices.
- **Proper they/them support.**

---

## 11. What I want back from you (the plan)

Plan in max detail. **Don't write code yet.** For each phase, give me:

1. **Scope and order:** tasks broken down to file- and module-level, with
   dependencies. Mark which tasks can run in parallel.
2. **Technical design:**
   - Key types and interfaces (the state shape, render pipeline interfaces,
     the animation clip format, the garment recipe and generator, the bridge
     protocol).
   - The shader list with inputs and outputs, and the data-pass encoding.
3. **Risks and spikes:**
   - What must be proven first, and how. At minimum: the G-buffer data
     pass, the phone frame rate, pattern mapping on limbs, and save
     migration.
   - A fallback plan for each risk.
4. **Verification:**
   - The golden screenshots and recordings you'll capture.
   - Performance measurements on desktop and phone.
   - Tests added.
   - The definition of done for each phase.
5. **Migration and rollout:**
   - How existing saves and the host bridge stay working.
   - A feature flag or quality-tier rollout, and how to roll back.
6. **Estimates:** relative size per task (S/M/L/XL).
7. **Open questions** for me. Ask before assuming on anything that changes
   the product.

**Order of work** (change it only with a good reason):

1. Phase 1: migration.
2. The Phase 2 proof slice (the lit basement).
3. Phase 3, starting with the rig, the clip system, walk, idle and faces.
4. Phase 4: clothing.
5. Phase 2: full rollout.
6. Phase 5: gardens.
7. Phase 6: opening and tutorial.

**Quality bar:** the player opens the game and *feels* it before they read
anything:
- the light through the window, the way their sim breathes and blinks;
- the satisfying thud and dust when a box lands;
- the companion turning to look at them.

Plan for that.
