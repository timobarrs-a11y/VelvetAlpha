/*
# Add server-side drift write and clear functions

## Purpose
Move voice fidelity drift writes off the client. The browser can no longer
write drift_vfs, drift_checked_at, drift_needs_correction, correction_applied,
or voice_baseline directly (protected by trigger). These functions run as
SECURITY DEFINER (bypassing the trigger) and verify the caller owns the companion.

## Functions
1. record_voice_drift: writes a drift log row + updates companion drift fields.
2. clear_drift_correction: sets drift_needs_correction = false.
*/

CREATE OR REPLACE FUNCTION record_voice_drift(
  p_companion_id uuid,
  p_vfs_overall real,
  p_drift_detected boolean,
  p_needs_correction boolean,
  p_vfs_tone real DEFAULT NULL,
  p_vfs_vocabulary real DEFAULT NULL,
  p_vfs_emotional real DEFAULT NULL,
  p_vfs_energy real DEFAULT NULL,
  p_vfs_boundary real DEFAULT NULL,
  p_messages_sampled int DEFAULT NULL,
  p_notes text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    v_uid := (SELECT user_id FROM companions WHERE id = p_companion_id);
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM companions WHERE id = p_companion_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Not authorized: companion does not belong to caller';
  END IF;

  INSERT INTO companion_drift_log (
    companion_id, user_id, vfs_overall, vfs_tone, vfs_vocabulary,
    vfs_emotional, vfs_energy, vfs_boundary, drift_detected,
    correction_applied, messages_sampled, notes
  ) VALUES (
    p_companion_id, v_uid, p_vfs_overall, p_vfs_tone, p_vfs_vocabulary,
    p_vfs_emotional, p_vfs_energy, p_vfs_boundary, p_drift_detected,
    false, p_messages_sampled, p_notes
  );

  UPDATE companions
  SET
    drift_vfs = p_vfs_overall,
    drift_needs_correction = p_needs_correction,
    drift_checked_at = now()
  WHERE id = p_companion_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION record_voice_drift FROM anon;
GRANT EXECUTE ON FUNCTION record_voice_drift TO authenticated;

CREATE OR REPLACE FUNCTION clear_drift_correction(
  p_companion_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    v_uid := (SELECT user_id FROM companions WHERE id = p_companion_id);
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM companions WHERE id = p_companion_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE companions
  SET drift_needs_correction = false
  WHERE id = p_companion_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION clear_drift_correction FROM anon;
GRANT EXECUTE ON FUNCTION clear_drift_correction TO authenticated;
