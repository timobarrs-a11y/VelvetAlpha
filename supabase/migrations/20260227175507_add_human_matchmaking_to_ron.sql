/*
  # Add Human Matchmaking to Real or Not

  ## Summary
  Enables real human-vs-human matching in the Real or Not game. Previously all sessions were
  AI-only. This migration adds the infrastructure for two real users to be matched together,
  with automatic AI fallback if no human is available within the lobby window.

  ## Changes

  ### Modified Tables
  - `ron_sessions`
    - Add `lobby_expires_at` (timestamptz): When a waiting session should expire and become
      ineligible for matching. Set to ~15 seconds after creation.

  ### New Database Objects
  - Index `ron_sessions_matchmaking`: Partial index on (status, gender_filter, created_at)
    covering only `status = 'waiting'` rows, making matchmaking queries fast.
  - Function `claim_ron_session(seeker_id, gender_pref)`: Atomic claim using
    FOR UPDATE SKIP LOCKED to prevent race conditions. Returns (claimed_session_id, did_claim).
    Runs as SECURITY DEFINER to bypass RLS for the atomic update.

  ### New RLS Policies
  - `ron_sessions` realtime SELECT: Allow participant B to see session updates
    (needed for the joiner to receive the matched_at / status changes).

  ## Notes
  - The claim function filters to sessions where lobby_expires_at > now(), so stale
    waiting sessions are naturally ignored without a cleanup job.
  - The SECURITY DEFINER function is safe because it only updates sessions that are
    in 'waiting' status and excludes the seeker's own sessions.
  - The existing RLS update policy already covers both A and B so no new update
    policy is needed.
*/

-- Add lobby_expires_at column
ALTER TABLE ron_sessions
  ADD COLUMN IF NOT EXISTS lobby_expires_at timestamptz;

-- Partial index for fast matchmaking queries
CREATE INDEX IF NOT EXISTS ron_sessions_matchmaking
  ON ron_sessions (status, gender_filter, created_at ASC)
  WHERE status = 'waiting';

-- Atomic claim function using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION claim_ron_session(
  seeker_id uuid,
  gender_pref text
)
RETURNS TABLE (
  claimed_session_id uuid,
  did_claim boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_session_id uuid;
BEGIN
  SELECT id INTO target_session_id
  FROM ron_sessions
  WHERE status = 'waiting'
    AND participant_a_id != seeker_id
    AND (gender_filter = 'any' OR gender_filter = gender_pref)
    AND lobby_expires_at > now()
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF target_session_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false;
    RETURN;
  END IF;

  UPDATE ron_sessions
  SET
    participant_b_id = seeker_id,
    is_b_ai          = false,
    status           = 'active',
    matched_at       = now()
  WHERE id = target_session_id;

  RETURN QUERY SELECT target_session_id, true;
END;
$$;

-- Enable realtime on ron_sessions for session-level subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ron_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ron_sessions;
  END IF;
END $$;

-- Allow participant B to SELECT their sessions (needed for realtime + joining)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ron_sessions'
      AND policyname = 'Participant B can view their session'
  ) THEN
    CREATE POLICY "Participant B can view their session"
      ON ron_sessions FOR SELECT
      TO authenticated
      USING (auth.uid() = participant_b_id);
  END IF;
END $$;

-- Allow authenticated users to SELECT waiting sessions for matchmaking
-- (they need to know if a match exists before claiming)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ron_sessions'
      AND policyname = 'Authenticated users can view waiting sessions for matchmaking'
  ) THEN
    CREATE POLICY "Authenticated users can view waiting sessions for matchmaking"
      ON ron_sessions FOR SELECT
      TO authenticated
      USING (status = 'waiting' AND lobby_expires_at > now());
  END IF;
END $$;
