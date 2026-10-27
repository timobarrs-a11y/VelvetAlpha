/*
  # Memory engine v4: safe belief revision (additive)

  Implements the storage side of docs/memory-engine-v4-spec.md (sections c, d, e).

  1. "Disputed" is a FLAG on an active row (disputed_at, dispute_count, dispute_quote), not a new status value.
     Deliberate deviation from the spec: every RPC and unique index that says status = 'active' keeps working,
     and retrieval needs no change. A disputed row is still retrieved and still active.
  2. dispute_memory_item / clear_memory_dispute / resolve_memory_disputes (service role only).
  3. restore_memory_item: un-retire a memory for 30 days. Refuses anything the user forgot or cleared (those rows
     were scrubbed), and anything that would duplicate a memory that is active now.
  4. memory_events.event_type is free text, so the new event types (shadow_verdict, dispute, gate_blocked,
     restored) need no constraint change.

  Nothing here changes behaviour until chat-turn runs with MEMORY_VERIFIER_MODE=enforce (or shadow, which only logs).
*/

ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS disputed_at timestamptz;
ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS dispute_count int NOT NULL DEFAULT 0;
ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS dispute_quote text;

CREATE INDEX IF NOT EXISTS idx_memory_items_disputed
  ON memory_items (disputed_at) WHERE disputed_at IS NOT NULL;

-- First signal: mark the row. A repeat keeps the ORIGINAL disputed_at, which is what the second-signal gap measures from.
CREATE OR REPLACE FUNCTION dispute_memory_item(p_id uuid, p_quote text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  EXECUTE format('SET LOCAL app.actor_type = %L', 'extractor');
  UPDATE memory_items
  SET disputed_at = COALESCE(disputed_at, now()),
      dispute_count = dispute_count + 1,
      dispute_quote = left(COALESCE(p_quote, ''), 300)
  WHERE id = p_id AND status = 'active'
  RETURNING jsonb_build_object('id', id, 'disputed_at', disputed_at, 'dispute_count', dispute_count) INTO v_result;
  RETURN v_result;
END;
$$;

-- A newer message that restates the memory clears the dispute.
CREATE OR REPLACE FUNCTION clear_memory_dispute(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  UPDATE memory_items SET disputed_at = NULL, dispute_quote = NULL
  WHERE id = p_id AND disputed_at IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

-- Nightly: a dispute that got no second signal lapses; the row goes back to normal, one importance point lower.
CREATE OR REPLACE FUNCTION resolve_memory_disputes(p_days int DEFAULT 14)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n int;
BEGIN
  EXECUTE format('SET LOCAL app.actor_type = %L', 'dream');
  UPDATE memory_items
  SET disputed_at = NULL, dispute_quote = NULL, importance = GREATEST(importance - 1, 1)
  WHERE status = 'active' AND disputed_at IS NOT NULL AND disputed_at < now() - make_interval(days => p_days);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Un-retire. Returns 'restored', 'not_found', 'not_restorable', 'expired', 'duplicate'.
CREATE OR REPLACE FUNCTION restore_memory_item(p_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old memory_items%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM memory_items WHERE id = p_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_old.status NOT IN ('retired', 'superseded') OR v_old.content LIKE '[forgotten by user]' OR v_old.content LIKE '[cleared by user]' THEN
    RETURN 'not_restorable';
  END IF;
  IF v_old.updated_at < now() - interval '30 days' THEN
    RETURN 'expired';
  END IF;
  IF EXISTS (
    SELECT 1 FROM memory_items m
    WHERE m.user_id = v_old.user_id AND m.status = 'active' AND m.id <> v_old.id AND m.kind = v_old.kind
      AND COALESCE(m.companion_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_old.companion_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND memory_normalize(m.content) = memory_normalize(v_old.content)
  ) THEN
    RETURN 'duplicate';
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', 'user');
  EXECUTE format('SET LOCAL app.actor_id = %L', p_user_id::text);

  -- Undoing a supersede also withdraws the replacement, so the two versions don't both claim to be current.
  IF v_old.status = 'superseded' AND v_old.superseded_by IS NOT NULL THEN
    UPDATE memory_items SET status = 'retired'
    WHERE id = v_old.superseded_by AND user_id = p_user_id AND status = 'active';
  END IF;

  UPDATE memory_items
  SET status = 'active', superseded_by = NULL, disputed_at = NULL, dispute_quote = NULL,
      last_confirmed_at = now()
  WHERE id = p_id;

  INSERT INTO memory_events (user_id, companion_id, memory_item_id, event_type, payload)
  SELECT p_user_id, COALESCE(v_old.companion_id, v_old.shared_origin_companion_id), p_id, 'restored',
         jsonb_build_object('source', 'user', 'was', v_old.status)
  WHERE COALESCE(v_old.companion_id, v_old.shared_origin_companion_id) IS NOT NULL;

  RETURN 'restored';
END;
$$;

REVOKE ALL ON FUNCTION dispute_memory_item(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION clear_memory_dispute(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION resolve_memory_disputes(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION restore_memory_item(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dispute_memory_item(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION clear_memory_dispute(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION resolve_memory_disputes(int) TO service_role;
GRANT EXECUTE ON FUNCTION restore_memory_item(uuid, uuid) TO service_role;
