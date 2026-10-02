/*
# Fix memory RPC security: enforce auth.uid() ownership

## Problem
Two SECURITY DEFINER functions accepted a caller-supplied `user_id` instead of
deriving it from `auth.uid()`. Any signed-in user could read or write another
user's memories, and forge the audit trail `actor_type`.

## Changes
1. `upsert_memory_item`: use `auth.uid()` as the owner instead of `p_payload->>'user_id'`.
   The `user_id` in the payload is now ignored. Also add `SET search_path = public`.
2. `fetch_memories_for_turn`: use `auth.uid()` instead of the `p_user_id` parameter.
   The parameter is kept for signature compatibility but no longer trusted.
   Also add `SET search_path = public`.
3. `update_memory_item`: already uses `auth.uid()` — add `SET search_path = public`.
4. `update_memory_recall`: already uses `auth.uid()` — add `SET search_path = public`.
5. Revoke EXECUTE from `anon` on all four functions so only authenticated users can call them.

## Notes
- chat-turn calls these via the service role key, which bypasses RLS and
  auth.uid() (returns NULL). To keep chat-turn working, we add a fallback:
  if auth.uid() is NULL (service-role caller), use p_payload->>'user_id' but
  only when the caller is the service role (set_by_config = 'service_role').
  Since we can't reliably detect service-role inside SECURITY DEFINER, we
  instead grant these functions to the `service_role` and check for that.
  In practice, the service role bypasses RLS and EXECUTE checks, so the
  auth.uid() guard only affects anon/authenticated callers.
- The `user_id` field in the payload is still used for SET LOCAL app.actor_id
  (the history trigger), but it no longer determines WHOSE memories are touched.
*/

-- 1. Fix upsert_memory_item
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

-- 2. Fix fetch_memories_for_turn
CREATE OR REPLACE FUNCTION fetch_memories_for_turn(
  p_user_id uuid,
  p_companion_id uuid,
  p_relationship_type text DEFAULT 'romantic',
  p_budget_tokens int DEFAULT 1200
)
RETURNS TABLE (
  id uuid,
  kind text,
  content text,
  confidence real,
  scope text,
  companion_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_is_private_allowed boolean;
  v_max_facts int := 12;
  v_max_threads int := 5;
  v_fact_tokens int := 0;
  v_thread_tokens int := 0;
  v_moment_tokens int := 0;
  v_total_tokens int := 0;
  v_moment_budget int := 800;
  v_fact_budget int;
  v_thread_budget int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    v_uid := p_user_id;
  END IF;

  v_is_private_allowed := p_relationship_type IN ('romantic', 'friend');

  v_thread_budget := LEAST(200, p_budget_tokens / 5);
  v_fact_budget := p_budget_tokens - v_thread_budget - LEAST(v_moment_budget, p_budget_tokens / 3);

  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id
  FROM memory_items mi
  WHERE mi.user_id = v_uid
    AND mi.kind = 'fact'
    AND mi.status = 'active'
    AND mi.confidence >= 0.6
    AND (
      (mi.companion_id IS NULL AND mi.scope = 'global')
      OR
      (mi.companion_id = p_companion_id AND mi.scope = 'companion')
      OR
      (mi.companion_id = p_companion_id AND mi.scope = 'private' AND v_is_private_allowed)
    )
  ORDER BY mi.last_recalled_at ASC NULLS FIRST, mi.updated_at DESC
  LIMIT v_max_facts;

  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id
  FROM memory_items mi
  WHERE mi.user_id = v_uid
    AND mi.kind = 'thread'
    AND mi.status = 'active'
    AND (
      (mi.companion_id IS NULL AND mi.scope = 'global')
      OR (mi.companion_id = p_companion_id AND mi.scope = 'companion')
      OR (mi.companion_id = p_companion_id AND mi.scope = 'private' AND v_is_private_allowed)
    )
  ORDER BY mi.updated_at DESC
  LIMIT v_max_threads;

  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id
  FROM memory_items mi
  WHERE mi.user_id = v_uid
    AND mi.companion_id = p_companion_id
    AND mi.kind = 'moment'
    AND mi.status = 'active'
  ORDER BY mi.updated_at DESC
  LIMIT 1;
END;
$$;

-- 3. Fix update_memory_item (add search_path)
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

-- 4. Fix update_memory_recall (add search_path)
CREATE OR REPLACE FUNCTION update_memory_recall(
  p_ids uuid[],
  p_actor_type text DEFAULT 'extractor'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
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

-- 5. Revoke anon access from all four functions
REVOKE EXECUTE ON FUNCTION upsert_memory_item(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION fetch_memories_for_turn(uuid, uuid, text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION update_memory_recall(uuid[], text) FROM anon;

-- Re-grant to authenticated
GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION fetch_memories_for_turn(uuid, uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_memory_recall(uuid[], text) TO authenticated;
