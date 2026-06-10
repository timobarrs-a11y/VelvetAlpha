/*
  # Fix first message claim expiry

  ## Problem
  Companions can get stuck in a state where `first_message_claimed_at` is set
  but `first_message_sent` is still false. This happens when the claim succeeded
  but the process crashed before finalizing. The claim lock then permanently
  blocks all retry attempts.

  ## Changes
  1. Update `claim_first_message` RPC to expire stale claims after 5 minutes,
     allowing the process to retry if it previously failed.
  2. Reset all currently stuck companions (claimed but not sent) so they get
     their first message.
*/

-- Update claim_first_message to expire stale claims after 5 minutes
CREATE OR REPLACE FUNCTION claim_first_message(p_companion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  did_claim boolean;
BEGIN
  UPDATE companions
  SET first_message_claimed_at = now()
  WHERE id = p_companion_id
    AND user_id = auth.uid()
    AND first_message_sent = false
    AND (
      first_message_claimed_at IS NULL
      OR first_message_claimed_at < now() - interval '5 minutes'
    )
  RETURNING true INTO did_claim;

  RETURN coalesce(did_claim, false);
END;
$$;

-- Reset currently stuck companions so they can receive their first message
UPDATE companions
SET first_message_claimed_at = NULL
WHERE first_message_sent = false
  AND first_message_claimed_at IS NOT NULL;
