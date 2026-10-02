/*
# Create canonical memory_items store

## Purpose
Replaces the fragmented memory tables (user_insights.facts_learned,
companion_memories.memory_text, conversation_threads, relationship_memories)
with a single atomic, addressable, scoped row per memory. This is the
"memory as a file system" design from the roadmap.

## New Table: memory_items
One row per memory the system has about a user.

Columns:
- id (uuid PK)
- user_id (uuid, FK auth.users, NOT NULL) — owner
- companion_id (uuid, FK companions, nullable) — null = user-global
- scope (text) — 'global' = visible to all companions,
  'companion' = visible to the linked companion only,
  'private' = never shared across companions (e.g. romantic partner only)
- kind (text) — 'fact' | 'preference' | 'person' | 'thread' | 'moment' | 'boundary' | 'inside_joke'
- content (text) — the memory text
- status (text) — 'active' | 'superseded' | 'retired'
- superseded_by (uuid, FK memory_items, nullable) — points to the replacement row
- confidence (real, default 0.7) — 0..1 extraction confidence
- importance (int, default 5) — 1..10 user/system importance
- source (text) — 'user_stated' | 'inferred' | 'user_edited' | 'dream'
- source_message_ids (uuid[]) — conversation messages that produced this memory
- due_at (timestamptz, nullable) — for threads: when to follow up
- last_recalled_at (timestamptz, nullable) — last time injected into a turn
- recall_count (int, default 0) — how many turns this was injected into
- version (int, default 1) — optimistic concurrency + history tracking
- embedding (vector(1536), nullable) — for semantic search
- created_at, updated_at (timestamptz)

## Security
- RLS enabled.
- Users can SELECT their own rows (for the "What I remember" panel, item 11).
- No INSERT/UPDATE/DELETE policies for authenticated users — all writes
  go through the service role (edge functions) or SECURITY DEFINER RPCs
  (to be added in items 6–7). This prevents browser-side memory tampering.

## Indexes
- (user_id, companion_id, status) — primary query pattern
- (user_id, scope, status) — global memory queries
- (user_id, kind, status) — filtered by kind
- embedding vector_cosine_ops — semantic search (ivfflat)
- (due_at) WHERE status = 'active' — thread follow-up scheduler
*/

CREATE TABLE IF NOT EXISTS memory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'companion'
    CHECK (scope IN ('global', 'companion', 'private')),
  kind text NOT NULL
    CHECK (kind IN ('fact', 'preference', 'person', 'thread', 'moment', 'boundary', 'inside_joke')),
  content text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'retired')),
  superseded_by uuid REFERENCES memory_items(id) ON DELETE SET NULL,
  confidence real NOT NULL DEFAULT 0.7,
  importance int NOT NULL DEFAULT 5,
  source text NOT NULL DEFAULT 'inferred'
    CHECK (source IN ('user_stated', 'inferred', 'user_edited', 'dream')),
  source_message_ids uuid[] NOT NULL DEFAULT '{}',
  due_at timestamptz,
  last_recalled_at timestamptz,
  recall_count int NOT NULL DEFAULT 0,
  version int NOT NULL DEFAULT 1,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;

-- Users can read their own memory items (for the "What I remember" panel)
DROP POLICY IF EXISTS "select_own_memory_items" ON memory_items;
CREATE POLICY "select_own_memory_items"
  ON memory_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies: all writes via service role or RPCs.

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_memory_items_user_companion_status
  ON memory_items (user_id, companion_id, status);

CREATE INDEX IF NOT EXISTS idx_memory_items_user_scope_status
  ON memory_items (user_id, scope, status);

CREATE INDEX IF NOT EXISTS idx_memory_items_user_kind_status
  ON memory_items (user_id, kind, status);

CREATE INDEX IF NOT EXISTS idx_memory_items_due_active
  ON memory_items (due_at)
  WHERE status = 'active' AND due_at IS NOT NULL;

-- Vector index for semantic search (ivfflat with cosine distance)
CREATE INDEX IF NOT EXISTS idx_memory_items_embedding
  ON memory_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);