# Phase 6c: Friend-request emails (optional, needs Tim)

**Paste this to Bolt (only after Tim has added the key below):**

> Do Phase 6c from `docs/velvet-world/phase-6c-email.md`. Phases 6a and 6b
> are done. Only open the files the phase lists.

## Rule

Email only when someone **did something for you**: right now, that's
sending you a friend request. **Never** email because someone viewed a
billboard or walked past a house. Views aren't recorded anywhere, so this
can't happen by accident.

## Before starting (Tim)

Every user already has an email address (it's their login). What's
missing is a **sending service**: Velvet has no way to send its own email
yet. Supabase only sends login emails. Recommended: **Resend** (free up to
3,000 emails a month, simple API).

1. Create a Resend account and verify the sending domain.
2. Supabase → Edge Functions → Secrets: add `RESEND_API_KEY` and
   `EMAIL_FROM` (for example `Velvet <hello@yourdomain>`).
3. Tell Bolt "the key is in."

## What ships

- One email a day at most, per person, bundling new friend requests:
  "Maya and 2 others want to be friends on Velvet." The button opens
  `/world`, where the Messaging overlay's requests list is.
- A setting **Email me about friend requests** (on by default) on the
  profile settings page, and a one-click unsubscribe link in every email.

## Files

| Do | File |
|---|---|
| New migration | the SQL below |
| New | `supabase/functions/friend-request-digest/index.ts` |
| Edit | the profile settings page: one toggle bound to `user_profiles.email_friend_requests` |

## SQL (new migration)

```sql
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email_friend_requests boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS friend_digest_sent_at timestamptz;
-- Unsubscribe links carry this token, never the user id.
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email_unsub_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Run the digest every day at 17:00 UTC (same pattern as the dream-hygiene job).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'friend-request-digest') THEN
    PERFORM cron.unschedule('friend-request-digest');
  END IF;
  PERFORM cron.schedule('friend-request-digest', '0 17 * * *', $cron$
    SELECT net.http_post(
      url := current_setting('app.supabase_url', true) || '/functions/v1/friend-request-digest',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)),
      body := '{}'::jsonb);
  $cron$);
END $$;
```

Copy the `url` line exactly as the existing `dream-hygiene` job does it in
`supabase/migrations/20261002204045_20261002224000_update_cron_auth_headers.sql.sql`.
That job hardcodes the project URL. Open only that file to copy it.

## Edge function `friend-request-digest`

1. **Auth:** require `Authorization: Bearer <service role key>`, the same
   check the `dream-hygiene` function uses. Anything else gets a 401.
2. **Query** (service role): pending `im_friendships` rows created since the
   addressee's `friend_digest_sent_at` (or the last 24 hours if null),
   grouped by `addressee_id`. Join `user_profiles` and keep only addressees
   with `email_friend_requests = true` and `is_banned` not true. Get
   addressee emails from `auth.users`. Get requester names from
   `im_discovery_profiles.display_name`, falling back to "Someone".
3. **Send** one email per addressee through
   `POST https://api.resend.com/emails`. Include a `List-Unsubscribe`
   header and a footer link to
   `/functions/v1/friend-request-digest?unsub=<email_unsub_token>`.
   - Subject: "{name} wants to be friends on Velvet", or
     "{name} and {n} others…" for several.
   - Body: names only. No billboard contents and no medals.
4. Set `friend_digest_sent_at = now()` for each person emailed. On a send
   error, log it and move on; don't retry in a loop.
5. **GET with `?unsub=`:** set `email_friend_requests = false` for that
   token and return a tiny HTML page: "You won't get these emails anymore."
   No auth needed (the token is the key).

## Done when

- [ ] Two requests to the same person in one day → one email that names both.
- [ ] A request that was already accepted before the digest ran isn't emailed (it's no longer pending).
- [ ] With the toggle off, or after clicking unsubscribe, no email.
- [ ] Calling the function without the service key → 401.
