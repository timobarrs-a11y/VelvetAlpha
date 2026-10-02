/*
# Add memory_history table + version trigger + rollback function

## Purpose
Every write to memory_items gets an immutable audit row in memory_history,
and the version column auto-increments. A rollback_memory() function lets
super users or the owning user restore a previous version. This is the
"trace a bad recall to its source" infrastructure.

## New Table: memory_history
- memory_id (uuid, FK memory_items) — the item that changed
- version (int) — the version number after this change
- op (text) — 'INSERT' | 'UPDATE' | 'DELETE'
- before (jsonb) — full row snapshot before the change (null for INSERT)
- after (jsonb) — full row snapshot after the change (null for DELETE)
- actor_type (text) — 'user' | 'extractor' | 'dream' | 'admin'
- actor_id (uuid, nullable) — the user or system that made the change
- triggering_session_id (uuid, nullable) — session context
- triggering_message_id (uuid, nullable) — message that caused the change
- proposal_id (uuid, nullable) — dreaming proposal that caused the change
- created_at (timestamptz)

## Trigger: trg_memory_items_history
AFTER INSERT/UPDATE/DELETE on memory_items that:
1. Increments version on UPDATE (new.version = old.version + 1)
2. Inserts a row into memory_history with before/after snapshots
3. Reads actor info from current_setting('app.actor_type', true) and
   current_setting('app.actor_id', true), defaulting to 'extractor'

## Function: rollback_memory(memory_id, to_version)
SECURITY DEFINER — restores a memory_item to a previous version from
memory_history. Only super users or the owning user can call it.

## Notes
- The trigger uses a BEFORE UPDATE to increment version, and an AFTER
  INSERT/UPDATE/DELETE to write history.
- Actor context is set via `SET LOCAL app.actor_type = '...'` in the
  writing transaction (edge functions set this via supabase RPC headers).
- Idempotent: uses IF NOT EXISTS guards.
*/

-- 1. Create memory_history table
CREATE TABLE IF NOT EXISTS memory_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memory_items(id) ON DELETE CASCADE,
  version int NOT NULL,
  op text NOT NULL CHECK (op IN ('INSERT', 'UPDATE', 'DELETE')),
  before jsonb,
  after jsonb,
  actor_type text NOT NULL DEFAULT 'extractor' CHECK (actor_type IN ('user', 'extractor', 'dream', 'admin')),
  actor_id uuid,
  triggering_session_id uuid,
  triggering_message_id uuid,
  proposal_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_history ENABLE ROW LEVEL SECURITY;

-- Users can read history for their own memories
DROP POLICY IF EXISTS "select_own_memory_history" ON memory_history;
CREATE POLICY "select_own_memory_history"
  ON memory_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memory_items mi
      WHERE mi.id = memory_history.memory_id
      AND mi.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies — history is written only by the trigger.

CREATE INDEX IF NOT EXISTS idx_memory_history_memory_id
  ON memory_history (memory_id, version);

-- 2. BEFORE UPDATE trigger to auto-increment version
CREATE OR REPLACE FUNCTION increment_memory_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only increment if version wasn't explicitly set by the caller
  -- (optimistic concurrency sets it explicitly)
  IF NEW.version = OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memory_items_version ON memory_items;
CREATE TRIGGER trg_memory_items_version
  BEFORE UPDATE ON memory_items
  FOR EACH ROW
  EXECUTE FUNCTION increment_memory_version();

-- 3. AFTER INSERT/UPDATE/DELETE trigger to write history
CREATE OR REPLACE FUNCTION log_memory_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor_type text := COALESCE(current_setting('app.actor_type', true), 'extractor');
  v_actor_id text := current_setting('app.actor_id', true);
  v_session_id text := current_setting('app.session_id', true);
  v_message_id text := current_setting('app.message_id', true);
  v_proposal_id text := current_setting('app.proposal_id', true);
  v_version int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_version := OLD.version;
    INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
    VALUES (
      OLD.id,
      v_version,
      'DELETE',
      to_jsonb(OLD),
      NULL,
      v_actor_type,
      CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
      CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
      CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
      CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_version := NEW.version;
    INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
    VALUES (
      NEW.id,
      v_version,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_actor_type,
      CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
      CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
      CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
      CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_version := NEW.version;
    INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
    VALUES (
      NEW.id,
      v_version,
      'INSERT',
      NULL,
      to_jsonb(NEW),
      v_actor_type,
      CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
      CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
      CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
      CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_memory_items_history ON memory_items;
CREATE TRIGGER trg_memory_items_history
  AFTER INSERT OR UPDATE OR DELETE ON memory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_memory_history();

-- 4. rollback_memory function — restore a previous version
CREATE OR REPLACE FUNCTION rollback_memory(p_memory_id uuid, p_to_version int)
RETURNS memory_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_super boolean;
  v_history record;
BEGIN
  -- Get the memory item's owner
  SELECT user_id INTO v_user_id FROM memory_items WHERE id = p_memory_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Memory item not found';
  END IF;

  -- Check authorization: owning user or super user
  SELECT is_super_user INTO v_is_super
  FROM user_profiles
  WHERE id = auth.uid();

  IF auth.uid() IS NULL OR (auth.uid() != v_user_id AND COALESCE(v_is_super, false) = false) THEN
    RAISE EXCEPTION 'Not authorized to rollback this memory item';
  END IF;

  -- Find the history row for the target version
  SELECT * INTO v_history
  FROM memory_history
  WHERE memory_id = p_memory_id
    AND version = p_to_version
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found in history', p_to_version;
  END IF;

  -- Restore the row from the 'after' snapshot (or 'before' if it was a DELETE)
  IF v_history.after IS NOT NULL THEN
    UPDATE memory_items
    SET
      content = (v_history.after->>'content'),
      status = (v_history.after->>'status'),
      scope = (v_history.after->>'scope'),
      kind = (v_history.after->>'kind'),
      confidence = (v_history.after->>'confidence')::real,
      importance = (v_history.after->>'importance')::int,
      source = (v_history.after->>'source'),
      due_at = NULLIF(v_history.after->>'due_at', '')::timestamptz,
      superseded_by = NULLIF(v_history.after->>'superseded_by', '')::uuid
    WHERE id = p_memory_id;
  ELSE
    -- The target version was a DELETE — re-insert from 'before'
    INSERT INTO memory_items (id, user_id, companion_id, scope, kind, content, status, confidence, importance, source, version)
    SELECT
      (v_history.before->>'id')::uuid,
      (v_history.before->>'user_id')::uuid,
      NULLIF(v_history.before->>'companion_id', '')::uuid,
      v_history.before->>'scope',
      v_history.before->>'kind',
      v_history.before->>'content',
      v_history.before->>'status',
      (v_history.before->>'confidence')::real,
      (v_history.before->>'importance')::int,
      v_history.before->>'source',
      p_to_version
    ON CONFLICT (id) DO UPDATE SET
      content = EXCLUDED.content,
      status = EXCLUDED.status,
      scope = EXCLUDED.scope,
      kind = EXCLUDED.kind;
  END IF;

  RETURN (SELECT * FROM memory_items WHERE id = p_memory_id);
END;
$$;

-- Grant execute on rollback to authenticated users (authorization checked inside)
GRANT EXECUTE ON FUNCTION rollback_memory(uuid, int) TO authenticated;