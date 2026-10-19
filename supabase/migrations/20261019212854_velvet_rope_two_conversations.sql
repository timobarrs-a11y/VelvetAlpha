/*
# Velvet Rope — allow one human + one AI conversation simultaneously

## Purpose
Changes the one-at-a-time rule so a user can have up to TWO active Velvet Rope
conversations at once: exactly one human match and one AI match. The user
cannot have two human conversations or two AI conversations, but can have one
of each active at the same time.

## Plain-English summary

1. Adds `velvet_rope_active_ai_conv_id` to user_profiles to track the active
   AI conversation separately from the human one (which stays in the existing
   `velvet_rope_active_conv_id` column).
2. Rewrites `vr_accept_request` to set the right column based on match_type
   (human → velvet_rope_active_conv_id, ai → velvet_rope_active_ai_conv_id)
   and to reject if that type's slot is already filled.
3. Rewrites `vr_close_conversation` to clear the right column based on the
   conversation's match_type.
4. Rewrites `vr_can_send_ai_request` to check the AI slot (not the human one)
   and only pending AI requests (not all pending requests).
5. Rewrites `vr_enter_queue` to check the human slot and only pending human
   requests.
6. Rewrites `vr_try_match` to check the human slot for the partner and only
   pending human requests.

## Security
No new tables. Existing RLS covers the new column via the existing
owner-scoped UPDATE policy on user_profiles. All functions remain
SECURITY DEFINER with search_path = public.

This migration is idempotent and re-runnable. No data is lost — existing
active conversations stay tracked in velvet_rope_active_conv_id.
*/

-- 1. Add AI active-conversation column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'velvet_rope_active_ai_conv_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN velvet_rope_active_ai_conv_id uuid;
  END IF;
END $$;

-- 2. vr_accept_request — set the right slot by match_type
CREATE OR REPLACE FUNCTION vr_accept_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req vr_requests%ROWTYPE;
  v_conv_id uuid;
  v_other uuid;
  v_human_slot uuid;
  v_ai_slot uuid;
BEGIN
  SELECT * INTO v_req FROM vr_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;
  IF v_req.addressee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not the addressee of this request';
  END IF;

  -- Check the correct slot is free for this match type.
  SELECT velvet_rope_active_conv_id, velvet_rope_active_ai_conv_id
    INTO v_human_slot, v_ai_slot
    FROM user_profiles WHERE id = auth.uid();

  IF v_req.match_type = 'human' AND v_human_slot IS NOT NULL THEN
    RAISE EXCEPTION 'You already have an active human Velvet Rope conversation';
  END IF;
  IF v_req.match_type = 'ai' AND v_ai_slot IS NOT NULL THEN
    RAISE EXCEPTION 'You already have an active AI Velvet Rope conversation';
  END IF;

  v_other := COALESCE(v_req.requester_id, v_req.addressee_id);

  INSERT INTO vr_conversations (user_a_id, user_b_id, match_type, status)
  VALUES (v_req.addressee_id, v_other, v_req.match_type, 'active')
  RETURNING id INTO v_conv_id;

  UPDATE vr_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = p_request_id;

  -- Set the correct slot for the addressee.
  IF v_req.match_type = 'human' THEN
    UPDATE user_profiles SET velvet_rope_active_conv_id = v_conv_id
      WHERE id = v_req.addressee_id;
  ELSE
    UPDATE user_profiles SET velvet_rope_active_ai_conv_id = v_conv_id
      WHERE id = v_req.addressee_id;
  END IF;

  -- For human matches, also set the requester's human slot.
  IF v_req.requester_id IS NOT NULL AND v_req.match_type = 'human' THEN
    UPDATE user_profiles SET velvet_rope_active_conv_id = v_conv_id
      WHERE id = v_req.requester_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

-- 3. vr_close_conversation — clear the right slot by match_type
CREATE OR REPLACE FUNCTION vr_close_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv vr_conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM vr_conversations WHERE id = p_conv_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or already closed';
  END IF;
  IF v_conv.user_a_id <> auth.uid() AND v_conv.user_b_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  UPDATE vr_conversations
    SET status = 'closed', closed_at = now()
    WHERE id = p_conv_id;

  IF v_conv.match_type = 'human' THEN
    UPDATE user_profiles SET velvet_rope_active_conv_id = NULL
      WHERE id IN (v_conv.user_a_id, v_conv.user_b_id)
        AND velvet_rope_active_conv_id = p_conv_id;
  ELSE
    UPDATE user_profiles SET velvet_rope_active_ai_conv_id = NULL
      WHERE id IN (v_conv.user_a_id, v_conv.user_b_id)
        AND velvet_rope_active_ai_conv_id = p_conv_id;
  END IF;
END;
$$;

-- 4. vr_can_send_ai_request — check AI slot + pending AI requests only
CREATE OR REPLACE FUNCTION vr_can_send_ai_request(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(up.velvet_rope_enabled, false)
    AND up.velvet_rope_active_ai_conv_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM vr_requests r
      WHERE r.addressee_id = p_user_id
        AND r.status = 'pending'
        AND r.match_type = 'ai'
    )
    AND up.velvet_rope_first_seen_at IS NOT NULL
    AND (now() - up.velvet_rope_first_seen_at) >= interval '5 minutes'
  FROM user_profiles up
  WHERE up.id = p_user_id;
$$;

-- 5. vr_enter_queue — check human slot + pending human requests only
CREATE OR REPLACE FUNCTION vr_enter_queue()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_human_slot uuid;
  v_pending_human boolean;
BEGIN
  SELECT velvet_rope_enabled, velvet_rope_active_conv_id
    INTO v_enabled, v_human_slot
    FROM user_profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_enabled, false) THEN RETURN false; END IF;
  IF v_human_slot IS NOT NULL THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM vr_requests
    WHERE addressee_id = auth.uid()
      AND status = 'pending'
      AND match_type = 'human'
  ) INTO v_pending_human;
  IF v_pending_human THEN RETURN false; END IF;

  DELETE FROM vr_queue WHERE user_id = auth.uid() AND status = 'waiting';
  INSERT INTO vr_queue (user_id, status) VALUES (auth.uid(), 'waiting');
  RETURN true;
END;
$$;

-- 6. vr_try_match — check human slot + pending human requests for partner
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

  SELECT q.* INTO v_partner
    FROM vr_queue q
    JOIN user_profiles up ON up.id = q.user_id
    WHERE q.status = 'waiting'
      AND q.user_id <> auth.uid()
      AND up.velvet_rope_enabled = true
      AND up.velvet_rope_active_conv_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM vr_requests r
        WHERE r.addressee_id = q.user_id
          AND r.status = 'pending'
          AND r.match_type = 'human'
      )
    ORDER BY q.joined_at ASC
    LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_me.joined_at <= v_partner.joined_at THEN
    v_requester := v_me.user_id;
    v_addressee := v_partner.user_id;
  ELSE
    v_requester := v_partner.user_id;
    v_addressee := v_me.user_id;
  END IF;

  SELECT
    up.velvet_rope_enabled
    AND up.velvet_rope_active_conv_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM vr_requests r
      WHERE r.addressee_id = up.id
        AND r.status = 'pending'
        AND r.match_type = 'human'
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
