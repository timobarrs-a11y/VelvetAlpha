-- Regression tests for supabase/migrations/20261030100000_memory_engine_v2.sql
--
-- Runs against a scratch Postgres (16+) with pgvector, never a real project:
--   psql -d scratch -v ON_ERROR_STOP=1 -f scripts/memory-eval/memory_engine_v2.test.sql
-- The preamble stubs the bits of Supabase the memory migrations need, applies
-- them in order, then asserts. Any failed assertion raises and stops the run.

\set ON_ERROR_STOP 1
\set QUIET 1

-- Supabase stubs -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
-- auth.uid() reads a test setting; unset = service-role caller.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE IF NOT EXISTS companions (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS user_profiles (id uuid PRIMARY KEY, is_super_user boolean DEFAULT false);

-- Migrations under test --------------------------------------------------------
\ir ../../supabase/migrations/20261002184116_20261002200000_create_memory_items_store.sql.sql
\ir ../../supabase/migrations/20261002184657_20261002202000_add_memory_history_and_versioning.sql.sql
\ir ../../supabase/migrations/20261002184728_20261002202500_fix_memory_history_fk.sql.sql
\ir ../../supabase/migrations/20261002203706_20261002220000_fix_memory_rpc_security.sql.sql
\ir ../../supabase/migrations/20261002203741_20261002221000_add_service_role_fallback_to_memory_rpcs.sql.sql
ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS shared_origin_companion_id uuid REFERENCES companions(id) ON DELETE SET NULL;
\ir ../../supabase/migrations/20261030100000_memory_engine_v2.sql
-- Idempotent: applying twice must not fail.
\ir ../../supabase/migrations/20261030100000_memory_engine_v2.sql

-- Fixtures ---------------------------------------------------------------------
INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');
INSERT INTO companions VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

CREATE OR REPLACE FUNCTION pg_temp.add(p_content text, p_extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql AS $$
  SELECT upsert_memory_item(jsonb_build_object(
    'user_id', '11111111-1111-1111-1111-111111111111',
    'companion_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'kind', 'fact', 'content', p_content) || p_extra);
$$;

CREATE OR REPLACE FUNCTION pg_temp.check(p_ok boolean, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %', p_what; END IF;
  RAISE NOTICE 'ok - %', p_what;
END $$;

\set QUIET 0

-- Dedup and reinforcement --------------------------------------------------------
SELECT pg_temp.add('User is an author');
SELECT pg_temp.add('user is an AUTHOR.', '{"confidence": 0.5}');
SELECT pg_temp.check((SELECT count(*) FROM memory_items) = 1, 'case/punctuation variants dedupe to one row');
SELECT pg_temp.check((SELECT confirm_count FROM memory_items) = 2, 're-observing a memory confirms it');
SELECT pg_temp.check((SELECT abs(confidence - 0.7) < 1e-6 FROM memory_items), 're-observing never lowers confidence');
SELECT pg_temp.check((SELECT count(*) FROM memory_history) = 1, 'confirmation is not a new version');

SELECT pg_temp.add(c) FROM unnest(ARRAY[
  'User has a dog named Biscuit', 'User works as a nurse at the hospital', 'User loves spicy ramen',
  'User lives in Denver', 'User prefers mornings', 'User plays guitar', 'User hates cilantro',
  'User drives a blue Subaru', 'User studied biology', 'User is allergic to cats', 'User reads mystery novels',
  'User sister is named Clara', 'User is training for a marathon in March']) c;
SELECT pg_temp.add('User has a girl over tonight', '{"valid_until": "2000-01-01T00:00:00Z"}');
SELECT pg_temp.add('User private marathon fear', '{"scope": "private"}');
SELECT pg_temp.add('User told B about a marathon secret', '{"companion_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}');
SELECT upsert_memory_item('{"user_id":"11111111-1111-1111-1111-111111111111","scope":"global","kind":"fact","content":"User got a new job as a marathon coach"}');

-- Recall tracking (service role) -------------------------------------------------
SELECT update_memory_recall(ARRAY(SELECT id FROM memory_items WHERE content LIKE '%Biscuit%'));
SELECT pg_temp.check((SELECT recall_count = 1 AND version = 1 FROM memory_items WHERE content LIKE '%Biscuit%'),
  'service-role recall is recorded without bumping version');

-- Retrieval --------------------------------------------------------------------
SELECT pg_temp.check((
  SELECT content FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'how is the marathon training going?') LIMIT 1
) = 'User is training for a marathon in March', 'the relevant fact ranks first even when it was stored last of 13');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'girl')
  WHERE content LIKE '%girl over%'), 'expired temporary memories are not retrieved');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'marathon secret')
  WHERE content LIKE '%told B%'), 'another companion''s memories do not leak');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mentor', 1200, 'marathon fear')
  WHERE content LIKE '%private%'), 'private memories are hidden from mentors');
SELECT pg_temp.check(EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mentor', 1200, 'job')
  WHERE content LIKE '%marathon coach%'), 'global memories reach every companion');
SELECT pg_temp.check((SELECT count(*) FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'and the of it''s')) > 0,
  'a stopword-only message still returns background memories');

-- Supersession -------------------------------------------------------------------
SELECT supersede_memory_item(id, version, '{"content": "User reads the Ice Cream Social series but is not its author"}', 'user')
FROM memory_items WHERE content = 'User is an author';
SELECT pg_temp.check((SELECT status = 'superseded' AND superseded_by IS NOT NULL FROM memory_items WHERE content = 'User is an author'),
  'a corrected memory is kept as superseded history');
SELECT pg_temp.check((SELECT status = 'active' AND source = 'user_stated' FROM memory_items WHERE content LIKE '%not its author'),
  'the correction is a new active, user-stated row');
SELECT pg_temp.check((SELECT supersede_memory_item(id, version - 1, '{"content": "x"}') IS NULL FROM memory_items WHERE content LIKE '%Denver%'),
  'a stale base_version is a conflict (NULL), not a write');
SELECT supersede_memory_item(id, version, '{"content": "User plays GUITAR!"}') FROM memory_items WHERE content = 'User prefers mornings';
SELECT pg_temp.check((SELECT count(*) FROM memory_items WHERE status = 'active' AND content ILIKE '%guitar%') = 1,
  'superseding into existing text points at that row instead of duplicating it');

-- Embedding hygiene ------------------------------------------------------------------
UPDATE memory_items SET embedding = array_fill(0.1, ARRAY[1536])::vector, embedding_model = 'm1' WHERE content LIKE '%Denver%';
SELECT pg_temp.check((SELECT version = 1 FROM memory_items WHERE content LIKE '%Denver%'), 'adding an embedding is not a new version');
SELECT update_memory_item(id, version, '{"content": "User lives in Boulder", "source": "user_edited"}', 'user') FROM memory_items WHERE content LIKE '%Denver%';
SELECT pg_temp.check((SELECT embedding IS NULL AND source = 'user_edited' AND version = 2 FROM memory_items WHERE content LIKE '%Boulder%'),
  'editing content clears the stale embedding');
SELECT pg_temp.add('User is vegan', '{"evidence": "I am vegan"}');
SELECT update_memory_item(id, version, '{"content": "[forgotten by user]", "status": "retired"}', 'user') FROM memory_items WHERE content = 'User is vegan';
SELECT pg_temp.check((SELECT evidence IS NULL FROM memory_items WHERE content = '[forgotten by user]'),
  'forgetting a memory also drops the user''s quoted words');

UPDATE memory_items SET embedding = array_fill(0.1, ARRAY[1536])::vector, embedding_model = 'm1' WHERE content LIKE '%Biscuit%';
SELECT pg_temp.check((
  SELECT content FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'puppy', array_fill(0.1, ARRAY[1536])::vector, 'm1') LIMIT 1
) LIKE '%Biscuit%', 'vector search finds a memory with no shared words');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'puppy', array_fill(0.1, ARRAY[1536])::vector, 'm2')
  WHERE relevance > 0), 'vectors from a different embedding model are never compared');

-- Authorization ------------------------------------------------------------------------
SET test.uid = '22222222-2222-2222-2222-222222222222';
SELECT pg_temp.check((SELECT count(*) FROM fetch_memories_for_turn('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'romantic', 1200, 'marathon')) = 0,
  'a signed-in user cannot read another user''s memories');
DO $$
BEGIN
  PERFORM supersede_memory_item(id, version, '{"content": "hacked"}') FROM memory_items WHERE content LIKE '%Biscuit%';
  RAISE EXCEPTION 'FAILED: cross-user supersede was allowed';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FAILED%' THEN RAISE; END IF;
  RAISE NOTICE 'ok - a signed-in user cannot supersede another user''s memory';
END $$;
SELECT update_memory_recall(ARRAY(SELECT id FROM memory_items));
RESET test.uid;
SELECT pg_temp.check((SELECT recall_count = 1 FROM memory_items WHERE content LIKE '%Biscuit%'),
  'a signed-in user cannot touch another user''s recall stats');

\echo 'memory_engine_v2: all checks passed'
