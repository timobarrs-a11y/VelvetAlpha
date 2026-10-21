/*
# Add public profile identity choice

## Summary
Adds a clear public-profile picture preference without changing the private user profile or the existing generated companion/avatar configuration. Members can choose whether their public page uses the generated avatar face or one smiley from the existing smiley registry.

## Modified Tables
- `public.member_profiles`
  - `profile_image_type` (text, default `avatar`) — the public picture mode, restricted to `avatar` or `smilie`.
  - `profile_smilie_code` (text, nullable) — the selected smiley registry code when the public picture mode is `smilie`.

## Security
- Existing authenticated owner-only INSERT/UPDATE/DELETE policies remain in place.
- Public profile SELECT behavior remains unchanged and only exposes rows allowed by the existing public-profile policies.
- Column-level UPDATE access is extended only to the two new public-profile fields and `updated_at`; server-managed fields remain protected.

## Important Notes
1. Existing members continue to use their generated avatar because the new mode defaults to `avatar`.
2. The application validates the selected smiley against the registry before saving it.
3. No private personal-profile fields are copied into or exposed by this change.
*/

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS profile_image_type text NOT NULL DEFAULT 'avatar',
  ADD COLUMN IF NOT EXISTS profile_smilie_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'member_profiles_profile_image_type_check'
      AND conrelid = 'public.member_profiles'::regclass
  ) THEN
    ALTER TABLE public.member_profiles
      ADD CONSTRAINT member_profiles_profile_image_type_check
      CHECK (profile_image_type IN ('avatar', 'smilie'));
  END IF;
END $$;

GRANT UPDATE (
  display_name,
  headline,
  bio,
  avatar_config,
  profile_image_type,
  profile_smilie_code,
  is_public,
  shared_goal_ids,
  discoverable,
  updated_at
)
ON public.member_profiles TO authenticated;
