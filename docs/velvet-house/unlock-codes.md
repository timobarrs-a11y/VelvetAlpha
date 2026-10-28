# Codes

The game has two ways of taking a typed code. There is no console, no key and no public cheat list: the developer's money
phrase and the unlock codes given to players are all there is. (The first cheats, `kaching`, `fillerup`, `lovebomb`,
`stockup` and `decorate`, were taken out; they come back nearer release if they are wanted.)

## 1. The developer's money phrase

See `dev-money.md`. `xoxotimoisgodxoxo` said to the partner, or entered on the start menu's Cheats screen, adds $500,000, for testing the shop.

## 2. Promo codes (promo packs, handed out during the alpha)

A phrase said to the partner in chat, or entered on the start menu's Cheats screen, gives the player a **promo pack**
for free. Promo packs are marketing: during the alpha Tim hands codes to players to get them trying the game.

Tim, 28 October: promo packs "show up in the main shop but only by name and you can't preview what it looks like, it
should be a lock over it", and they get their own filter in the shop. Limiting how many people can use a code is not
worth it in the alpha ("you'd have to actually be good at IT and more important care enough about the game"); "if we
lock the codes per account, so one per account, that should be fine".

- **In the shop:** a promo item the player doesn't have shows by name with a lock instead of its picture, a **Promo**
  tag, "Free with a promo code. It isn't sold in the shop.", no price and a disabled **Code only** button. It is in its
  usual tab (Sets, Furniture, Wallpaper...) and the packs are also listed in the **Promo** tab. Buying one is refused
  (`systems/shop.ts`). Once a code has given it, it is an ordinary owned item with a Promo tag; a pack's card shows
  **Apply**.
- **The account's, for every house:** a code redeemed in one house opens the packs in every house on that account,
  including houses made later, without typing it again (Tim, 28 October: "the intent is open it up for every house they
  want after"). The game tells the host it redeemed a code (`velvet:promo`), which records it in
  `velvet_promo_redemptions` through `claim_velvet_promo()`. Whenever a house opens, the host sends the account's codes
  (`velvet:promos`) and the game gives that house the packs quietly: they wait in the Sets tab with **Apply**, so a house
  that already has its own look isn't redecorated. There's no limit on how many accounts use a code. Standalone (no app
  around the game, as in the live tests) there is no account and a code just works in the house it was typed in.

The codes (also on the admin **Promo codes** page, with a copy button and how many accounts have used each):

| Code | Gives |
|---|---|
| `rainbowhugs` | **Cuddle Clouds**: the kitchen and living room (six looks, the clouds wallpaper, the sky-check floor) and its finishing touches (cloud rug, rainbow arch, cloud night light, plush pile, cloud swing) |
| `luv2dance` | **Nana** (reserved: the pack is still being made on `claude/nana-pack`; the line goes in when it lands) |

It gives everything, puts it on if they are looking at a floor of the house, and the packs then show in the **Sets**
tab with an **Apply** button. In chat it is caught in `handleTalk` before anything goes to the AI or the chat history.

**When Nana lands** (`claude/nana-pack`): wrap the set and every piece in `promo(...)` (not `secret(...)`, which is gone),
add `luv2dance: { setIds: ['set-nana'], packName: 'Nana', welcome: '...' }` to `UNLOCK_CODES`, and drop that branch's
own shop lock (`isLockedPromo` and its card in `ui/drawer.ts`): the promo card and the Promo tab here cover it.

To add one: mark the pack and every piece in it `promo(...)` in `state/catalog.ts` (look drawers in `art/houseArt.js`),
then a line in `UNLOCK_CODES` in `state/unlockCodes.ts` naming the sets it gives. Code: `state/unlockCodes.ts`,
`systems/unlocks.ts`, `bridge/hostPromo.ts`, and the host side in `pages/VelvetHouseNextGame.tsx`.

**The list of codes lives in the game's code**, so someone who digs through the page can find them. That is fine for the
alpha; before release the list should move to the server.

### The start menu's Cheats screen
It takes a code and lists none: a pack's unlock code, or the developer's money phrase. There is no house at the title
screen, so a valid code is saved (`state/codeQueue.ts`) and redeemed once the player is in their house
(`systems/codeQueue.ts`).

### Applying a pack
Buying a pack from the Sets tab puts it on at once. Once a pack is owned its card shows **Apply**, which puts the whole set
on again for free: the pieces on the main floor, the wallpaper and floor on the floor being looked at. It is not a story
moment (no `room.styled`), so it can be used on any floor as often as wanted.

Tests: `__tests__/unlockCodes.test.ts`, `__tests__/themeSets.test.ts`, `__tests__/touches.test.ts`, `__tests__/devMoney.test.ts`, `e2e/velvet-sims/unlock.spec.ts`, `e2e/velvet-sims/sets.spec.ts`.
