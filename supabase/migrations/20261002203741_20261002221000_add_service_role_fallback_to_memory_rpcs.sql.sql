/*
# Add service-role fallback to memory RPCs

## Problem
chat-turn and dream-hygiene call memory RPCs via the service role key, where
auth.uid() returns NULL. The previous migration added an auth.uid() guard that
would block these legitimate service-role calls.

## Fix
When auth.uid() is NULL (only reachable by the service role, since anon is
revoked and authenticated always has a valid auth.uid()):
- upsert_memory_item: fall back to p_payload->>'user_id'
- update_memory_item: look up the owner from the memory_items row by p_id
- fetch_memories_for_turn: already has a fallback to p_user_id

## Security
This fallback is safe because:
- anon EXECUTE is revoked — anon role cannot call these functions
- authenticated users always have auth.uid() set — they never reach the fallback
- Only the service_role (no user context) has auth.uid() = NULL
*/

CREATE OR REPLACE FUNCTION upsert_memory_item(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_companion_id uuid;
  v_scope text;
  v_kind text;
  v_content text;
  v_status text;
  v_confidence real;
  v_importance int;
  v_source text;
  v_due_at timestamptz;
  v_actor_type text;
  v_source_message_ids uuid[];
  v_existing_id uuid;
  v_existing_version int;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    -- Service-role caller (anon revoked, authenticated always has auth.uid)
    v_uid := (p_payload->>'user_id')::uuid;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_companion_id := NULLIF(p_payload->>'companion_id', '')::uuid;
  v_scope := COALESCE(p_payload->>'scope', 'companion');
  v_kind := p_payload->>'kind';
  v_content := p_payload->>'content';
  v_status := COALESCE(p_payload->>'status', 'active');
  v_confidence := COALESCE((p_payload->>'confidence')::real, 0.7);
  v_importance := COALESCE((p_payload->>'importance')::int, 5);
  v_source := COALESCE(p_payload->>'source', 'inferred');
  v_due_at := NULLIF(p_payload->>'due_at', '')::timestamptz;
  v_actor_type := COALESCE(p_payload->>'actor_type', 'extractor');

  BEGIN
    v_source_message_ids := ARRAY(SELECT jsonb_array_elements_text(p_payload->'source_message_ids')::uuid);
  EXCEPTION WHEN OTHERS THEN
    v_source_message_ids := '{}'::uuid[];
  END;

  IF v_kind IS NULL OR v_content IS NULL THEN
    RAISE EXCEPTION 'Missing required fields: kind, content';
  END IF;

  IF v_kind = 'boundary' AND v_source = 'inferred' THEN
    RAISE EXCEPTION 'Extraction cannot create boundary-type memories';
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', v_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_uid::text);

  SELECT id, version INTO v_existing_id, v_existing_version
  FROM memory_items
  WHERE user_id = v_uid
    AND (companion_id IS NOT DISTINCT FROM v_companion_id)
    AND kind = v_kind
    AND content = v_content
    AND status = 'active'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE memory_items
    SET
      confidence = v_confidence,
      importance = v_importance,
      status = v_status,
      due_at = v_due_at,
      source_message_ids = CASE
        WHEN v_source_message_ids IS NOT NULL AND array_length(v_source_message_ids, 1) > 0
        THEN ARRAY(SELECT DISTINCT unnest(array_cat(memory_items.source_message_ids, v_source_message_ids)))
        ELSE memory_items.source_message_ids
      END
    WHERE id = v_existing_id
    RETURNING to_jsonb(memory_items) INTO v_result;
  ELSE
    INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, confidence, importance, source, due_at, source_message_ids)
    VALUES (v_uid, v_companion_id, v_scope, v_kind, v_content, v_status, v_confidence, v_importance, v_source, v_due_at, v_source_message_ids)
    RETURNING to_jsonb(memory_items) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION update_memory_item(
  p_id uuid,
  p_base_version int,
  p_patch jsonb,
  p_actor_type text DEFAULT 'extractor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    -- Service-role caller: look up the owner from the row itself
    SELECT user_id INTO v_uid FROM memory_items WHERE id = p_id;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', p_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_uid::text);

  UPDATE memory_items
  SET
    content = COALESCE(NULLIF(p_patch->>'content', ''), memory_items.content),
    status = COALESCE(NULLIF(p_patch->>'status', ''), memory_items.status),
    confidence = COALESCE(NULLIF(p_patch->>'confidence', '')::real, memory_items.confidence),
    importance = COALESCE(NULLIF(p_patch->>'importance', '')::int, memory_items.importance),
    due_at = COALESCE(NULLIF(p_patch->>'due_at', '')::timestamptz, memory_items.due_at)
  WHERE id = p_id
    AND version = p_base_version
    AND user_id = v_uid
  RETURNING to_jsonb(memory_items) INTO v_result;

  RETURN v_result;
END;
$$;

-- Re-grant
GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) TO authenticated;
