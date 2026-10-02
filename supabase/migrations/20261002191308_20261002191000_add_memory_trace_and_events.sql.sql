/*
# Add memory_turn_trace and memory_events tables

1. New Tables
- `memory_turn_trace`: Records which memory_item IDs were injected into each
  conversation turn, plus token count. One row per chat-turn call. This is the
  telemetry that makes "trace a bad recall to its source" possible.
- `memory_events`: Records discrete memory-related events — corrections
  (user says a remembered fact is wrong), references (assistant used an
  injected memory and user engaged/deflected), and thread closures.
  These feed the dreaming passes (items 13-16).

2. Columns
- memory_turn_trace:
  - id (uuid PK)
  - user_id (uuid, FK auth.users, NOT NULL)
  - companion_id (uuid, NOT NULL)
  - message_id (uuid, nullable — the conversation row ID of the user's message)
  - injected_memory_ids (uuid[] — memory_item IDs injected into this turn)
  - token_count (int — estimated tokens of memory injected)
  - created_at (timestamptz, default now())
- memory_events:
  - id (uuid PK)
  - user_id (uuid, FK auth.users, NOT NULL)
  - companion_id (uuid, NOT NULL)
  - memory_item_id (uuid, nullable — the memory_item this event concerns)
  - message_id (uuid, nullable — the conversation row ID)
  - event_type (text — 'correction' | 'reference' | 'thread_closed' | 'thread_auto_retired')
  - payload (jsonb — event-specific data: corrected_content, engagement, etc.)
  - created_at (timestamptz, default now())

3. Security
- RLS enabled on both tables.
- Users can SELECT their own rows (for the "What I Remember" panel).
- All writes via service role only (from chat-turn edge function).
- No INSERT/UPDATE/DELETE policies for authenticated — service role bypasses RLS.

4. Indexes
- memory_turn_trace: user_id + companion_id + created_at DESC
- memory_events: user_id + companion_id + created_at DESC
- memory_events: memory_item_id (for dreaming pass lookups)
*/

CREATE TABLE IF NOT EXISTS memory_turn_trace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL,
  message_id uuid,
  injected_memory_ids uuid[] DEFAULT '{}',
  token_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE memory_turn_trace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_traces" ON memory_turn_trace;
CREATE POLICY "select_own_traces"
ON memory_turn_trace FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_memory_turn_trace_user_companion
ON memory_turn_trace (user_id, companion_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL,
  memory_item_id uuid,
  message_id uuid,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE memory_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_events" ON memory_events;
CREATE POLICY "select_own_events"
ON memory_events FOR SELECT
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_memory_events_user_companion
ON memory_events (user_id, companion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_events_item
ON memory_events (memory_item_id)
WHERE memory_item_id IS NOT NULL;
