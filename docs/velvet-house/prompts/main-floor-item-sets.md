# Prompt: themed item sets for the main floor

Copy everything below the line into a new session. It is written for an agent working in this repository; the facts
in it were checked against the code on 2026-10-27.

---

You are working in the Velvet Sims game (`src/games/velvet-house/`). Read `CLAUDE.md` first.

## Why this work exists

The house is small. Most pieces have one good spot (the fridge, the counter, the dining set, the TV unit), so the
player cannot express themselves by moving things around. The director's decision: the trade-off is **content
diversity**. Every common main-floor piece gets **three to five looks**, grouped into **themed sets** the player can
swap in and out, so the fridge in the same spot does not always look the same. Sets are classified by **theme and
material**. The first set is **Retro**; it includes at least the table, the sink (which is part of the counter), the
fridge and a wallpaper.

## What a piece is in this codebase (do not guess; these are the real shapes)

Everything is drawn in code on an isometric canvas. There are no image assets, and none may be added.

1. **Size, spots and lights** live in `state/objects.ts` `TYPES[type]`: `W`, `D`, `h`, `name`, optional `spots`
   (where someone stands and sits to use it, with `tag`s the activities look up: `fridge`, `sink`, `stove`, `coffee`,
   `seat`, `dine1`...), `light`, `store`, `small`, `fixed`, `cols` (colour variants). A test
   (`__tests__/noDuplicateData.test.ts`) fails if sizes or spots are defined anywhere else.
2. **Drawing** lives in `art/houseArt.js` in the drawer table keyed by the same type name, as
   `parts: () => [F(x1, y1, x2, y2, (T) => { ... }, { name })]` using `T.box`, `T.poly`, `T.line`, `T.P`, `ell`,
   `circle`, `shade`, with hex colours. Read the existing `fridge`, `counter`, `dining`, `sofa`, `tvunit`, `lamp`
   and `plant` drawers before writing any. A test (`houseArt.test.ts`, "knows how to draw every starter furniture
   piece") renders every starter type.
3. **The shop** is `state/catalog.ts`: `furn(id, type, name, price, tags, cols?)`, `decor(...)`, `wallpaper(id, name,
   patternKey, price, tags)`, `floor(id, name, floorKey, price, tags)`. `tags` come from `STYLE_TAGS` in
   `state/taste.ts`: `warm, cool, bold, soft, natural, modern, vintage, playful, luxe, industrial, cozy, minimal`.
   The companion's taste reacts to these tags, so they are content, not metadata. `catalogTypes.test.ts` fails on a
   duplicate id or a type the house cannot hold.
4. **Wallpapers and floors** are entries in `art/houseArt.js` `PAPERS` (`{ pat, base, ink, ink2? }`, patterns: dots,
   stripes, pin, gingham, plaid, chevron, scallop, damask, brick, block, deco, botanical) and `FLOORS`
   (`{ kind: 'plank' | 'flat' | 'check' | 'speck', a, b, line }`), each sold through `wallpaper()` / `floor()`.

## The rule that makes a "look" safe

**A look never changes a piece's footprint, height class or spots.** The household's activities find the fridge, the
sink, the stove, the coffee machine, the seats and the dining chairs by the spots in `TYPES`; a Retro fridge is the
same 0.9 × 0.85 × 1.95 box with the same `fridge` spot, drawn differently. Only the drawing, the name, the
description, the price, the tags and the colour variants change.

Do this with a **skin** on the instance, not a new type per look:

- `ObjectInstance.skin?: string` next to `col` (saved and loaded like `col`: `state/save.ts` writes `col`, do the
  same for `skin`; `saveMigration` needs nothing, the field is optional).
- `TYPES[type].skins?: Record<string, { name: string; material: Material; theme: Theme }>` listing the looks a type
  has. `Material = 'wood' | 'metal' | 'laminate' | 'stone' | 'fabric' | 'glass'`; `Theme = 'retro' | 'farmhouse' |
  'modern' | 'scandi' | 'industrial'`.
- The drawer reads `T.o.skin` and branches; the default look is `undefined`.
- A catalog entry gets `skin?: string`. Buying a piece with a skin whose type already stands on the main floor
  **swaps the skin of that piece** (the one good spot stays); otherwise it is placed as today. Put the swap in
  `systems/shop.ts` where purchases are applied, and emit `room.styled`-style feedback so the companion reacts to it
  with her taste as she does for paint.
- The Arrange bar shows the piece's look name in the "what" line.

Build that plumbing first, in its own pull request, with unit tests (skin saved and loaded; buying a skinned fridge
swaps the existing fridge; the drawer renders every skin of every type without throwing). Then one pull request per
theme set.

## The pieces, with their real footprints

Main floor, in the order players meet them. Read `state/objects.ts` for anything not listed.

| Type | Footprint (W × D × h) | Spots that must not change | Notes |
|---|---|---|---|
| `fridge` | 0.9 × 0.85 × 1.95 | `fridge` | the door light shows red when empty: keep that |
| `counter` | 2.8 × 0.8 × 1.1 | `sink` at 0.65 along, `stove` at 1.65, `coffee` at 2.45, `window` | the sink, stove and coffee machine are parts of this one piece: a "Retro sink" is a counter look |
| `dining` | 1.3 × 2.5 × 1.1 | `dine1`, `dine2` (+ its light) | |
| `sofa` | 2.4 × 1.0 × 0.95 | `seat` ×2 | |
| `tvunit` | 1.6 × 0.45 × 0.75 | none | has a `bigtv` upgrade branch: keep it |
| `lamp` | 0.4 × 0.4 × 1.75 | none; `light` | |
| `plant` | 0.5 × 0.5 × 1.1 | `water` | pot colour already varies by `pot` |
| `bookshelf` | 1.4 × 0.38 × 1.6 | none; has a `surface` | |
| wallpaper | – | – | one per set, in `PAPERS` |
| floor | – | – | one per set, in `FLOORS` |

## The sets

Five themes, each a complete kitchen and living room so a player can commit to one. Three to five looks per piece
across the themes, so no piece has fewer than three. Classify each look by material.

| Theme | Feel | Materials | Tags (from STYLE_TAGS) |
|---|---|---|---|
| **Retro** (first) | 1950s to 70s American kitchen: rounded pastel fridge with chrome handle, boomerang or atomic laminate table with chrome legs, two-tone counter with a deep white sink, checkerboard or linoleum floor, a starburst or atomic wallpaper | laminate, metal | vintage, playful, bold |
| Farmhouse | shiplap, butcher block, a cream enamel fridge, a farmhouse apron sink, a plank floor, a gingham or botanical wallpaper | wood, stone | cozy, natural, warm |
| Modern | matte black or brushed steel fridge, slab-front counter, a glass-top table, a flat charcoal floor, a pinstripe or block wallpaper | metal, glass, stone | modern, minimal, cool |
| Scandi | pale ash, linen sofa, a white fridge with wood handles, a light plank floor, a soft dot or stripe wallpaper | wood, fabric | soft, minimal, natural |
| Industrial | riveted steel fridge, concrete counter, a reclaimed wood and pipe table, a concrete floor, a brick wallpaper | metal, stone, wood | industrial, bold, cool |

For each theme deliver: fridge, counter, dining set, sofa, TV unit, lamp, plant pot colour, one wallpaper, one floor.
Price ladder: Retro and Farmhouse mid, Scandi mid, Modern and Industrial higher; a wallpaper 80 to 120, a floor
120 to 180, pieces in line with what the same type costs today.

## What to deliver, per look

1. The `skins` entry in `TYPES[type]` (name in the game's voice: "Pastel icebox", not "Fridge (retro)").
2. The drawer branch in `houseArt.js`: a few `T.box`/`T.poly`/`T.line` calls in the existing style, with the
   same silhouette as the base so the hit-test and the shadows still fit. Hex colours only; use `shade()` for faces.
3. The catalog line with tags, price, `skin`, and an optional `cols` list (the cheap way to get two more variants).
4. One line of description for the shop card.
5. For the wallpaper and the floor: the `PAPERS`/`FLOORS` entry and the catalog line.

## Checks before each pull request

- `npm run typecheck`, `npx vitest run src/games/velvet-house` (the tests above, plus the new skin tests).
- `npm run test:visual` for a golden of the main floor with the whole set applied, day and night, so the set is
  reviewed as one picture: do the five pieces and the walls read as one kitchen?
- The companion's reaction: buy the set's wallpaper and confirm she reacts with her taste (she does today for paint).
- In the pull request's Testing section, list what was checked at which level (S source, A automated, P played).

## Rules

- No external images, fonts or sprites. Everything drawn in code.
- Never change a footprint, a spot, a light position or an activity to fit a look. If a look needs that, it is not a
  look; stop and say so.
- One theme per pull request after the plumbing one. Names and descriptions in the game's plain, warm voice.
- Do not touch the story scripts, the save content version or the opening; this is shop content.
