# Phase 6a: Plots, move-in and your daily block

**Paste this to Bolt:**

> Do Phase 6a from `docs/velvet-world/phase-6a-plots-and-block.md`. Read
> `docs/velvet-world/README.md` first (short). Only open the files the phase
> lists. Don't redraw any art: import `src/features/velvet-world/art/streetArt.js`.

## What ships

- A new **Town** page at `/world`. It opens on **your block today**: 9 lots
  in a row with you in the middle and 8 neighbors you haven't seen lately.
- First visit: a **move-in sheet** to pick a starter house and its colors.
  It claims your plot.
- Tap a billboard (or house) to open the **billboard card**: name, address,
  headline, shared goal, pinned medals, spaces, "Member" and "New neighbor"
  chips, and **Add friend**.
- Your own card has **Customize my plot**, the same customizer as the demo.
  It saves through `save_world_plot`. Member options show "· members" and
  are disabled for free users.
- A **main house** picker (which companion's game house is yours).
- Real time of day and season from the user's clock. Night lighting just
  works.

Not in 6a: the whole-town view, pins, Friends popover and search (6b);
email (6c).

## Files

| Do | File |
|---|---|
| New migration | `supabase/migrations/<timestamp>_velvet_world_phase6.sql` ← copy `docs/velvet-world/sql/phase-6-world.sql` word for word |
| Edit | `index.html` (fonts, step 2) |
| New | `src/services/worldService.ts` (step 3: code below, paste as is) |
| New | `src/features/velvet-world/WorldCanvas.tsx` (step 4) |
| New | `src/features/velvet-world/BillboardCard.tsx` (step 5) |
| New | `src/features/velvet-world/Customizer.tsx` (step 6) |
| New | `src/features/velvet-world/MoveInSheet.tsx` (step 7) |
| New | `src/pages/WorldPage.tsx` (step 8) |
| Edit | `src/routes/appRoutes.tsx`: add the route next to the `house` routes (`const HousePage = lazy(...)` is at line 42, routes at ~92) |
| Edit | `src/components/SignedInWorkspace.tsx`: `connectTools` (~line 256), add after House: `{ label: 'Town', path: '/world', tone: '#f472b6', icon: <Building2 className="h-3.5 w-3.5" /> }` (import `Building2` from lucide-react) |
| Read only | `src/features/velvet-world/demo/street-test.html` (the reference), `src/features/velvet-world/art/streetArt.d.ts` (kit types) |

Existing code you'll call (signatures already checked):

- `import { supabase } from '../shared/supabase/client'` (from `src/services`)
- `import { useAuth } from '../auth/AuthProvider'` → `const { user } = useAuth()` (from `src/pages`)
- `src/shared/supabase/queries/messaging.ts`:
  `sendFriendRequest(otherUserId, introMessage?)` (silently ignores
  duplicates), `getFriends(): FriendPeer[]` (`user_id`, `display_name`),
  `getOutgoingRequests(): FriendPeer[]`
- `src/hooks/useAccess.ts`: `useAccess().isPaid`
- `src/services/companionService.ts`: `getCompanions(userId)`

## Step 1: migration

Copy the SQL file into a new migration, unchanged. It's idempotent.

## Step 2: fonts

The billboards use five fonts that `index.html` doesn't load yet. In the
existing Google Fonts `<link>` (line 56), add these families before
`&display=swap`:

```
&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Alfa+Slab+One&family=Fraunces:opsz,wght@9..144,700&family=Yellowtail&family=Instrument+Sans:wght@400;600;700
```

## Step 3: `src/services/worldService.ts` (paste as is)

```ts
import { supabase } from '../shared/supabase/client';
import { townSlot, type Plot, type PlotConfig } from '../features/velvet-world/art/streetArt.js';

export interface WorldCard {
  user_id: string; slot_index: number; house: PlotConfig['house']; sign: PlotConfig['sign']; yard: Omit<PlotConfig, 'house' | 'sign'>;
  is_member: boolean; earned: string[]; is_public: boolean; display_name: string; headline: string | null;
  goal_label: string | null; goal_pct: number | null; medals: string[]; medal_count: number; spaces: string[]; new_neighbor: boolean;
}
export interface MyPlot {
  slot_index: number; house: PlotConfig['house']; sign: PlotConfig['sign']; yard: Omit<PlotConfig, 'house' | 'sign'>;
  main_companion_id: string | null; moved_in_at: string; is_member: boolean; earned: string[];
}

/** The user's local calendar date as YYYY-MM-DD. The daily block changes at their midnight. */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getMyPlot(): Promise<MyPlot | null> {
  const { data, error } = await supabase.rpc('get_my_world_plot');
  if (error) throw new Error(`Failed to load your plot: ${error.message}`);
  return (data as MyPlot[] | null)?.[0] ?? null;
}

export async function claimPlot(house: PlotConfig['house']): Promise<number> {
  const { data, error } = await supabase.rpc('claim_world_plot', { p_house: house });
  if (error) throw new Error(`Failed to move in: ${error.message}`);
  return data as number;
}

/** Saves the whole look. `config` is a kit PlotConfig; house goes in its own column, the rest is sign + yard. */
export async function savePlot(config: PlotConfig): Promise<void> {
  const { house, sign, ...yard } = config;
  const { error } = await supabase.rpc('save_world_plot', { p_house: house, p_sign: sign ?? {}, p_yard: yard });
  if (error) throw new Error(error.message);
}

export async function setMainCompanion(companionId: string | null): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase.from('world_plots').update({ main_companion_id: companionId }).eq('user_id', user.id);
  if (error) throw new Error(error.message);
}

/** Rows come back in any order; match them by user_id. */
export async function getCards(userIds: string[]): Promise<WorldCard[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.rpc('world_cards', { p_user_ids: userIds });
  if (error) throw new Error(`Failed to load neighbors: ${error.message}`);
  return (data ?? []) as WorldCard[];
}

/** Today's candidates in order (16 by default). The page picks 8 of them; see pickBlock. */
export async function getDailyBlock(day = localDay(), count = 16): Promise<{ user_id: string; shares_space: boolean; ord: number }[]> {
  const { data, error } = await supabase.rpc('get_daily_block', { p_day: day, p_count: count });
  if (error) throw new Error(`Failed to load today's block: ${error.message}`);
  return data ?? [];
}

export async function markSeen(day: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const { error } = await supabase.rpc('mark_block_seen', { p_day: day, p_ids: userIds });
  if (error) console.warn('mark_block_seen failed', error.message);
}

/** A database card → the plot object the art kit draws. */
export function cardToPlot(c: WorldCard): Plot {
  const slot = townSlot(c.slot_index);
  return {
    id: c.user_id,
    number: (slot.col + 1) * 2,
    member: c.is_member,
    origin: null,
    config: { house: c.house ?? {}, sign: c.sign ?? {}, ...(c.yard ?? {}) },
    profile: {
      name: c.display_name,
      headline: c.headline,
      goal: c.goal_label ? { label: c.goal_label, pct: c.goal_pct ?? 0 } : null,
      medals: c.medals,
      earned: c.earned,
      medalCount: c.medal_count,
      spaces: c.spaces,
      newNeighbor: c.new_neighbor,
      address: slot.address,
    },
  };
}
```

## Step 4: `WorldCanvas.tsx`: port the demo's canvas, don't redesign it

A React component that owns one full-size `<canvas>`, a camera and a
`requestAnimationFrame` loop. Keep everything in refs, not state: React
must not re-render 60 times a second. Port these demo functions
(`street-test.html`) almost line for line, with fake data replaced by props:

| Demo function | What it does | Change when porting |
|---|---|---|
| `resize`, `frameStreet`, `clampCam`, `zoomAt`, `toWorld`, the pointer/wheel listeners, `flyTo` | camera, drag, pinch, wheel zoom | Use a `ResizeObserver` on the container instead of `window.innerWidth`. |
| `cacheKey`, `buildPlotCache`, `drawDetailed` | per-plot offscreen back/front layers, LRU of 140, 5 builds per frame | none |
| `render` (the `state.view === 'street'` branch only) | ground → plots → front → night tint → lights → weather | `street` comes from props. Drop the fps text. |
| `inside`, `pick` (sign hit first, then house) | tap targets | call `onSelect(plot.id \| null)` |
| selection ring inside `render` | outline the selected billboard | none |
| the `document.fonts.load(...)` block at the end | rebuild caches once fonts arrive | none |

Props:

```ts
{ plots: Plot[]; selectedId: string | null; onSelect: (id: string | null) => void; season: Season; hour: number }
```

`effective()` in the demo exists only for the demo's free/member toggle.
In the app, use the plot as is. Whenever a plot object changes (after a
save), give it a new object with `_resolved: null` and clear that plot's
cache entries (demo `invalidatePlot`).

Time and season: `hour = now.getHours() + now.getMinutes() / 60`, refreshed
every minute. Season by month: Dec–Feb winter, Mar–May spring, Jun–Aug
summer, Sep–Nov autumn. Respect `prefers-reduced-motion` (`env.reducedMotion`)
exactly as the demo does. The kit already freezes animation and snow when
it's set.

Accessibility: `aria-label` on the canvas, as in the demo. The card (step 5)
is real DOM, so screen readers get the content.

## Step 5: `BillboardCard.tsx`

Port the top `<section class="card">` part of `renderPanel()` in the demo
to JSX, using the same order and wording:

- name and address
- chips: ★ Member, New neighbor, Friend, spaces
- headline
- house line (`houseLine()`: "Victorian · member house", or "Treehouse ·
  earned with Hat Trick")
- goal bar
- pinned medals (port `medalIcon()`, which uses the kit's `glyph` and
  `TIER_COLORS`)

Buttons:

- someone else: **Add friend** → `sendFriendRequest(id)` → shows "Request
  sent", disabled. Show "Friends" (disabled) if they're already a friend
  (`getFriends()`), and "Request sent" if `getOutgoingRequests()` includes
  them. Load both once when the page opens.
- you: **Customize my plot** (opens step 6) and **Play inside**, which links
  to `/velvet-house` (the game). The game shows the inside and back; the
  front stays here.
- **No other actions.** No message, no knock, no "last seen".

Private profiles come back from `world_cards` as "A neighbor" with no
details. Show the card with just the house line and no Add friend (they
chose not to be found).

## Step 6: `Customizer.tsx`

Port the customizer half of `renderPanel()` (`optRow`, `swatchRow`, the
three tier rows, member rows) to JSX, using the same labels. Rules (the kit
helpers do the work):

- House rows: one per tier, from `HOUSE_STYLES` / `HOUSE_TIERS`.
  `houseUnlock(id, isPaid, earned)` decides enabled. A locked member house
  says "Craftsman · members". A locked earned house says
  "Treehouse · Hat Trick".
- Walls, Roof and Door swatches (`COLORS.body/roof/door`) are open to
  everyone.
- Billboard, Sign color, Car, Pet, Yard and Tree are disabled for free
  users, with "· members" on the label.
- Changes preview live on the canvas. **Save** calls `savePlot(config)`.
  **Cancel** restores the loaded config. Free users' member choices aren't
  sent (keep them out of the config) so the save never fails on them.
- If `save_world_plot` raises "That house is not open to you yet" (for
  example their plan just ended), show that text and revert.
- Below the kit, the **Main house** picker: a select of `getCompanions(user.id)`
  plus "None". On change, call `setMainCompanion(id)`. Hint text: "Which
  companion's house you live in when you play. Your plot here never
  changes."

For free users, show the demo's lock box text ("You are on the free plan:
any starter house in any colors, plus earned houses for medals you have.
Member houses, twinkle lights, animation and yard extras come with
membership."). Drop the demo's "preview as member" toggle.

## Step 7: `MoveInSheet.tsx`

Shown when `getMyPlot()` returns null. Heading: "Pick your house". Show the
five starter houses as a row of tiles. Each tile is a tiny canvas drawn
with the kit: `drawPlot(ctx, plot, 0, 'back', env)` then `'front'` on a
`plotBounds(0, plot)`-sized canvas scaled to fit, the same as
`buildPlotCache`. Below, the Walls, Roof and Door swatches. A big preview of
the selected plot sits on top.

The button "Move in" calls `claimPlot(house)`, then loads the page. Member and
earned houses aren't offered here. People switch to those afterward in the
customizer, which knows their plan and medals once the plot exists.

## Step 8: `WorldPage.tsx` (route `/world`)

On load:

1. `const day = localDay()`, then `getMyPlot()`. If it returns null, show
   the move-in sheet.
2. `getDailyBlock(day, 16)`, then `getCards([me, ...candidateIds])` and map
   them with `cardToPlot`.
3. **pickBlock** (port `buildStreet` from the demo): 9 lots with **you at
   index 4**.
   - Fill the queue as `[shared0, rest0, shared1, rest1, rest2, shared2,
     rest3, rest4, ...rest]`, where shared means `shares_space`, in `ord`
     order.
   - For each lot, take the first unused candidate whose
     `` `${r.house.style}|${r.house.body}` `` (from
     `resolvePlot(plot)`) differs from the lot to its left.
   - With fewer than 8 candidates (a tiny town), show fewer neighbors. Never
     pad with fake houses. **Leave out** the street lots that are empty:
     pass a shorter array and put you in the middle of what's there.
4. `markSeen(day, the 8 neighbor ids you actually placed)`. Fire and forget.
   Calling it again the same day is harmless.
5. Render `<WorldCanvas plots={block} ... />`, with the card or customizer
   in a side panel (desktop) or bottom sheet (phone, under 760px wide). Use
   the demo's `.panel` CSS as the look.

Header text: "Your block today" and a small "Velvet World" label. There is
no "Tomorrow" button. That was a demo control; the block changes at the
user's midnight.

## Done when

- [ ] A new user sees the move-in sheet. After Move in, they land on their block, in the middle, with their house.
- [ ] Reloading the same day shows the same neighbors in the same order. The next day shows different people. Test by passing a different `day` in dev.
- [ ] No two neighbors next to each other share both style and wall color.
- [ ] Tapping a billboard opens the card. Add friend sends a request, and the recipient sees it in the Messaging overlay's requests list.
- [ ] A free user can change house (starter or earned) and colors, and save. Member rows are disabled. A paid user can use everything and sees twinkle lights, smoke and a pet moving.
- [ ] Private-profile users never appear on anyone's block.
- [ ] Picking a main house works, and deleting that companion leaves the plot in place.
- [ ] At night the windows glow. With reduced motion on, nothing animates.
- [ ] A phone at 390px wide: drag, pinch and tap all work, and the card is a bottom sheet.
- [ ] `npm run build` and `npm run lint` pass.
