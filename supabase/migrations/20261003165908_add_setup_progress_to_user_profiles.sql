/*
# Track guided setup progress on user profiles

## Summary
Saves where each user is in the guided setup (coach -> optional friend/companion)
so the app can resume them exactly where they left off on any device.

## 1. Modified Tables
- `user_profiles`
  - `setup_step` (text, nullable): last setup screen the user reached. One of
    'atlas', 'coach_avatar', 'coach_environment', 'coach_ready',
    'companion_in_progress', 'choose_conversation', 'complete'.
  - `setup_path` (text, nullable): 'coach_only' or 'coach_and_companion'.

## 2. Backfill
1. Users with a coach AND a friend/companion -> step 'complete', path 'coach_and_companion'.
2. Users with only a coach -> step 'complete', path 'coach_only'.
3. Users with only a friend/companion (legacy) -> step 'complete'.

## 3. Security
- No policy changes. Existing "Users can update own profile" policy already
  restricts writes to the user's own row.

## 4. Notes
1. Check constraints keep values to the known set.
2. Idempotent: safe to re-run.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='setup_step') THEN
    ALTER TABLE public.user_profiles ADD COLUMN setup_step text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='setup_path') THEN
    ALTER TABLE public.user_profiles ADD COLUMN setup_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_setup_step_check') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_setup_step_check
      CHECK (setup_step IS NULL OR setup_step IN ('atlas','coach_avatar','coach_environment','coach_ready','companion_in_progress','choose_conversation','complete'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_profiles_setup_path_check') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_setup_path_check
      CHECK (setup_path IS NULL OR setup_path IN ('coach_only','coach_and_companion'));
  END IF;
END $$;

UPDATE public.user_profiles p
SET setup_step = 'complete',
    setup_path = CASE
      WHEN EXISTS (SELECT 1 FROM public.companions c WHERE c.user_id = p.id AND c.relationship_type = 'mentor')
       AND EXISTS (SELECT 1 FROM public.companions c WHERE c.user_id = p.id AND c.relationship_type <> 'mentor')
        THEN 'coach_and_companion'
      WHEN EXISTS (SELECT 1 FROM public.companions c WHERE c.user_id = p.id AND c.relationship_type = 'mentor')
        THEN 'coach_only'
      ELSE NULL
    END
WHERE p.setup_step IS NULL
  AND EXISTS (SELECT 1 FROM public.companions c WHERE c.user_id = p.id);
