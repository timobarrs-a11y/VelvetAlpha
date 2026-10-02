/*
# Add quality_review_consent and fleet_exclusion columns

1. Purpose
- Adds `quality_review_consent` (boolean, default false) to user_profiles for
  tracking whether the user has opted into fleet-level quality review (Pass B
  dreaming). Per the roadmap, the default should be set per the current ToS
  decision — we default to false (opt-in) until the ToS is updated.
- Adds `fleet_excluded` (boolean, default false) as a composite exclusion flag
  that covers minors (age_verified_at IS NULL), moderation-flagged
  (is_banned = true OR moderation_strikes >= 3), and deleted accounts.
  This is a denormalized flag for fast filtering in fleet queries; the
  edge function also checks the underlying columns.

2. Columns
- quality_review_consent boolean DEFAULT false
- fleet_excluded boolean DEFAULT false

3. Security
- Both columns are user-readable (they're on user_profiles which already has
  a SELECT policy for own row). Writes via service role only (edge functions,
  admin actions). No new RLS policies needed — existing user_profiles policies
  cover these columns.

4. Index
- Partial index on user_profiles(id) WHERE quality_review_consent = true
  AND fleet_excluded = false — for fast fleet-level queries.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS quality_review_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fleet_excluded boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_profiles_fleet_eligible
ON user_profiles (id)
WHERE quality_review_consent = true AND fleet_excluded = false;
