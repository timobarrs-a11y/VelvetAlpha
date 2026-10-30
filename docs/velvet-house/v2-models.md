# V2 models: the same pieces in new shapes

Looks (`state/skins.ts`) restyle a piece but never change its size, so every fridge stood in the same box and every
kitchen read the same. A **model** is another shape of a piece the house already has: its own footprint, height and
spots, doing the same job. Mixing models changes the room; each model then gets its own looks, drawn for its shape.

## The director's brief for this pass

- A V2 bundle of the same items (wallpaper, table, fridge and so on), each "sized differently to distinguish them from
  existing pieces". The chest freezer is the example: a fridge whose lid lifts, so every look of it differs from the
  tall fridge's.
- Per item, two versions: the V2 base model and **one** reskin (not ten).
- The reskins use new, distinct themes, not the 25 the sets already have.
- "Let's build more TV unit options for sure."

## Built

| Kind | V2 model | Size (W × D × h) | Reskin (theme) |
|---|---|---|---|
| Fridge | Chest freezer (`chestfreezer`) | 1.2 × 0.75 × 0.92, against 0.9 × 0.85 × 1.95 | Camp cooler chest (`camp`) |
| TV unit | Media console (`mediaconsole`) | 2.0 × 0.5 × 0.5, against 1.6 × 0.45 × 0.75 | Walnut credenza (`midcentury`) |

## How a model works

- `TYPES[type].kind` names the piece it stands in for (`kindOf`, `modelsOf` in `state/objects.ts`). It must carry every
  spot tag its kind has, and be fixed if its kind is (`__tests__/models.test.ts` checks both).
- A fixed piece with more than one model swaps **in place**: buying a model, or any look of any model of that kind,
  replaces the piece standing on the main floor (`skinTarget`, `swapsInPlace`). `swapModel` (`state/arrange.ts`) keeps
  the back against the same wall and slides along it to the nearest spot that fits (left edge, right edge, centred,
  then a quarter tile at a time). If nothing fits, the shop says so and charges nothing.
- Arrange's Look row lists the other models the player has, with their looks (ids `type:skin`); the kind's own model
  is always there to go back to.
- The story treats a model as its kind: a `world` condition `is: 'fridge'` is met by the chest freezer. Groceries set
  down on it go in, as on the fridge.
- Drawing: `chestFreezer` and `mediaConsole` in `art/houseArt.js`. The chest freezer's lid stands up on its hinge
  while someone is at it or after a tap. Tapping the console switches the TV, as the TV unit does.

## TVs are pieces

The director: "make the tv removable an create tvs that also sit on desks and entertainment centers". The screen used
to be part of the living room's back wall (a `tv` feature in `state/house.ts`); it is a piece now.

- **Wall-mounted TV** (`walltv`): starts where the old one was, and can be moved, stored or sold like any piece. It is
  hung (`mount`, the height it hangs at): its back must be against a wall (`backToWall`), it hangs over whatever stands
  below it, and nobody walks into it. With no spot chosen it hangs itself on the nearest free wall. A house saved
  before this gets it once (`STARTER_TV_IDS`, flag `tvObject`), as the rugs were given.
- **TVs that stand on things** (`small`): a flat-screen (`tvflat`), a desk TV (`tvdesk`) and a tube TV (`tvtube`).
  The TV unit, the media console, the desk, the dresser and the new **entertainment center** (`entcenter`: shelf
  towers round a niche) have tops for them. A TV bought in the shop goes on a free stand on that floor
  (`setOnStand`: the TV unit first, then the entertainment center, a dresser, a desk), else on the floor.
- **Five more ways to watch** (`crttable`, `crtwall`, `frametv`, `cinematv`, `floortv`; none is `small`, so none goes on a
  stand). Two have a tube: a **CRT TV table** stands on the floor (a wooden top on four legs, a shelf with a video
  player under it) and a **wall shelf CRT** hangs (a thick shelf on two iron brackets, the set pushed back to the wall).
  Two more hang: a **Frame TV** (a wooden frame and a white mat round a painting while it is off, a screen when it is on)
  and a **cinema wall TV** (wide, with a soundbar under it). The **floor-stand TV** stands on two uprights with two
  shelves for a console and a soundbar. Hung ones cannot share a bit of wall (`checkPlacement`: "already hangs there"),
  so a second one finds the next free spot; the standing ones take floor space like any piece. They are drawn in
  `art/houseArt.js` (`TV_DRAWERS`, with the shared tube set `crtSet` and `sortedBoxes`, which draws a piece's boxes far
  to near for any turn) and sold in the Furniture tab.
- **Watching** (`tv` activity, `screen: true`): from a seat on any floor with a TV, the nearer the seat to one the
  better; with no TV in the house, nobody watches. The world knows where the TVs are (`HouseWorld.screens`).
- **On and off:** tapping a TV switches it; tapping the TV unit, the console or the entertainment center switches the
  TV on it or on the wall just above it. A TV is also on while someone on its floor watches. Each lit TV lights the
  room round it from where it is.

## Still open

- **The rest of the bundle** (counter, dining table, sofa, lamp, plant, wallpaper, floor) is not built. The director
  named the TV unit; the others wait on a yes.
- The legacy copy of the save (`toV1Compatible`) carries the new types as they are; the legacy game does not know them,
  as it already does not know the other pieces added since.
- Sets do not include V2 models yet. A set that puts a fridge look on brings the tall fridge back in place of a chest
  freezer, if it fits.
