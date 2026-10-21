/*
# Make member profiles public by default

## Summary
Changes the default value of `member_profiles.is_public` from `false` to `true`
so new members are visible by default. Also flips existing private profiles
to public, since the app now treats public as the default state.

## Modified Tables
- `public.member_profiles`: `is_public` column default changed to `true`.

## Data Migration
- All existing rows with `is_public = false` are set to `true`.
*/

ALTER TABLE public.member_profiles
  ALTER COLUMN is_public SET DEFAULT true;

UPDATE public.member_profiles
SET is_public = true, updated_at = now()
WHERE is_public = false;
