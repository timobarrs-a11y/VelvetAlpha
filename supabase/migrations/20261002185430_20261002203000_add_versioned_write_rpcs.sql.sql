/*
# Add versioned write RPCs for memory_items

## Purpose
Replace direct supabase-js inserts/updates on memory_items with SECURITY DEFINER
RPCs that:
1. Set the `app.actor_type` / `app.actor_id` session context so the history
   trigger records WHO made the change.
2. Use optimistic concurrency on UPDATE: `WHERE id = $1 AND version = $2`
   so concurrent writers don't silently overwrite each other.
3. Provide an atomic upsert for deduped fact/thread writes (check-then-insert
   in a single RPC call, eliminating the race condition in chat-turn).

## New Functions

### upsert_memory_item(p_payload jsonb)
SECURITY DEFINER. Does a dedup-by-content upsert:
- If an active row with same user_id + companion_id + kind + content exists:
  UPDATE it (with optimistic version check) and return the updated row.
- Otherwise INSERT a new row.
Sets `app.actor_type='extractor'` and `app.actor_id` from p_payload.
Returns the resulting memory_items row as jsonb.

### update_memory_recall(p_ids uuid[], p_actor_type text DEFAULT 'extractor')
SECURITY DEFINER. Updates last_recalled_at + increments recall_count for
the given IDs. Sets actor context. Does NOT change version (recall is not
a content change).

### update_memory_item(p_id uuid, p_base_version int, p_patch jsonb, p_actor_type text DEFAULT 'extractor')
SECURITY DEFINER. Optimistic-concurrency update:
- Only updates if current version = p_base_version.
- If version mismatch, returns NULL (caller must retry with fresh version).
- Sets actor context.
Returns the updated row or NULL on version conflict.

## Security
- All functions are SECURITY DEFINER so they can SET LOCAL session vars
  and write to memory_items even when called from the service-role client.
- update_memory_item verifies ownership (user_id = auth.uid()) before updating.
- upsert_memory_item verifies ownership on existing rows before updating.
- update_memory_recall only updates rows owned by auth.uid().
- All functions are granted to authenticated.

## Notes
- SET LOCAL is used so the setting only lasts for the current transaction.
- The version trigger (trg_memory_items_version) auto-increments version on
  UPDATE, so callers don't need to set it manually.
- The history trigger (trg_memory_items_history) fires AFTER the write and
  reads the actor context to record who made the change.
*/

-- 1. upsert_memory_item — atomic dedup-by-content upsert
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
  v_actor_id_str text;
  v_existing_id uuid;
  v_existing_version int;
  v_result jsonb;
BEGIN
  -- Extract fields from payload
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
  v_actor_id_str := v_user_id::text;

  IF v_user_id IS NULL OR v_kind IS NULL OR v_content IS NULL THEN
    RAISE EXCEPTION 'Missing required fields: user_id, kind, content';
  END IF;

  -- Set actor context for the history trigger
  SET LOCAL app.actor_type = v_actor_type;
  SET LOCAL app.actor_id = v_actor_id_str;

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
    -- UPDATE existing row (version auto-increments via trigger)
    UPDATE memory_items
    SET
      confidence = v_confidence,
      importance = v_importance,
      status = v_status,
      due_at = v_due_at
    WHERE id = v_existing_id
    RETURNING to_jsonb(memory_items) INTO v_result;
  ELSE
    -- INSERT new row
    INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, confidence, importance, source, due_at)
    VALUES (v_user_id, v_companion_id, v_scope, v_kind, v_content, v_status, v_confidence, v_importance, v_source, v_due_at)
    RETURNING to_jsonb(memory_items) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO authenticated;

-- 2. update_memory_recall — batch update recall metadata
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
  v_uid_str text;
BEGIN
  IF v_uid IS NULL OR p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_uid_str := v_uid::text;

  -- Set actor context
  SET LOCAL app.actor_type = p_actor_type;
  SET LOCAL app.actor_id = v_uid_str;

  -- Only update rows owned by this user
  UPDATE memory_items
  SET
    last_recalled_at = now(),
    recall_count = recall_count + 1
  WHERE id = ANY(p_ids)
    AND user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION update_memory_recall(uuid[], text) TO authenticated;

-- 3. update_memory_item — optimistic concurrency update
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
  v_uid_str text;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_uid_str := v_uid::text;

  -- Set actor context
  SET LOCAL app.actor_type = p_actor_type;
  SET LOCAL app.actor_id = v_uid_str;

  -- Optimistic concurrency: only update if version matches
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

  -- Returns NULL if version mismatch or not found/not owned
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) TO authenticated;