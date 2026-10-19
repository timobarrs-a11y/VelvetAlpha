/*
# Velvet Rope — human matching queue

## Purpose
Adds a matchmaking queue for Velvet Rope so two real users with the toggle on
can be paired automatically. When a user enables Velvet Rope and has no active
conversation or pending request, they enter the queue. A matching function
pairs the oldest waiting user with the next oldest, creates a vr_request from
one to the other (with a masked handle — no real name, no avatar), and removes
both from the queue. This is the human counterpart to the AI opponent flow.

## Plain-English summary

1. Creates a `vr_queue` table with one row per waiting user, a joined_at
   timestamp, and a status ('waiting' | 'matched'). Only one waiting row per
   user is allowed (partial unique index on user_id where status='waiting').
2. Adds a `vr_enter_queue()` SECURITY DEFINER function that adds the calling
   user to the queue if they are eligible (toggle on, no active conversation,
   no pending request). Returns true if entered, false if not eligible.
3. Adds a `vr_try_match()` SECURITY DEFINER function that looks for the
   calling user in the queue, then looks for another waiting user who is also
   eligible, and if found creates a vr_request from the older user to the
   newer one, marks both queue rows matched, and returns the request id. If
   no partner is available, returns null (the user stays in the queue).
4. Adds a `vr_leave_queue()` function so users can remove themselves when they
   turn the toggle off or get matched another way.

## Security
- vr_queue has RLS: users can read only their own queue row, can insert only
  their own, can update/delete only their own.
- The matching functions run as SECURITY DEFINER so they can read all waiting
  rows and create requests between two users. They re-check eligibility
  server-side before creating a request.

This migration is idempotent and re-runnable.
*/

CREATE TABLE IF NOT EXISTS vr_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','matched')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz
);

ALTER TABLE vr_queue ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS vr_queue_one_waiting_per_user
  ON vr_queue (user_id) WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS vr_queue_waiting_idx
  ON vr_queue (joined_at) WHERE status = 'waiting';

DROP POLICY IF EXISTS "vr_queue_read_own" ON vr_queue;
CREATE POLICY "vr_queue_read_own"
ON vr_queue FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "vr_queue_insert_own" ON vr_queue;
CREATE POLICY "vr_queue_insert_own"
ON vr_queue FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "vr_queue_update_own" ON vr_queue;
CREATE POLICY "vr_queue_update_own"
ON vr_queue FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "vr_queue_delete_own" ON vr_queue;
CREATE POLICY "vr_queue_delete_own"
ON vr_queue FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- vr_enter_queue()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_enter_queue()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_active uuid;
  v_pending boolean;
BEGIN
  SELECT velvet_rope_enabled, velvet_rope_active_conv_id
    INTO v_enabled, v_active
    FROM user_profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_enabled, false) THEN RETURN false; END IF;
  IF v_active IS NOT NULL THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM vr_requests
    WHERE addressee_id = auth.uid() AND status = 'pending'
  ) INTO v_pending;
  IF v_pending THEN RETURN false; END IF;

  -- Remove any stale waiting row first, then insert a fresh one.
  DELETE FROM vr_queue WHERE user_id = auth.uid() AND status = 'waiting';
  INSERT INTO vr_queue (user_id, status) VALUES (auth.uid(), 'waiting');
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION vr_enter_queue() TO authenticated;

-- ---------------------------------------------------------------------------
-- vr_leave_queue()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_leave_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM vr_queue WHERE user_id = auth.uid() AND status = 'waiting';
END;
$$;

GRANT EXECUTE ON FUNCTION vr_leave_queue() TO authenticated;

-- ---------------------------------------------------------------------------
-- vr_try_match()
-- Looks for a partner for the calling user. If found, creates a vr_request
-- from the older user to the newer user and marks both queue rows matched.
-- Returns the request id, or null if no partner is available.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_try_match()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me vr_queue%ROWTYPE;
  v_partner vr_queue%ROWTYPE;
  v_request_id uuid;
  v_addressee uuid;
  v_requester uuid;
  v_eligible boolean;
  v_handles text[] := ARRAY['Someone','A stranger','Mystery guest','Unknown player','Velvet visitor','The other side'];
  v_masked text;
BEGIN
  SELECT * INTO v_me
    FROM vr_queue
    WHERE user_id = auth.uid() AND status = 'waiting'
    LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Find the oldest other waiting user who is eligible.
  SELECT q.* INTO v_partner
    FROM vr_queue q
    JOIN user_profiles up ON up.id = q.user_id
    WHERE q.status = 'waiting'
      AND q.user_id <> auth.uid()
      AND up.velvet_rope_enabled = true
      AND up.velvet_rope_active_conv_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM vr_requests r
        WHERE r.addressee_id = q.user_id AND r.status = 'pending'
      )
    ORDER BY q.joined_at ASC
    LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- The older user is the requester, the newer is the addressee.
  IF v_me.joined_at <= v_partner.joined_at THEN
    v_requester := v_me.user_id;
    v_addressee := v_partner.user_id;
  ELSE
    v_requester := v_partner.user_id;
    v_addressee := v_me.user_id;
  END IF;

  -- Double-check the addressee is still eligible (race safety).
  SELECT
    up.velvet_rope_enabled
    AND up.velvet_rope_active_conv_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM vr_requests r
      WHERE r.addressee_id = up.id AND r.status = 'pending'
    )
    INTO v_eligible
    FROM user_profiles up
    WHERE up.id = v_addressee;
  IF NOT v_eligible THEN RETURN NULL; END IF;

  v_masked := v_handles[1 + floor(random() * array_length(v_handles, 1))::int];

  INSERT INTO vr_requests (addressee_id, requester_id, match_type, masked_handle, opener_message, status)
  VALUES (v_addressee, v_requester, 'human', v_masked, '', 'pending')
  RETURNING id INTO v_request_id;

  UPDATE vr_queue SET status = 'matched', matched_at = now()
    WHERE user_id IN (v_me.user_id, v_partner.user_id) AND status = 'waiting';

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION vr_try_match() TO authenticated;
