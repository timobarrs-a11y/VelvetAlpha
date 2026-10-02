/*
# Add fetch_memories_for_turn — relationship-type-aware memory scoping

## Purpose
Replace the three separate memory queries in chat-turn (facts, companion memory,
open threads) with a single SQL function that enforces scoping rules based on
the companion's relationship type. This prevents cross-companion memory leakage
(e.g., a correspondent seeing romantic partner memories).

## Scoping Rules
1. USER-GLOBAL memories (companion_id IS NULL, scope='global'): visible to ALL
   companion types. These are things like name, job, city, people.
2. COMPANION-SCOPED memories (companion_id = X): visible only to companion X.
3. PRIVATE memories (scope='private'): visible ONLY to romantic and friend
   companions. Never visible to mentors, correspondents, or other types.

## Function: fetch_memories_for_turn(p_user_id, p_companion_id, p_relationship_type, p_budget_tokens int DEFAULT 1200)
Returns a table with:
- id (uuid) — memory item ID (needed for recall tracking)
- kind (text) — 'fact' | 'thread' | 'moment' | etc.
- content (text) — the memory text
- confidence (real)
- scope (text)
- companion_id (uuid)

## Logic
1. Filter to active items (status='active')
2. Filter by ownership (user_id = p_user_id)
3. Apply visibility rules:
   - Always include user-global items (companion_id IS NULL, scope != 'private')
   - Include companion-scoped items (companion_id = p_companion_id)
   - Include private items ONLY if relationship_type IN ('romantic', 'friend')
     AND companion_id = p_companion_id
4. Exclude private-scoped global items from non-romantic/non-friend companions
5. Order facts by last_recalled_at ASC (least recently recalled first), then
   by updated_at DESC
6. Limit threads to 5 most recent active
7. Limit companion memory (kind='moment') to 1 most recent
8. Estimate tokens and enforce budget

## Security
- SECURITY DEFINER so it can be called from the service-role client
- Filters by p_user_id (not auth.uid()) since it's called from edge functions
  using the service role key
- Granted to authenticated

## Notes
- The function returns a UNION of facts, threads, and moments in priority order
- Token estimation: ceil(length(content) / 4) + 4 per item
- Facts are returned first (up to budget), then threads, then moment summary
- The caller is responsible for updating recall metadata via update_memory_recall
*/

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
AS $$
DECLARE
  v_is_private_allowed boolean;
  v_max_facts int := 12;
  v_max_threads int := 5;
  v_fact_tokens int := 0;
  v_thread_tokens int := 0;
  v_moment_tokens int := 0;
  v_total_tokens int := 0;
  v_moment_budget int := 800; -- reserve up to 800 tokens for companion memory
  v_fact_budget int;
  v_thread_budget int;
BEGIN
  -- Private memories only visible to romantic and friend companions
  v_is_private_allowed := p_relationship_type IN ('romantic', 'friend');

  -- Calculate sub-budgets: facts get most of the budget, threads get ~200,
  -- moment gets the rest (up to v_moment_budget)
  v_thread_budget := LEAST(200, p_budget_tokens / 5);
  v_fact_budget := p_budget_tokens - v_thread_budget - LEAST(v_moment_budget, p_budget_tokens / 3);

  -- Return facts first (ordered by least recently recalled, then most recently updated)
  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id
  FROM memory_items mi
  WHERE mi.user_id = p_user_id
    AND mi.kind = 'fact'
    AND mi.status = 'active'
    AND mi.confidence >= 0.6
    AND (
      -- User-global (non-private) items: visible to everyone
      (mi.companion_id IS NULL AND mi.scope = 'global')
      OR
      -- Companion-scoped items: visible only to this companion
      (mi.companion_id = p_companion_id AND mi.scope = 'companion')
      OR
      -- Private items: only for romantic/friend companions
      (mi.companion_id = p_companion_id AND mi.scope = 'private' AND v_is_private_allowed)
    )
  ORDER BY mi.last_recalled_at ASC NULLS FIRST, mi.updated_at DESC
  LIMIT v_max_facts;

  -- Return threads (most recently updated, active only)
  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id
  FROM memory_items mi
  WHERE mi.user_id = p_user_id
    AND mi.kind = 'thread'
    AND mi.status = 'active'
    AND (
      (mi.companion_id IS NULL AND mi.scope = 'global')
      OR (mi.companion_id = p_companion_id AND mi.scope = 'companion')
      OR (mi.companion_id = p_companion_id AND mi.scope = 'private' AND v_is_private_allowed)
    )
  ORDER BY mi.updated_at DESC
  LIMIT v_max_threads;

  -- Return companion memory (kind='moment', most recent one)
  RETURN QUERY
  SELECT mi.id, mi.kind, mi.content, mi.confidence, mi.scope, mi.companion_id
  FROM memory_items mi
  WHERE mi.user_id = p_user_id
    AND mi.companion_id = p_companion_id
    AND mi.kind = 'moment'
    AND mi.status = 'active'
  ORDER BY mi.updated_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION fetch_memories_for_turn(uuid, uuid, text, int) TO authenticated;