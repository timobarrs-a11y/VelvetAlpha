# Phase 1: Access (welcome window → card trial → membership)

> Read `docs/social-profiles/spec.md` §2 before starting. Start by giving me a
> short numbered plan (files and migrations you'll touch), then build it.
> When something isn't covered here, inspect the code rather than guess.

## Goal

New users get **48 hours of full access with no card**, starting when they
verify their email. After that, a lock screen offers **"Keep going free for 3
more days"** (card required, $0 today, then the cheapest plan) or **"Start my
membership"**. Only adults get in, and the free window can't be farmed by
bots or throwaway accounts.

## What exists today

- **Signup.** `src/pages/SignUpPage.tsx` + `src/services/authService.ts`.
  - The browser inserts the `user_profiles` row right after `supabase.auth.signUp`.
  - It also sets `age_verified_at = now()` from an "I'm 18+" checkbox.
- **Client-writable columns.** `age_verified_at` and `birthday` are in the
  client-writable column grant
  (`supabase/migrations/20261009131910_restrict_user_profiles_privileged_columns.sql`).
- **Unused modal.** `src/components/AgeVerificationModal.tsx` has date-of-birth
  selects but nothing renders it.
- **Trials.** The `start_trial()` RPC, called from
  `src/pages/PricingPageRoute.tsx`, gives a 7-day, 8,000-message trial with no
  card. The toast wrongly says "3-day".
- **Stripe.**
  - `supabase/functions/create-checkout-session` creates subscription
    checkouts.
  - `supabase/functions/stripe-webhook` syncs tiers on
    `checkout.session.completed` and `customer.subscription.updated` (it
    already handles `trialing`).
- **Tiers.** `src/types/subscription.ts` (`isPaidTier`: essential, plus,
  elite) and `src/hooks/useSubscription.ts`.
- **Rate limiting.** Table `rate_limits`, RPCs `check_rate_limit` and
  `record_rate_limit` (used in `supabase/functions/chat-turn`).
- **Settings.** The `app_settings` table (key/value jsonb) holds tunable
  numbers.

## Build

### 1. Signup and email verification
- **Date of birth at signup.**
  - Add it to `SignUpPage` using the selects from `AgeVerificationModal`.
  - Reject anyone under 18 in the UI and again on the server.
- **Server-side profile creation.**
  - Pass `terms_version`, `terms_accepted_at` and `birthdate` in
    `supabase.auth.signUp({ options: { data } })`.
  - Create the `user_profiles` row with a database trigger on `auth.users`
    insert (SECURITY DEFINER).
  - Remove the browser-side profile insert from `authService.signUp`.
- **`verify_age` RPC.** Add `verify_age(p_birthdate date)` (SECURITY DEFINER,
  `search_path = public, pg_temp`). It:
  - rejects anyone under 18,
  - writes `birthday` and `age_verified_at`,
  - is write-once.
  - The signup trigger uses the same check.
- **Lock down columns.** Revoke client UPDATE on `age_verified_at` and
  `birthday` (re-issue the column grant without them).
- **"Check your inbox" screen** after signup:
  - **Resend** (max once per 60 s, 5 per hour) via `supabase.auth.resend`,
  - **Wrong email? Change it.**
- **Bot check.** Add Cloudflare Turnstile in invisible mode to the signup form,
  and pass the token as `captchaToken` to `signUp`. Supabase verifies it
  server-side once CAPTCHA is enabled in the dashboard (see manual steps).
- **Existing users without a server-set DOB** see `AgeVerificationModal` on
  next app open, wired to `verify_age`.

### 2. Welcome window (48 h, no card)
- **New columns** on `user_profiles` (server-only, NOT in the client grant):
  - `welcome_expires_at timestamptz`,
  - `social_paused boolean default false`.
- **Start the window on email confirmation.** A trigger on `auth.users`
  update fires when `email_confirmed_at` goes from null to set. It:
  - sets `welcome_expires_at = email_confirmed_at + interval '48 hours'` and
    `subscription_status = 'welcome'`;
  - **only if** the normalized email isn't already in `welcome_grants`.
- **New table** `welcome_grants (email_normalized text PRIMARY KEY, user_id
  uuid, granted_at timestamptz)`. It has no FK cascade, so the row survives
  account deletion.
  - Normalize: lowercase, strip `+tag`, and remove dots in the local part for
    gmail.com / googlemail.com.
  - Disposable-email domains (blocklist table `disposable_email_domains`,
    seeded with a common list) never get a window.
- **Daily AI message cap** during the window: 200 per day (read
  `app_settings.welcome_daily_message_cap`).
  - Enforce it in every edge function that calls Claude for the user, at
    minimum `chat-turn`, `atlas-agent` and `velvet-game-turn`.
  - On hitting the cap, return a clear error. The client shows "You've used
    today's welcome messages — start your trial to keep going" with the trial
    button.
- **Rate limit.** Per-user limit of 20 AI messages per minute on those same
  functions, using the existing `rate_limits` RPCs.
- **Countdown and reminder.**
  - Countdown banner: "31 hours of full access left".
  - A reminder notification and email at 6 hours left (scheduled function).

### 3. Gate functions (SQL, SECURITY DEFINER, stable)
```sql
has_full_access(uid uuid) RETURNS boolean
--   tier in ('essential','plus','elite')
--   OR (subscription_status = 'trialing' AND has a Stripe subscription)
--   OR now() < welcome_expires_at

can_use_social(uid uuid) RETURNS boolean
--   has_full_access(uid) AND age_verified_at IS NOT NULL
--   AND NOT is_banned AND NOT social_paused
```
- Use `has_full_access` in edge functions that serve paid features.
- Mirror it on the client in `useSubscription` (for UI only; the server stays
  the source of truth).

### 4. Lock screen
When `has_full_access` is false and the user isn't on the free tier's limited
features, show a full-screen choice:

- **"Keep going free for 3 more days"** → card trial checkout (below).
- **"Start my membership"** → existing plan checkout.

Behind the lock screen, the user can still see their own goals and progress
(read-only). **Delete nothing.**

### 5. 3-day card trial
- **Trial mode in checkout.** Add a trial mode to `create-checkout-session`:
  - price = the essential plan,
  - `subscription_data.trial_period_days = 3`,
  - `payment_method_collection = 'always'`.
- **Webhook.** In `stripe-webhook`, set `subscription_status = 'trialing'` and
  `trial_expires_at` from `trial_end`. During `trialing`, grant top-tier
  features (same as today's trial). On conversion the tier becomes essential.
- **One trial per account.** Keep `trial_used`, and set it when the trial
  checkout completes.
- **Retire the old trial.** Remove the `start_trial()` call from
  `PricingPageRoute.tsx`. Leave the RPC in place but unused, so existing no-card
  trials expire naturally. Fix the toast text.

### 6. Possible-minor reports
- Add report reason `possible_minor` wherever reports are created.
- These sort to the top of the admin console report queue.
- An admin action sets `social_paused = true`.

## Non-negotiables
- **Server is the source of truth.** `welcome_expires_at`, `age_verified_at`,
  `birthday`, tier and status are only ever written server-side. The browser
  can't extend or grant access.
- **No photo ID.** No face images anywhere.
- **Nothing is deleted** when access lapses.
- **Signup must not break.** Profile creation moves to the trigger in the same
  change that removes the browser insert.
- **All new tables have RLS enabled.** All SECURITY DEFINER functions set
  `search_path` and revoke EXECUTE from `anon` unless needed.

## Done when
- [ ] A new user signs up with DOB, gets a verification email, clicks it, and
      has full access with a 48-hour countdown.
- [ ] Under-18 DOB is rejected, and the browser can no longer set
      `age_verified_at` or `birthday` directly (try it from the console).
- [ ] The same email (or `name+x@gmail.com`) doesn't get a second window.
- [ ] Message 201 in a day during the window is refused with the trial prompt.
- [ ] After 48 hours, the lock screen appears. "Keep going free for 3 more
      days" completes a Stripe test-mode checkout with $0 due, and full access
      returns.
- [ ] Stripe test clock: on day 3 the subscription converts to essential.
- [ ] Existing users without a server-set DOB see the age modal once.
- [ ] `npm run lint`, `npm run test` and `npm run build` pass.

## Manual steps for you
1. **Supabase → Authentication → Providers → Email:** turn on **Confirm
   email**. Do this only after this phase is deployed, because the old browser
   profile insert breaks with it on.
2. **Supabase → Authentication → Attack Protection:** enable CAPTCHA with
   **Cloudflare Turnstile**, and paste the Turnstile secret key.
3. **Cloudflare dashboard:** create a Turnstile site (invisible mode), and put
   the site key in the frontend env var Bolt asks for.
4. **Supabase → Authentication → Email templates:** customise the "Confirm
   signup" email so it says the 48 hours start when they click.
5. **Anthropic console:** set a spend alert on the API key.
