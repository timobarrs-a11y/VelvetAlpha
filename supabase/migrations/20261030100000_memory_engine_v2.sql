/*
# Memory engine v2: hybrid retrieval, supersession, drift guards

## Why
An audit of live data (2026-10-26) found the memory store drifting:
- 0 of 57 memory_items had an embedding, so "semantic" memory had no semantics.
  Facts were picked by "least recently recalled first, LIMIT 12" and only then
  ranked by keyword overlap, so a relevant fact past the 12th never reached the model.
- update_memory_recall had no service-role fallback, so chat-turn's recall
  writes silently did nothing (recall_count = 0 on every row).
- Exact-string dedup let the same fact pile up in 7–9 paraphrases.
- Corrections overwrote content in place, or (dream-hygiene / admin approve)
  wrote the corrected text onto a row and then marked that row superseded,
  so the corrected fact vanished from retrieval.
- Every bookkeeping write bumped `version`, breaking optimistic concurrency
  and filling memory_history with noise.

## Changes
1. Columns: embedding_model (embedding versioning), valid_until (temporary
   facts expire instead of lingering), last_confirmed_at / confirm_count
   (reinforcement), evidence (verbatim user quote the memory came from),
   content_tsv (generated, for full-text search).
2. Indexes: GIN on content_tsv; HNSW replaces the ivfflat index that was built
   on an empty table; partial index for the hot read path.
3. memory_normalize(): punctuation/case/whitespace-insensitive dedup key.
4. Triggers: version + history only on meaningful changes; editing content
   clears a now-stale embedding.
5. upsert_memory_item: normalized dedup, reinforcement instead of overwrite,
   accepts embedding / valid_until / evidence / shared_origin_companion_id.
6. supersede_memory_item (new): atomic "new row + old row superseded_by new".
7. update_memory_item: patch also accepts source, superseded_by, valid_until.
8. update_memory_recall: service-role fallback (fixes recall tracking).
9. fetch_memories_for_turn: hybrid retrieval (full-text + vector, fused with
   reciprocal rank fusion) blended with importance, recency decay and
   confidence. Returns scored candidates; chat-turn makes the final selection.
*/

-- 1. Columns ---------------------------------------------------------------

ALTER TABLE memory_items
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirm_count int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS evidence text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memory_items' AND column_name = 'content_tsv'
  ) THEN
    ALTER TABLE memory_items
      ADD COLUMN content_tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;
  END IF;
END $$;

-- 2. Indexes ---------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_memory_items_content_tsv
  ON memory_items USING gin (content_tsv);

-- ivfflat trained on an empty table has useless centroids; HNSW needs no training.
DROP INDEX IF EXISTS idx_memory_items_embedding;
CREATE INDEX IF NOT EXISTS idx_memory_items_embedding_hnsw
  ON memory_items USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_memory_items_active_lookup
  ON memory_items (user_id, companion_id, kind)
  WHERE status = 'active';

-- 3. Dedup key -------------------------------------------------------------

CREATE OR REPLACE FUNCTION memory_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower(coalesce(p_text, '')), '[[:punct:]]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- 4. Triggers --------------------------------------------------------------

-- Bump version only when the memory itself changes. Recall stats, embeddings,
-- provenance and confirmation bookkeeping are not new versions.
CREATE OR REPLACE FUNCTION increment_memory_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     AND NEW.embedding IS NOT DISTINCT FROM OLD.embedding THEN
    -- The old vector describes the old text.
    NEW.embedding := NULL;
    NEW.embedding_model := NULL;
  END IF;

  IF NEW.content IS DISTINCT FROM OLD.content
     AND NEW.evidence IS NOT DISTINCT FROM OLD.evidence THEN
    -- The quote supported the old text (and "forget" must not keep the user's words).
    NEW.evidence := NULL;
  END IF;

  IF (NEW.content, NEW.status, NEW.scope, NEW.kind, NEW.companion_id, NEW.confidence,
      NEW.importance, NEW.due_at, NEW.superseded_by, NEW.valid_until, NEW.source)
     IS NOT DISTINCT FROM
     (OLD.content, OLD.status, OLD.scope, OLD.kind, OLD.companion_id, OLD.confidence,
      OLD.importance, OLD.due_at, OLD.superseded_by, OLD.valid_until, OLD.source) THEN
    NEW.version := OLD.version;
    NEW.updated_at := OLD.updated_at;
    RETURN NEW;
  END IF;

  IF NEW.version = OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_memory_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_type text := COALESCE(current_setting('app.actor_type', true), 'extractor');
  v_actor_id text := current_setting('app.actor_id', true);
  v_session_id text := current_setting('app.session_id', true);
  v_message_id text := current_setting('app.message_id', true);
  v_proposal_id text := current_setting('app.proposal_id', true);
  v_memory_id uuid;
  v_version int;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    -- Bookkeeping-only update (see increment_memory_version): not a new version.
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_memory_id := OLD.id; v_version := OLD.version;
    v_before := to_jsonb(OLD) - 'embedding' - 'content_tsv'; v_after := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_memory_id := NEW.id; v_version := NEW.version;
    v_before := to_jsonb(OLD) - 'embedding' - 'content_tsv';
    v_after := to_jsonb(NEW) - 'embedding' - 'content_tsv';
  ELSE
    v_memory_id := NEW.id; v_version := NEW.version;
    v_before := NULL; v_after := to_jsonb(NEW) - 'embedding' - 'content_tsv';
  END IF;

  INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
  VALUES (
    v_memory_id, v_version, TG_OP, v_before, v_after, v_actor_type,
    CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
    CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
    CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
    CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. upsert_memory_item ----------------------------------------------------

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
  v_valid_until timestamptz;
  v_actor_type text;
  v_source_message_ids uuid[];
  v_embedding vector;
  v_embedding_model text;
  v_evidence text;
  v_shared_origin uuid;
  v_existing_id uuid;
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
  v_content := btrim(p_payload->>'content');
  v_status := COALESCE(p_payload->>'status', 'active');
  v_confidence := COALESCE((p_payload->>'confidence')::real, 0.7);
  v_importance := COALESCE((p_payload->>'importance')::int, 5);
  v_source := COALESCE(p_payload->>'source', 'inferred');
  v_due_at := NULLIF(p_payload->>'due_at', '')::timestamptz;
  v_valid_until := NULLIF(p_payload->>'valid_until', '')::timestamptz;
  v_actor_type := COALESCE(p_payload->>'actor_type', 'extractor');
  v_embedding_model := NULLIF(p_payload->>'embedding_model', '');
  v_evidence := NULLIF(left(p_payload->>'evidence', 500), '');
  v_shared_origin := NULLIF(p_payload->>'shared_origin_companion_id', '')::uuid;

  IF v_embedding_model IS NOT NULL AND jsonb_typeof(p_payload->'embedding') = 'array' THEN
    v_embedding := (p_payload->'embedding')::text::vector;
  END IF;

  BEGIN
    v_source_message_ids := ARRAY(SELECT jsonb_array_elements_text(p_payload->'source_message_ids')::uuid);
  EXCEPTION WHEN OTHERS THEN
    v_source_message_ids := '{}'::uuid[];
  END;

  IF v_kind IS NULL OR v_content IS NULL OR v_content = '' THEN
    RAISE EXCEPTION 'Missing required fields: kind, content';
  END IF;

  IF v_kind = 'boundary' AND v_source = 'inferred' THEN
    RAISE EXCEPTION 'Extraction cannot create boundary-type memories';
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', v_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_uid::text);

  -- Same memory, said differently only in case/punctuation/spacing.
  SELECT id INTO v_existing_id
  FROM memory_items
  WHERE user_id = v_uid
    AND (companion_id IS NOT DISTINCT FROM v_companion_id)
    AND kind = v_kind
    AND status = 'active'
    AND memory_normalize(content) = memory_normalize(v_content)
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    -- Re-observing a memory reinforces it; it never lowers what we know.
    UPDATE memory_items
    SET
      confidence = GREATEST(memory_items.confidence, v_confidence),
      importance = GREATEST(memory_items.importance, v_importance),
      status = v_status,
      due_at = COALESCE(v_due_at, memory_items.due_at),
      valid_until = CASE
        WHEN memory_items.valid_until IS NULL THEN NULL
        ELSE GREATEST(memory_items.valid_until, v_valid_until)
      END,
      last_confirmed_at = now(),
      confirm_count = memory_items.confirm_count + 1,
      evidence = COALESCE(memory_items.evidence, v_evidence),
      embedding = COALESCE(memory_items.embedding, v_embedding),
      embedding_model = CASE WHEN memory_items.embedding IS NULL THEN v_embedding_model ELSE memory_items.embedding_model END,
      source_message_ids = CASE
        WHEN array_length(v_source_message_ids, 1) > 0
        THEN ARRAY(SELECT DISTINCT unnest(array_cat(memory_items.source_message_ids, v_source_message_ids)))
        ELSE memory_items.source_message_ids
      END
    WHERE id = v_existing_id
    RETURNING to_jsonb(memory_items) - 'embedding' - 'content_tsv' INTO v_result;
  ELSE
    INSERT INTO memory_items (
      user_id, companion_id, scope, kind, content, status, confidence, importance, source,
      due_at, valid_until, source_message_ids, embedding, embedding_model, evidence,
      shared_origin_companion_id, last_confirmed_at
    )
    VALUES (
      v_uid, v_companion_id, v_scope, v_kind, v_content, v_status, v_confidence, v_importance, v_source,
      v_due_at, v_valid_until, v_source_message_ids, v_embedding, v_embedding_model, v_evidence,
      v_shared_origin, now()
    )
    RETURNING to_jsonb(memory_items) - 'embedding' - 'content_tsv' INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- 6. supersede_memory_item -------------------------------------------------

-- Replace a memory with a corrected one without losing either: the new text
-- becomes a new active row, the old row is kept as status='superseded' with
-- superseded_by pointing at its replacement. Returns the replacement row, or
-- NULL on a version conflict (caller re-reads and retries).
CREATE OR REPLACE FUNCTION supersede_memory_item(
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
  v_old memory_items%ROWTYPE;
  v_content text := btrim(p_patch->>'content');
  v_embedding_model text := NULLIF(p_patch->>'embedding_model', '');
  v_embedding vector;
  v_source_message_ids uuid[];
  v_new_id uuid;
  v_result jsonb;
BEGIN
  v_uid := auth.uid();

  SELECT * INTO v_old FROM memory_items WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_uid IS NOT NULL AND v_old.user_id <> v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_old.version <> p_base_version OR v_old.status <> 'active' THEN
    RETURN NULL;
  END IF;
  IF v_content IS NULL OR v_content = '' THEN
    RAISE EXCEPTION 'Missing content';
  END IF;

  EXECUTE format('SET LOCAL app.actor_type = %L', p_actor_type);
  EXECUTE format('SET LOCAL app.actor_id = %L', v_old.user_id::text);

  -- Same text: a confirmation, not a correction.
  IF memory_normalize(v_content) = memory_normalize(v_old.content) THEN
    UPDATE memory_items
    SET last_confirmed_at = now(), confirm_count = confirm_count + 1
    WHERE id = p_id
    RETURNING to_jsonb(memory_items) - 'embedding' - 'content_tsv' INTO v_result;
    RETURN v_result;
  END IF;

  IF v_embedding_model IS NOT NULL AND jsonb_typeof(p_patch->'embedding') = 'array' THEN
    v_embedding := (p_patch->'embedding')::text::vector;
  END IF;

  BEGIN
    v_source_message_ids := ARRAY(SELECT jsonb_array_elements_text(p_patch->'source_message_ids')::uuid);
  EXCEPTION WHEN OTHERS THEN
    v_source_message_ids := '{}'::uuid[];
  END;

  -- The corrected text may already exist as its own active row.
  SELECT id INTO v_new_id
  FROM memory_items
  WHERE user_id = v_old.user_id
    AND companion_id IS NOT DISTINCT FROM v_old.companion_id
    AND kind = v_old.kind
    AND status = 'active'
    AND id <> p_id
    AND memory_normalize(content) = memory_normalize(v_content)
  LIMIT 1;

  IF v_new_id IS NULL THEN
    INSERT INTO memory_items (
      user_id, companion_id, scope, kind, content, status, confidence, importance, source,
      due_at, valid_until, source_message_ids, embedding, embedding_model, evidence,
      shared_origin_companion_id, last_confirmed_at
    )
    VALUES (
      v_old.user_id, v_old.companion_id, v_old.scope, v_old.kind, v_content, 'active',
      COALESCE(NULLIF(p_patch->>'confidence', '')::real, GREATEST(v_old.confidence, 0.9)),
      COALESCE(NULLIF(p_patch->>'importance', '')::int, v_old.importance),
      COALESCE(NULLIF(p_patch->>'source', ''), 'user_stated'),
      v_old.due_at,
      NULLIF(p_patch->>'valid_until', '')::timestamptz,
      CASE WHEN array_length(v_source_message_ids, 1) > 0 THEN v_source_message_ids ELSE v_old.source_message_ids END,
      v_embedding, CASE WHEN v_embedding IS NULL THEN NULL ELSE v_embedding_model END,
      NULLIF(left(p_patch->>'evidence', 500), ''),
      v_old.shared_origin_companion_id,
      now()
    )
    RETURNING id INTO v_new_id;
  END IF;

  UPDATE memory_items
  SET status = 'superseded', superseded_by = v_new_id
  WHERE id = p_id;

  SELECT to_jsonb(mi) - 'embedding' - 'content_tsv' INTO v_result FROM memory_items mi WHERE mi.id = v_new_id;
  RETURN v_result;
END;
$$;

-- 7. update_memory_item ----------------------------------------------------

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
    due_at = COALESCE(NULLIF(p_patch->>'due_at', '')::timestamptz, memory_items.due_at),
    source = COALESCE(NULLIF(p_patch->>'source', ''), memory_items.source),
    superseded_by = COALESCE(NULLIF(p_patch->>'superseded_by', '')::uuid, memory_items.superseded_by),
    valid_until = COALESCE(NULLIF(p_patch->>'valid_until', '')::timestamptz, memory_items.valid_until)
  WHERE id = p_id
    AND version = p_base_version
    AND user_id = v_uid
  RETURNING to_jsonb(memory_items) - 'embedding' - 'content_tsv' INTO v_result;

  RETURN v_result;
END;
$$;

-- 8. update_memory_recall --------------------------------------------------

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
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_uid := auth.uid();

  -- Service-role callers (auth.uid() NULL; anon is revoked) may touch any row.
  UPDATE memory_items
  SET
    last_recalled_at = now(),
    recall_count = recall_count + 1
  WHERE id = ANY(p_ids)
    AND (v_uid IS NULL OR user_id = v_uid);
END;
$$;

-- 9. fetch_memories_for_turn -----------------------------------------------

DROP FUNCTION IF EXISTS fetch_memories_for_turn(uuid, uuid, text, int);

CREATE OR REPLACE FUNCTION fetch_memories_for_turn(
  p_user_id uuid,
  p_companion_id uuid,
  p_relationship_type text DEFAULT 'romantic',
  p_budget_tokens int DEFAULT 1200,
  p_query_text text DEFAULT NULL,
  p_query_embedding vector DEFAULT NULL,
  p_embedding_model text DEFAULT NULL,
  p_max_candidates int DEFAULT 40
)
RETURNS TABLE (
  id uuid,
  kind text,
  content text,
  confidence real,
  scope text,
  companion_id uuid,
  importance int,
  source text,
  created_at timestamptz,
  updated_at timestamptz,
  last_confirmed_at timestamptz,
  confirm_count int,
  relevance real,
  score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_is_private_allowed boolean;
  v_tsquery tsquery;
  v_signals int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    v_uid := p_user_id;
  END IF;

  v_is_private_allowed := p_relationship_type IN ('romantic', 'friend');

  -- OR together the message's stemmed, stopword-free terms. websearch_to_tsquery
  -- would AND them, and a chat message almost never matches every term.
  IF p_query_text IS NOT NULL AND btrim(p_query_text) <> '' THEN
    SELECT string_agg(quote_literal(lex), ' | ')::tsquery
    INTO v_tsquery
    FROM unnest(tsvector_to_array(to_tsvector('english', left(p_query_text, 2000)))) AS lex;
  END IF;

  -- Relevance is normalized against the best fused score the available signals allow.
  v_signals := (CASE WHEN v_tsquery IS NOT NULL THEN 1 ELSE 0 END)
             + (CASE WHEN p_query_embedding IS NOT NULL THEN 1 ELSE 0 END);

  RETURN QUERY
  WITH eligible AS (
    SELECT mi.*
    FROM memory_items mi
    WHERE mi.user_id = v_uid
      AND mi.status = 'active'
      AND mi.kind IN ('fact', 'preference', 'person', 'boundary', 'inside_joke', 'thread')
      AND (mi.valid_until IS NULL OR mi.valid_until > now())
      AND (mi.kind = 'thread' OR mi.confidence >= 0.6)
      AND (
        (mi.companion_id IS NULL AND mi.scope = 'global')
        OR (mi.companion_id = p_companion_id AND mi.scope = 'companion')
        OR (mi.companion_id = p_companion_id AND mi.scope = 'private' AND v_is_private_allowed)
      )
    ORDER BY mi.updated_at DESC
    LIMIT 500
  ),
  lexical AS (
    SELECT e.id, row_number() OVER (ORDER BY ts_rank_cd(e.content_tsv, v_tsquery) DESC) AS rnk
    FROM eligible e
    WHERE v_tsquery IS NOT NULL AND e.content_tsv @@ v_tsquery
  ),
  semantic AS (
    SELECT e.id, s.sim, row_number() OVER (ORDER BY s.sim DESC) AS rnk
    FROM eligible e
    CROSS JOIN LATERAL (SELECT (1 - (e.embedding <=> p_query_embedding))::real AS sim) s
    WHERE p_query_embedding IS NOT NULL
      AND e.embedding IS NOT NULL
      AND e.embedding_model IS NOT DISTINCT FROM p_embedding_model
      AND s.sim >= 0.25
  ),
  fused AS (
    -- Reciprocal rank fusion (k = 60)
    SELECT e.id,
      (COALESCE(1.0 / (60 + l.rnk), 0) + COALESCE(1.0 / (60 + s.rnk), 0))::real AS rrf,
      COALESCE(s.sim, 0)::real AS sim
    FROM eligible e
    LEFT JOIN lexical l ON l.id = e.id
    LEFT JOIN semantic s ON s.id = e.id
  ),
  scored AS (
    SELECT e.*,
      CASE WHEN v_signals = 0 THEN 0 ELSE LEAST(1.0, f.rrf / (v_signals / 61.0)) END::real AS rel,
      -- Recency: half-life of 30 days since the memory was last said or confirmed.
      power(0.5, EXTRACT(EPOCH FROM (now() - GREATEST(e.updated_at, COALESCE(e.last_confirmed_at, e.updated_at)))) / 86400.0 / 30.0)::real AS rec
    FROM eligible e
    JOIN fused f ON f.id = e.id
  ),
  blended AS (
    SELECT sc.*,
      (0.55 * sc.rel
        + 0.20 * (LEAST(GREATEST(sc.importance, 1), 10) / 10.0)
        + 0.15 * sc.rec
        + 0.10 * LEAST(sc.confidence, 1.0)
        + CASE WHEN sc.source IN ('user_stated', 'user_edited') THEN 0.05 ELSE 0 END
      )::real AS total
    FROM scored sc
  ),
  ranked AS (
    -- Threads get their own quota so they never crowd out facts.
    SELECT fi.*, row_number() OVER (PARTITION BY (fi.kind = 'thread') ORDER BY fi.total DESC) AS kind_rank
    FROM blended fi
  )
  SELECT r.id, r.kind, r.content, r.confidence, r.scope, r.companion_id,
    r.importance, r.source, r.created_at, r.updated_at, r.last_confirmed_at, r.confirm_count,
    r.rel AS relevance, r.total AS score
  FROM ranked r
  WHERE r.kind_rank <= CASE WHEN r.kind = 'thread' THEN 10 ELSE GREATEST(p_max_candidates, 1) END
  ORDER BY r.total DESC;

  -- Companion's prose summary (unchanged): newest active moment for this companion.
  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id,
    mi.importance, mi.source, mi.created_at, mi.updated_at, mi.last_confirmed_at, mi.confirm_count,
    0::real, 0::real
  FROM memory_items mi
  WHERE mi.user_id = v_uid
    AND mi.companion_id = p_companion_id
    AND mi.kind = 'moment'
    AND mi.status = 'active'
  ORDER BY mi.updated_at DESC
  LIMIT 1;
END;
$$;

-- 10. Grants ---------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION upsert_memory_item(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION supersede_memory_item(uuid, int, jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION update_memory_recall(uuid[], text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION fetch_memories_for_turn(uuid, uuid, text, int, text, vector, text, int) FROM anon, public;

GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION supersede_memory_item(uuid, int, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_memory_recall(uuid[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION fetch_memories_for_turn(uuid, uuid, text, int, text, vector, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION memory_normalize(text) TO authenticated, service_role;
