/*
# Add source_message_ids support to upsert_memory_item

## Purpose
The extraction path in chat-turn now needs to record WHICH conversation messages
a fact or thread was extracted from. This gives us provenance tracking — we can
trace any memory back to the exact message that produced it.

## Changes
- `upsert_memory_item`: extract `source_message_ids` from the JSON payload and
  include it in the INSERT. On UPDATE (existing row found), merge the new IDs
  into the existing array using array_cat with dedup.

## Notes
- source_message_ids is a uuid[] column with DEFAULT '{}'
- We use array_cat to union existing + new IDs, then DISTINCT to dedup
- Empty/null payload value → no change to existing array
*/

CREATE OR REPLACE FUNCTION upsert_memory_item(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
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
  v_user_id := (p_payload->>'user_id')::uuid;
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

  -- Parse source_message_ids from JSON array string
  BEGIN
    v_source_message_ids := ARRAY(SELECT jsonb_array_elements_text(p_payload->'source_message_ids')::uuid);
  EXCEPTION WHEN OTHERS THEN
    v_source_message_ids := '{}'::uuid[];
  END;

  IF v_user_id IS NULL OR v_kind IS NULL OR v_content IS NULL THEN
    RAISE EXCEPTION 'Missing required fields: user_id, kind, content';
  END IF;

  -- Reject kind='boundary' from extraction — boundaries are user-authored only
  IF v_kind = 'boundary' AND v_source = 'inferred' THEN
    RAISE EXCEPTION 'Extraction cannot create boundary-type memories';
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', v_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_user_id::text);

  SELECT id, version INTO v_existing_id, v_existing_version
  FROM memory_items
  WHERE user_id = v_user_id
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
    VALUES (v_user_id, v_companion_id, v_scope, v_kind, v_content, v_status, v_confidence, v_importance, v_source, v_due_at, v_source_message_ids)
    RETURNING to_jsonb(memory_items) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO authenticated;