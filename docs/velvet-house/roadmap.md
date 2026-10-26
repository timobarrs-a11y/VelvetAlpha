# Velvet Sims: one roadmap

Two plans exist and they overlap. This page puts them in one order.

- **The overhaul brief:** `bolt-overhaul-prompt.md`. Six phases: modules,
  renderer, animation, clothing, gardens, opening. It is a visual and systems
  upgrade of the existing game.
- **The architecture plan:** `architecture-plan.md` (written by Opus). Foundation
  fixes, then the script engine, daily list, character chat, jobs and the
  classroom.

The overhaul's Phase 6 (the opening and tutorial) *is* the architecture plan's
Phase 1 (script engine and Dez). Everything else in the architecture plan is
new scope that the overhaul brief never covered.

## Where the overhaul stands (checked against the code)

| Overhaul phase | Status | Evidence |
|---|---|---|
| 1. Move into the repo as modules | **Done, with two things left** | `src/games/velvet-house/` (state, art, ui, engine, bridge, plus `kernel`, `systems`, `view`, `dev` since the `main.ts` split), served by `games/velvet-house-next`. Typed save with migrations tested against a v1 fixture, seeded RNG (looks and dirt now draw from it too), Vitest on the pure logic, host messages checked and posted to the app's origin, a separate lazy chunk, live e2e (`npm run test:live`, 22 tests) and golden screenshots (`npm run test:visual`). **Left:** the legacy game is still served at `/velvet-house-legacy` until the parity checklist below is clear (the brief said delete it); the screenshots were taken after the animation work, not before the move, so they guard against regressions from here, not parity with the old game |
| 2. Renderer (deferred lighting) | **Done** | `engine/gbuffer.ts`, `deferredLights.ts`, `gpuLights.ts`, quality tiers with automatic detection and a player override. Soft shadows, ambient occlusion, window beams, bloom, time-of-day and season grade, wet yard, snow, material sheen, dust motes and pooled particles. Added in the gap pass: depth of field while Maya and the player talk (high quality only, a cheap shrink-and-stretch blur with a clear hole around Maya) and rain droplets sliding down window glass. Frame times (`npm run test:perf`, measured in a cloud container with **no GPU**, so a worst case): phone-size view, auto 22.6 ms (44 fps), high 38.5 ms (26 fps), medium 22.4 ms, low 16.7 ms (60 fps); desktop-size view, high 273 ms and medium 128 ms in software, low 16.9 ms. Quote real numbers only from a run on a real device |
| 3. Animation | **Done and extended by PR #48; two gaps left** | `art/poseAnim.js`: 30 activity clips on top of 31 poses, springs for hair and hems, blinks and eye darts, look-at, expressions from needs, idle fidgets, close-up and two-shot camera. Added in the gap pass: a drag that ends while moving glides on, a short screen shake for big moments (attic built, tutorial finished; none with reduced motion), a close-up on the player when trying something on, and a pull-back with sparkles when a room is repainted or refloored. **Left, inside the animation code another agent is changing:** a crossfade between clips when the pose changes, and a turn-in-place step |
| 4. Clothing system and design generator | **Took a different route (PR #48)** | Instead of garment recipes, the game now wears the avatar app's own wardrobe: separate shirts, pants and hats that mix and match, personas (a whole look in one tap), full-body sprites (`state/bodySprites.ts`, `renderers/bodyRenderer`, `handRenderer`, `outfitRenderer`), six new shirts, four hats, pants and six personas, with migration `20261028120000_wardrobe_pants_personas.sql`. The garment-recipe format and the design generator from the brief are not built. **Decision: still wanted** (see Design Studio below) |
| 5. Gardens and the outdoors | **Partly** | Grass, weeds, rain, seasons and a garden bed in the art. No plant species, growth stages or yard decorating. The `yard`, `dirt`, `pets`, `calendar` and `festivals` modules are not wired into the live game |
| 6. Opening and tutorial | **Not started** | Design exists (`opening-sequence.md`); no script engine, no Dez, no scripted tutorial |

## Combined order

1. **Foundation** (architecture Phase 0). Steps 0.1 (saves) and 0.7 (the live
   end-to-end harness, `npm run test:live`, no reference screenshots yet because
   the animation work is still changing the look) are done. Steps 0.5 and 0.8
   are done in part:
   - **Done:** server-side moderation on every reply; a daily reply allowance
     (migration `20261027130000_velvet_game_budget.sql`, 40 free and 300 paid;
     apply it before deploying the function, which fails open if it is missing);
     in-voice canned replies when the AI can't answer; save v3 (`rev`,
     `contentVersion`, looks-lost detection, `repairFromV1`); the live game's own
     save slot (`velvet-sims:<id>`, carried across from the old slot on first
     run); the newer of the cloud and local save wins; and the legacy copy drops
     the attic so the old game still loads it.
   - **Deferred:** the full typed bridge v2 (streaming replies, boot and save
     messages), server-built prompts and structured replies, prompt caching, and
     the additive v3 keys for scripts, daily list and jobs (each arrives with its
     feature).

   Steps 0.2 (memory is condensed, not dropped), 0.3 (taps follow the rotation), 0.4 (model IDs in one place), 0.9 (one source for level and object data), 0.10 (`main.ts` split into modules) and 0.11 (the scene list) are done. Foundation is complete apart from the deferred bridge v2 items above.
2. **Overhaul Phase 6 = architecture Phase 1:** script engine, NPCs, the Dez
   opening, deliveries, tutorial chapters 7-15.
3. **Architecture Phase 2 and 3 in parallel:** daily to-do list; character chat
   engine (Maya first). Wire `yard` and `dirt` here as to-do sources, which also
   advances overhaul Phase 5.
4. **Overhaul Phase 5 (gardens)** where it supports the daily list: plant
   species and growth, planting and harvesting animations, yard decorating.
5. **Architecture Phase 4:** jobs, IT Help Desk first, then the office scene.
6. **Overhaul Phase 4 (garment recipes and generator)** as a separate art track
   that can run alongside steps 3 to 5. Work outfits for each job are a natural
   first use.
7. **Architecture Phase 5:** child-safety layer, Teacher job, classroom.

## Rules that apply to everything

- The overhaul's non-negotiables (§3 of the brief) stay in force: everything
  drawn in code, no external art, phone-first, the companion and memory rules
  intact.
- The architecture plan's per-step rules stay in force: one PR per step, tests
  green, no change to the look unless the step says so.

## Legacy parity checklist (what must be true before `/velvet-house-legacy` is removed)

Checked against the legacy game (`public/games/velvet-house/index.html`, 72 activities,
92 object types, 17 wall-decor types, 209 shop items) and the live game. For each missing
item: port it, or write down that it is dropped on purpose. Delete the legacy game only
when every row is "ported" or "dropped".

| Legacy system | Live game | Decision |
|---|---|---|
| Maya reacts to what you move, buy and wear (`judge`, `react`, `noteMove`, `noteBuy`) | Missing | Port (the core "she has taste" loop; also needed by the opening) |
| Maya changes the house herself, proposals, undo (`requestAct`, `planAct`, `undoChange`) | Missing (chat parses an `act` tag but only logs it) | Port |
| Move-in day: mover brings boxes, unpacking | Missing (starts furnished) | Replaced by the Dez opening (architecture Phase 1) |
| Pets: adopt, feed, litter, play (`adoptPet`, `PETS`) | Missing (4 shop items, no logic) | Port |
| Dirt and cleaning (`DIRT`, `scrubTarget`) | Module exists, not wired | Port (daily-list source) |
| Visitors: friends and family drop by (`GUESTS`, `inviteGuests`) | Missing | **Dropped** (decided) |
| Calendar, anniversary, birthday, gifts (`upcoming`, `giveGift`, Gifts tab) | Removed (`calendar.ts`, its tests and the Gifts tab deleted) | **Dropped** (decided) |
| Careers for both: work, reviews, promotions (`career`, `mcareer`) | Missing (stubbed to level 0) | Replaced by Jobs (architecture Phase 4) |
| Errands: going out the front door (`startErrand`) | Missing | **Port, redesigned:** a way to get someone out of the house for a short, unseen trip. Unlike a job you can't watch it; they come back at a random time, and it never takes long (target: about 30 to 90 game minutes) |
| Wishes, noticing and sparks (Maya's initiative: she asks for things, comments on what you do, starts conversations) | Modules exist, not wired | **Port** (recommended; see explanation below). Feeds the daily list and chat engine |
| Offline catch-up and welcome-back recap (`offlineCatchup`, `showRecap`) | Missing | Port |
| Second house, The Craftsman on Elm (`moveHouse`, Homes tab) | Missing | **Dropped** (decided): replaced by a house-upgrade plan. The empty Homes shop tab stays until that plan is built |
| Wall decor that hangs and slides along walls (17 types, `WALLOBJS`) | Art code exists, nothing in the shop places it | Port |
| Per-room paint, wallpaper and floor (`setLookRoom`) | Per floor only | Port |
| Shop: Today's picks, deals, rotation, locks | Missing (Today tab is empty) | Port |
| Shop: gameplay upgrades (string lights, espresso machine, 75-inch TV, chef's range, projector, memory-foam bed) | Only the attic | Port |
| Shop: Groceries (3), Gifts (5), Homes (2) tabs | Empty | Port |
| Shop depth: Paint 25 / Floors 29 / Decor 15 vs 12 / 18 / 5 | Smaller | Port the missing ones |
| Backyard gameplay (mowing, weeds, `lawnStats`, seasons) | Visuals only | Port (overhaul Phase 5) |
| Seasonal festivals (four one-line events; the Holiday one depended on gifts) | Module exists, not wired | **Replaced** by mayor-run town events with a small objective (for example Dez hosts a Leaf Day cleanup: rake the yard before 5 PM for money and a Maya reaction). Later, after the opening and the yard work. The "Spring is here" season-change messages stay as flavour |

Ported or better in the live game: rendering and lighting, animation, 86 activities, needs
and free will, arrange (new design), outfits, avatar heads and the Salon, bills, grocery
and takeout orders, TV videos, floors/attic/storage, picture wallpapers, chat (now through
the host bridge), cloud save.

## What wishes, noticing and sparks are

Together they are how Maya acts like a person with her own moods, not a menu.
They are cheap: the triggers are plain rules, and the AI is used only for the
conversation that follows.

- **Wishes:** Maya wants something small and says so ("Maya yawned and eyed the
  coffee maker"). It lasts about two hours. If you do it with her (make her
  coffee, dance with her, watch TV together), she's happier, the bond goes up
  and she remembers it. If you ignore it, it fades. These are tiny objectives.
- **Noticing:** Maya reacts to what you have been doing or how the house is. The
  rules are things like "showered and cooked breakfast before work", "glued to
  the TV for hours", "dishes piling up", "fridge empty", "power cut", "the lawn
  is a jungle", "the pet is starving". She walks over and brings it up, and the
  chat opens with that topic.
- **Sparks:** every game hour there is a chance she starts a conversation on
  her own, picked from a weighted list by the situation (morning means coffee,
  evening means TV or dancing, low money means a money check, rain means
  rain, plus small talk like a toast, her plant, or a call from her mom).

## Decisions still open


## After PR #48 (merged to `main`)

The avatar and animation work landed on `main` while the Sims branch was in progress. It was merged
into the Sims branch with four conflicts, all resolved by keeping both sides:

- `bridge/protocol.ts`: the AI-turn messages (`velvet:sample*`) and the avatar look messages
  (`velvet:avatarLook`, `bottom` and `hat` on `velvet:lookChanged`).
- `VelvetHouseNextGame.tsx`: the host answers AI turns and restarts, and also sends the wardrobe and
  saves shirt, pants and hat changes to the avatar.
- `ui/drawer.ts`: the You page uses the animation work's own rebuild guard (it only rebuilds the
  wardrobe when it changes); every other page uses the shared `put()` guard.
- `main.ts` and `state/save.ts`: one serializer, now also carrying `bottomStyle` and `bottomAccent`;
  wardrobe items (`w-` ids) come from the host each time and are not saved.

Effect on the plan: none of the architecture steps change. Two notes:
- The avatar wardrobe makes work outfits for each job (step 4.1 onwards) mostly a content job, not a
  rendering job.
- The worn hat is not saved; the host sends it at boot.

## Design Studio (overhaul Phase 4, kept)

The idea, in the style of Animal Crossing custom designs: players make their own patterns and
apply them to clothes, floors, wallpaper and rugs, and share them.

- **Recipes (procedural):** a small data object (cut, fabric, base colour, pattern kind and
  colours) the game draws live. Cheap, no moderation problem, and it is what the brief asked
  for. Floors and wallpaper already work this way (`FLOORS` and `PAPERS` in the art).
- **Pixel designs (player-made):** a small grid (for example 32 by 32, up to 16 colours) painted
  in an editor, stored as a short code, and applied as a texture: tiled on a floor, hung on a
  wall (the picture-wallpaper code already maps an image onto a wall), or wrapped on a shirt.
- **Sharing:** a design code that can be pasted into a message (the messaging system exists), with
  friends-only first. A public gallery is the last step and needs moderation and reporting before
  it opens, because player-made images can be offensive.
- **Order:** recipes first, then the pixel editor with private and friends-only sharing, then a
  public gallery.
