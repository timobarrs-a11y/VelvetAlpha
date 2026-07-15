/*
  # Content Moderation System — CSAE input screening, strikes & bans

  ## Why
  The AI chat is an adult companion product, so ordinary adult content is allowed.
  What is NOT allowed — and is illegal — is sexual content involving minors (CSAE).
  The edge functions screen user input locally BEFORE it is stored or sent to the
  model; on a block they call the RPC below to log the event and strike/ban the user.

  We intentionally do NOT store the offending text — logging CSAE material is itself
  a liability. We record only the user, the category, and the timestamp.

  ## Changes
  ### user_profiles
    - `moderation_strikes` (integer) — count of policy violations
    - `is_banned` (boolean)          — hard block; edge functions reject banned users
    - `banned_at` (timestamptz)

  ### moderation_events (audit)
    - one row per blocked attempt: user_id, category, created_at. No content.
    - RLS enabled with NO client policies → only service_role (edge functions) and
      the dashboard can read/write. Not exposed to end users.

  ### RPC record_moderation_strike(p_user_id, p_category) → integer
    - SERVICE-ROLE ONLY. Inserts the event, increments strikes, and bans the user
      (immediately for 'csae', or once strikes reach the threshold otherwise).
    - Returns the new strike count.

  ## Security
    - record_moderation_strike is EXECUTE-able only by service_role, so a client
      cannot log/strike/ban arbitrary users.
*/

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS moderation_strikes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_banned
  ON user_profiles(is_banned)
  WHERE is_banned = true;

-- ---------------------------------------------------------------------------
-- 2. Audit table (no offending content stored)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_user ON moderation_events(user_id, created_at DESC);

ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: end users get zero access. service_role (edge functions)
-- bypasses RLS; admins read via the dashboard / service role.

-- ---------------------------------------------------------------------------
-- 3. Strike / ban RPC — service role only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_moderation_strike(p_user_id uuid, p_category text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  BAN_THRESHOLD constant integer := 3;  -- non-CSAE categories: ban on the 3rd strike
  v_strikes integer;
BEGIN
  INSERT INTO moderation_events (user_id, category) VALUES (p_user_id, p_category);

  UPDATE user_profiles
    SET moderation_strikes = moderation_strikes + 1
    WHERE id = p_user_id
    RETURNING moderation_strikes INTO v_strikes;

  -- CSAE is zero-tolerance: ban immediately. Other categories: ban at threshold.
  IF p_category = 'csae' OR v_strikes >= BAN_THRESHOLD THEN
    UPDATE user_profiles
      SET is_banned = true, banned_at = now()
      WHERE id = p_user_id AND is_banned = false;
  END IF;

  RETURN coalesce(v_strikes, 0);
END;
$$;

REVOKE ALL ON FUNCTION record_moderation_strike(uuid, text) FROM public;
REVOKE ALL ON FUNCTION record_moderation_strike(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION record_moderation_strike(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION record_moderation_strike(uuid, text) TO service_role;
