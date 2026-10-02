/*
# Backfill memory_items from legacy tables

## Purpose
Populates memory_items with existing data from four legacy stores.
Idempotent — uses NOT EXISTS guards so re-running is safe.

## Sources
1. user_insights.facts_learned → kind='fact', scope='companion'
2. conversation_threads (status='active') → kind='thread', scope='companion'
3. relationship_memories → kind='fact' or 'moment', scope='global' (no companion_id in source)
4. companion_memories.memory_text → kind='moment', scope='companion'

## Notes
- Old tables are NOT modified or dropped — they remain read-only.
- relationship_memories has no companion_id, so those rows are scope='global'.
*/

-- 1. Backfill facts from user_insights.facts_learned
INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, confidence, source, created_at, updated_at)
SELECT
  ui.user_id,
  ui.companion_id,
  'companion',
  'fact',
  f.fact,
  'active',
  LEAST(GREATEST(ui.confidence_score, 0.5), 1.0),
  CASE WHEN ui.confidence_score >= 0.8 THEN 'user_stated' ELSE 'inferred' END,
  ui.created_at,
  ui.updated_at
FROM user_insights ui,
     LATERAL jsonb_array_elements(ui.facts_learned) AS elem,
     LATERAL (SELECT (elem->>'fact') AS fact) f
WHERE f.fact IS NOT NULL AND f.fact != ''
  AND NOT EXISTS (
    SELECT 1 FROM memory_items mi
    WHERE mi.user_id = ui.user_id
      AND mi.companion_id = ui.companion_id
      AND mi.kind = 'fact'
      AND mi.content = f.fact
  );

-- 2. Backfill active conversation threads
INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, source, due_at, created_at, updated_at)
SELECT
  ct.user_id,
  ct.companion_id,
  'companion',
  'thread',
  COALESCE(ct.topic || ' — ' || ct.context_summary, ct.topic),
  'active',
  'inferred',
  ct.last_active + interval '21 days',
  COALESCE(ct.started_at, now()),
  COALESCE(ct.last_active, now())
FROM conversation_threads ct
WHERE ct.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM memory_items mi
    WHERE mi.user_id = ct.user_id
      AND mi.companion_id = ct.companion_id
      AND mi.kind = 'thread'
      AND mi.content LIKE ct.topic || '%'
  );

-- 3. Backfill relationship_memories (no companion_id → scope='global')
INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, confidence, importance, source, embedding, created_at, updated_at)
SELECT
  rm.user_id,
  NULL,
  'global',
  CASE WHEN rm.memory_type ILIKE '%moment%' OR rm.memory_type ILIKE '%event%' THEN 'moment' ELSE 'fact' END,
  rm.content,
  'active',
  0.7,
  LEAST(GREATEST(rm.importance_score, 1), 10),
  'inferred',
  rm.embedding,
  rm.created_at,
  rm.updated_at
FROM relationship_memories rm
WHERE rm.content IS NOT NULL AND rm.content != ''
  AND NOT EXISTS (
    SELECT 1 FROM memory_items mi
    WHERE mi.user_id = rm.user_id
      AND mi.content = rm.content
      AND mi.kind IN ('fact', 'moment')
  );

-- 4. Backfill companion_memories prose summaries (one row per companion)
INSERT INTO memory_items (user_id, companion_id, scope, kind, content, status, source, created_at, updated_at)
SELECT
  cm.user_id,
  cm.companion_id,
  'companion',
  'moment',
  cm.memory_text,
  'active',
  'inferred',
  cm.created_at,
  cm.updated_at
FROM companion_memories cm
WHERE cm.memory_text IS NOT NULL AND cm.memory_text != ''
  AND NOT EXISTS (
    SELECT 1 FROM memory_items mi
    WHERE mi.user_id = cm.user_id
      AND mi.companion_id = cm.companion_id
      AND mi.kind = 'moment'
  );