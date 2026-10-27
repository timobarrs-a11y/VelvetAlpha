/*
# Memory engine v3: calibrated relevance, real forgetting, write lockdown

Follows an independent review of v2 (see docs/memory-engine.md, "v3").

1. fetch_memories_for_turn: relevance is now an absolute score instead of a
   rank. Lexical = share of the memory's terms the message mentions (damped
   for single-word matches); semantic = cosine rescaled so 0.25 -> 0 and
   0.60 -> 1. With rank fusion every match scored as "relevant" no matter
   how weak, so the relevance gate did nothing.
2. upsert_memory_item:
   - an expired temporary memory no longer swallows a fresh statement of the
     same thing (it is retired and the new one inserted);
   - `durable: true` clears an old expiry when a temporary fact turns out to
     be lasting;
   - a partial unique index on the normalized text closes the duplicate
     insert race, and the RPC retries on conflict instead of failing.
3. forget_memory_item / clear_user_memory (service role only): forgetting
   scrubs the text everywhere it was copied: the row, its superseded
   predecessors, memory_history, memory_events payloads, memory_proposals
   and the companion summary built from it.
4. log_memory_history: hard-deleting a memory (account deletion cascade)
   purges its history instead of writing the content into history one more
   time.
5. retire_expired_memories (service role): fleet-wide expiry, so users who
   stopped chatting aren't sent check-ins built on stale temporary facts.
6. claim_unsummarized_messages (service role): atomic claim so concurrent
   summarize-memory runs can't process the same messages twice.
7. Write RPCs are no longer executable by `authenticated`: the browser goes
   through the memory-mutate edge function, which checks ownership.
*/

-- 1. Unique active text per (user, companion, kind) --------------------------

-- Self-heal: fold any active normalized duplicates into the oldest row first.
WITH ranked AS (
  SELECT id,
    first_value(id) OVER w AS keep_id,
    row_number() OVER w AS rn
  FROM memory_items
  WHERE status = 'active'
  WINDOW w AS (
    PARTITION BY user_id, COALESCE(companion_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, memory_normalize(content)
    ORDER BY created_at, id
  )
)
UPDATE memory_items mi
SET status = 'superseded', superseded_by = r.keep_id
FROM ranked r
WHERE mi.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_memory_items_active_text
  ON memory_items (user_id, COALESCE(companion_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, memory_normalize(content))
  WHERE status = 'active';

-- 2. History: a hard delete erases, it doesn't re-log ------------------------

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
  v_version int;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Rows are only hard-deleted when the account goes (FK cascade). Take
    -- the history with them rather than writing the content out again.
    DELETE FROM memory_history WHERE memory_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    -- Bookkeeping-only update (see increment_memory_version): not a new version.
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_version := NEW.version;
    v_before := to_jsonb(OLD) - 'embedding' - 'content_tsv';
    v_after := to_jsonb(NEW) - 'embedding' - 'content_tsv';
  ELSE
    v_version := NEW.version;
    v_before := NULL;
    v_after := to_jsonb(NEW) - 'embedding' - 'content_tsv';
  END IF;

  INSERT INTO memory_history (memory_id, version, op, before, after, actor_type, actor_id, triggering_session_id, triggering_message_id, proposal_id)
  VALUES (
    NEW.id, v_version, TG_OP, v_before, v_after, v_actor_type,
    CASE WHEN v_actor_id IS NOT NULL AND v_actor_id != '' THEN v_actor_id::uuid ELSE NULL END,
    CASE WHEN v_session_id IS NOT NULL AND v_session_id != '' THEN v_session_id::uuid ELSE NULL END,
    CASE WHEN v_message_id IS NOT NULL AND v_message_id != '' THEN v_message_id::uuid ELSE NULL END,
    CASE WHEN v_proposal_id IS NOT NULL AND v_proposal_id != '' THEN v_proposal_id::uuid ELSE NULL END
  );
  RETURN NEW;
END;
$$;

-- 3. upsert_memory_item ----------------------------------------------------

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
  v_durable boolean;
  v_actor_type text;
  v_source_message_ids uuid[];
  v_embedding vector;
  v_embedding_model text;
  v_evidence text;
  v_shared_origin uuid;
  v_existing_id uuid;
  v_result jsonb;
  v_attempt int := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    -- Service-role caller (anon and authenticated can't execute this)
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
  v_durable := COALESCE((p_payload->>'durable')::boolean, false);
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

  -- A temporary twin that has already expired is over; the new statement
  -- starts a fresh memory instead of reviving it.
  UPDATE memory_items
  SET status = 'retired'
  WHERE user_id = v_uid
    AND companion_id IS NOT DISTINCT FROM v_companion_id
    AND kind = v_kind
    AND status = 'active'
    AND valid_until IS NOT NULL AND valid_until <= now()
    AND memory_normalize(content) = memory_normalize(v_content);

  LOOP
    v_attempt := v_attempt + 1;

    SELECT id INTO v_existing_id
    FROM memory_items
    WHERE user_id = v_uid
      AND (companion_id IS NOT DISTINCT FROM v_companion_id)
      AND kind = v_kind
      AND status = 'active'
      AND memory_normalize(content) = memory_normalize(v_content)
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
          WHEN v_durable THEN NULL
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
      RETURN v_result;
    END IF;

    BEGIN
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
      RETURN v_result;
    EXCEPTION WHEN unique_violation THEN
      -- A concurrent writer inserted the same memory; reinforce theirs.
      IF v_attempt >= 3 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

-- 4. supersede_memory_item: survive the same race ----------------------------

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

  -- Free the old row's slot in the unique index before the replacement lands.
  UPDATE memory_items SET status = 'superseded' WHERE id = p_id;

  SELECT id INTO v_new_id
  FROM memory_items
  WHERE user_id = v_old.user_id
    AND companion_id IS NOT DISTINCT FROM v_old.companion_id
    AND kind = v_old.kind
    AND status = 'active'
    AND memory_normalize(content) = memory_normalize(v_content)
  LIMIT 1;

  IF v_new_id IS NULL THEN
    BEGIN
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
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_new_id
      FROM memory_items
      WHERE user_id = v_old.user_id
        AND companion_id IS NOT DISTINCT FROM v_old.companion_id
        AND kind = v_old.kind
        AND status = 'active'
        AND memory_normalize(content) = memory_normalize(v_content)
      LIMIT 1;
    END;
  END IF;

  UPDATE memory_items SET superseded_by = v_new_id WHERE id = p_id;

  SELECT to_jsonb(mi) - 'embedding' - 'content_tsv' INTO v_result FROM memory_items mi WHERE mi.id = v_new_id;
  RETURN v_result;
END;
$$;

-- 5. fetch_memories_for_turn: calibrated relevance ------------------------------

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
  v_qlex text[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    v_uid := p_user_id;
  END IF;

  v_is_private_allowed := p_relationship_type IN ('romantic', 'friend');

  -- The message's stemmed, stopword-free terms. "user" is in nearly every
  -- memory ("User likes..."), so it never counts as a match.
  IF p_query_text IS NOT NULL AND btrim(p_query_text) <> '' THEN
    SELECT array_agg(lex) INTO v_qlex
    FROM unnest(tsvector_to_array(to_tsvector('english', left(p_query_text, 2000)))) AS lex
    WHERE lex <> 'user';
  END IF;

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
  terms AS (
    SELECT e.id,
      count(*) FILTER (WHERE l <> 'user') AS n_terms,
      count(*) FILTER (WHERE l <> 'user' AND l = ANY(v_qlex)) AS n_hit
    FROM eligible e
    CROSS JOIN LATERAL unnest(tsvector_to_array(e.content_tsv)) AS l
    WHERE v_qlex IS NOT NULL
    GROUP BY e.id
  ),
  signals AS (
    SELECT e.id,
      -- Share of the memory's terms the message mentions; one shared word is
      -- only half-credit so "love" alone doesn't make "loves spicy ramen" relevant.
      COALESCE(t.n_hit::real / GREATEST(t.n_terms, 1) * LEAST(1.0, t.n_hit / 2.0), 0)::real AS lex,
      CASE
        WHEN p_query_embedding IS NULL OR e.embedding IS NULL
          OR e.embedding_model IS DISTINCT FROM p_embedding_model THEN 0
        ELSE LEAST(1.0, GREATEST(0.0, ((1 - (e.embedding <=> p_query_embedding)) - 0.25) / 0.35))
      END::real AS sem
    FROM eligible e
    LEFT JOIN terms t ON t.id = e.id
  ),
  scored AS (
    SELECT e.*,
      LEAST(1.0, GREATEST(s.lex, s.sem) + 0.25 * LEAST(s.lex, s.sem))::real AS rel,
      -- Recency: half-life of 30 days since the memory was last said or confirmed.
      power(0.5, EXTRACT(EPOCH FROM (now() - GREATEST(e.updated_at, COALESCE(e.last_confirmed_at, e.updated_at)))) / 86400.0 / 30.0)::real AS rec
    FROM eligible e
    JOIN signals s ON s.id = e.id
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

  -- Companion's prose summary: newest active moment for this companion.
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

-- 6. Forgetting ----------------------------------------------------------------

-- Scrub the text of these memories from every place it was copied, and
-- reset the companion summaries that were written from them.
CREATE OR REPLACE FUNCTION scrub_memory_items(p_user_id uuid, p_ids uuid[], p_label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_all_companions boolean;
  v_companions uuid[];
BEGIN
  EXECUTE format('SET LOCAL app.actor_type = %L', 'user');
  EXECUTE format('SET LOCAL app.actor_id = %L', p_user_id::text);

  -- The memories plus every earlier version they replaced.
  WITH RECURSIVE chain AS (
    SELECT mi.id FROM memory_items mi WHERE mi.id = ANY(p_ids) AND mi.user_id = p_user_id
    UNION
    SELECT mi.id FROM memory_items mi JOIN chain c ON mi.superseded_by = c.id WHERE mi.user_id = p_user_id
  )
  SELECT array_agg(id) INTO v_ids FROM chain;

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  -- Summaries were written from these memories; reset the affected ones.
  SELECT bool_or(mi.companion_id IS NULL), array_agg(DISTINCT mi.companion_id) FILTER (WHERE mi.companion_id IS NOT NULL)
  INTO v_all_companions, v_companions
  FROM memory_items mi WHERE mi.id = ANY(v_ids);

  UPDATE memory_items
  SET status = CASE WHEN status = 'active' THEN 'retired' ELSE status END,
      content = p_label, evidence = NULL, embedding = NULL, embedding_model = NULL,
      source_message_ids = '{}'
  WHERE id = ANY(v_ids) AND content IS DISTINCT FROM p_label;

  UPDATE memory_items
  SET status = 'retired', content = p_label, evidence = NULL, embedding = NULL, embedding_model = NULL
  WHERE user_id = p_user_id AND kind = 'moment' AND content IS DISTINCT FROM p_label
    AND (v_all_companions OR companion_id = ANY(v_companions));

  DELETE FROM companion_memories
  WHERE user_id = p_user_id AND (v_all_companions OR companion_id = ANY(v_companions));

  -- History, including the rows the updates above just wrote.
  UPDATE memory_history h
  SET before = CASE WHEN h.before IS NULL THEN NULL ELSE h.before || jsonb_build_object('content', p_label, 'evidence', NULL) END,
      after = CASE WHEN h.after IS NULL THEN NULL ELSE h.after || jsonb_build_object('content', p_label, 'evidence', NULL) END
  WHERE h.memory_id IN (
    SELECT mi.id FROM memory_items mi
    WHERE mi.user_id = p_user_id
      AND (mi.id = ANY(v_ids) OR (mi.kind = 'moment' AND (v_all_companions OR mi.companion_id = ANY(v_companions))))
  );

  UPDATE memory_events SET payload = '{}'::jsonb
  WHERE user_id = p_user_id AND memory_item_id = ANY(v_ids);

  UPDATE memory_proposals SET before = p_label, after = NULL
  WHERE user_id = p_user_id AND target_id = ANY(SELECT unnest(v_ids)::text);
END;
$$;

CREATE OR REPLACE FUNCTION forget_memory_item(p_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM memory_items WHERE id = p_id AND user_id = p_user_id) THEN
    RETURN false;
  END IF;
  PERFORM scrub_memory_items(p_user_id, ARRAY[p_id], '[forgotten by user]');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION clear_user_memory(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- Every summary and the legacy fact list go too, even for companions with
  -- no memory_items rows yet.
  DELETE FROM companion_memories WHERE user_id = p_user_id;
  UPDATE user_insights SET facts_learned = '[]'::jsonb WHERE user_id = p_user_id;

  SELECT array_agg(id) INTO v_ids FROM memory_items WHERE user_id = p_user_id;
  IF v_ids IS NULL THEN
    RETURN 0;
  END IF;
  PERFORM scrub_memory_items(p_user_id, v_ids, '[cleared by user]');
  RETURN array_length(v_ids, 1);
END;
$$;

-- 7. Fleet-wide expiry --------------------------------------------------------------

CREATE OR REPLACE FUNCTION retire_expired_memories()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  EXECUTE format('SET LOCAL app.actor_type = %L', 'dream');
  UPDATE memory_items SET status = 'retired'
  WHERE status = 'active' AND valid_until IS NOT NULL AND valid_until <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 8. Atomic summarization claim -------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_unsummarized_messages(
  p_user_id uuid,
  p_companion_id uuid,
  p_min int DEFAULT 50,
  p_max int DEFAULT 100
)
RETURNS TABLE (id uuid, role text, content text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(c.id ORDER BY c.created_at) INTO v_ids
  FROM (
    SELECT cv.id, cv.created_at
    FROM conversations cv
    WHERE cv.user_id = p_user_id AND cv.companion_id = p_companion_id AND cv.summarized = false
    ORDER BY cv.created_at
    LIMIT p_max
    FOR UPDATE SKIP LOCKED
  ) c;

  IF COALESCE(array_length(v_ids, 1), 0) < p_min THEN
    RETURN;
  END IF;

  UPDATE conversations SET summarized = true WHERE conversations.id = ANY(v_ids);

  RETURN QUERY
  SELECT cv.id, cv.role, cv.content, cv.created_at
  FROM conversations cv WHERE cv.id = ANY(v_ids)
  ORDER BY cv.created_at;
END;
$$;

-- 9. Grants ------------------------------------------------------------------------------

-- Browsers write memory only through memory-mutate (which checks ownership).
REVOKE EXECUTE ON FUNCTION upsert_memory_item(jsonb) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION supersede_memory_item(uuid, int, jsonb, text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION update_memory_recall(uuid[], text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION scrub_memory_items(uuid, uuid[], text) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION forget_memory_item(uuid, uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION clear_user_memory(uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION retire_expired_memories() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION claim_unsummarized_messages(uuid, uuid, int, int) FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION upsert_memory_item(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION supersede_memory_item(uuid, int, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION update_memory_item(uuid, int, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION update_memory_recall(uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION scrub_memory_items(uuid, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION forget_memory_item(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION clear_user_memory(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION retire_expired_memories() TO service_role;
GRANT EXECUTE ON FUNCTION claim_unsummarized_messages(uuid, uuid, int, int) TO service_role;
