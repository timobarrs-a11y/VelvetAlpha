/*
# Fix companions UPDATE: restore all columns, protect drift via trigger

## Problem
The previous migration revoked UPDATE on all companion columns and only
granted back a subset. But the app legitimately updates many more columns
(last_message_at, first_message_sent, is_active, personality_traits, hobbies,
sports, music_genre, favorite_color, zodiac_sign, custom_name, etc.).

## Fix
1. Re-grant UPDATE on ALL columns to authenticated (undo the narrow grant).
2. Add a BEFORE UPDATE trigger that blocks changes to drift-related columns
   (drift_vfs, drift_checked_at, drift_needs_correction, correction_applied,
   voice_baseline) unless the caller is the service role (auth.uid() IS NULL).

## Security
- Users can still update name, avatar, personality, etc. — everything they need.
- Drift fields can only be written server-side (service role has auth.uid() = NULL,
  which bypasses RLS and the trigger check).
- The refresh_voice_baseline SECURITY DEFINER function still works because it
  runs as the table owner, bypassing triggers.
*/

-- 1. Restore full UPDATE grant on companions
REVOKE UPDATE ON companions FROM authenticated;
GRANT UPDATE ON companions TO authenticated;

-- 2. Add trigger to protect drift columns from client-side writes
CREATE OR REPLACE FUNCTION protect_drift_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only block when auth.uid() is set (i.e. a real user, not service role)
  IF auth.uid() IS NOT NULL THEN
    -- If any drift column is being changed, block it
    IF NEW.drift_vfs IS DISTINCT FROM OLD.drift_vfs THEN
      RAISE EXCEPTION 'drift_vfs is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.drift_checked_at IS DISTINCT FROM OLD.drift_checked_at THEN
      RAISE EXCEPTION 'drift_checked_at is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.drift_needs_correction IS DISTINCT FROM OLD.drift_needs_correction THEN
      RAISE EXCEPTION 'drift_needs_correction is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.correction_applied IS DISTINCT FROM OLD.correction_applied THEN
      RAISE EXCEPTION 'correction_applied is server-managed and cannot be updated by clients';
    END IF;
    IF NEW.voice_baseline IS DISTINCT FROM OLD.voice_baseline THEN
      RAISE EXCEPTION 'voice_baseline is server-managed; use refresh_voice_baseline() instead';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_drift_columns_trigger ON companions;
CREATE TRIGGER protect_drift_columns_trigger
  BEFORE UPDATE ON companions
  FOR EACH ROW
  EXECUTE FUNCTION protect_drift_columns();
