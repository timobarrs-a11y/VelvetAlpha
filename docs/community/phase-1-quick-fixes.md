# Phase 1: Quick fixes

## Prompt to paste into Bolt

> Read `docs/community/phase-1-quick-fixes.md` and do exactly what it says.
> Only open the files it names. Copy `docs/community/sql/phase-1-interest-tags.sql`
> into a new migration without changing it.

---

## Why

1. **Discover starts empty.** When someone opens the Discover tab for the
   first time, `MessagingOverlay.tsx` fills their discovery card from
   `user_profiles.interests`. That's a legacy column the V2 questionnaire
   never writes, so people who answered every interest question still get a
   blank card, and the "shared interests" ranking has nothing to match.
2. **Seeded boards may be hidden.** `set_board_approval_on_insert` marks a
   board unapproved unless `auth.uid()` is a super user. Migrations run with
   no `auth.uid()`, so the 12 boards from the seed migration (Moms, Dads,
   Gaming Lounge, Sports Talk...) were saved as unapproved: Tim sees them,
   nobody else does.
3. **Category typo.** The categories migration looks for
   `'Movies/Music & Pop Culture'`, but the board is named
   `'Movies, Music & Pop Culture'`, so it's filed under "General."

## Step 1: Migration

Create a migration with the exact contents of
`docs/community/sql/phase-1-interest-tags.sql`. It:

- adds `user_interest_tags(user_id, include_signals)`, an internal helper that
  merges all seven interest columns into one list (used again in Phase 2),
- adds the `get_my_interest_tags()` RPC for the client,
- backfills empty `im_discovery_profiles.interests`,
- approves the 12 seeded boards and fixes the category.

## Step 2: Frontend (one file)

**`src/components/MessagingOverlay.tsx`**, in the settings view's load effect
(around line 1128, the `else` branch commented "Bootstrap from user_profiles
so the user doesn't start empty"). Replace the `user_profiles.interests`
read with the RPC:

```ts
} else {
  // Bootstrap from user_profiles + questionnaire so the user doesn't start empty.
  const [{ data: up }, { data: tags }] = await Promise.all([
    supabase.from('user_profiles').select('name, avatar_config').eq('id', user.id).maybeSingle(),
    supabase.rpc('get_my_interest_tags'),
  ]);
  const interests = (tags as string[] | null) ?? [];
  if (up) {
    setDisplayName(up.name ?? '');
    setInterests(interests);
    await syncDiscoveryFromProfile({ name: up.name, interests }).catch(() => {});
  }
}
```

Don't change anything else in that file.

## Done when

- [ ] A user who finished the questionnaire but never opened Discover sees their questionnaire interests as tags on their first visit.
- [ ] `select name, is_approved from community_boards` shows `true` for all 12 seeded boards.
- [ ] Movies, Music & Pop Culture shows under "Interests & Hobbies" on `/community`.
- [ ] `npm run build` passes.
