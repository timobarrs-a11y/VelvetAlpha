/*
# Add detect_session_dropoffs RPC for fleet dreaming

1. Purpose
- Detects sessions where the user dropped off within 3 turns of an assistant
  message. Used by the dream-fleet edge function as a signal source.

2. Function
- `detect_session_dropoffs(p_user_ids uuid[], p_since timestamptz) RETURNS TABLE`
- Uses the `conversations` table which stores individual messages with a
  `role` column ('user' or 'assistant').
- Finds conversations where the last 3+ messages are from the assistant.

3. Security
- SECURITY DEFINER, search_path = public
- EXECUTE granted to service_role only
*/

CREATE OR REPLACE FUNCTION detect_session_dropoffs(
  p_user_ids uuid[],
  p_since timestamptz
)
RETURNS TABLE (
  user_id uuid,
  companion_id uuid,
  conversation_id uuid,
  message_count bigint,
  relationship_type text,
  signature_voice text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked_messages AS (
    SELECT
      c.id AS message_id,
      c.user_id,
      c.companion_id,
      c.role,
      c.created_at,
      c.client_message_id
    FROM conversations c
    WHERE c.user_id = ANY(p_user_ids)
      AND c.created_at >= p_since
  ),
  -- Group by user+companion as a conversation proxy, find trailing assistant messages
  trailing_assistant AS (
    SELECT
      user_id,
      companion_id,
      COUNT(*) AS trailing_count,
      MAX(created_at) AS created_at
    FROM (
      SELECT
        user_id,
        companion_id,
        role,
        created_at,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, companion_id
          ORDER BY created_at DESC
        ) AS rn
      FROM ranked_messages
    ) ranked
    WHERE role = 'assistant'
      AND rn <= 3
    GROUP BY user_id, companion_id
    HAVING COUNT(*) >= 3
  )
  SELECT
    ta.user_id,
    ta.companion_id,
    NULL::uuid AS conversation_id,
    ta.trailing_count AS message_count,
    comp.relationship_type,
    comp.signature_voice,
    ta.created_at
  FROM trailing_assistant ta
  LEFT JOIN companions comp ON comp.id = ta.companion_id
  ORDER BY ta.created_at DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION detect_session_dropoffs(uuid[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION detect_session_dropoffs(uuid[], timestamptz) TO service_role;
