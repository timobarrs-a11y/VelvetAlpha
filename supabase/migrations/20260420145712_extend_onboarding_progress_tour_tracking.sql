/*
  # Extend Onboarding Progress with Tour Tracking

  ## Purpose
  The tutorial system is being rebuilt so it runs inside the live companion chat
  UI (the new main hub) instead of a separate onboarding page. Users can now
  re-play the tour on demand from Settings. These columns let us:
  1. Track why the tour is running (first_time, manual_replay, feature_highlight)
  2. Know when each user last took a tour so we can nudge dormant users later
  3. Record dismissed mini tours so feature highlights don't repeat

  ## Modified Tables

  ### user_onboarding_progress (additive only)
  - `tour_source` (text, default `'first_time'`) — reason the current/last tour ran
  - `last_tour_at` (timestamptz, nullable) — timestamp of the most recent tour start
  - `mini_tours_seen` (text[], default `'{}'`) — per-feature highlight dismissals

  ## Security
  - No RLS changes; existing row-owner policies continue to cover these columns
  - No destructive operations performed

  ## Notes
  - All changes use IF NOT EXISTS guards so re-running is safe
  - Existing rows keep working; defaults back-fill automatically on read
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_onboarding_progress' AND column_name = 'tour_source'
  ) THEN
    ALTER TABLE user_onboarding_progress ADD COLUMN tour_source text DEFAULT 'first_time';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_onboarding_progress' AND column_name = 'last_tour_at'
  ) THEN
    ALTER TABLE user_onboarding_progress ADD COLUMN last_tour_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_onboarding_progress' AND column_name = 'mini_tours_seen'
  ) THEN
    ALTER TABLE user_onboarding_progress ADD COLUMN mini_tours_seen text[] DEFAULT '{}';
  END IF;
END $$;
