/*
# Fix SET LOCAL variable interpolation in memory RPCs

## Problem
`SET LOCAL app.actor_id = v_variable;` inside PL/pgSQL does NOT interpolate
the variable — it stores the literal string "v_variable". This causes the
history trigger to fail when it tries to cast the setting to uuid.

## Fix
Use `EXECUTE format('SET LOCAL ... = %L', v_variable)` to interpolate
the variable value dynamically. Update all three RPCs.
*/

-- 1. Fix upsert_memory_item
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

  IF v_user_id IS NULL OR v_kind IS NULL OR v_content IS NULL THEN
    RAISE EXCEPTION 'Missing required fields: user_id, kind, content';
  END IF;

  -- Set actor context for the history trigger (use EXECUTE for variable interpolation)
  EXECUTE format('SET LOCAL app.actor_type = %L', v_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_user_id::text);

  -- Try to find an existing active row with same content
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
      due_at = v_due_at
    WHERE id = v_existing_id
    RETURNING to_jsonb(memory_items) INTO v_result;
  ELSE
    INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, confidence, importance, source, due_at)
    VALUES (v_user_id, v_companion_id, v_scope, v_kind, v_content, v_status, v_confidence, v_importance, v_source, v_due_at)
    RETURNING to_jsonb(memory_items) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- 2. Fix update_memory_recall
CREATE OR REPLACE FUNCTION update_memory_recall(
  p_ids uuid[],
  p_actor_type text DEFAULT 'extractor'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', p_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_uid::text);

  UPDATE memory_items
  SET
    last_recalled_at = now(),
    recall_count = recall_count + 1
  WHERE id = ANY(p_ids)
    AND user_id = v_uid;
END;
$$;

-- 3. Fix update_memory_item
CREATE OR REPLACE FUNCTION update_memory_item(
  p_id uuid,
  p_base_version int,
  p_patch jsonb,
  p_actor_type text DEFAULT 'extractor'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
BEGIN
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

-- Re-grant (CREATE OR REPLACE preserves grants, but be safe)
GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION update_memory_recall(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) TO authenticated;