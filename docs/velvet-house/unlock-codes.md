# Codes

The game has two ways of taking a typed code. There is no console, no key and no public cheat list: the developer's money
phrase and the unlock codes given to players are all there is. (The first cheats, `kaching`, `fillerup`, `lovebomb`,
`stockup` and `decorate`, were taken out; they come back nearer release if they are wanted.)

## 1. The developer's money phrase

See `dev-money.md`. `xoxotimoisgodxoxo` said to the partner, or entered on the start menu's Cheats screen, adds $500,000, for testing the shop.

## 2. Unlock codes (secret packs, as gifts and for marketing)

A phrase said to the partner in chat, or entered on the start menu's Cheats screen, gives the player something for free.
The first gives a secret pack, **Cloud Nine** (clouds, rainbows, stars, hearts, a confetti carpet): its six looks, its
wallpaper and its floor are in the catalog as `secret(...)`, so they are in no shop tab until the player has them. The
code is:

```
rainbowhugs
```

It gives the whole set, puts it on if they are looking at a floor of the house, and the pack then shows in the **Sets**
tab with an **Apply** button. In chat it is caught in `handleTalk` before anything goes to the AI or the chat history.

To add one: a `secret(...)` set in `state/catalog.ts` (look drawers in `art/houseArt.js`), then a line in `UNLOCK_CODES` in
`state/unlockCodes.ts`. Code: `state/unlockCodes.ts`, `systems/unlocks.ts`.

**These codes live in the game's code**, so anyone can read them out of the page and use them without limit. That is fine
for a keepsake; for a marketing campaign they need to be checked by a server (single-use or limited, tracked per account).

### The start menu's Cheats screen
It takes a code and lists none: a pack's unlock code, or the developer's money phrase. There is no house at the title
screen, so a valid code is saved (`state/codeQueue.ts`) and redeemed once the player is in their house
(`systems/codeQueue.ts`).

### Applying a pack
Buying a pack from the Sets tab puts it on at once. Once a pack is owned its card shows **Apply**, which puts the whole set
on again for free: the pieces on the main floor, the wallpaper and floor on the floor being looked at. It is not a story
moment (no `room.styled`), so it can be used on any floor as often as wanted.

Tests: `__tests__/unlockCodes.test.ts`, `__tests__/devMoney.test.ts`, `e2e/velvet-sims/unlock.spec.ts`, `e2e/velvet-sims/sets.spec.ts`.
