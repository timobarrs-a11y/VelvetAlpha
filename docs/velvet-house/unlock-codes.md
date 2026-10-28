# Unlock codes, the Cheats screen and applying a pack

## Unlock codes (secret packs, as gifts)

A phrase said to the partner in chat gives the player something for free. The first is a secret pack, **Cloud Nine**
(clouds, rainbows, stars, hearts, a confetti carpet): its six looks, its wallpaper and its floor are in the catalog as
`secret(...)`, so they are in no shop tab until the player has them. The code is:

```
rainbowhugs
```

It gives the whole set, puts it on if they are looking at a floor of the house, and the pack then shows in the **Sets**
tab with an **Apply** button. It is caught in `handleTalk` before anything goes to the AI or the chat history. The public
cheats can never give a secret set (`decorate` and the title screen's list leave it out).

To add one: a `secret(...)` set in `state/catalog.ts` (look drawers in `art/houseArt.js`), then a line in
`UNLOCK_CODES` in `state/unlockCodes.ts`. Code: `state/unlockCodes.ts`, `systems/unlocks.ts`.

## The start menu's Cheats screen

The title screen has **Cheats**: it lists the public codes (`kaching`, `fillerup`, `lovebomb`, `stockup`,
`decorate <set>`; see `cheats.md`) and takes a code. There is no house at the title screen, so a code is checked and
saved (`state/codeQueue.ts`), and redeemed once the player is in their house (`systems/codeQueue.ts`): an unlock code at
once, a cheat once the move-in is over. A secret unlock code is accepted there but never listed.

## Applying a pack

Buying a pack from the Sets tab puts it on at once. Once a pack is owned its card shows **Apply**, which puts the whole
set on again for free: the pieces on the main floor, the wallpaper and floor on the floor being looked at. It is not a
story moment (no `room.styled`), so it can be used as often as wanted, on any floor.

Tests: `__tests__/unlockCodes.test.ts`, `e2e/velvet-sims/unlock.spec.ts`, `e2e/velvet-sims/sets.spec.ts`.
