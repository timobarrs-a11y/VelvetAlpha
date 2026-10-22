# Phase 6b: The whole town

**Paste this to Bolt:**

> Do Phase 6b from `docs/velvet-world/phase-6b-town.md`. Phase 6a is done.
> Only open the files the phase lists. Don't redraw any art.

## What ships

- A **Block / Town** toggle on `/world`. Town shows **every plot in Velvet**
  (2,000 members means 2,000 houses) on numbered streets around the town
  square, with the clock tower in the middle.
- Zoomed out it's a living map. Zoom in and full houses with readable
  billboards fade in. Tap any lot to fly there and open its card.
- **Pins** for you ("You", pink) and your friends (first name, green).
- **Friends** button: a popover listing your friends and their addresses,
  each with **Visit**, which flies to their house.
- **Search** by name (public profiles only).
- The clock tower rises with everyone's completed goals.

## Files

| Do | File |
|---|---|
| Edit | `src/services/worldService.ts`: add the functions below |
| Edit | `src/features/velvet-world/WorldCanvas.tsx`: add the town branch |
| New | `src/features/velvet-world/FriendsPopover.tsx` |
| Edit | `src/pages/WorldPage.tsx`: toggle, Friends, search, tower button |
| Read only | `src/features/velvet-world/demo/street-test.html` |

## Step 1: add to `worldService.ts`

```ts
import { townSlot, townLayout } from '../features/velvet-world/art/streetArt.js'; // merge into the existing import

export interface TownPlot { user_id: string; slot_index: number; style: string | null; body: string | null; roof: string | null; door: string | null; sign_color: string | null; is_member: boolean; earned: string[] }

export async function getTownSize(): Promise<number> {
  const { data, error } = await supabase.rpc('get_town_size');
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Plot summaries for slot_index in [from, to). The server caps one call at 5,000. */
export async function getTownPlots(from: number, to: number): Promise<TownPlot[]> {
  const { data, error } = await supabase.rpc('get_town_plots', { p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as TownPlot[];
}

export async function findPlot(query: string): Promise<{ user_id: string; slot_index: number; display_name: string }[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('find_world_plot', { p_query: query });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLandmarkProgress(): Promise<number> {
  const { data } = await supabase.rpc('get_landmark_progress');
  return (data as number) ?? 0;
}

/** A town summary → a kit plot placed at its permanent lot. Enough for drawPlotLowDetail. */
export function townToPlot(t: TownPlot): Plot {
  const slot = townSlot(t.slot_index);
  return {
    id: t.user_id, number: (slot.col + 1) * 2, member: t.is_member, origin: { x: slot.x, y: slot.y },
    config: { house: { style: (t.style ?? 'standard') as HouseStyle, ...(t.body && { body: t.body }), ...(t.roof && { roof: t.roof }), ...(t.door && { door: t.door }) }, sign: t.sign_color ? { color: t.sign_color } : {} },
    profile: { name: '', earned: t.earned, address: slot.address },
  };
}
```

(`HouseStyle` is exported by the kit types.)

## Step 2: town data on the page

- `size = await getTownSize()`, then `layout = townLayout(size)`. Gaps in
  numbering (deleted accounts) just stay as empty lawn. Don't renumber
  anyone.
- Load summaries in chunks of 5,000 (`getTownPlots(0, 5000)`,
  `(5000, 10000)`, ...) **in the background, in order**, into an array
  indexed by `slot_index`. Draw whatever has arrived. Rebuild the
  zoomed-out town image at most once every 2 seconds while chunks are
  still arriving.
- **Cards for close-up plots:** when zoom ≥ 0.45, collect the visible plot
  ids that don't have a card yet. Debounce 250 ms, then call
  `getCards(ids)` in batches of up to 100 and swap in
  `cardToPlot(card)` **with `origin` set to the slot's `{x, y}`** (cardToPlot
  sets origin null for the street; overwrite it here). Until a card
  arrives, that plot draws low-detail, which is what the demo does when its
  build budget runs out. Keep fetched cards in a `Map` for the session.
- Landmark: `pct = await getLandmarkProgress()`. Pass it to
  `drawTownSquare(..., pct)` here **and** to `drawTownGround(..., pct)` in
  the street view (6a passed nothing, which defaults to 62).

## Step 3: town rendering: port the rest of the demo `render`

Port the two `else` branches of the demo's `render()` (`cam.zoom < 0.2`
and the `else`), plus `buildTownImage`, `slotBounds`, `townFit`,
`plotCenter`, `pin` and the far-away part of `pick` (the lot under your
finger → fly there). Same level-of-detail steps, already tuned for 2,000
plots at 60 fps:

| Zoom | Draw |
|---|---|
| < 0.2 | one cached image of the whole town (`buildTownImage`, max 3,400 px wide), plus `drawTownLightsLow` for visible plots |
| 0.2 – 0.45 | `drawTownStreets` + `drawPlotLowDetail` per visible plot + `drawTownSquare` |
| ≥ 0.45 | `drawTownStreets(..., true)` + full cached plots (`drawDetailed`, 5 builds per frame) |

Use **separate caches** for the street and the town (`streetCache` and
`townCache` in the demo). They draw the same plot at different origins.

Entering the town (`setView('town')` in the demo): start zoomed on your
house, then fly out to `townFit()` over 1.8 s. Minimum zoom is
`townFit().zoom * 0.9`.

## Step 4: pins, Friends and search

- Pins (demo, end of `render`): you, plus every friend from `getFriends()`
  who has a plot. To place a friend you need their `slot_index`: one
  `getCards(friendIds)` call when the page opens gives every friend's slot,
  even if their profile is private. Use the name from `getFriends()` for
  the pin label (their first name), not the card's "A neighbor".
- `FriendsPopover.tsx`: port `renderFriends()`. Each row shows the initial
  dot (gold for members), the name, the address `townSlot(slot).address`
  and a **Visit** button. Visit (demo `visitHouse`) switches to the town,
  jumps to zoom 0.2 over their lot, flies in to zoom 1.0 over 1.3 s and
  opens their card. Friends who haven't moved in: "Hasn't moved in yet"
  with no button.
- Search: a small input in the header. Debounce 300 ms, then
  `findPlot(q)`. Results are a list. Tapping one does Visit.
- **Clock tower** button: in the town, fly to `layout.square` (demo
  `tower` handler). On the block, fly to the tower behind the street.

## Done when

- [ ] Town shows every plot. Panning and zooming hold about 60 fps on a laptop with 2,000 plots (seed fake rows in a dev database to check).
- [ ] An earned house (Treehouse, Lighthouse, Observatory) looks right zoomed out and zoomed in.
- [ ] Zooming in, billboards show real names within about half a second. Zoomed out, there are no requests per frame (check the network tab).
- [ ] Tapping a far-away lot flies there and opens the card.
- [ ] Pins show you and your friends. Friends → Visit lands on the right house.
- [ ] Search finds public profiles by name and never finds private ones.
- [ ] Nothing anywhere shows when someone was last online.
- [ ] `npm run build` and `npm run lint` pass.

## Scale notes (already designed, nothing to do now)

- Summaries are about 100 bytes a plot: 2,000 plots ≈ 200 KB, once per
  visit. Past about 20,000 members, load only the chunks near the camera
  plus the zoomed-out image.
- No realtime subscriptions in the town. Plots change rarely, so a reload
  picks changes up. This keeps 100,000 members off the realtime server.
