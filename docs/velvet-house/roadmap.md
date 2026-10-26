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
| 1. Move into the repo as modules | **Done** | `src/games/velvet-house/` (state, art, ui, engine, bridge), served by `games/velvet-house-next` |
| 2. Renderer (deferred lighting) | **Done** | `engine/gbuffer.ts`, `deferredLights.ts`, `gpuLights.ts`, quality tiers, tests |
| 3. Animation | **Done** | `art/poseAnim.js`; commits "watch them do it", clips per activity, springs, expressions, camera close-ups |
| 4. Clothing system and design generator | **Partly** | A clothing catalog, patterns on shirts, avatar heads and the Salon exist. The garment-recipe format and the design generator from the brief do not |
| 5. Gardens and the outdoors | **Partly** | Grass, weeds, rain, seasons and a garden bed in the art. No plant species, growth stages or yard decorating. The `yard`, `dirt`, `pets`, `calendar` and `festivals` modules are not wired into the live game |
| 6. Opening and tutorial | **Not started** | Design exists (`opening-sequence.md`); no script engine, no Dez, no scripted tutorial |

## Combined order

1. **Foundation** (architecture Phase 0). Step 0.1 (saves) is done. Next: the
   end-to-end harness (0.7), the bridge and cloud save (0.5, 0.8), one source
   for level and object data (0.9), splitting `main.ts` (0.10), the scene list
   (0.11).
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
| Visitors: friends and family drop by (`GUESTS`, `inviteGuests`) | Missing | Port or drop |
| Calendar, anniversary, birthday, gifts (`upcoming`, `giveGift`, Gifts tab) | Modules exist, not wired; Gifts tab empty | Port |
| Careers for both: work, reviews, promotions (`career`, `mcareer`) | Missing (stubbed to level 0) | Replaced by Jobs (architecture Phase 4) |
| Errands: going out the front door (`startErrand`) | Missing | Port or replace with Dez deliveries |
| Wishes, noticing and sparks | Modules exist, not wired | Port or drop |
| Offline catch-up and welcome-back recap (`offlineCatchup`, `showRecap`) | Missing | Port |
| Second house, The Craftsman on Elm (`moveHouse`, Homes tab) | Missing | Port or drop |
| Wall decor that hangs and slides along walls (17 types, `WALLOBJS`) | Art code exists, nothing in the shop places it | Port |
| Per-room paint, wallpaper and floor (`setLookRoom`) | Per floor only | Port |
| Shop: Today's picks, deals, rotation, locks | Missing (Today tab is empty) | Port |
| Shop: gameplay upgrades (string lights, espresso machine, 75-inch TV, chef's range, projector, memory-foam bed) | Only the attic | Port |
| Shop: Groceries (3), Gifts (5), Homes (2) tabs | Empty | Port |
| Shop depth: Paint 25 / Floors 29 / Decor 15 vs 12 / 18 / 5 | Smaller | Port the missing ones |
| Backyard gameplay (mowing, weeds, `lawnStats`, seasons, festivals) | Visuals only | Port (overhaul Phase 5) |

Ported or better in the live game: rendering and lighting, animation, 86 activities, needs
and free will, arrange (new design), outfits, avatar heads and the Salon, bills, grocery
and takeout orders, TV videos, floors/attic/storage, picture wallpapers, chat (now through
the host bridge), cloud save.
