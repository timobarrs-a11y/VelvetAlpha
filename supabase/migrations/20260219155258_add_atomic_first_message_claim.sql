/*
  # Atomic First Message Claim System

  ## Summary
  Prevents duplicate first-message generation when the same companion is opened
  in multiple tabs simultaneously, or when a page reload occurs mid-generation.

  ## Changes

  ### 1. New Column: companions.first_message_claimed_at
  - Timestamptz column, nullable
  - Set atomically by the RPC below the moment a client begins generating the first message
  - Distinct from first_message_sent: this is "someone is working on it" vs "it's done"
  - A non-null value permanently blocks any other client from claiming

  ### 2. RPC: claim_first_message(p_companion_id uuid) → boolean
  - Performs a single conditional UPDATE with RETURNING under Postgres row locking
  - Only succeeds (returns true) if first_message_sent = false AND first_message_claimed_at IS NULL
  - Concurrent callers are serialized by Postgres; only the first one wins
  - SECURITY DEFINER with search_path = public to prevent search-path injection

  ### 3. RPC: finalize_first_message(p_companion_id uuid) → void
  - Sets first_message_sent = true
  - Restricts update to the authenticated caller's own companions (auth.uid() = user_id)
  - SECURITY DEFINER with search_path = public

  ## Security Notes
  - Both functions use SECURITY DEFINER so they execute with the function owner's privileges,
    bypassing RLS for the UPDATE itself, but the user_id check in finalize ensures ownership
  - search_path is pinned to prevent privilege escalation via schema injection
*/

-- 1. Add claim column
ALTER TABLE companions
  ADD COLUMN IF NOT EXISTS first_message_claimed_at timestamptz;

-- 2. Atomic claim RPC
CREATE OR REPLACE FUNCTION claim_first_message(p_companion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did_claim boolean;
BEGIN
  UPDATE companions
  SET first_message_claimed_at = now()
  WHERE id = p_companion_id
    AND user_id = auth.uid()
    AND first_message_sent = false
    AND first_message_claimed_at IS NULL
  RETURNING true INTO did_claim;

  RETURN coalesce(did_claim, false);
END;
$$;

-- 3. Finalize RPC
CREATE OR REPLACE FUNCTION finalize_first_message(p_companion_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE companions
  SET first_message_sent = true
  WHERE id = p_companion_id
    AND user_id = auth.uid();
$$;
