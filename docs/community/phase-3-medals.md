# Phase 3: Medals

## Prompt to paste into Bolt

> Read `docs/community/phase-3-medals.md` and build it exactly as written.
> Only open the files it names. Copy `docs/community/sql/phase-3-medals.sql`
> into a new migration without changing it. Phase 2 must already be applied.

---

## What the person sees

- A **medal case** on their profile: earned medals in color, locked ones as
  silhouettes with a progress bar ("7 / 10 friends") and rarity ("Earned by 4%").
- **Three pinned medals** (the showcase) at the top of their public profile.
- A toast the moment a medal unlocks, a notification in the bell, and a
  "Medal Earned" post in the Feed if their profile is public.
- Hidden medals show as "???" until earned.
- **Day One** is for Velvet Alpha members only and closes for good when Tim
  sets its end date.

## Design rules (already built into the SQL)

- Real progress (goals, commitments, coach work) earns the best medals. Logging in earns the minor ones.
- Medals are permanent once earned.
- Everything is recalculated by triggers the moment something happens. There are no batch jobs.
- Other people only see **earned** medals, and only if the profile is public (`member_profiles.is_public`).
- The catalog is data: add or change rows in `medals` to add medals. No code change needed.

## Step 1: Migration

Create a migration with the exact contents of `docs/community/sql/phase-3-medals.sql`. It:

- creates `medals` (catalog) and `user_medals` (progress, earned_at, showcase_slot 1–3),
- adds `community_notifications.meta` (jsonb) and puts `community_notifications` on realtime,
- adds triggers on commitments, goals, check-ins, streaks, friendships, reactions, likes, referrals, posts, comments, space joins and room messages,
- seeds 23 medals, and backfills everyone **quietly** (no notifications or posts for past activity),
- rewrites `get_community_badges()` to read from the new tables, keeping its JSON shape.

RPCs:

| RPC | Returns |
|---|---|
| `get_user_medals(p_user_id uuid default null)` | slug, name, description, category, tier, icon, threshold, progress, earned_at, showcase_slot, is_hidden, earned_percent. Null = me (every medal with progress; hidden ones masked). Someone else = their earned medals only, empty if their profile is private. Sorted earned first, showcase first. |
| `set_medal_showcase(p_slugs text[])` | Up to 3 **earned** slugs in display order. `'{}'` clears. Raises an error if a slug isn't earned. |

Starter catalog (`tier`: bronze, silver, gold, legendary):

| Category | Medal | How |
|---|---|---|
| exclusive | **Day One** (legendary) | Member of Velvet Alpha |
| goals | First Step · Halfway There · Hat Trick · Promise Keeper · The Closer | 1 commitment · 50% on a goal · 3 goals · 25 commitments · 10 goals |
| streaks | Showed Up · Habit Forming · Iron Will · Unbreakable | 7-day streak · four separate 7-day streaks · 30 days · 100 days |
| social | A Friend in Need... · ...Is a Friend Indeed · Hype Man · Plus One | 10 friends · 20 friends · 25 likes given · 1 referral who joins |
| community | Found My People · First Post · Conversation Starter · Community Helper · Rising Star · Crowd Favorite · Life of the Party | join a space yourself · 1 post · 5 posts · 10 comments · 10 reactions received · 25 received · 100 room messages |
| coach | Coachable | 10 commitments your coach set |
| hidden | Comeback Kid | come back after 14+ days away |

## Step 2: Frontend

### 2a. Service `src/services/medalsService.ts` (new)

```ts
export interface UserMedal {
  slug: string; name: string; description: string;
  category: 'goals' | 'streaks' | 'social' | 'community' | 'coach' | 'hidden' | 'exclusive';
  tier: 'bronze' | 'silver' | 'gold' | 'legendary'; icon: string;
  threshold: number; progress: number; earned_at: string | null;
  showcase_slot: number | null; is_hidden: boolean; earned_percent: number;
}
getUserMedals(userId?: string): Promise<UserMedal[]>   // rpc get_user_medals { p_user_id: userId ?? null }
setShowcase(slugs: string[]): Promise<void>           // rpc set_medal_showcase { p_slugs: slugs }
```

### 2b. Components `src/components/medals/` (new)

- **`MedalIcon.tsx`**: explicit lucide map (don't import all of lucide). Names in use, all checked against lucide-react 0.344:
  `Crown, Footprints, Flag, Target, Handshake, Trophy, CalendarCheck, Repeat, Flame, Gem, Users, HeartHandshake, ThumbsUp, UserPlus, DoorOpen, PenLine, MessageSquarePlus, MessageCircle, Star, Sparkles, PartyPopper, GraduationCap, RotateCcw`. Fall back to `Award`.
- **`MedalBadge.tsx`**: circular medal, icon in the middle, ring color by tier: bronze `#cd7f32`, silver `#cbd5e1`, gold `#fbbf24`, legendary a pink→violet gradient with a soft glow. Sizes `sm` (24px), `md` (48px), `lg` (80px). Locked = grayscale at 35% opacity with a small lock.
- **`MedalCase.tsx`**: grid grouped by category (Exclusive, Goals, Streaks, Social, Community, Coach, Hidden). Each tile: badge, name, description, and either "Earned Mar 4 · 12% of members" or a progress bar `progress / threshold`. Click opens a small detail popover.
- **`MedalShowcase.tsx`**: the three pinned medals, large, side by side. Empty slots show a dashed circle (own profile: "Pin a medal").
- **`ShowcasePicker.tsx`**: `ModalShell` listing earned medals. Tap to select up to 3 in order, then Save (`setShowcase`).
- **`MedalToast.tsx`**: mounted once in `src/components/SignedInWorkspace.tsx`. Subscribes to realtime `INSERT` on `community_notifications` with `filter: user_id=eq.${user.id}`. When `type === 'badge'`, show a 5-second toast with the `MedalBadge` (`meta.icon`, `meta.tier`) and "You earned **{meta.name}**". Clicking it opens `/medals`. Generalize the slide-in look of `src/components/AchievementToast.tsx`.

### 2c. Pages and wire-up

1. **`/medals`**, new `src/pages/MedalsPage.tsx`: the user's own `MedalShowcase` (with "Edit showcase"), then their `MedalCase`. Add the route in `src/routes/appRoutes.tsx`.
2. **`src/pages/MyPublicProfilePage.tsx`**: under the header, before the "Shared goals" section (around line 152), add `MedalShowcase` plus a compact row of all earned medals (`sm`) with a "See all" link to `/medals`.
3. **`src/pages/MemberProfilePage.tsx`**: same spot (before "Shared goals", around line 184): `MedalShowcase` and the earned row for `getUserMedals(userId)`. Hide the section if the list is empty.
4. **`src/components/community/BadgeDisplay.tsx`**: badge keys are now medal slugs (`first-post`, not `first_post`). Replace the emoji `BADGE_ICONS` lookup with `<MedalBadge size="sm">`. The data comes from `fetchBadges` → `get_community_badges` (unchanged API), so add `icon` and `tier`. Simplest: call `getUserMedals(userId)` here instead, filter to earned, and show showcase medals first (max 5).
5. **`src/components/community/NotificationBell.tsx`** (line ~192): replace `'You earned a new badge!'` with `` `You earned ${notif.meta?.name ?? 'a new medal'}!` `` and link it to `/medals`. Add `meta?: Record<string, unknown> | null` to `CommunityNotification` in `src/types/community.ts`. (`fetchNotifications` already selects `*`.)
6. **`src/services/progressFeedService.ts`**, `POST_TYPE_LABELS`: add `medal_earned: { label: 'Medal Earned', icon: 'trophy', color: '#fbbf24' }`.
7. **House member list (Phase 2 `HereNow.tsx`)**: show each member's first showcase medal (`sm`) next to their name. Fetch lazily per member, or skip if it's slow.

## Step 3: Closing Day One (Tim, the day the alpha ends)

```sql
update medals set available_until = now() where slug = 'day-one';
```

People who already have it keep it. Nobody new can earn it, and it disappears from the locked list.

## Done when

- [ ] Completing a commitment for the first time pops a "First Step" toast within a couple of seconds, adds a bell notification, and (public profile) adds a Feed post.
- [ ] `/medals` shows earned medals in color, locked ones with progress bars and rarity, and "Comeback Kid" as "???".
- [ ] Pinning three medals shows them on `/my-profile` and on `/member/:id` for others.
- [ ] A private profile shows no medals to other people.
- [ ] Velvet Alpha members have Day One.
- [ ] Badges on community posts still show, now as medal icons.
- [ ] `npm run typecheck` and `npm run build` pass.
