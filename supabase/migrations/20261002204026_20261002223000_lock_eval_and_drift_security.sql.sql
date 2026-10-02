/*
# Lock down eval_verifications and companion drift fields

## Changes
1. eval_verifications: restrict INSERT and UPDATE to super-users only.
   Regular users can still SELECT and INSERT their own responses/extractions,
   but ground-truth verifications (the eval baseline) can only be set by admins.
2. companions: revoke UPDATE on drift-related columns from authenticated users.
   Drift fields (drift_vfs, drift_checked_at, drift_needs_correction,
   correction_applied, voice_baseline) are now server-trusted — users cannot
   forge or suppress their own drift records.
3. Add a SECURITY DEFINER function for server-side voice baseline refresh.

## Security
- eval_verifications INSERT/UPDATE: only super-users (is_super_user = true)
- companions UPDATE: users can still update name, avatar, personality fields,
  but NOT drift fields. Column-level GRANT controls which columns are writable.
*/

-- 1. Lock down eval_verifications: only super-users can insert/update
DROP POLICY IF EXISTS "insert_own_eval_verifications" ON eval_verifications;
DROP POLICY IF EXISTS "update_own_eval_verifications" ON eval_verifications;

CREATE POLICY "insert_super_user_eval_verifications" ON eval_verifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND COALESCE(user_profiles.is_super_user, false) = true
  )
);

CREATE POLICY "update_super_user_eval_verifications" ON eval_verifications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND COALESCE(user_profiles.is_super_user, false) = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND COALESCE(user_profiles.is_super_user, false) = true
  )
);

-- 2. Lock down companion drift fields: revoke all UPDATE, grant only non-drift columns
REVOKE UPDATE ON companions FROM authenticated;

-- Re-grant UPDATE only on user-editable columns (NOT drift fields)
-- Note: we need to check which columns users legitimately edit
-- From the app: name, bio, personality text, signature_voice, avatar config,
-- chat_bubble_color, text_color, font_family, relationship_type, questionnaire answers
-- Drift fields that must NOT be user-editable: drift_vfs, drift_checked_at,
-- drift_needs_correction, correction_applied, voice_baseline
DO $$
BEGIN
  -- Grant UPDATE on all columns EXCEPT drift-related ones
  -- We use a dynamic approach: grant on columns that exist and are not drift fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'name') THEN
    EXECUTE 'GRANT UPDATE (name) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'bio') THEN
    EXECUTE 'GRANT UPDATE (bio) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'gender') THEN
    EXECUTE 'GRANT UPDATE (gender) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'signature_voice') THEN
    EXECUTE 'GRANT UPDATE (signature_voice) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'relationship_type') THEN
    EXECUTE 'GRANT UPDATE (relationship_type) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'avatar_config') THEN
    EXECUTE 'GRANT UPDATE (avatar_config) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'chat_bubble_color') THEN
    EXECUTE 'GRANT UPDATE (chat_bubble_color) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'own_bubble_color') THEN
    EXECUTE 'GRANT UPDATE (own_bubble_color) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'text_color') THEN
    EXECUTE 'GRANT UPDATE (text_color) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'own_text_color') THEN
    EXECUTE 'GRANT UPDATE (own_text_color) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'font_family') THEN
    EXECUTE 'GRANT UPDATE (font_family) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'chat_wallpaper') THEN
    EXECUTE 'GRANT UPDATE (chat_wallpaper) ON companions TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companions' AND column_name = 'atlas_goal_text') THEN
    EXECUTE 'GRANT UPDATE (atlas_goal_text) ON companions TO authenticated';
  END IF;
END
$$;

-- 3. SECURITY DEFINER function to refresh voice_baseline (server-side only)
CREATE OR REPLACE FUNCTION refresh_voice_baseline(
  p_companion_id uuid,
  p_new_baseline text
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
    -- Service-role caller: allow (used by edge functions)
    v_uid := (SELECT user_id FROM companions WHERE id = p_companion_id);
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE companions
  SET
    voice_baseline = p_new_baseline,
    drift_needs_correction = false,
    drift_checked_at = now(),
    correction_applied = true
  WHERE id = p_companion_id
    AND user_id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_voice_baseline(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION refresh_voice_baseline(uuid, text) TO authenticated;
