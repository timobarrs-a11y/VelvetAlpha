/*
# Add shared memory consent to user_profiles

## Purpose
Adds a `shared_memory_consent` column to `user_profiles` so the app can track
whether the user has opted into the shared memory network — where life news
told to one AI (coach or companion) becomes available to all of their AI people.

## Changes
1. New column on `user_profiles`:
   - `shared_memory_consent` (boolean, default true)
     - `true`: the user's AI people share life news with each other
     - `false`: each AI only knows what was told directly to it
   - Default is `true` so the "how did it know?" moment happens naturally
     for new users. The user can turn it off at any time in settings.

2. New column on `memory_items`:
   - `shared_origin_companion_id` (uuid, nullable)
     - When a memory is shared (scope='global'), this records which companion
       originally heard it, so other companions can say "your coach mentioned..."
     - FK to companions(id) ON DELETE SET NULL

## Security
- No new RLS policies needed — existing user_profiles and memory_items policies
  already cover these columns (they're on tables the user owns).
- The new memory_items column is informational only and does not change access patterns.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS shared_memory_consent boolean DEFAULT true;

ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS shared_origin_companion_id uuid REFERENCES companions(id) ON DELETE SET NULL;
