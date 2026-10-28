# Velvet Community: Spaces, Crews and Medals (build plan for Bolt)

> **For Bolt:** do one phase per chat. Open only the phase file you were given,
> the SQL file it names, and the source files it lists. Everything else you
> need has already been looked up and is written down here. **Don't scan the
> repo or read old migrations.** If something in a phase file doesn't match
> the code, stop and say so instead of exploring.

## The goal

Bring people from different places into one house they can see at a glance.
Velvet already knows what people are into from the personal questionnaire,
so it puts them in the right spaces automatically. Nobody has to know
somebody to get in.

**How we know it's done**

1. It does what Discord does: spaces with rooms, live chat, members, roles,
   private crews, invites, mentions, unread counts and "who's here now."
2. A stranger can find a crew in under 30 seconds. Every space is listed
   and searchable, even locked ones. A crew can lock its door, but the door
   is always on the map. **One exception (Tim, 28 October): a Hidden door**,
   see "After Phase 4" below.

## Phases (in order, each depends on the one before)

| Phase | File | What ships | Size |
|---|---|---|---|
| 1 | [phase-1-quick-fixes.md](phase-1-quick-fixes.md) | Discover tab uses questionnaire interests; seeded boards approved; category typo | Small |
| 2 | [phase-2-spaces.md](phase-2-spaces.md) | Spaces with live rooms, join/leave, auto-placement from the questionnaire, presence, unread, the **House** page, the private **Velvet Alpha** space | Large |
| 3 | [phase-3-medals.md](phase-3-medals.md) | One medal system, live unlocks, profile medal case and showcase | Medium |
| 4 | [phase-4-crews.md](phase-4-crews.md) | Crews: request/invite/private spaces, sub-spaces, mods, bans, role tags, invite links, @mentions, directory | Large |
| 5 | [phase-5-voice.md](phase-5-voice.md) | Voice rooms (plan only, don't build yet) | n/a |

Each phase's SQL is in [`sql/`](sql/). **Copy it into a new migration word
for word.** It was tested on Postgres 16 against this repo's real community,
goals, check-in, friends, referral and progress-feed migrations. All four
apply cleanly from scratch, in order. Each phase can be re-run safely (for
example after a half-failed apply) **as long as the next phase hasn't been
applied yet**. Never re-run an earlier phase after a later one.

## Words used in this plan

| Word | What it is in the code |
|---|---|
| **Space** | A row in `community_boards` (an existing board). Gaming Lounge is a space. |
| **Room** | A row in `community_rooms`: a live chat channel inside a space (`#general`, `#looking-for-group`). |
| **Posts** | The existing forum posts in a board (`community_posts`). They stay, as the space's Posts tab. |
| **Crew** | A space with `parent_board_id` set (lives inside another space) and usually `request` or `invite` visibility. |
| **Spaces** | The `/spaces` page (it was House at `/house`; the name is retired and old links redirect): your spaces, who's here, what's unread, all on one screen. The community boards' posts live here too, as each space's Posts tab. |
| **Medal** | A row in `medals`; a user's progress is in `user_medals`. |

## What already exists (don't rebuild it)

- **Community boards** `src/pages/CommunityPage.tsx`, `BoardPage.tsx`, `PostDetailPage.tsx`, `src/services/communityService.ts`: posts, comments, smilie reactions, polls, search, reports, notifications (`NotificationBell.tsx`), weekly threads, bots Maya and Jordan (`supabase/functions/community-bot`).
- **Messaging overlay** `src/components/MessagingOverlay.tsx`, `src/shared/supabase/queries/messaging.ts`: friends (`im_friendships`), 1:1 DMs, typing, presence (`im_presence`), blocks, Discover.
- **Progress feed and public profiles** `ProgressFeedPage.tsx`, `MyPublicProfilePage.tsx`, `MemberProfilePage.tsx`, `progressFeedService.ts`: `member_profiles`, `member_follows`, `progress_posts` (auto-posted by triggers), likes, comments, Atlas introductions.
- **Moderation** `supabase/functions/_shared/moderation.ts` (`moderateInput`), `record_moderation_strike`, `check_rate_limit` / `record_rate_limit`, `user_profiles.is_banned`, `community_reports`, `AdminModerationPage.tsx`.
- **Access** `check_access()` RPC and `src/hooks/useAccess.ts` (`canAccessSocial` = age verified AND welcome window/trial/paid).
- **Questionnaire** `src/features/questionnaire/personalBank.ts`, saved by `userProfileService.saveUserLevelAnswers` into `user_profiles`: `hobbies`, `sports` (also holds the swipe-deck answers), `sports_interests`, `entertainment_interests`, `tech_interests`, `lifestyle_interests`, `music_genre`. These already drive the Daily Feed (`newsService.getUserAllInterests`) and the Daily Lens (`CompanionHubRightRail.tsx`).
- **"Group Chat"** (`/group-chat`) is the user plus their AI companions. It is **not** human group chat and isn't part of this plan.

## Before Phase 1: three checks in the Supabase SQL editor (Tim)

```sql
-- 1. Are the seeded boards hidden? (Phase 1 fixes this if any say false.)
select name, is_approved from community_boards order by sort_order;

-- 2. The interest columns must be text[] (all phases assume it).
select column_name, data_type, udt_name from information_schema.columns
where table_name = 'user_profiles'
  and column_name in ('hobbies','sports','interests','sports_interests','entertainment_interests',
                      'tech_interests','lifestyle_interests','music_genre','gender');
-- Expect udt_name = _text for all but music_genre and gender (text).

-- 3. Are the bot accounts flagged? (Phase 2 fixes this if false.)
select id, name, is_bot from user_profiles where id::text like 'b0b00000%';
```

## After Phase 4: Hidden spaces, and spaces and crews as one view (built)

Migration `supabase/migrations/20261109100000_hidden_spaces_and_space_cards.sql`.

**Hidden door (Tim, 28 October).** A fifth door next to Open, Request, Invite only and Private,
for private groups of friends. A hidden space or crew is never listed in Browse, search,
suggestions or anyone's sidebar unless they're in it. The only ways in are an invite link or an
owner/mod adding a friend. Everything inside it (its crews, rooms and posts) is hidden the same
way. Making a door hidden needs social access (age verified). Admins still see every space, and
reporting works inside hidden spaces as everywhere else. One rule, `can_see_board()`, decides
visibility for the board policy, the directory, search, suggestions and `can_read_board()`.

**One view.** Spaces and crews used to read as two UIs: crews were only on the Browse page,
Posts left Spaces for the old forum page, and a space or crew you weren't in didn't open at
all. Now:

| Before | Now |
|---|---|
| Crews listed only on Browse, behind a drill-in | A **Crews** tab in every space (`?tab=crews`), with Join/Request and **Start a crew** |
| Posts opened `/community/board/:id`, a different page | A **Posts** tab inside Spaces (`?tab=posts`); old board links redirect there |
| A space you weren't in fell back to the overview | Open spaces show their rooms with Join; closed doors show a card with Request, "Use invite" or "Members only", plus their crews |
| Sidebar showed crews only after a lookup that often never ran | Crews you're in nest under their space (unread rolls up when folded); unfolding also lists crews you can join |
| Crews didn't say where they live | A breadcrumb (`Gaming Lounge › Crew`) on the header and door card |

`get_my_spaces()` and `get_space_directory()` now return `parent_board_id`, `parent_name` and
a `sub_space_count` of crews you can see; `get_space_card(id)` returns one space as Spaces
shows it.

**The old Community page is retired.** `/community` redirects to Browse, which took over what
only that page had: the Featured row, **Propose a space** (top-level spaces still wait for
approval; crews don't), and the note that your proposal is waiting. The approval queue itself
moved to the admin Moderation page. Post cards in the Posts tab use the same row style as rooms
and crews.

## Ideas for after Phase 4 (not scheduled)

- **Daily Lens in rooms:** the tags that pick a person's Lens videos also
  pick their spaces, so a space can show "4 people in Gaming watched this
  today" and give the room something to talk about.
- **Coach or companion hosts:** a Coach runs a space's daily prompt and
  weekly recap, on the same plumbing Maya and Jordan already use.
- **Learned interests:** `threadSignalService.ts` adds interests from chat
  over time. Use `get_space_suggestions()` to offer "There's a 2K27 crew with
  14 people. Want in?" when a new interest appears.
- **Fold Feed, Discover and Velvet Rope into Spaces** so social has one door.
