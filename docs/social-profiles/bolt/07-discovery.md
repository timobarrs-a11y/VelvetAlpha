# Phase 7: Follows and discovery

> Read `docs/social-profiles/spec.md` §8 before starting. Phases 1–6 must be
> done. Start with a short numbered plan, then build it.

## Goal

Members find each other two ways:

- **By shared goals:** "12 people training for a 5K right now".
- **By trending:** the posts showing the most effort and real engagement.

They can follow people and search by interest or goal type. **Follower counts
are never shown.**

## Build
- **Follows.** Table `social_follows (follower_id, followee_id, created_at,
  PRIMARY KEY (follower_id, followee_id))`, if not already added in phase 5.
  - Follow and Unfollow buttons on profiles.
  - A "People I follow" list for the user themselves.
  - **No follower or following counts anywhere**, including on your own
    profile.
- **Following feed.** Posts from people you follow, newest first.
- **Shared-goal discovery.**
  - Cards grouped by `goal_type` and normalized goal title from
    `social_shared_goals`, e.g. "12 people training for a 5K".
  - Tapping a card lists those members' profiles.
- **Trending.**
  - Rank posts from the last 72 hours by an effort score:
    - milestone size, streak length,
    - **human** likes (`liker_kind = 'human'` only), comments, follows from
      the post,
    - with a recency decay.
  - **Bot likes do not count toward ranking.**
- **Search** by interest and goal type.
- **Eligibility.** Discovery only includes profiles that are discoverable, pass
  `can_use_social`, aren't blocked either way, and aren't `crisis_flagged`.
- **New-member boost.**
  - A member's first 5 posts are mixed into the following/trending feeds of
    active members with matching goal types, so early likes come from real
    people too.
  - Cap how often any one member sees boosted posts.

## Non-negotiables
- **No follower counts.**
- **Trending is human-ranked.** It uses human signals only.
- **Blocks, visibility and crisis flags** apply everywhere in discovery.

## Done when
- [ ] Shared-goal cards show correct counts and open the right member lists.
- [ ] A post with 50 bot likes and no human engagement doesn't outrank a post
      with 5 human likes.
- [ ] Blocked or non-discoverable profiles never appear.
- [ ] No follower count appears anywhere in the UI or in API responses.
- [ ] `npm run lint`, `npm run test` and `npm run build` pass.
